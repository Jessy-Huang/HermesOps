<script setup lang="ts">
/**
 * InstancesView — ⚙️ 实例
 * 13 个 AI 编码工具的总览网格，当前实例高亮（切换仍走侧边栏 ⚙️ 浮层）
 */
import { INSTANCES } from '../layout/instances'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

const typeColor = (t: ToolInstance['type']): string => ({
  Code: '#889df0',
  Agent: '#b77dee',
  Gate: '#82d5bb',
}[t])
</script>

<template>
  <div class="inst-view">
    <div class="head">
      <h2>⚙️ 工具实例总览</h2>
      <span class="meta">{{ INSTANCES.length }} 个已注册 · 当前激活 <strong>{{ instance.name }}</strong></span>
    </div>

    <div class="grid">
      <div
        v-for="inst in INSTANCES"
        :key="inst.id"
        class="card"
        :class="{ active: inst.id === instance.id }"
      >
        <div class="card-top">
          <span class="num">{{ inst.id.split('_')[0] }}</span>
          <span class="type" :style="{ color: typeColor(inst.type), borderColor: typeColor(inst.type) }">{{ inst.type }}</span>
        </div>
        <div class="name">{{ inst.name }}</div>
        <code class="cmd">{{ inst.cmd }}</code>
        <div class="quota">{{ inst.quota }}</div>
        <div class="pros">{{ inst.pros }}</div>
        <div class="cons">{{ inst.cons }}</div>
        <div v-if="inst.id === instance.id" class="active-tag">● 当前激活</div>
      </div>
    </div>

    <p class="hint">
      切换激活实例请点击侧边栏 <strong>⚙️ 实例</strong> 浮层。本面板为只读总览。
    </p>
  </div>
</template>

<style scoped>
.inst-view { max-width: 1080px; margin: 0 auto; }
.head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #f2f3f5; }
.meta { font-size: 12px; color: #7a7d84; }
.meta strong { color: #19c8b9; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
.card {
  position: relative;
  background: #232529;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 14px;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
}
.card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.12); }
.card.active {
  border-color: #19c8b9;
  box-shadow: 0 0 0 1px #19c8b9, 0 8px 24px rgba(25,200,185,0.18);
}
.card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.num { font-size: 11px; font-weight: 800; color: #565862; font-family: 'SF Mono',Consolas,monospace; }
.type { font-size: 9px; font-weight: 700; padding: 1px 6px; border: 1px solid; border-radius: 6px; }
.name { font-size: 15px; font-weight: 700; color: #f2f3f5; margin-bottom: 3px; }
.cmd { font-family: 'SF Mono',Consolas,monospace; font-size: 11px; color: #19c8b9; }
.quota { font-size: 11px; color: #7a7d84; margin-top: 8px; padding-top: 8px; border-top: 1px dashed rgba(255,255,255,0.05); }
.pros { font-size: 11px; color: #c9ccd1; margin-top: 6px; }
.cons { font-size: 11px; color: #7a7d84; margin-top: 2px; }
.active-tag {
  position: absolute; top: 12px; right: 12px;
  font-size: 10px; font-weight: 700; color: #19c8b9;
}
.hint { margin-top: 18px; font-size: 12px; color: #7a7d84; text-align: center; }
.hint strong { color: #19c8b9; }
</style>
