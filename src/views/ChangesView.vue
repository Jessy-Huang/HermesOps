<script setup lang="ts">
/**
 * ChangesView — 🔄 Git 变更面板 + 回退点系统
 * --------------------------------------------------------------------------
 * 左侧：文件变更列表（M/A/D 状态色标）+ inline diff 展开
 * 右侧：回退点列表（[snapshot] commits）+ 创建回退点 + 一键回退
 * --------------------------------------------------------------------------
 */
import { ref, computed, onMounted, watch } from 'vue'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

interface ChangedFile { path: string; status: string; type: string; staged: boolean; modified: boolean }
interface Snapshot { hash: string; short: string; label: string; ts: number }
interface DiffHunk { type: 'add' | 'del' | 'ctx' | 'hunk'; text: string }

const workDir = ref('/home/cybot/.hermesops')
const files = ref<ChangedFile[]>([])
const snapshots = ref<Snapshot[]>([])
const expandedFile = ref<string | null>(null)
const currentDiff = ref<DiffHunk[]>([])
const loadingDiff = ref(false)
const creating = ref(false)
const restoring = ref<string | null>(null)
const message = ref('')

const STATUS_COLOR: Record<string, string> = {
  M: '#f5c31c', A: '#6fba2c', D: '#e05a5a', R: '#889df0', '?': '#7a7d84',
}
const STATUS_LABEL: Record<string, string> = {
  M: '修改', A: '新增', D: '删除', R: '重命名', '?': '未跟踪',
}

function statusColor(f: ChangedFile) {
  const c = f.status[0]
  return STATUS_COLOR[c] || '#7a7d84'
}
function statusLabel(f: ChangedFile) {
  const c = f.status[0]
  return STATUS_LABEL[c] || f.status
}

/* ---- 加载文件变更 ---- */
async function loadStatus() {
  try {
    const res = await fetch(`/api/git/status?dir=${encodeURIComponent(workDir.value)}`)
    const data = await res.json()
    files.value = data.files || []
  } catch (e) {
    console.error('loadStatus:', e)
  }
}

/* ---- 加载回退点列表 ---- */
async function loadSnapshots() {
  try {
    const res = await fetch(`/api/git/snapshots?dir=${encodeURIComponent(workDir.value)}`)
    const data = await res.json()
    snapshots.value = data.snapshots || []
  } catch (e) {
    console.error('loadSnapshots:', e)
  }
}

/* ---- 展开/收起文件 diff ---- */
async function toggleDiff(file: ChangedFile) {
  if (expandedFile.value === file.path) {
    expandedFile.value = null
    return
  }
  expandedFile.value = file.path
  currentDiff.value = []
  loadingDiff.value = true
  try {
    const res = await fetch(`/api/git/diff?dir=${encodeURIComponent(workDir.value)}&file=${encodeURIComponent(file.path)}`)
    const data = await res.json()
    if (data.diff) {
      currentDiff.value = parseDiff(data.diff)
    } else {
      // 新增/未跟踪文件无 diff，显示提示
      currentDiff.value = [{ type: 'hunk', text: file.type === 'untracked' ? '新文件，尚无 git 历史' : '无 diff 数据' }]
    }
  } catch (e) {
    currentDiff.value = [{ type: 'hunk', text: '加载失败: ' + e }]
  } finally {
    loadingDiff.value = false
  }
}

/* ---- 解析 unified diff ---- */
function parseDiff(diff: string): DiffHunk[] {
  const lines = diff.split('\n')
  const hunks: DiffHunk[] = []
  for (const line of lines) {
    if (line.startsWith('diff ') || line.startsWith('index ')) continue
    if (line.startsWith('+++') || line.startsWith('---')) continue
    if (line.startsWith('@@')) { hunks.push({ type: 'hunk', text: line }); continue }
    if (line.startsWith('+')) hunks.push({ type: 'add', text: line.slice(1) })
    else if (line.startsWith('-')) hunks.push({ type: 'del', text: line.slice(1) })
    else if (line.startsWith(' ')) hunks.push({ type: 'ctx', text: line.slice(1) })
    else if (line.trim()) hunks.push({ type: 'ctx', text: line })
  }
  return hunks
}

/* ---- 创建回退点 ---- */
async function createSnapshot() {
  const label = prompt('输入回退点标签（描述当前改动）', `AI 改动 - ${props.instance.name}`)
  if (!label) return
  creating.value = true
  try {
    const res = await fetch(`/api/git/snapshot?dir=${encodeURIComponent(workDir.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    const data = await res.json()
    if (data.ok) {
      message.value = `✓ 已创建回退点 ${data.hash.slice(0, 7)}`
      await loadSnapshots()
      await loadStatus()
    } else {
      message.value = data.message || data.error || '创建失败'
    }
  } catch (e) {
    message.value = '创建失败: ' + e
  } finally {
    creating.value = false
    setTimeout(() => message.value = '', 3000)
  }
}

/* ---- 回退到指定快照 ---- */
async function restoreSnapshot(snap: Snapshot) {
  if (!confirm(`确定回退到 "${snap.label}" (${snap.short})？\n\n当前未提交的改动会先备份为一个 commit，不会丢失。`)) return
  restoring.value = snap.hash
  try {
    const res = await fetch(`/api/git/restore?dir=${encodeURIComponent(workDir.value)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash: snap.hash }),
    })
    const data = await res.json()
    if (data.ok) {
      message.value = `✓ ${data.message}`
      await loadStatus()
      await loadSnapshots()
    } else {
      message.value = data.error || '回退失败'
    }
  } catch (e) {
    message.value = '回退失败: ' + e
  } finally {
    restoring.value = null
    setTimeout(() => message.value = '', 4000)
  }
}

