<script setup lang="ts">
/**
 * HermesOps — MainLayout.vue
 * --------------------------------------------------------------------------
 * 智能体后台导航总线 (Agent Console Navigation Bus)
 *
 * 设计语言：animal-island-ui 的圆润 / 软阴影 / 薄荷青 (#19c8b9) 质感，
 *           按用户要求适配为低饱和深灰色系 + 白色高亮选中块。
 *
 * 灵魂契约：服务于 1~13 个 AI 编码工具实例。当用户在【实例】中切换工具时，
 *           currentInstance 变更，下方所有工作区面板的状态（UUID / 沙盒路径）
 *           通过 <slot/> 与 instance-change 事件同步刷新到对应沙盒环境。
 * --------------------------------------------------------------------------
 */
import { ref, computed, reactive, onMounted, onBeforeUnmount } from 'vue'

/* =========================================================================
 * 1. 类型定义 (Types)
 * ======================================================================= */
interface ToolInstance {
  id: string        // '01_codebuddy'
  name: string      // 'CodeBuddy'
  type: 'Code' | 'Agent' | 'Gate'
  cmd: string       // 启动指令
  quota: string     // 额度
  pros: string
  cons: string
  uuid: string      // 沙盒 UUID
  sandbox: string   // 沙盒路径
}

interface MenuItem {
  key: string
  label: string
  icon: string
  desc?: string
}

interface MenuSection {
  title: string
  items: MenuItem[]
}

/* =========================================================================
 * 2. 实例注册表 (1~13 AI 编码工具，源自 core/plugins/*.sh)
 *    数据源抽离至 ./instances.ts，供 InstancesView 共享
 * ======================================================================= */
import { INSTANCES } from './instances'

/* =========================================================================
 * 3. 导航矩阵 (4 大功能区 × 16 菜单项)
 * ======================================================================= */
const MENU: MenuSection[] = [
  {
    title: '核心控制',
    items: [
      { key: 'chat',      label: '对话',     icon: '💬', desc: 'AI 交互主视窗' },
      { key: 'instances', label: '实例',     icon: '⚙️', desc: '切换 AI 工具沙盒' },
      { key: 'remote',    label: '远程控制', icon: '📡', desc: 'GPU 集群连接状态' },
    ],
  },
  {
    title: '工作区',
    items: [
      { key: 'tasks',    label: '任务',   icon: '📋', desc: '子任务流水线看板' },
      { key: 'terminal', label: '终端',   icon: '🖥️', desc: '实时 TTY 终端流' },
      { key: 'canvas',   label: '画布',   icon: '🎨', desc: '代码调用依赖图谱' },
      { key: 'editor',   label: '编辑器', icon: '🛠️', desc: '沙盒文件预览 / Diff' },
      { key: 'changes',  label: '变更',   icon: '🔄', desc: 'Git diff 暂存区' },
      { key: 'plugins',  label: '插件',   icon: '🔌', desc: 'Skill 算子管理' },
    ],
  },
  {
    title: '可观测',
    items: [
      { key: 'metrics', label: '统计', icon: '📉', desc: 'Token / 耗时 / 成功率' },
      { key: 'tracing', label: '链路', icon: '🔗', desc: 'Hand-off 控制权流转' },
      { key: 'monitor', label: '监控', icon: '⚡', desc: 'CPU / GPU / 内存负载' },
      { key: 'logs',    label: '日志', icon: '📝', desc: 'stdout / stderr 滚动流' },
    ],
  },
  {
    title: '配置',
    items: [
      { key: 'settings',  label: '设置',   icon: '🔧', desc: 'config.json 全局中心' },
      { key: 'shortcuts', label: '快捷键', icon: '⌨️', desc: '前端热键绑定' },
      { key: 'docs',      label: '文档',   icon: '📄', desc: '使用指南 / 开发契约' },
    ],
  },
]

const ALL_ITEMS = MENU.flatMap(s => s.items)

/* =========================================================================
 * 4. 响应式状态 (Reactive State)
 * ======================================================================= */
