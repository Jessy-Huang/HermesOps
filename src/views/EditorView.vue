<script setup lang="ts">
/**
 * EditorView — 🛠️ VSCode 风格代码编辑器
 * Monaco Editor + 文件树 + 多标签页 + 工作目录切换
 * --------------------------------------------------------------------------
 */
import { ref, shallowRef, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

interface FileNode { name: string; path: string; type: 'dir' | 'file'; children?: FileNode[]; size?: number }
interface Tab { path: string; name: string; dirty: boolean; model: monaco.editor.ITextModel | null }

const containerRef = ref<HTMLElement | null>(null)
const tree = ref<FileNode[]>([])
const tabs = ref<Tab[]>([])
const activeTab = ref<string | null>(null)
const workDir = ref('')
const expanded = ref<Set<string>>(new Set())
const loading = ref(false)
const editorEl = ref<HTMLElement | null>(null)

const editor = shallowRef<monaco.editor.IStandaloneCodeEditor | null>(null)

/* ---- 语言检测 ---- */
const LANG_MAP: Record<string, string> = {
  js: 'javascript', mjs: 'javascript', ts: 'typescript', vue: 'html',
  json: 'json', md: 'markdown', html: 'html', css: 'css', sh: 'shell',
  py: 'python', yml: 'yaml', yaml: 'yaml', toml: 'ini',
}

function detectLang(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return LANG_MAP[ext] || 'plaintext'
}

function shortName(path: string): string {
  return path.split('/').pop() || path
}

/* ---- 加载文件树 ---- */
async function loadTree() {
  loading.value = true
  try {
    const res = await fetch(`/api/files?dir=${encodeURIComponent(workDir.value)}`)
    const data = await res.json()
    tree.value = data.tree || []
    workDir.value = data.root
  } catch (e) {
    console.error('loadTree:', e)
  } finally {
    loading.value = false
  }
}

/* ---- 切换目录展开 ---- */
function toggleExpand(node: FileNode) {
  if (node.type !== 'dir') return
  if (expanded.value.has(node.path)) expanded.value.delete(node.path)
  else expanded.value.add(node.path)
}

/* ---- 打开文件 ---- */
async function openFile(node: FileNode) {
  if (node.type !== 'file') return
  if (tabs.value.find(t => t.path === node.path)) {
    activeTab.value = node.path
    return
  }
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(node.path)}`)
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    const lang = detectLang(node.path)
    const model = monaco.editor.createModel(data.content || '', lang)
    model.onDidChangeContent(() => {
      const tab = tabs.value.find(t => t.path === node.path)
      if (tab) tab.dirty = true
    })
    tabs.value.push({ path: node.path, name: shortName(node.path), dirty: false, model })
    activeTab.value = node.path
  } catch (e) {
    console.error('openFile:', e)
  }
}

/* ---- 切换标签 ---- */
function switchTab(path: string) {
  activeTab.value = path
}

/* ---- 关闭标签 ---- */
function closeTab(path: string, e: Event) {
  e.stopPropagation()
  const idx = tabs.value.findIndex(t => t.path === path)
  if (idx === -1) return
  tabs.value[idx].model?.dispose()
  tabs.value.splice(idx, 1)
  if (activeTab.value === path) {
    activeTab.value = tabs.value[idx]?.path || tabs.value[idx - 1]?.path || null
  }
}

/* ---- 保存文件 ---- */
async function saveCurrent() {
  const tab = tabs.value.find(t => t.path === activeTab.value)
  if (!tab || !tab.dirty) return
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(tab.path)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: tab.model?.getValue() || '' }),
    })
    const data = await res.json()
    if (data.ok) tab.dirty = false
    else alert(data.error)
  } catch (e) {
    alert('保存失败: ' + e)
  }
}

/* ---- Monaco 编辑器初始化 ---- */
function initEditor() {
  if (!editorEl.value || editor.value) return
  editor.value = monaco.editor.create(editorEl.value, {
    theme: 'vs-dark',
    fontSize: 13,
    fontFamily: "'SF Mono','Fira Code',Consolas,monospace",
    minimap: { enabled: true },
    automaticLayout: true,
    tabSize: 2,
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    renderWhitespace: 'selection',
  })
  // Ctrl+S 保存
  editor.value.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, saveCurrent)
}

/* ---- 切换标签时切换 model ---- */
watch(activeTab, (path) => {
  if (!editor.value || !path) return
  const tab = tabs.value.find(t => t.path === path)
  if (tab?.model) editor.value.setModel(tab.model)
})

/* ---- 改工作目录 ---- */
async function changeWorkDir() {
  const dir = prompt('输入工作目录（绝对路径，如 /home/cybot/.hermesops）', workDir.value)
  if (dir && dir !== workDir.value) {
    workDir.value = dir
    await loadTree()
  }
}

/* ---- 树渲染辅助 ---- */
function isExpanded(path: string) { return expanded.value.has(path) }

onMounted(async () => {
  await nextTick()
  initEditor()
  workDir.value = '/home/cybot/.hermesops'
  await loadTree()
  // 默认展开 src
  expanded.value.add('/home/cybot/.hermesops/src')
})

onBeforeUnmount(() => {
  editor.value?.dispose()
})
</script>

<template>
  <div class="editor-view">
    <!-- 文件树侧栏 -->
    <aside class="file-tree">
      <div class="tree-head">
        <span class="tree-title">资源管理器</span>
        <button class="tree-btn" title="切换工作目录" @click="changeWorkDir">📂</button>
        <button class="tree-btn" title="刷新" @click="loadTree">↻</button>
      </div>
      <div class="tree-cwd" :title="workDir">{{ workDir }}</div>
      <div class="tree-body">
        <div v-if="loading" class="tree-loading">加载中…</div>
        <template v-else>
          <div v-for="node in tree" :key="node.path">
            <div
              class="tree-node"
              :class="{ dir: node.type === 'dir', expanded: isExpanded(node.path) }"
              @click="node.type === 'dir' ? toggleExpand(node) : openFile(node)"
            >
              <span class="node-icon">{{ node.type === 'dir' ? (isExpanded(node.path) ? '📂' : '📁') : '📄' }}</span>
              <span class="node-name">{{ node.name }}</span>
            </div>
            <div v-if="node.type === 'dir' && isExpanded(node.path) && node.children" class="tree-children">
              <div
                v-for="child in node.children"
                :key="child.path"
                class="tree-node"
                :class="{ dir: child.type === 'dir', expanded: isExpanded(child.path), active: activeTab === child.path }"
                :style="{ paddingLeft: '14px' }"
                @click="child.type === 'dir' ? toggleExpand(child) : openFile(child)"
              >
                <span class="node-icon">{{ child.type === 'dir' ? (isExpanded(child.path) ? '📂' : '📁') : '📄' }}</span>
                <span class="node-name">{{ child.name }}</span>
              </div>
              <!-- 递归：再深一层 -->
              <template v-for="child in node.children" :key="'sub-' + child.path">
                <template v-if="child.type === 'dir' && isExpanded(child.path) && child.children">
                  <div
                    v-for="gc in child.children"
                    :key="gc.path"
                    class="tree-node"
                    :class="{ active: activeTab === gc.path }"
                    :style="{ paddingLeft: '28px' }"
                    @click="gc.type === 'dir' ? toggleExpand(gc) : openFile(gc)"
                  >
                    <span class="node-icon">{{ gc.type === 'dir' ? (isExpanded(gc.path) ? '📂' : '📁') : '📄' }}</span>
                    <span class="node-name">{{ gc.name }}</span>
                  </div>
                </template>
              </template>
            </div>
          </div>
        </template>
      </div>
    </aside>

    <!-- 编辑器主区 -->
    <main class="editor-main">
      <!-- 标签页栏 -->
      <div class="tabs-bar">
        <div
          v-for="tab in tabs"
          :key="tab.path"
          class="tab"
          :class="{ active: activeTab === tab.path }"
          @click="switchTab(tab.path)"
        >
          <span class="tab-icon">📄</span>
          <span class="tab-name">{{ tab.name }}</span>
          <span class="tab-dirty" :class="{ on: tab.dirty }">●</span>
          <span class="tab-close" @click="closeTab(tab.path, $event)">×</span>
        </div>
        <div v-if="!tabs.length" class="tabs-empty">打开左侧文件开始编辑（Ctrl+S 保存）</div>
        <div class="tabs-spacer" />
        <button v-if="activeTab" class="save-btn" @click="saveCurrent">💾 保存</button>
      </div>

      <!-- Monaco 容器 -->
      <div ref="editorEl" class="monaco-container" />
    </main>
  </div>
</template>

<style scoped>
.editor-view {
  display: flex;
  height: calc(100vh - 140px);
  background: #1e1e1e;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  overflow: hidden;
}

/* 文件树 */
.file-tree {
  width: 240px;
  flex-shrink: 0;
  background: #252526;
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
}
.tree-head {
  display: flex; align-items: center; gap: 4px;
  padding: 10px 12px 8px;
}
.tree-title { flex: 1; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7a7d84; text-transform: uppercase; }
.tree-btn {
  width: 24px; height: 24px;
  font-size: 12px;
  background: none; border: none; cursor: pointer;
  border-radius: 5px; color: #7a7d84;
  transition: background 0.15s;
}
.tree-btn:hover { background: rgba(255,255,255,0.06); color: #c9ccd1; }
.tree-cwd {
  padding: 4px 14px 8px;
  font-size: 10px;
  color: #565862;
  font-family: 'SF Mono',Consolas,monospace;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tree-body { flex: 1; overflow-y: auto; padding: 0 4px 10px; }
.tree-body::-webkit-scrollbar { width: 6px; }
.tree-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 6px; }
.tree-loading { padding: 14px; font-size: 12px; color: #565862; }

.tree-node {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 10px;
  font-size: 13px;
  color: #c9ccd1;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.12s;
  user-select: none;
}
.tree-node:hover { background: rgba(255,255,255,0.05); }
.tree-node.active { background: rgba(25,200,185,0.14); color: #19c8b9; }
.node-icon { font-size: 12px; flex-shrink: 0; }
.node-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tree-children { }

/* 编辑器主区 */
.editor-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tabs-bar {
  display: flex; align-items: center;
  background: #252526;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  min-height: 36px;
  padding: 0 4px;
}
.tab {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 12px;
  font-size: 12px;
  color: #7a7d84;
  cursor: pointer;
  border-right: 1px solid rgba(255,255,255,0.04);
  transition: background 0.12s, color 0.12s;
}
.tab:hover { background: rgba(255,255,255,0.04); color: #c9ccd1; }
.tab.active { background: #1e1e1e; color: #fff; }
.tab-icon { font-size: 11px; }
.tab-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-dirty { color: transparent; font-size: 9px; }
.tab-dirty.on { color: #f5c31c; }
.tab-close {
  width: 16px; height: 16px;
  display: grid; place-items: center;
  font-size: 14px; color: #565862;
  border-radius: 4px;
  margin-left: 2px;
}
.tab-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
.tabs-empty { padding: 0 14px; font-size: 12px; color: #565862; align-self: center; }
.tabs-spacer { flex: 1; }
.save-btn {
  padding: 5px 12px;
  font-size: 12px;
  font-family: inherit;
  color: #19c8b9;
  background: rgba(25,200,185,0.1);
  border: 1px solid rgba(25,200,185,0.25);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}
.save-btn:hover { background: rgba(25,200,185,0.2); }

.monaco-container {
  flex: 1;
  min-height: 0;
}
</style>