/* ---- 格式化时间 ---- */
function fmtTime(ts: number) {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth()+1}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const hasChanges = computed(() => files.value.length > 0)

onMounted(() => {
  loadStatus()
  loadSnapshots()
})

// 切实例时刷新（不同实例可能改了不同文件）
watch(() => props.instance.id, () => {
  loadStatus()
  loadSnapshots()
})
</script>

<template>
  <div class="changes-view">
    <!-- 顶部工具栏 -->
    <div class="changes-toolbar">
      <div class="toolbar-left">
        <h2>🔄 代码变更</h2>
        <span class="cwd" :title="workDir">{{ workDir }}</span>
      </div>
      <div class="toolbar-right">
        <button class="btn-refresh" @click="loadStatus(); loadSnapshots()">↻ 刷新</button>
        <button class="btn-snapshot" :disabled="creating || !hasChanges" @click="createSnapshot">
          {{ creating ? '创建中…' : '📸 创建回退点' }}
        </button>
      </div>
    </div>

    <Transition name="msg">
      <div v-if="message" class="toast">{{ message }}</div>
    </Transition>

    <!-- 主体：左文件变更 + 右回退点 -->
    <div class="changes-body">
      <!-- 左：文件变更 -->
      <section class="files-panel">
        <h3 class="panel-title">
          <span>文件变更</span>
          <span class="count">{{ files.length }}</span>
        </h3>

        <div v-if="!hasChanges" class="empty">
          <div class="empty-icon">✓</div>
          <p>工作区干净，无未提交改动</p>
        </div>

        <ul v-else class="file-list">
          <li
            v-for="f in files"
            :key="f.path"
            class="file-item"
            :class="{ expanded: expandedFile === f.path }"
          >
            <div class="file-row" @click="toggleDiff(f)">
              <span class="file-status" :style="{ color: statusColor(f), borderColor: statusColor(f) }">{{ f.status[0] }}</span>
              <span class="file-path">{{ f.path }}</span>
              <span class="file-type" :style="{ color: statusColor(f) }">{{ statusLabel(f) }}</span>
              <span class="file-caret">{{ expandedFile === f.path ? '▾' : '▸' }}</span>
            </div>

            <!-- inline diff -->
            <div v-if="expandedFile === f.path" class="diff-block">
              <div v-if="loadingDiff" class="diff-loading">加载 diff…</div>
              <div v-else class="diff-content">
                <div v-for="(h, i) in currentDiff" :key="i" class="diff-line" :class="h.type">
                  <span class="diff-marker">{{ h.type === 'add' ? '+' : h.type === 'del' ? '-' : h.type === 'hunk' ? '@' : ' ' }}</span>
                  <code>{{ h.text }}</code>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </section>

      <!-- 右：回退点 -->
      <section class="snapshots-panel">
        <h3 class="panel-title">
          <span>回退点</span>
          <span class="count">{{ snapshots.length }}</span>
        </h3>

        <div v-if="!snapshots.length" class="empty">
          <div class="empty-icon">📸</div>
          <p>暂无回退点</p>
          <p class="empty-hint">AI 改动后点"创建回退点"即可</p>
        </div>

        <ul v-else class="snapshot-list">
          <li
            v-for="(snap, idx) in snapshots"
            :key="snap.hash"
            class="snapshot-item"
            :class="{ first: idx === 0 }"
          >
            <div class="snap-head">
              <span class="snap-led" :class="{ first: idx === 0 }" />
              <span class="snap-label">{{ snap.label }}</span>
              <span class="snap-time">{{ fmtTime(snap.ts) }}</span>
            </div>
            <div class="snap-meta">
              <code class="snap-hash">{{ snap.short }}</code>
              <button
                v-if="idx !== 0"
                class="btn-restore"
                :disabled="restoring === snap.hash"
                @click="restoreSnapshot(snap)"
              >{{ restoring === snap.hash ? '回退中…' : '⟲ 回退到此' }}</button>
              <span v-else class="snap-current">当前</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.changes-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  gap: 10px;
}