const currentInstance = ref<ToolInstance>(INSTANCES[0])
const activeView = ref<string>('chat')
const popoverOpen = ref(false)
const filterQuery = ref('')
const remoteStatus = reactive({ connected: true, host: 'gpu-cluster-01', latencyMs: 28 })

const emit = defineEmits<{
  (e: 'select', key: string, instance: ToolInstance): void
  (e: 'instance-change', instance: ToolInstance): void
}>()

/* =========================================================================
 * 5. 计算属性 (Computed)
 * ======================================================================= */
const activeItem = computed(() => ALL_ITEMS.find(i => i.key === activeView.value))

const filteredInstances = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return INSTANCES
  return INSTANCES.filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.id.toLowerCase().includes(q) ||
    t.type.toLowerCase().includes(q),
  )
})

const typeColor = (type: ToolInstance['type']): string => ({
  Code: '#889df0',
  Agent: '#b77dee',
  Gate: '#82d5bb',
}[type])

/* =========================================================================
 * 6. 交互方法 (Methods)
 * ======================================================================= */
function selectItem(key: string) {
  if (key === 'instances') {
    popoverOpen.value = !popoverOpen.value
    return
  }
  popoverOpen.value = false
  activeView.value = key
  emit('select', key, currentInstance.value)
}

function switchInstance(inst: ToolInstance) {
  currentInstance.value = inst
  popoverOpen.value = false
  emit('instance-change', inst)
}

function closePopover() {
  popoverOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePopover()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="hermes-layout">
    <!-- ============================= 侧边栏 ============================= -->
    <aside class="sidebar">
      <!-- 品牌 -->
      <header class="brand">
        <div class="brand-mark">🚀</div>
        <div class="brand-text">
          <span class="brand-name">HermesOps</span>
          <span class="brand-ver">v5.0</span>
        </div>
      </header>

      <!-- 导航区 -->
      <nav class="nav" @click.self="closePopover">
        <section v-for="sec in MENU" :key="sec.title" class="nav-section">
          <h3 class="nav-title">{{ sec.title }}</h3>
          <ul class="nav-list">
            <li
              v-for="item in sec.items"
              :key="item.key"
              class="nav-item"
              :class="{
                active: activeView === item.key,
                'instance-trigger': item.key === 'instances',
              }"
              :title="item.desc"
              @click="selectItem(item.key)"
            >
              <span class="nav-icon">{{ item.icon }}</span>
              <span class="nav-label">{{ item.label }}</span>
              <span v-if="item.key === 'instances'" class="nav-caret">▾</span>
              <span v-else-if="item.key === 'remote'" class="nav-dot" :class="{ on: remoteStatus.connected }" />
            </li>
          </ul>

          <!-- 实例切换浮层：紧贴 instances 项展开 -->
          <Transition name="popover">
            <div v-if="popoverOpen && sec.title === '核心控制'" class="popover" @click.stop>
              <div class="popover-head">
                <span class="popover-title">切换工具实例</span>
                <span class="popover-count">{{ INSTANCES.length }}</span>
              </div>
              <div class="popover-search">
                <input
                  v-model="filterQuery"
                  type="text"
                  placeholder="搜索工具 / 类型…"
                  spellcheck="false"
                />
              </div>
              <ul class="inst-list">
                <li
                  v-for="(inst, idx) in filteredInstances"
                  :key="inst.id"
                  class="inst-row"
                  :class="{ active: inst.id === currentInstance.id }"
                  @click="switchInstance(inst)"
                >
                  <span class="inst-idx">{{ inst.id.split('_')[0] }}</span>
                  <span class="inst-name">{{ inst.name }}</span>
                  <span class="inst-type" :style="{ color: typeColor(inst.type), borderColor: typeColor(inst.type) }">{{ inst.type }}</span>
                  <span class="inst-quota">{{ inst.quota }}</span>
                  <span v-if="inst.id === currentInstance.id" class="inst-tick">✓</span>
                  <span v-else class="inst-go">→</span>
                </li>
                <li v-if="!filteredInstances.length" class="inst-empty">无匹配实例</li>
              </ul>
            </div>
          </Transition>
        </section>
      </nav>

      <!-- 底部：当前实例胶囊 -->
      <footer class="sidebar-foot">
        <div class="capsule">
          <span class="capsule-type" :style="{ background: typeColor(currentInstance.type) }">{{ currentInstance.type }}</span>
          <div class="capsule-meta">
            <span class="capsule-name">{{ currentInstance.name }}</span>
            <span class="capsule-uuid">{{ currentInstance.uuid.slice(0, 13) }}…</span>
          </div>
        </div>
      </footer>
    </aside>

    <!-- ============================= 主内容 ============================= -->
    <main class="content">
      <!-- 实例信息条：切换实例后整个条目同步刷新 -->
      <header class="infobar">
        <div class="infobar-left">
          <h1 class="view-title">
            <span class="view-icon">{{ activeItem?.icon }}</span>
            {{ activeItem?.label }}
          </h1>
          <span class="view-desc">{{ activeItem?.desc }}</span>
        </div>
        <div class="infobar-right">
          <div class="inst-chip">
            <span class="chip-led" :style="{ background: typeColor(currentInstance.type) }" />
            <span class="chip-name">{{ currentInstance.name }}</span>
            <span class="chip-uuid">UUID · {{ currentInstance.uuid }}</span>
          </div>
          <div class="sandbox-chip" :title="currentInstance.sandbox">
            <span class="chip-key">SANDBOX</span>
            <code class="chip-path">{{ currentInstance.sandbox }}</code>
          </div>
        </div>
      </header>

      <!-- 视图主体：由路由 / 父组件注入，默认展示当前实例上下文 -->
      <section class="view-body">
        <slot :view="activeView" :instance="currentInstance">
          <div class="placeholder">
            <div class="placeholder-icon">{{ activeItem?.icon }}</div>
            <h2>{{ activeItem?.label }} · {{ currentInstance.name }}</h2>
            <p>{{ activeItem?.desc }}</p>
            <p class="placeholder-hint">
              切换实例后，此面板将自动加载 <code>{{ currentInstance.id }}</code> 沙盒的对应数据。
            </p>
          </div>
        </slot>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* =========================================================================
 * 主题令牌：低饱和深灰 + animal-island 圆润质感
 * ======================================================================= */
