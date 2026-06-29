<script setup lang="ts">
/**
 * LogsView — 📝 日志
 * 滚动日志控制台，模拟捕获当前实例的 stdout/stderr
 */
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

interface LogLine { t: string; level: 'INFO' | 'WARN' | 'ERR' | 'DBG'; msg: string }

const lines = ref<LogLine[]>([])
const autoScroll = ref(true)
const boxRef = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

const now = () => new Date().toTimeString().slice(0, 8)

function push(level: LogLine['level'], msg: string) {
  lines.value.push({ t: now(), level, msg })
  if (lines.value.length > 200) lines.value.shift()
  if (autoScroll.value) {
    requestAnimationFrame(() => {
      const el = boxRef.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
}

function bootstrap() {
  lines.value = []
  push('INFO', `[${props.instance.id}] 沙盒 ${props.instance.uuid.slice(0, 8)} 已挂载`)
  push('DBG',  `cmd=${props.instance.cmd} sandbox=${props.instance.sandbox}`)
  push('INFO', `额度: ${props.instance.quota}`)
}
bootstrap()
watch(() => props.instance.id, () => bootstrap())

const sampleMsgs: Array<[LogLine['level'], string]> = [
  ['INFO', 'GridEngine 心跳: workers=4 idle=2'],
  ['DBG',  'hand-off 协议监听端口 :3000'],
  ['WARN', 'CodeGraph 增量同步耗时 1.2s，接近阈值'],
  ['INFO', '子任务 sub_xxx 已完成，状态 DONE'],
  ['ERR',  '远程 GPU 节点 gpu-02 延迟突增 280ms'],
  ['DBG',  'ACI 沙盒文件锁释放 /src/main.ts'],
  ['INFO', 'Orchestrator 分发新任务至 worker-1'],
]

onMounted(() => {
  timer = setInterval(() => {
    const [lvl, msg] = sampleMsgs[Math.floor(Math.random() * sampleMsgs.length)]
    push(lvl, msg)
  }, 1400)
})
onBeforeUnmount(() => { if (timer) clearInterval(timer) })

function clear() { lines.value = [] }
</script>

<template>
  <div class="logs">
    <div class="logs-bar">
      <span class="logs-title">📝 {{ instance.name }} 日志流</span>
      <label class="logs-auto">
        <input type="checkbox" v-model="autoScroll" /> 自动滚动
      </label>
      <button class="logs-clear" @click="clear">清空</button>
    </div>

    <div ref="boxRef" class="logs-body">
      <div v-for="(ln, i) in lines" :key="i" class="logline" :class="ln.level.toLowerCase()">
        <span class="ts">{{ ln.t }}</span>
        <span class="lv">{{ ln.level }}</span>
        <span class="msg">{{ ln.msg }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.logs {
  max-width: 920px;
  margin: 0 auto;
  height: calc(100vh - 140px);
  display: flex;
  flex-direction: column;
  background: #151619;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  overflow: hidden;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
}
.logs-bar {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px;
  background: #1b1c1f;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.logs-title { font-size: 13px; font-weight: 700; color: #f2f3f5; flex: 1; }
.logs-auto { font-size: 12px; color: #7a7d84; display: flex; align-items: center; gap: 5px; cursor: pointer; }
.logs-auto input { accent-color: #19c8b9; }
.logs-clear {
  font-size: 11px; font-family: inherit;
  color: #c9ccd1; background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 4px 10px; cursor: pointer;
  transition: background 0.15s;
}
.logs-clear:hover { background: #34373d; }

.logs-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-size: 12px;
  line-height: 1.7;
}
.logline { display: flex; gap: 12px; padding: 1px 0; }
.logline .ts { color: #565862; flex-shrink: 0; }
.logline .lv { width: 44px; flex-shrink: 0; font-weight: 700; }
.logline .msg { color: #c9ccd1; }
.logline.info .lv { color: #19c8b9; }
.logline.dbg  .lv { color: #7a7d84; }
.logline.warn .lv { color: #f5c31c; }
.logline.warn .msg { color: #f5c31c; }
.logline.err  .lv { color: #e05a5a; }
.logline.err  .msg { color: #e05a5a; }
</style>
