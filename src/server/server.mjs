/**
 * HermesOps 后端桥接服务 (v3 — 结构化事件 + PTY 终端)
 * --------------------------------------------------------------------------
 * 端点：
 *   POST /api/chat       { instance_id, message, enhanced } → SSE 结构化流
 *   GET  /api/health     → 服务状态
 *   GET  /api/instances  → 实例注册表
 *   GET  /api/snapshot   → projects/*.json 任务快照
 *   WS   /ws/terminal    → 交互式 PTY 终端（xterm.js 双向桥接）
 *
 * 终端模式（mode 字段）：
 *   raw       → 纯 bash，不启动 AI CLI
 *   minimal   → AI CLI + --tools "" --effort minimal（省用，~3.6k token）
 *   enhanced  → AI CLI + --tools Read,Edit,Bash --effort low（增强，~16k token）
 *   native    → AI CLI 原生默认参数（用户完全自由）
 *   resume    → AI CLI + --continue（续接上次会话，长时记忆）
 * --------------------------------------------------------------------------
 */
import http from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { WebSocketServer } from 'ws'
import pty from 'node-pty'

const PORT = Number(process.env.PORT) || 3001
const HOST = '127.0.0.1'
const HOME = process.env.HOME || '/home/cybot'

/* ---- 实例注册表 ----
 * json: true 表示该工具支持结构化 JSON 事件流
 *   - codebuddy/claude/qodercli: Anthropic 风格 stream-json NDJSON
 *   - mimo: 自有 --format json 事件流（step_start/text/tool_use/step_finish）
 *
 * Token 省用策略（"非必要不启用"原则）：
 *   默认（省用模式）: --tools "" --effort minimal --system-prompt <极简>
 *     → 仅纯对话，无工具无思考，~3.6k tokens/次
 *   增强模式 (enhanced=true): --tools "Read,Edit,Bash,Glob,Grep" --effort low
 *     → 启用文件/命令工具，~18k tokens/次
 */
const MINIMAL_PROMPT = '简洁回答'
const ENHANCED_TOOLS = 'Read,Edit,Bash,Glob,Grep'

function buildArgs(tool, message, enhanced) {
  return tool.args(message, enhanced)
}

const TOOLS = {
  '01_codebuddy':      {
    cmd: 'codebuddy',
    args: (m, enh) => enh
      ? ['-p', m, '--output-format', 'stream-json', '--tools', ENHANCED_TOOLS, '--system-prompt', MINIMAL_PROMPT, '--effort', 'low']
      : ['-p', m, '--output-format', 'stream-json', '--tools', '', '--system-prompt', MINIMAL_PROMPT, '--effort', 'minimal'],
    json: 'anthropic',
  },
  '02_qoder':          {
    cmd: 'qodercli',
    args: (m, enh) => enh
      ? ['-p', m, '--output-format', 'stream-json', '--tools', ENHANCED_TOOLS, '--system-prompt', MINIMAL_PROMPT, '--effort', 'low']
      : ['-p', m, '--output-format', 'stream-json', '--tools', '', '--system-prompt', MINIMAL_PROMPT, '--effort', 'minimal'],
    json: 'anthropic',
  },
  '03_trae':           { cmd: 'Trae',      args: null, reason: 'TRAE 是桌面 IDE，无 CLI 非交互模式。请在 IDE 内使用其面板。' },
  '04_cursor':         { cmd: 'cursor',    args: null, reason: 'Cursor 是桌面编辑器，无 CLI prompt 模式。' },
  '05_opencode':       { cmd: 'opencode',  args: (m) => ['run', m], json: false },
  '06_github_copilot': { cmd: 'copilot',   args: null, reason: 'GitHub Copilot CLI 仅支持交互式，不支持一次性 prompt。' },
  '07_claude_code':    {
    cmd: 'claude',
    args: (m, enh) => enh
      ? ['-p', m, '--output-format', 'stream-json', '--allowedTools', 'Read', 'Edit', 'Bash', '--system-prompt', MINIMAL_PROMPT, '--effort', 'low']
      : ['-p', m, '--output-format', 'stream-json', '--allowedTools', '', '--system-prompt', MINIMAL_PROMPT, '--effort', 'minimal'],
    json: 'anthropic',
  },
  '08_codex':          { cmd: 'codex',     args: (m) => ['exec', m], json: false },
  '09_qwen_code':      { cmd: 'qwen',      args: (m) => [m], json: false },
  '10_windsurf':       { cmd: 'windsurf',  args: null, reason: 'Windsurf 未安装或仅桌面端。' },
  '11_codegeex':       { cmd: 'codegeex',  args: null, reason: 'CodeGeeX 是 IDE 插件，无独立 CLI prompt。' },
  '12_mimo_code':      { cmd: 'mimo',      args: (m) => ['run', m, '--format', 'json'], json: 'mimo' },
  '13_hermes':         { cmd: 'hermes',    args: (m) => ['-z', m], json: false },
}
const ALLOWED = new Set(Object.keys(TOOLS))

