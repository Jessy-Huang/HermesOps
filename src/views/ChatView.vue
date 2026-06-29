<script setup lang="ts">
/**
 * ChatView — 💬 多状态流式动态渲染器
 * --------------------------------------------------------------------------
 * 按 SSE 事件 type 分发到对应卡片：
 *   thinking  → CoTCard（折叠思考）
 *   text      → TextBubble（文本气泡）
 *   tool_use  → FileActionCard / TerminalCard（按工具名分类）
 *   tool_result → 回填到对应 tool_use 卡片的结果
 *   result    → TokenMeter（Token 计量）
 *   error     → ErrorCard（硬核 fallback）
 *   delta     → TextBubble（非结构化工具的纯文本流）
 * --------------------------------------------------------------------------
 */
import { ref, reactive, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import type { ToolInstance, MenuItem } from '../types'
import CoTCard from './chat/CoTCard.vue'
import FileActionCard from './chat/FileActionCard.vue'
import TerminalCard from './chat/TerminalCard.vue'
import TokenMeter from './chat/TokenMeter.vue'
import ErrorCard from './chat/ErrorCard.vue'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

/* ---- 消息类型 ---- */
type CardType = 'user' | 'text' | 'thinking' | 'file' | 'terminal' | 'error' | 'meter'

interface Card {
  id: number
  type: CardType
  text?: string                    // text / thinking / error / user
  durationS?: number               // thinking
  tool?: string                    // file / terminal
  filePath?: string                // file
  oldString?: string               // file (Edit)
  newString?: string               // file (Edit)
  content?: string                 // file (Write) / terminal result
  command?: string                 // terminal
  status?: 'running' | 'success' | 'error'  // terminal
  isError?: boolean                // file
  result?: string                  // file/terminal tool_result
  toolUseId?: string               // 关联 tool_use_id
  streaming?: boolean              // text 气泡是否仍在流式
  inputTokens?: number             // meter
  outputTokens?: number            // meter
  costUsd?: number                 // meter
  durationMs?: number              // meter
  unavailable?: boolean            // meter (非结构化工具)
}

const FILE_TOOLS = new Set(['Read', 'Write', 'Edit', 'NotebookEdit'])
const TERM_TOOLS = new Set(['Bash', 'PowerShell'])

const cards = ref<Card[]>([])
const input = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const sending = ref(false)
const enhanced = ref(false)  // 增强模式：启用工具（Read/Edit/Bash），token 消耗更高
let abortCtrl: AbortController | null = null
let cardIdSeq = 0
let metaStructured = false  // 当前请求是否为结构化事件流

/* ---- 开场白 ---- */
function bootstrap() {
  cards.value = [{
    id: ++cardIdSeq,
    type: 'text',
    text: `🚀 ${props.instance.name} 已就位。我是当前沙盒（${props.instance.id}）的编码智能体，有什么需要我处理的？`,
  }]
}
bootstrap()

watch(() => props.instance.id, () => {
  abortCtrl?.abort()
  sending.value = false
  bootstrap()
  nextTick(scrollBottom)
})

function scrollBottom() {
  const el = scrollRef.value
  if (el) el.scrollTop = el.scrollHeight
}

/* ---- 查找最后一个 running 的 tool_use 卡片 ---- */
function findPendingToolCard(toolUseId?: string): Card | undefined {
  if (toolUseId) return cards.value.find(c => c.toolUseId === toolUseId)
  // 没有 id 时取最后一个 running 的 tool 卡片
  for (let i = cards.value.length - 1; i >= 0; i--) {
    const c = cards.value[i]
    if ((c.type === 'file' || c.type === 'terminal') && c.status === 'running') return c
  }
  return undefined
}

/* ---- 发送 ---- */
async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  sending.value = true

  cards.value.push({ id: ++cardIdSeq, type: 'user', text })
  nextTick(scrollBottom)
  metaStructured = false

  abortCtrl = new AbortController()
  try {
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instance_id: props.instance.id, message: text, enhanced: enhanced.value }),
      signal: abortCtrl.signal,
    })

    if (!resp.ok || !resp.body) {
      cards.value.push({ id: ++cardIdSeq, type: 'error', text: `HTTP ${resp.status} — 后端桥接服务未就绪` })
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let hasContent = false  // 跟踪是否有任何有效内容

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let evt
        try { evt = JSON.parse(line.slice(6)) } catch { continue }
        hasContent = handleEvent(evt) || hasContent
        nextTick(scrollBottom)
      }
    }

    // ===== 硬核 Fallback：整轮流完仍无有效内容 =====
    if (!hasContent) {
      cards.value.push({
        id: ++cardIdSeq,
        type: 'error',
        text: `⚠ ${props.instance.name} 未返回任何内容。可能原因：\n• 未登录或未配置 API Key\n• 该工具不支持 -p 非交互模式\n• 沙盒执行被拒绝\n\n请检查终端 stderr 或切换至已配置的工具（如 CodeBuddy / Qoder）。`,
      })
    }
  } catch (e: any) {
    if (e.name === 'AbortError') {
      cards.value.push({ id: ++cardIdSeq, type: 'text', text: '_(已中断)_' })
    } else {
      cards.value.push({
        id: ++cardIdSeq,
        type: 'error',
        text: `请求失败: ${e.message}\n\n提示：请确认后端桥接服务已启动（hermesops --web 会自动拉起）`,
      })
    }
  } finally {
    sending.value = false
    abortCtrl = null
    nextTick(scrollBottom)
  }
}