.hermes-layout {
  --hi-bg:        #1b1c1f;   /* 侧边栏底色 */
  --hi-bg-deep:   #151619;   /* 最深 */
  --hi-bg-soft:   #232529;   /* 悬浮 */
  --hi-content:   #202225;   /* 内容区 */
  --hi-surface:   #2a2d33;   /* 卡片 */
  --hi-line:      rgba(255, 255, 255, 0.06);
  --hi-text:      #c9ccd1;
  --hi-text-strong: #f2f3f5;
  --hi-text-muted: #7a7d84;
  --hi-text-dim:  #565862;
  --hi-accent:    #19c8b9;   /* animal-island 薄荷青 */
  --hi-accent-soft: rgba(25, 200, 185, 0.14);
  --hi-selected-bg: #ffffff; /* 白色高亮包裹块 */
  --hi-selected-text: #2a2d33;
  --hi-warn:  #f5c31c;
  --hi-error: #e05a5a;
  --hi-ok:    #6fba2c;
  --radius:    12px;         /* animal-island 最小圆角 */
  --radius-lg: 16px;
  --radius-xl: 20px;
  --ease: cubic-bezier(0.4, 0, 0.2, 1);

  display: flex;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  font-family: Nunito, 'Noto Sans SC', -apple-system, 'PingFang SC', sans-serif;
  font-weight: 500;
  color: var(--hi-text);
  background: var(--hi-bg-deep);
  -webkit-font-smoothing: antialiased;
}