.changes-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px;
  flex-shrink: 0;
}
.toolbar-left { display: flex; align-items: baseline; gap: 12px; }
.toolbar-left h2 { margin: 0; font-size: 17px; font-weight: 700; color: #f2f3f5; }
.cwd { font-size: 11px; color: #7a7d84; font-family: 'SF Mono',Consolas,monospace; }
.toolbar-right { display: flex; gap: 8px; }
.btn-refresh, .btn-snapshot {
  font-size: 12px; font-family: inherit;
  padding: 7px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-refresh {
  color: #c9ccd1; background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.08);
}
.btn-refresh:hover { background: #34373d; }
.btn-snapshot {
  color: #0d2b28; background: #19c8b9;
  border: none; font-weight: 700;
}
.btn-snapshot:hover:not(:disabled) { background: #3dd4c6; }
.btn-snapshot:disabled { opacity: 0.4; cursor: not-allowed; }

.toast {
  padding: 8px 14px;
  background: rgba(25,200,185,0.1);
  border: 1px solid rgba(25,200,185,0.3);
  border-radius: 10px;
  font-size: 12px;
  color: #19c8b9;
  flex-shrink: 0;
}
.msg-enter-active, .msg-leave-active { transition: all 0.25s; }
.msg-enter-from, .msg-leave-to { opacity: 0; transform: translateY(-6px); }

.changes-body {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 10px;
  min-height: 0;
}

.files-panel, .snapshots-panel {
  background: #232529;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-title {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px;
  margin: 0;
  font-size: 13px; font-weight: 700;
  color: #f2f3f5;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.count {
  font-size: 10px; font-weight: 700;
  color: #7a7d84;
  background: #2a2d33;
  padding: 1px 7px;
  border-radius: 8px;
}

.empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #565862;
}
.empty-icon { font-size: 32px; opacity: 0.5; }
.empty p { margin: 0; font-size: 13px; }
.empty-hint { font-size: 11px !important; opacity: 0.7; }

/* 文件列表 */
.file-list { list-style: none; margin: 0; padding: 6px; overflow-y: auto; flex: 1; }
.file-item { margin-bottom: 2px; border-radius: 8px; overflow: hidden; }
.file-row {
  display: grid;
  grid-template-columns: 28px 1fr 50px 16px;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.12s;
}
.file-row:hover { background: rgba(255,255,255,0.04); }
.file-item.expanded .file-row { background: rgba(25,200,185,0.06); }

.file-status {
  width: 22px; height: 20px;
  display: grid; place-items: center;
  font-size: 10px; font-weight: 800;
  border: 1px solid; border-radius: 5px;
}
.file-path {
  font-size: 12px;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  color: #c9ccd1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-type { font-size: 10px; text-align: right; }
.file-caret { font-size: 10px; color: #565862; }

.diff-block {
  border-top: 1px solid rgba(255,255,255,0.04);
  background: #1b1c1f;
  max-height: 360px;
  overflow-y: auto;
}
.diff-loading { padding: 14px; font-size: 12px; color: #565862; }
.diff-line {
  display: flex;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 11.5px;
  line-height: 1.55;
  padding: 0 8px;
}
.diff-marker { width: 18px; flex-shrink: 0; color: #565862; text-align: center; }
.diff-line code { color: #c9ccd1; white-space: pre-wrap; word-break: break-all; }
.diff-line.add { background: rgba(111,186,44,0.08); }
.diff-line.add code { color: #8fd44f; }
.diff-line.add .diff-marker { color: #6fba2c; }
.diff-line.del { background: rgba(224,90,90,0.08); }
.diff-line.del code { color: #e88; }
.diff-line.del .diff-marker { color: #e05a5a; }
.diff-line.hunk { color: #889df0; padding: 4px 8px; }
.diff-line.hunk code { color: #889df0; font-weight: 600; }

/* 回退点列表 */
.snapshot-list { list-style: none; margin: 0; padding: 8px; overflow-y: auto; flex: 1; }
.snapshot-item {
  position: relative;
  padding: 10px 12px;
  margin-bottom: 6px;
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 10px;
  transition: border-color 0.15s;
}
.snapshot-item.first { border-color: rgba(25,200,185,0.3); background: rgba(25,200,185,0.04); }
.snap-head {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 6px;
}
.snap-led {
  width: 8px; height: 8px; border-radius: 50%;
  background: #565862;
  flex-shrink: 0;
}
.snap-led.first { background: #19c8b9; box-shadow: 0 0 6px #19c8b9; }
.snap-label { flex: 1; font-size: 12px; font-weight: 600; color: #f2f3f5; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snap-time { font-size: 10px; color: #565862; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.snap-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.snap-hash { font-family: 'SF Mono',Consolas,monospace; font-size: 10px; color: #7a7d84; }
.btn-restore {
  font-size: 10px; font-family: inherit;
  padding: 3px 9px;
  color: #f5c31c;
  background: rgba(245,195,28,0.1);
  border: 1px solid rgba(245,195,28,0.25);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-restore:hover:not(:disabled) { background: rgba(245,195,28,0.2); }
.btn-restore:disabled { opacity: 0.5; cursor: not-allowed; }
.snap-current {
  font-size: 10px; font-weight: 700;
  color: #19c8b9;
  background: rgba(25,200,185,0.1);
  padding: 3px 9px;
  border-radius: 6px;
}

@media (max-width: 880px) {
  .changes-body { grid-template-columns: 1fr; }
}
</style>
