<script setup lang="ts">
/**
 * TerminalCard — >_ 终端命令执行卡片
 * 横向长条 + 状态指示灯（运行中旋转/成功绿勾/失败红叉）
 * 点击展开只读控制台日志流
 */
import { ref, computed } from 'vue'

const props = defineProps<{
  command: string
  result?: string
  status: 'running' | 'success' | 'error'
}>()

const expanded = ref(false)
const shortCmd = computed(() => {
  const c = props.command
  return c.length > 70 ? c.slice(0, 67) + '…' : c
})
</script>

<template>
  <div class="term-card" :class="{ expanded, [status]: true }">
    <button class="term-header" @click="expanded = !expanded">
      <span class="term-prompt">&gt;_</span>
      <code class="term-cmd">{{ shortCmd }}</code>
      <span class="term-status">
        <span v-if="status === 'running'" class="spinner" />
        <span v-else-if="status === 'success'" class="ok">✓</span>
        <span v-else class="err">✗</span>
      </span>
      <span class="term-caret">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <div class="term-body-wrap">
      <div class="term-body">
        <pre v-if="result" class="term-output">{{ result }}</pre>
        <div v-else class="term-empty">{{ status === 'running' ? '执行中…' : '无输出' }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.term-card {
  align-self: flex-start;
  max-width: 82%;
  margin-bottom: 8px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
  transition: border-color 0.2s;
  background: #26282d;
}
.term-card.expanded { border-color: rgba(25,200,185,0.3); }
.term-card.error { border-color: rgba(224,90,90,0.4); }

.term-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s;
}
.term-header:hover { background: rgba(255,255,255,0.03); }
.term-prompt {
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 12px;
  font-weight: 700;
  color: #19c8b9;
  flex-shrink: 0;
}
.term-cmd {
  flex: 1;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 12px;
  color: #c9ccd1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.term-status { flex-shrink: 0; width: 16px; text-align: center; }
.ok { color: #6fba2c; font-size: 13px; }
.err { color: #e05a5a; font-size: 13px; }
.spinner {
  display: inline-block;
  width: 11px; height: 11px;
  border: 2px solid rgba(25,200,185,0.2);
  border-top-color: #19c8b9;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.term-caret { font-size: 10px; color: #565862; flex-shrink: 0; }

.term-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1);
}
.term-card.expanded .term-body-wrap { grid-template-rows: 1fr; }
.term-body { overflow: hidden; }
.term-output {
  margin: 0;
  padding: 10px 14px;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 11.5px;
  line-height: 1.6;
  background: #1b1c1f;
  color: #c9ccd1;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 280px;
  overflow-y: auto;
}
.term-empty { padding: 10px 14px; font-size: 11px; color: #565862; }
</style>