/* ============================ 侧边栏 ============================ */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--hi-bg);
  border-right: 1px solid var(--hi-line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 14px;
}
.brand-mark {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  font-size: 18px;
  border-radius: var(--radius);
  background: var(--hi-accent-soft);
  box-shadow: inset 0 0 0 1px rgba(25, 200, 185, 0.25);
}
.brand-text { display: flex; flex-direction: column; line-height: 1.15; }
.brand-name { font-size: 15px; font-weight: 800; color: var(--hi-text-strong); letter-spacing: 0.01em; }
.brand-ver  { font-size: 10px; font-weight: 700; color: var(--hi-accent); letter-spacing: 0.05em; }

/* ============================ 导航 ============================ */
.nav {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px;
  position: relative;
}
.nav::-webkit-scrollbar { width: 6px; }
.nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 8px; }

.nav-section { margin-bottom: 6px; }
.nav-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--hi-text-muted);
  padding: 14px 14px 6px;
  text-transform: none;
}
.nav-list { list-style: none; margin: 0; padding: 0; }

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 40px;
  padding: 0 14px 0 26px;
  margin: 1px 5px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  color: var(--hi-text);
  cursor: pointer;
  transition: all 0.18s var(--ease);
  user-select: none;
}
.nav-item:hover {
  background: var(--hi-bg-soft);
  color: var(--hi-text-strong);
}
.nav-icon {
  font-size: 15px;
  width: 18px;
  text-align: center;
  line-height: 1;
  transition: transform 0.18s var(--ease);
}
.nav-item:hover .nav-icon { transform: scale(1.12); }
.nav-label { flex: 1; }

/* 选中：白色高亮包裹块 + 圆角切边 + 薄荷青左指示条 */
.nav-item.active {
  background: var(--hi-selected-bg);
  color: var(--hi-selected-text);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.28);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 3px;
  background: var(--hi-accent);
}
.nav-item.active .nav-icon { transform: scale(1.1); }

.nav-caret { font-size: 10px; opacity: 0.7; transition: transform 0.18s var(--ease); }
.instance-trigger.is-open .nav-caret { transform: rotate(180deg); }

/* 远程状态小圆点 */
.nav-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--hi-text-dim);
  box-shadow: 0 0 0 2px rgba(255,255,255,0.04);
}
.nav-dot.on {
  background: var(--hi-ok);
  box-shadow: 0 0 0 2px rgba(111,186,44,0.18), 0 0 8px rgba(111,186,44,0.6);
}

/* ============================ 实例浮层 ============================ */
.popover {
  position: relative;
  margin: 4px 5px 8px;
  background: var(--hi-surface);
  border: 1px solid var(--hi-line);
  border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  z-index: 20;
}
.popover-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 11px 14px 8px;
}
.popover-title { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: var(--hi-text-muted); }
.popover-count {
  font-size: 10px; font-weight: 700;
  color: var(--hi-accent);
  background: var(--hi-accent-soft);
  padding: 1px 7px; border-radius: 8px;
}
.popover-search { padding: 0 10px 8px; }
.popover-search input {
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  padding: 0 12px;
  font-size: 12px;
  font-family: inherit;
  color: var(--hi-text);
  background: var(--hi-bg-deep);
  border: 1px solid var(--hi-line);
  border-radius: 10px;
  outline: none;
  transition: border-color 0.18s var(--ease), box-shadow 0.18s var(--ease);
}
.popover-search input::placeholder { color: var(--hi-text-dim); }
.popover-search input:focus {
  border-color: var(--hi-accent);
  box-shadow: 0 0 0 3px var(--hi-accent-soft);
}

.inst-list {
  list-style: none; margin: 0; padding: 0 6px 8px;
  max-height: 320px; overflow-y: auto;
}
.inst-list::-webkit-scrollbar { width: 6px; }
.inst-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 8px; }