/* ---- 事件分发：返回 true 表示产生了有效内容 ---- */
function handleEvent(evt: any): boolean {
  switch (evt.type) {
    case 'meta':
      metaStructured = !!evt.structured
      return false  // 元信息不算内容

    case 'thinking':
      cards.value.push({
        id: ++cardIdSeq,
        type: 'thinking',
        text: evt.text,
        durationS: evt.duration_s,
      })
      return true

    case 'text':
      if (!evt.text) return false
      cards.value.push({ id: ++cardIdSeq, type: 'text', text: evt.text })
      return true

    case 'delta':
      // 非结构化工具的纯文本流：append 到上一个 text 气泡，或新建
      if (!evt.text) return false
      const last = cards.value[cards.value.length - 1]
      if (last && last.type === 'text' && last.streaming) {
        last.text += evt.text
      } else {
        cards.value.push({ id: ++cardIdSeq, type: 'text', text: evt.text, streaming: true })
      }
      return true

    case 'tool_use': {
      const tool = evt.tool
      const inp = evt.input || {}
      if (FILE_TOOLS.has(tool)) {
        cards.value.push({
          id: ++cardIdSeq,
          type: 'file',
          tool,
          filePath: inp.file_path || inp.path || '',
          oldString: inp.old_string,
          newString: inp.new_string,
          content: inp.content,
          status: 'running',
          toolUseId: evt.tool_use_id,
        })
      } else if (TERM_TOOLS.has(tool)) {
        cards.value.push({
          id: ++cardIdSeq,
          type: 'terminal',
          tool,
          command: inp.command || '',
          status: 'running',
          toolUseId: evt.tool_use_id,
        })
      } else {
        // 其他工具：当文本气泡
        cards.value.push({
          id: ++cardIdSeq,
          type: 'text',
          text: `🔧 ${tool}(${JSON.stringify(inp).slice(0, 100)})`,
        })
      }
      return true
    }

    case 'tool_result': {
      const target = findPendingToolCard(evt.tool_use_id)
      if (target) {
        target.result = evt.content || ''
        target.isError = !!evt.is_error
        target.status = evt.is_error ? 'error' : 'success'
      }
      return true
    }

    case 'result':
      // Token 计量卡片
      cards.value.push({
        id: ++cardIdSeq,
        type: 'meter',
        inputTokens: evt.usage?.input_tokens,
        outputTokens: evt.usage?.output_tokens,
        costUsd: evt.cost_usd,
        durationMs: evt.duration_ms,
      })
      // 若 result_text 有内容且前面没 text 卡片，补一个
      if (evt.result_text && evt.is_error === false) {
        const last = cards.value[cards.value.length - 2]
        if (!last || last.type !== 'text') {
          cards.value.splice(cards.value.length - 1, 0, {
            id: ++cardIdSeq,
            type: 'text',
            text: evt.result_text,
          })
        }
      }
      return true

    case 'stderr':
      // 结构化工具的 stderr 不直接渲染（噪声）；非结构化工具在 server 已转 delta
      return false

    case 'error':
      cards.value.push({ id: ++cardIdSeq, type: 'error', text: evt.text })
      return true

    case 'done':
      // 标记最后一个 streaming text 为完成
      const last2 = cards.value[cards.value.length - 1]
      if (last2 && last2.type === 'text') last2.streaming = false
      // 非结构化工具：若整轮没有 meter 卡片，补一个"不可用"计量
      const hasMeter = cards.value.some(c => c.type === 'meter')
      if (!hasMeter && !metaStructured) {
        cards.value.push({ id: ++cardIdSeq, type: 'meter', unavailable: true })
      }
      return false

    default:
      return false
  }
}

function stop() {
  abortCtrl?.abort()
}

onBeforeUnmount(() => abortCtrl?.abort())

const label = computed(() => props.instance.name)
</script>