/* ---- 工具函数 ---- */
const readBody = (req) => new Promise((resolve) => {
  let buf = ''
  req.on('data', (c) => { buf += c; if (buf.length > 1 << 20) req.destroy() })
  req.on('end', () => resolve(buf))
  req.on('error', () => resolve(''))
})

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')

/* ---- stream-json NDJSON 解析器（Anthropic 风格：codebuddy/claude/qodercli） ----
 * 把 NDJSON 事件转成前端友好的 SSE 事件。
 * 跟踪 thinking 起始时间，在下一个非 thinking 事件时计算耗时。
 */
function createAnthropicParser(sse) {
  let lineBuf = ''
  let thinkingStart = null
  let thinkingText = ''

  function flushThinking() {
    if (thinkingText) {
      const dur = thinkingStart ? Math.round((Date.now() - thinkingStart) / 1000) : 0
      sse({ type: 'thinking', text: thinkingText, duration_s: dur })
    }
    thinkingText = ''
    thinkingStart = null
  }

  function handleLine(line) {
    if (!line.trim()) return
    let evt
    try { evt = JSON.parse(line) } catch { return }

    const t = evt.type
    if (t === 'assistant') {
      const content = evt.message?.content || []
      for (const block of content) {
        if (block.type === 'thinking') {
          if (!thinkingStart) thinkingStart = Date.now()
          thinkingText += block.thinking || ''
        } else {
          flushThinking()
          if (block.type === 'text') {
            sse({ type: 'text', text: block.text || '' })
          } else if (block.type === 'tool_use') {
            sse({ type: 'tool_use', tool: block.name, tool_use_id: block.id, input: block.input || {} })
          }
        }
      }
    } else if (t === 'user') {
      const content = evt.message?.content || []
      for (const block of content) {
        if (block.type === 'tool_result') {
          flushThinking()
          let resultText = ''
          if (typeof block.content === 'string') resultText = block.content
          else if (Array.isArray(block.content)) resultText = block.content.map(c => c.text || '').join('\n')
          sse({ type: 'tool_result', tool_use_id: block.tool_use_id, content: stripAnsi(resultText).slice(0, 8000), is_error: !!block.is_error })
        }
      }
    } else if (t === 'result') {
      flushThinking()
      sse({ type: 'result', usage: evt.usage || {}, cost_usd: evt.total_cost_usd ?? 0, duration_ms: evt.duration_ms ?? 0, is_error: evt.is_error, result_text: evt.result || '' })
    }
  }

  return {
    feed(chunk) {
      lineBuf += chunk.toString()
      const lines = lineBuf.split('\n')
      lineBuf = lines.pop() ?? ''
      for (const line of lines) handleLine(line)
    },
    end() { if (lineBuf.trim()) handleLine(lineBuf); flushThinking() },
  }
}

/* ---- mimo JSON 解析器（自有格式：step_start/text/tool_use/step_finish） ----
 * mimo 不提供 token 计量，但支持 text + tool_use 事件。
 */
function createMimoParser(sse) {
  let lineBuf = ''
  function handleLine(line) {
    if (!line.trim()) return
    let evt
    try { evt = JSON.parse(line) } catch { return }
    const t = evt.type
    const part = evt.part || {}
    if (t === 'text') {
      const text = part.text || ''
      if (text) sse({ type: 'text', text })
    } else if (t === 'tool_use') {
      const tool = part.tool || 'unknown'
      const input = part.input || {}
      // mimo 的 tool_use 状态: completed/failed
      const status = part.state?.status
      if (status === 'completed' || status === 'failed') {
        // 这是 tool_result
        sse({
          type: 'tool_result',
          tool_use_id: part.callID,
          content: stripAnsi(typeof part.state?.output === 'string' ? part.state.output : JSON.stringify(part.state?.output || '')).slice(0, 8000),
          is_error: status === 'failed',
        })
      } else {
        sse({ type: 'tool_use', tool, tool_use_id: part.callID, input })
      }
    }
    // step_start / step_finish 不转发
  }
  return {
    feed(chunk) {
      lineBuf += chunk.toString()
      const lines = lineBuf.split('\n')
      lineBuf = lines.pop() ?? ''
      for (const line of lines) handleLine(line)
    },
    end() { if (lineBuf.trim()) handleLine(lineBuf) },
  }
}

