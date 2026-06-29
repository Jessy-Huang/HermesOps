<script setup lang="ts">
/**
 * TerminalView — 🖥️ 交互式 PTY 终端
 * --------------------------------------------------------------------------
 * xterm.js + WebSocket 连后端 node-pty，可直接跑原生 codebuddy / mimo / bash。
 *
 * 三模式 + 续接（省 token 哲学）：
 *   ▦ 原生   → AI CLI 默认参数（用户完全自由）
 *   ⚡ 省用   → --tools "" --effort minimal（~3.6k token，纯对话）
 *   🔧 增强   → --tools Read,Edit,Bash --effort low（~16k token，可操作文件）
 *   ⟲ 续接   → --continue（codebuddy/claude 自带长时记忆）
 *
 * 会话 ID 持久化 localStorage，切实例自动重连。
 * --------------------------------------------------------------------------
 */
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

type Mode = 'raw' | 'minimal' | 'enhanced' | 'native' | 'resume'

const containerRef = ref<HTMLElement | null>(null)
const statusText = ref('未连接')
const statusClass = ref('idle')
const currentMode = ref<Mode>('native')
const resumeOnStart = ref(false)
const showHelp = ref(false)

let term: Terminal | null = null
let fitAddon: FitAddon | null = null
let ws: WebSocket | null = null
let resizeObs: ResizeObserver | null = null

const MODE_DESC: Record<Mode, { icon: string; label: string; hint: string }> = {
  raw:      { icon: '🐚', label: '纯 Shell',  hint: '只开 bash，不启动 AI CLI' },
  minimal:  { icon: '⚡', label: '省用',     hint: 'AI CLI + 禁用工具 + minimal 思考（~3.6k token，纯对话最省）' },
  enhanced: { icon: '🔧', label: '增强',     hint: 'AI CLI + Read/Edit/Bash 工具 + low 思考（~16k token，可操作文件）' },
  native:   { icon: '▦',  label: '原生',     hint: 'AI CLI 默认参数（完全自由，token 按默认）' },
  resume:   { icon: '⟲',  label: '续接',     hint: 'AI CLI + --continue 续接上次会话（长时记忆）' },
}