<template>
  <div class="chat">
    <div class="chat-head">
      <span class="chat-title">💬 {{ label }} 对话流</span>
      <span class="chat-uuid">{{ instance.uuid.slice(0, 8) }}</span>
    </div>

    <div ref="scrollRef" class="chat-stream">
      <template v-for="card in cards" :key="card.id">
        <!-- 用户消息 -->
        <div v-if="card.type === 'user'" class="bubble user">
          <p>{{ card.text }}</p>
        </div>

        <!-- 文本气泡 -->
        <div v-else-if="card.type === 'text'" class="bubble agent" :class="{ streaming: card.streaming }">
          <p>{{ card.text }}</p>
        </div>

        <!-- CoT 思考卡片 -->
        <CoTCard
          v-else-if="card.type === 'thinking'"
          :text="card.text || ''"
          :duration-s="card.durationS"
        />

        <!-- 文件操作卡片 -->
        <FileActionCard
          v-else-if="card.type === 'file'"
          :tool="card.tool || ''"
          :file-path="card.filePath || ''"
          :old-string="card.oldString"
          :new-string="card.newString"
          :content="card.content"
          :result="card.result"
          :is-error="card.isError"
        />

        <!-- 终端命令卡片 -->
        <TerminalCard
          v-else-if="card.type === 'terminal'"
          :command="card.command || ''"
          :result="card.result"
          :status="card.status || 'running'"
        />

        <!-- 错误卡片 -->
        <ErrorCard
          v-else-if="card.type === 'error'"
          :text="card.text || ''"
        />

        <!-- Token 计量 -->
        <TokenMeter
          v-else-if="card.type === 'meter'"
          :input-tokens="card.inputTokens"
          :output-tokens="card.outputTokens"
          :cost-usd="card.costUsd"
          :duration-ms="card.durationMs"
          :unavailable="card.unavailable"
        />
      </template>
    </div>

    <div class="chat-input">
      <button
        class="enh-toggle"
        :class="{ on: enhanced }"
        :title="enhanced ? '增强模式：已启用工具（Read/Edit/Bash），token 消耗更高' : '省用模式：纯对话无工具，token 最省。点击启用工具'"
        @click="enhanced = !enhanced"
      >{{ enhanced ? '🔧' : '⚡' }}</button>
      <input
        v-model="input"
        type="text"
        :placeholder="sending ? `${label} 思考中…` : `向 ${label} 发送指令…${enhanced ? '（增强：已启用工具）' : ''}`"
        spellcheck="false"
        :disabled="sending"
        @keydown.enter="send"
      />
      <button v-if="!sending" class="btn-send" @click="send">发送</button>
      <button v-else class="btn-stop" @click="stop">■ 停止</button>
    </div>
  </div>
</template>

<style scoped>
.chat {
  max-width: 820px;
  margin: 0 auto;
  height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  background: #232529;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 20px;
  overflow: hidden;
}
.chat-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: #1b1c1f;
}
.chat-title { font-size: 14px; font-weight: 700; color: #f2f3f5; }
.chat-uuid { font-size: 11px; font-family: 'SF Mono',Consolas,monospace; color: #19c8b9; }

.chat-stream {
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.55;
  animation: pop 0.22s cubic-bezier(0.4,0,0.2,1);
}
@keyframes pop { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.bubble p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.bubble.user {
  align-self: flex-end;
  background: #19c8b9;
  color: #0d2b28;
  border-bottom-right-radius: 4px;
  font-weight: 600;
}
.bubble.agent {
  align-self: flex-start;
  background: #2a2d33;
  color: #f2f3f5;
  border: 1px solid rgba(255,255,255,0.06);
  border-bottom-left-radius: 4px;
  margin-bottom: 8px;
}
.bubble.agent.streaming::after {
  content: '▋';
  margin-left: 2px;
  color: #19c8b9;
  animation: blink 0.9s step-end infinite;
}
@keyframes blink { 50% { opacity: 0; } }

.chat-input {
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
  background: #1b1c1f;
  align-items: center;
}
.enh-toggle {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  font-size: 16px;
  font-family: inherit;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  background: #2a2d33;
  cursor: pointer;
  transition: all 0.18s;
  line-height: 1;
}
.enh-toggle:hover { border-color: rgba(255,255,255,0.15); }
.enh-toggle.on {
  background: rgba(25,200,185,0.14);
  border-color: #19c8b9;
  box-shadow: 0 0 0 2px rgba(25,200,185,0.1);
}
.chat-input input {
  flex: 1;
  height: 40px;
  box-sizing: border-box;
  padding: 0 14px;
  font-size: 13px;
  font-family: inherit;
  color: #f2f3f5;
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.chat-input input:focus {
  border-color: #19c8b9;
  box-shadow: 0 0 0 3px rgba(25,200,185,0.14);
}
.chat-input input::placeholder { color: #565862; }
.chat-input input:disabled { opacity: 0.6; }
.chat-input button {
  height: 40px;
  padding: 0 20px;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.18s, transform 0.12s;
}
.chat-input button.btn-send {
  color: #0d2b28;
  background: #19c8b9;
}
.chat-input button.btn-send:hover { background: #3dd4c6; }
.chat-input button.btn-send:active { transform: translateY(1px); }
.chat-input button.btn-stop {
  color: #e05a5a;
  background: rgba(224,90,90,0.12);
  border: 1px solid rgba(224,90,90,0.4);
}
.chat-input button.btn-stop:hover { background: rgba(224,90,90,0.2); }
</style>