function createJsonParser(sse, dialect) {
  if (dialect === 'mimo') return createMimoParser(sse)
  return createAnthropicParser(sse)
}

/* ---- POST /api/chat : SSE 流式桥接 ---- */
async function handleChat(req, res) {
  const raw = await readBody(req)
  let payload
  try { payload = JSON.parse(raw || '{}') } catch { return send(res, 400, { error: 'invalid JSON' }) }

  const { instance_id, message, enhanced } = payload
  if (!instance_id || !ALLOWED.has(instance_id)) {
    return send(res, 400, { error: `unknown instance_id: ${instance_id}` })
  }
  if (typeof message !== 'string' || !message.trim()) {
    return send(res, 400, { error: 'message required' })
  }

  const tool = TOOLS[instance_id]
  const cmd = tool.cmd
  const isEnhanced = !!enhanced

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  const sse = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`)
  sse({ type: 'meta', cmd, instance_id, structured: tool.json || false, enhanced: isEnhanced, ts: Date.now() })

  // 1) 不支持非交互模式
  if (!tool.args) {
    sse({ type: 'error', text: `⚠ ${tool.reason || '该工具不支持 CLI 非交互模式'}` })
    sse({ type: 'done', code: -1 })
    return res.end()
  }

  // 2) 未安装
  const probe = spawnSync('command', ['-v', cmd], { shell: true })
  if (probe.status !== 0) {
    sse({ type: 'error', text: `✗ 未检测到 ${cmd} 命令，请先安装（core/plugins/${instance_id}.sh）` })
    sse({ type: 'done', code: -1 })
    return res.end()
  }

  const args = tool.args(message, isEnhanced)
  let child
  try {
    child = spawn(cmd, args, {
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      cwd: process.env.START_DIR || process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    sse({ type: 'error', text: `无法启动 ${cmd}: ${e.message}` })
    sse({ type: 'done', code: -1 })
    return res.end()
  }

  const timer = setTimeout(() => {
    child.kill('SIGTERM')
    sse({ type: 'error', text: '⏱ 超时（5min），已终止' })
    res.end()
  }, 5 * 60 * 1000)

  const jsonParser = tool.json ? createJsonParser(sse, tool.json) : null
  let stdoutBuf = ''
  let stderrBuf = ''

  child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString()
    if (jsonParser) {
      jsonParser.feed(chunk)
    } else {
      sse({ type: 'delta', text: chunk.toString() })
    }
  })
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    stderrBuf += text
    // 结构化工具的 stderr 多为日志噪声，不转发；非结构化工具保留
    if (!tool.json) sse({ type: 'stderr', text })
  })

  child.on('error', (e) => {
    clearTimeout(timer)
    sse({ type: 'error', text: `进程错误: ${e.message}` })
    res.end()
  })

  child.on('close', (code) => {
    clearTimeout(timer)
    if (jsonParser) jsonParser.end()

    // Fallback：stdout 完全为空时，用 stderr 兜底
    if (!stdoutBuf.trim() && stderrBuf.trim()) {
      const clean = stripAnsi(stderrBuf).trim()
      sse({ type: 'error', text: clean })
    } else if (code !== 0 && !stdoutBuf.trim() && !stderrBuf.trim()) {
      sse({ type: 'error', text: `${cmd} 退出码 ${code}（可能未登录/未配置 API Key）` })
    }
    sse({ type: 'done', code })
    res.end()
  })
}

/* ---- GET /api/snapshot : 读取 projects/*.json 任务快照 ---- */
function handleSnapshot(res) {
  const dir = join(HOME, '.hermesops', 'projects')
  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    const snapshots = files.map(f => {
      try {
        const data = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
        return { file: f, ...data }
      } catch { return null }
    }).filter(Boolean)
    send(res, 200, { snapshots })
  } catch (e) {
    send(res, 200, { snapshots: [], error: e.message })
  }
}

/* ---- 工作目录解析 ---- */
function getCwd(query) {
  const dir = query.get('dir')
  if (dir && /^[\w./-]+$/.test(dir)) {
    // 防路径穿越：只允许字母数字 / . _ -
    const resolved = join(process.env.HOME || '/home', dir)
    return resolved
  }
  return process.env.START_DIR || process.cwd()
}

/* ---- GET /api/files : 文件树 ---- */
async function handleFiles(req, res, url) {
  const dir = getCwd(url.searchParams)
  const { readdirSync, statSync } = await import('node:fs')
  const ignore = new Set(['node_modules', '.git', 'dist', '.DS_Store', '__pycache__'])
  function walk(d, depth = 0) {
    if (depth > 3) return []
    let items
    try { items = readdirSync(d) } catch { return [] }
    return items
      .filter(n => !ignore.has(n) && !n.startsWith('.'))
      .map(n => {
        const p = join(d, n)
        let stat
        try { stat = statSync(p) } catch { return null }
        if (stat.isDirectory()) {
          return { name: n, path: p, type: 'dir', children: walk(p, depth + 1) }
        }
        return { name: n, path: p, type: 'file', size: stat.size }
      })
      .filter(Boolean)
      .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1)
  }
  send(res, 200, { root: dir, tree: walk(dir) })
}

/* ---- GET/POST /api/file : 读/写文件 ---- */
async function handleFile(req, res, url) {
  const { readFileSync, writeFileSync, mkdirSync } = await import('node:fs')
  const { dirname } = await import('node:path')
  const path = url.searchParams.get('path')
  if (!path) return send(res, 400, { error: 'path required' })
  // 防穿越：不允许 .. 跳出工作目录
  const cwd = process.env.START_DIR || process.cwd()
  const resolved = join(cwd, path.replace(/^\.\//, ''))
  if (!resolved.startsWith(cwd) && !path.startsWith('/tmp/')) {
    return send(res, 403, { error: 'path outside workspace' })
  }

  if (req.method === 'GET') {
    try {
      const content = readFileSync(resolved, 'utf-8')
      send(res, 200, { path: resolved, content })
    } catch (e) {
      send(res, 404, { error: e.message })
    }
    return
  }
  if (req.method === 'POST') {
    const body = await readBody(req)
    let payload
    try { payload = JSON.parse(body) } catch { return send(res, 400, { error: 'invalid JSON' }) }
    try {
      mkdirSync(dirname(resolved), { recursive: true })
      writeFileSync(resolved, payload.content || '', 'utf-8')
      send(res, 200, { ok: true, path: resolved })
    } catch (e) {
      send(res, 500, { error: e.message })
    }
  }
}

/* ---- Git 辅助：执行 git 命令 ---- */
function git(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', c => out += c)
    child.stderr.on('data', c => err += c)
    child.on('close', code => resolve({ code, out, err }))
  })
}

/* ---- GET /api/git/status : Git 变更状态 ---- */
async function handleGitStatus(req, res, url) {
  const cwd = getCwd(url.searchParams)
  const { code, out, err } = await git(['status', '--porcelain=v1', '-z'], cwd)
  if (code !== 0) return send(res, 500, { error: err || 'git status failed' })
  // 解析 -z 分隔的 status
  const files = out.split('\0').filter(Boolean).map(line => {
    const status = line.slice(0, 2)
    const path = line.slice(3)
    const code = status.trim()
    return {
      path,
      status: code,
      staged: status[0] !== ' ' && status[0] !== '?',
      modified: status[1] !== ' ',
      type: code === '??' ? 'untracked' : code[0] === 'A' ? 'added' : code[0] === 'D' ? 'deleted' : code[0] === 'R' ? 'renamed' : 'modified',
    }
  })
  send(res, 200, { files, cwd })
}

/* ---- GET /api/git/diff : 单文件 diff ---- */
async function handleGitDiff(req, res, url) {
  const cwd = getCwd(url.searchParams)
  const file = url.searchParams.get('file')
  const args = file ? ['diff', 'HEAD', '--', file] : ['diff', 'HEAD']
  const { code, out, err } = await git(args, cwd)
  if (code !== 0) return send(res, 500, { error: err })
  send(res, 200, { diff: out })
}

/* ---- POST /api/git/snapshot : 创建回退点 ---- */
async function handleGitSnapshot(req, res, url) {
  const cwd = getCwd(url.searchParams)
  const body = await readBody(req)
  let payload = {}
  try { payload = JSON.parse(body || '{}') } catch {}
  const label = (payload.label || 'AI snapshot').replace(/"/g, '\'').slice(0, 80)
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  // 检查是否有改动
  const { out: stOut } = await git(['status', '--porcelain'], cwd)
  if (!stOut.trim()) {
    return send(res, 200, { ok: false, message: '工作区干净，无需创建快照' })
  }

  // add all + commit
  await git(['add', '-A'], cwd)
  const { code, err } = await git(['commit', '-m', `[snapshot] ${label} @ ${ts}`], cwd)
  if (code !== 0) {
    return send(res, 500, { error: err || 'git commit failed' })
  }
  // 获取 commit hash
  const { out: hashOut } = await git(['rev-parse', 'HEAD'], cwd)
  const hash = hashOut.trim()
  send(res, 200, { ok: true, hash, label, ts })
}

/* ---- GET /api/git/snapshots : 回退点列表 ---- */
async function handleGitSnapshots(req, res, url) {
  const cwd = getCwd(url.searchParams)
  // 列出最近 20 条带 [snapshot] 的 commit
  const { code, out, err } = await git(['log', '--grep=\\[snapshot\\]', '-20', '--pretty=format:%H|%h|%s|%ct', '--'], cwd)
  if (code !== 0) return send(res, 500, { error: err })
  const snapshots = out.trim().split('\n').filter(Boolean).map(line => {
    const [hash, short, subject, ts] = line.split('|')
    // 解析 label: "[snapshot] <label> @ <ts>"
    const m = subject.match(/^\[snapshot\]\s*(.+?)\s*@\s*[\d-T:]+$/)
    return { hash, short, label: m ? m[1] : subject, ts: Number(ts) * 1000 }
  })
  send(res, 200, { snapshots })
}

/* ---- POST /api/git/restore : 回退到指定快照 ---- */
async function handleGitRestore(req, res, url) {
  const cwd = getCwd(url.searchParams)
  const body = await readBody(req)
  let payload
  try { payload = JSON.parse(body || '{}') } catch { return send(res, 400, { error: 'invalid JSON' }) }
  const { hash } = payload
  if (!hash || !/^[\da-f]{7,40}$/.test(hash)) {
    return send(res, 400, { error: 'invalid hash' })
  }
  // 创建当前状态的备份 commit（防止丢失未提交改动）
  const { out: stOut } = await git(['status', '--porcelain'], cwd)
  if (stOut.trim()) {
    await git(['add', '-A'], cwd)
    await git(['commit', '-m', `[backup] pre-restore @ ${new Date().toISOString()}`], cwd)
  }
  // 回退到指定 commit（保留工作区）
  const { code, err } = await git(['checkout', hash, '--', '.'], cwd)
  if (code !== 0) return send(res, 500, { error: err || 'git checkout failed' })
  send(res, 200, { ok: true, hash, message: `已回退到 ${hash.slice(0, 7)}` })
}

/* ---- HTTP 路由 ---- */
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return send(res, 204, '')

  const url = new URL(req.url, `http://${HOST}`)

  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res)
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, { ok: true, port: PORT, instances: Object.keys(TOOLS).length })
  }
  if (req.method === 'GET' && url.pathname === '/api/instances') {
    const list = Object.fromEntries(
      Object.entries(TOOLS).map(([id, t]) => [id, { cmd: t.cmd, supported: !!t.args, json: t.json || false, reason: t.reason || null }])
    )
    return send(res, 200, { instances: list })
  }
  if (req.method === 'GET' && url.pathname === '/api/snapshot') return handleSnapshot(res)

  // 文件 + Git API
  if (req.method === 'GET' && url.pathname === '/api/files') return handleFiles(req, res, url)
  if (url.pathname === '/api/file') return handleFile(req, res, url)
  if (req.method === 'GET' && url.pathname === '/api/git/status') return handleGitStatus(req, res, url)
  if (req.method === 'GET' && url.pathname === '/api/git/diff') return handleGitDiff(req, res, url)
  if (req.method === 'POST' && url.pathname === '/api/git/snapshot') return handleGitSnapshot(req, res, url)
  if (req.method === 'GET' && url.pathname === '/api/git/snapshots') return handleGitSnapshots(req, res, url)
  if (req.method === 'POST' && url.pathname === '/api/git/restore') return handleGitRestore(req, res, url)

  send(res, 404, { error: 'not found', path: url.pathname })
})

