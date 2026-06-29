<script setup lang="ts">
/**
 * FileActionCard — ✎ 文件读写内联卡片
 * 横向圆角长条，点击展开 Git Diff 代码比对
 */
import { ref, computed } from 'vue'

const props = defineProps<{
  tool: string          // Read / Write / Edit
  filePath: string
  oldString?: string
  newString?: string
  content?: string
  result?: string       // tool_result 内容
  isError?: boolean
}>()

const expanded = ref(false)

const opLabel = computed(() => {
  const map: Record<string, string> = { Read: 'Read', Write: 'Write', Edit: 'Edit' }
  return map[props.tool] || props.tool
})

const shortPath = computed(() => {
  const p = props.filePath
  if (p.length > 60) return '…/' + p.split('/').slice(-2).join('/')
  return p
})

const hasDiff = computed(() => {
  return props.tool === 'Edit' && (props.oldString || props.newString)
})

const diffLines = computed(() => {
  if (!hasDiff.value) return []
  const oldL = (props.oldString || '').split('\n')
  const newL = (props.newString || '').split('\n')
  const max = Math.max(oldL.length, newL.length)
  const rows: { type: 'del' | 'add' | 'ctx'; old: string; new: string }[] = []
  for (let i = 0; i < max; i++) {
    const o = oldL[i] ?? ''
    const n = newL[i] ?? ''
    if (o === n) rows.push({ type: 'ctx', old: o, new: n })
    else {
      if (o) rows.push({ type: 'del', old: o, new: '' })
      if (n) rows.push({ type: 'add', old: '', new: n })
    }
  }
  return rows
})
</script>

<template>
  <div class="file-card" :class="{ expanded, error: isError }">
    <button class="file-header" @click="expanded = !expanded">
      <span class="file-icon">✎</span>
      <span class="file-op">{{ opLabel }}</span>
      <code class="file-path">{{ shortPath }}</code>
      <span v-if="isError" class="file-status err">✗</span>
      <span v-else-if="result" class="file-status ok">✓</span>
      <span class="file-caret">{{ expanded ? '▾' : '▸' }}</span>
    </button>
    <div class="file-body-wrap">
      <div class="file-body">
        <!-- Edit: 显示 diff -->
        <div v-if="hasDiff" class="diff-block">
          <div class="diff-row del" v-for="(r, i) in diffLines.filter(l => l.type==='del')" :key="'d'+i">
            <span class="diff-marker">-</span><code>{{ r.old }}</code>
          </div>
          <div class="diff-row add" v-for="(r, i) in diffLines.filter(l => l.type==='add')" :key="'a'+i">
            <span class="diff-marker">+</span><code>{{ r.new }}</code>
          </div>
        </div>
        <!-- Write: 显示写入内容预览 -->
        <pre v-else-if="tool === 'Write' && content" class="code-preview">{{ content.slice(0, 500) }}{{ content.length > 500 ? '\n…' : '' }}</pre>
        <!-- Read / 其他: 显示 tool_result -->
        <pre v-else-if="result" class="code-preview">{{ result.slice(0, 800) }}{{ result.length > 800 ? '\n…' : '' }}</pre>
        <div v-else class="file-empty">无内容预览</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-card {
  align-self: flex-start;
  max-width: 82%;
  margin-bottom: 8px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
  transition: border-color 0.2s;
  background: #26282d;
}
.file-card.expanded { border-color: rgba(25,200,185,0.3); }
.file-card.error { border-color: rgba(224,90,90,0.4); }

.file-header {
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
.file-header:hover { background: rgba(255,255,255,0.03); }
.file-icon { font-size: 13px; }
.file-op {
  font-size: 11px;
  font-weight: 700;
  color: #19c8b9;
  background: rgba(25,200,185,0.1);
  padding: 1px 6px;
  border-radius: 5px;
  flex-shrink: 0;
}
.file-path {
  flex: 1;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 12px;
  color: #c9ccd1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-status { font-size: 12px; flex-shrink: 0; }
.file-status.ok { color: #6fba2c; }
.file-status.err { color: #e05a5a; }
.file-caret { font-size: 10px; color: #565862; flex-shrink: 0; }

.file-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1);
}
.file-card.expanded .file-body-wrap { grid-template-rows: 1fr; }
.file-body { overflow: hidden; }

.diff-block, .code-preview {
  margin: 0;
  padding: 10px 14px;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 11.5px;
  line-height: 1.6;
  background: #1b1c1f;
  overflow-x: auto;
  white-space: pre;
}
.diff-row { display: flex; gap: 6px; }
.diff-row.del { background: rgba(224,90,90,0.08); }
.diff-row.add { background: rgba(111,186,44,0.08); }
.diff-marker { color: #565862; flex-shrink: 0; }
.diff-row.del code { color: #e05a5a; }
.diff-row.add code { color: #6fba2c; }
.diff-row code, .code-preview { color: #c9ccd1; }
.file-empty { padding: 10px 14px; font-size: 11px; color: #565862; }
</style>