/* ---- WebSocket URL ---- */
function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${location.host}/ws/terminal`
}

/* ---- 启动终端会话 ---- */
function startSession() {
  if (!term || !props.instance) return

  // 关闭旧连接
  if (ws) { try { ws.close() } catch {} ws = null }

  // 决定实际 mode：resumeOnStart 优先（仅对 anthropic 工具有效）
  let mode = currentMode.value
  if (resumeOnStart.value && (props.instance.id === '01_codebuddy' || props.instance.id === '07_claude_code' || props.instance.id === '02_qoder')) {
    mode = 'resume'
  }

  statusText.value = `连接中…`
  statusClass.value = 'connecting'
  ws = new WebSocket(wsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    const init = {
      type: 'start',
      instance_id: props.instance.id,
      mode,
      cols: term!.cols,
      rows: term!.rows,
    }
    ws!.send(JSON.stringify(init))
  }

  ws.onmessage = (ev) => {
    // 文本帧 = PTY 数据，直接写终端；JSON 帧 = 控制事件
    if (typeof ev.data === 'string') {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'ready') {
          statusText.value = `${msg.cmd} ${msg.args?.join(' ') || ''}`.trim()
          statusClass.value = 'running'
          term!.focus()
        } else if (msg.type === 'data') {
          term!.write(msg.data)
        } else if (msg.type === 'exit') {
          statusText.value = `进程退出 (code ${msg.code})`
          statusClass.value = msg.code === 0 ? 'exited' : 'error'
        } else if (msg.type === 'error') {
          term!.write(`\r\n\x1b[31m${msg.text}\x1b[0m\r\n`)
          statusText.value = '错误'
          statusClass.value = 'error'
        }
      } catch {
        // 非 JSON，当文本处理
        term!.write(ev.data)
      }
    } else {
      term!.write(ev.data)
    }
  }

  ws.onerror = () => {
    statusText.value = 'WebSocket 错误'
    statusClass.value = 'error'
  }

  ws.onclose = () => {
    if (statusClass.value !== 'error' && statusClass.value !== 'exited') {
      statusText.value = '连接关闭'
      statusClass.value = 'idle'
    }
  }
}

/* ---- 用户输入 → WS ---- */
function onData(data: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data)
  }
}

/* ---- 切换模式重启 ---- */
function switchMode(m: Mode) {
  currentMode.value = m
  if (term) term.clear()
  startSession()
}

/* ---- 杀进程 ---- */
function killSession() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'kill' }))
  }
}

/* ---- 初始化 xterm.js ---- */
function initTerminal() {
  if (!containerRef.value || term) return

  term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'SF Mono','Fira Code','Cascadia Code',Consolas,monospace",
    theme: {
      background: '#151619',
      foreground: '#c9ccd1',
      cursor: '#19c8b9',
      selectionBackground: 'rgba(25,200,185,0.25)',
      black: '#151619', red: '#e05a5a', green: '#6fba2c', yellow: '#f5c31c',
      blue: '#889df0', magenta: '#b77dee', cyan: '#19c8b9', white: '#c9ccd1',
      brightBlack: '#565862', brightRed: '#e88', brightGreen: '#8fd44f',
      brightYellow: '#ffd84d', brightBlue: '#a5b3f5', brightMagenta: '#c99eff',
      brightCyan: '#3dd4c6', brightWhite: '#f2f3f5',
    },
    allowProposedApi: true,
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.loadAddon(new WebLinksAddon())
  term.open(containerRef.value)
  fitAddon.fit()
  term.onData(onData)

  // 容器尺寸变化 → fit + 通知后端 resize
  resizeObs = new ResizeObserver(() => {
    fitAddon?.fit()
    if (ws?.readyState === WebSocket.OPEN && term) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  })
  resizeObs.observe(containerRef.value)
}

/* ---- 切实例重启 ---- */
watch(() => props.instance.id, () => {
  if (term) {
    term.clear()
    term.write(`\x1b[36m→ 切换到 ${props.instance.name}，重新启动会话…\x1b[0m\r\n`)
    startSession()
  }
})

onMounted(async () => {
  await nextTick()
  initTerminal()
  startSession()
})

onBeforeUnmount(() => {
  resizeObs?.disconnect()
  ws?.close()
  term?.dispose()
  term = null
})
</script>

<template>
  <div class="term-view">
    <div class="term-toolbar">
      <div class="mode-group">
        <button
          v-for="(m, key) in MODE_DESC"
          :key="key"
          class="mode-btn"
          :class="{ active: currentMode === key }"
          :title="m.hint"
          @click="switchMode(key as Mode)"
        >
          <span class="mode-icon">{{ m.icon }}</span>
          <span class="mode-label">{{ m.label }}</span>
        </button>
      </div>

      <label class="resume-toggle" :title="'启动时自动 --continue 续接上次会话（仅 codebuddy/claude/qoder 支持）'">
        <input type="checkbox" v-model="resumeOnStart" />
        <span>⟲ 续接上次</span>
      </label>

      <div class="spacer" />

      <div class="status" :class="statusClass">
        <span class="status-dot" />
        <span class="status-text">{{ statusText }}</span>
      </div>

      <button class="kill-btn" title="终止当前进程" @click="killSession">⏹</button>
      <button class="help-btn" :class="{ on: showHelp }" @click="showHelp = !showHelp">?</button>
    </div>

    <Transition name="help">
      <div v-if="showHelp" class="help-panel">
        <div class="help-row"><b>⚡ 省用</b> — 纯对话最省 token（~3.6k）。问"什么文件夹"、"解释概念"等用此模式。</div>
        <div class="help-row"><b>🔧 增强</b> — 启用 Read/Edit/Bash 工具（~16k token）。要读写文件、跑命令时用。</div>
        <div class="help-row"><b>▦ 原生</b> — AI CLI 默认参数，完全自由（token 按默认，可能较高）。</div>
        <div class="help-row"><b>🐚 纯 Shell</b> — 只开 bash，不启动 AI。</div>
        <div class="help-row"><b>⟲ 续接</b> — 用 --continue 续接上次会话，保持长时记忆（仅 codebuddy/claude/qoder）。</div>
      </div>
    </Transition>

    <div ref="containerRef" class="term-container" />
  </div>
</template>

<style scoped>
.term-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  background: #151619;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
}

.term-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: #1b1c1f;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-wrap: wrap;
}

.mode-group {
  display: flex;
  gap: 4px;
  background: #151619;
  padding: 3px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.06);
}
.mode-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 12px;
  font-family: inherit;
  color: #7a7d84;
  background: none;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn:hover { color: #c9ccd1; background: rgba(255,255,255,0.04); }
.mode-btn.active {
  color: #0d2b28;
  background: #19c8b9;
  font-weight: 700;
}
.mode-icon { font-size: 13px; }

.resume-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #7a7d84;
  cursor: pointer;
  user-select: none;
}
.resume-toggle input { accent-color: #19c8b9; }

.spacer { flex: 1; }

.status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #7a7d84;
  font-family: 'SF Mono',Consolas,monospace;
  max-width: 320px;
  overflow: hidden;
}
.status-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: #565862;
  flex-shrink: 0;
}
.status.connecting .status-dot { background: #f5c31c; animation: pulse 1s infinite; }
.status.running .status-dot { background: #6fba2c; box-shadow: 0 0 6px #6fba2c; }
.status.exited .status-dot { background: #565862; }
.status.error .status-dot { background: #e05a5a; }
.status-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
@keyframes pulse { 50% { opacity: 0.3; } }

.kill-btn, .help-btn {
  width: 28px; height: 28px;
  font-size: 13px;
  font-family: inherit;
  color: #7a7d84;
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.15s;
}
.kill-btn:hover { color: #e05a5a; border-color: rgba(224,90,90,0.4); }
.help-btn:hover { color: #19c8b9; border-color: rgba(25,200,185,0.4); }
.help-btn.on { color: #19c8b9; border-color: rgba(25,200,185,0.4); }

.help-panel {
  padding: 10px 16px;
  background: #1b1c1f;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.help-row { font-size: 11px; color: #9a9da4; line-height: 1.6; }
.help-row b { color: #19c8b9; }

.term-container {
  flex: 1;
  padding: 8px 10px;
  background: #151619;
  overflow: hidden;
}
.term-container :deep(.xterm) {
  height: 100%;
}
.term-container :deep(.xterm-viewport) {
  overflow-y: auto;
}

.help-enter-active, .help-leave-active { transition: all 0.25s cubic-bezier(0.4,0,0.2,1); max-height: 200px; }
.help-enter-from, .help-leave-to { opacity: 0; max-height: 0; }
</style>