.inst-row {
  display: grid;
  grid-template-columns: 26px 1fr auto auto 18px;
  align-items: center;
  gap: 9px;
  padding: 8px 10px;
  margin: 1px 0;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s var(--ease), color 0.15s var(--ease);
}
.inst-row:hover { background: var(--hi-bg-soft); }
.inst-row.active { background: var(--hi-accent-soft); }
.inst-idx { font-size: 10px; font-weight: 700; color: var(--hi-text-dim); font-variant-numeric: tabular-nums; }
.inst-name { font-size: 13px; font-weight: 600; color: var(--hi-text-strong); }
.inst-row.active .inst-name { color: var(--hi-accent); }
.inst-type {
  font-size: 9px; font-weight: 700; letter-spacing: 0.04em;
  padding: 1px 6px; border-radius: 6px;
  border: 1px solid; opacity: 0.9;
}
.inst-quota { font-size: 10px; color: var(--hi-text-muted); white-space: nowrap; }
.inst-tick { color: var(--hi-accent); font-weight: 800; font-size: 13px; }
.inst-go { color: var(--hi-text-dim); font-size: 13px; transition: transform 0.15s var(--ease); }
.inst-row:hover .inst-go { color: var(--hi-accent); transform: translateX(2px); }
.inst-empty { padding: 16px; text-align: center; font-size: 12px; color: var(--hi-text-dim); }

/* 浮层出入动画 */
.popover-enter-active, .popover-leave-active {
  transition: opacity 0.2s var(--ease), transform 0.2s var(--ease);
}
.popover-enter-from, .popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scaleY(0.96);
  transform-origin: top;
}

/* ============================ 侧边栏底部胶囊 ============================ */
.sidebar-foot { padding: 12px 12px 16px; border-top: 1px solid var(--hi-line); }
.capsule {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 11px;
  background: var(--hi-bg-deep);
  border-radius: var(--radius);
  border: 1px solid var(--hi-line);
}
.capsule-type {
  font-size: 9px; font-weight: 800; color: #fff;
  padding: 3px 7px; border-radius: 7px; letter-spacing: 0.04em;
}
.capsule-meta { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.capsule-name { font-size: 12px; font-weight: 700; color: var(--hi-text-strong); }
.capsule-uuid { font-size: 10px; color: var(--hi-text-dim); font-variant-numeric: tabular-nums; }

/* ============================ 主内容区 ============================ */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--hi-content);
}

.infobar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--hi-line);
  background: var(--hi-bg);
}
.infobar-left { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.view-title {
  display: flex; align-items: center; gap: 9px;
  margin: 0;
  font-size: 17px; font-weight: 700;
  color: var(--hi-text-strong);
  letter-spacing: 0.01em;
}
.view-icon { font-size: 17px; }
.view-desc { font-size: 12px; color: var(--hi-text-muted); }

.infobar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.inst-chip, .sandbox-chip {
  display: flex; align-items: center; gap: 8px;
  height: 34px;
  padding: 0 12px;
  background: var(--hi-surface);
  border: 1px solid var(--hi-line);
  border-radius: 10px;
  font-size: 11px;
}
.chip-led { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
.chip-name { font-weight: 700; color: var(--hi-text-strong); }
.chip-uuid { color: var(--hi-text-dim); font-variant-numeric: tabular-nums; }
.chip-key { font-size: 9px; font-weight: 800; letter-spacing: 0.06em; color: var(--hi-text-muted); }
.chip-path {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: var(--hi-accent);
  max-width: 240px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ============================ 视图主体 ============================ */
.view-body {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  color: var(--hi-text-muted);
}
.placeholder-icon {
  font-size: 44px;
  margin-bottom: 6px;
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.4));
}
.placeholder h2 { margin: 0; font-size: 18px; font-weight: 700; color: var(--hi-text-strong); }
.placeholder p { margin: 0; font-size: 13px; }
.placeholder-hint { margin-top: 6px !important; font-size: 12px; color: var(--hi-text-dim); }
.placeholder code {
  font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: var(--hi-accent);
  background: var(--hi-accent-soft);
  padding: 1px 6px;
  border-radius: 6px;
}

/* ============================ 响应式 ============================ */
@media (max-width: 1080px) {
  .sandbox-chip .chip-path { max-width: 140px; }
}
@media (max-width: 880px) {
  .infobar-right .sandbox-chip { display: none; }
}
</style>