/* ---- PTY 终端：构建启动参数 ----
 * mode:
 *   raw      → 纯 bash
 *   minimal  → AI CLI + 省用参数（--tools "" --effort minimal）
 *   enhanced → AI CLI + 增强参数（--tools Read,Edit,Bash --effort low）
 *   native   → AI CLI 原生默认
 *   resume   → AI CLI + --continue（续接上次会话）
 */
function buildPtyArgs(instanceId, mode) {
  if (mode === 'raw') return { cmd: process.env.SHELL || '/bin/bash', args: ['-l'] }

  const tool = TOOLS[instanceId]
  if (!tool || !tool.args) return null

  const cmd = tool.cmd
  // 交互式模式：codebuddy/claude/qodercli 用 --tools + --effort + --system-prompt
  // opencode/mimo 用 run（但 run 是非交互的，交互式直接用命令本身）
  // codex 用 exec（非交互），交互式直接 codex
  // hermes 用 -z（非交互），交互式直接 hermes
  // qwen 交互式直接 qwen

  const isAnthropic = tool.json === 'anthropic'
  const MINIMAL_PROMPT = '简洁回答'
  const ENHANCED_TOOLS = 'Read,Edit,Bash,Glob,Grep'

  if (mode === 'resume') {
    // 续接：codebuddy/claude 用 --continue，其他工具无此能力则回退 native
    if (isAnthropic) return { cmd, args: ['--continue', '--system-prompt', MINIMAL_PROMPT] }
    return { cmd, args: [] }
  }

  if (mode === 'minimal' && isAnthropic) {
    return { cmd, args: ['--tools', '', '--effort', 'minimal', '--system-prompt', MINIMAL_PROMPT] }
  }
  if (mode === 'enhanced' && isAnthropic) {
    return { cmd, args: ['--tools', ENHANCED_TOOLS, '--effort', 'low', '--system-prompt', MINIMAL_PROMPT] }
  }

  // native 或非 Anthropic 工具：直接启动
  return { cmd, args: [] }
}

