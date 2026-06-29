<script setup lang="ts">
/**
 * PanelView — 通用占位面板
 * 用于尚未专门实现的 11 个菜单项，统一展示视图元信息 + 当前实例上下文
 */
import { computed } from 'vue'
import { findItem } from '../menu'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

const meta = computed(() => findItem(props.view.key))
</script>

<template>
  <div class="panel">
    <div class="panel-head">
      <div class="panel-icon">{{ meta?.icon }}</div>
      <div class="panel-title">
        <h2>{{ meta?.label }}</h2>
        <p>{{ meta?.desc }}</p>
      </div>
    </div>

    <div class="panel-body">
      <div class="ctx-card">
        <div class="ctx-row">
          <span class="ctx-key">当前实例</span>
          <span class="ctx-val">{{ instance.name }}</span>
          <span class="ctx-type" :style="{ color: instance.type === 'Agent' ? '#b77dee' : '#889df0' }">{{ instance.type }}</span>
        </div>
        <div class="ctx-row">
          <span class="ctx-key">实例 ID</span>
          <code class="ctx-mono">{{ instance.id }}</code>
        </div>
        <div class="ctx-row">
          <span class="ctx-key">沙盒路径</span>
          <code class="ctx-mono">{{ instance.sandbox }}</code>
        </div>
        <div class="ctx-row">
          <span class="ctx-key">沙盒 UUID</span>
          <code class="ctx-mono">{{ instance.uuid }}</code>
        </div>
      </div>

      <div class="todo">
        <span class="todo-badge">待接入</span>
        <p>该面板将在后续接入后端数据源。切换侧边栏 <strong>⚙️ 实例</strong> 可立即看到本卡片上下文同步刷新。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  max-width: 720px;
  margin: 0 auto;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.panel-icon {
  font-size: 40px;
  width: 64px; height: 64px;
  display: grid; place-items: center;
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  filter: drop-shadow(0 6px 14px rgba(0,0,0,0.3));
}
.panel-title h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; color: #f2f3f5; }
.panel-title p { margin: 0; font-size: 13px; color: #7a7d84; }

.ctx-card {
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 18px 20px;
  margin-bottom: 18px;
}
.ctx-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 9px 0;
  border-bottom: 1px dashed rgba(255,255,255,0.05);
  font-size: 13px;
}
.ctx-row:last-child { border-bottom: none; }
.ctx-key { width: 88px; flex-shrink: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; color: #7a7d84; }
.ctx-val { font-weight: 700; color: #f2f3f5; }
.ctx-type { font-size: 10px; font-weight: 700; padding: 1px 7px; border: 1px solid currentColor; border-radius: 6px; }
.ctx-mono { font-family: 'SF Mono','Fira Code',Consolas,monospace; font-size: 12px; color: #19c8b9; }

.todo {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px;
  background: rgba(25,200,185,0.06);
  border: 1px solid rgba(25,200,185,0.18);
  border-radius: 14px;
}
.todo-badge {
  flex-shrink: 0;
  font-size: 10px; font-weight: 800; letter-spacing: 0.05em;
  color: #19c8b9;
  background: rgba(25,200,185,0.14);
  padding: 3px 8px;
  border-radius: 8px;
  margin-top: 1px;
}
.todo p { margin: 0; font-size: 13px; line-height: 1.6; color: #c9ccd1; }
.todo strong { color: #19c8b9; }
</style>