/* ---- WebSocket 终端桥接 ----
 * 客户端 → 服务端: {type:'start', instance_id, mode, cols, rows} 启动
 *                  字符串 → 写入 PTY stdin
 * 服务端 → 客户端: {type:'ready', cmd} / {type:'data', data} / {type:'exit', code} / {type:'error', text}
 */
const wss = new WebSocketServer({ server, path: '/ws/terminal' })

wss.on('connection', (ws) => {
  let ptyProc = null

  ws.on('message', (raw) => {
    // 文本帧 = 写入 stdin；JSON 帧 = 控制指令
    const text = raw.toString()
    if (!text.startsWith('{')) {
      ptyProc?.write(text)
      return
    }
    let msg
    try { msg = JSON.parse(text) } catch { return }
    if (msg.type !== 'start') return

    // 启动前先关掉旧进程
    if (ptyProc) { try { ptyProc.kill() } catch {} }

    const { instance_id, mode = 'native', cols = 80, rows = 24 } = msg
    const conf = buildPtyArgs(instance_id, mode)
    if (!conf) {
      ws.send(JSON.stringify({ type: 'error', text: `该实例不支持终端模式: ${instance_id} (${mode})` }))
      return
    }

    try {
      ptyProc = pty.spawn(conf.cmd, conf.args, {
        name: 'xterm-256color',
        cols: Math.max(20, cols | 0),
        rows: Math.max(5, rows | 0),
        cwd: process.env.START_DIR || process.cwd(),
        env: { ...process.env, TERM: 'xterm-256color' },
      })
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', text: `启动失败: ${e.message}` }))
      return
    }

    ws.send(JSON.stringify({ type: 'ready', cmd: conf.cmd, args: conf.args, mode, pid: ptyProc.pid }))

    ptyProc.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'data', data }))
    })
    ptyProc.onExit(({ exitCode }) => {
      ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
      ptyProc = null
    })
  })

  ws.on('message', (raw) => {
    // 第二个 listener：处理 resize 等控制指令（JSON）
    const text = raw.toString()
    if (!text.startsWith('{')) return
    let msg
    try { msg = JSON.parse(text) } catch { return }
    if (msg.type === 'resize' && ptyProc) {
      try { ptyProc.resize(Math.max(20, msg.cols | 0), Math.max(5, msg.rows | 0)) } catch {}
    } else if (msg.type === 'kill' && ptyProc) {
      try { ptyProc.kill() } catch {}
    }
  })

  ws.on('close', () => {
    if (ptyProc) { try { ptyProc.kill() } catch {} }
  })
})

server.listen(PORT, HOST, () => {
  console.log(`[HermesOps Bridge v3] http://${HOST}:${PORT}  ·  /api/chat (SSE) · /ws/terminal (PTY) · /api/snapshot`)
})
