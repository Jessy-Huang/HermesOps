<script setup lang="ts">
/**
 * TasksView — 📋 任务
 * 子任务流水线看板：三列（WORKING / HANDOFF / DONE），数据风格对齐 projects/*.json
 */
import { ref, watch } from 'vue'
import type { ToolInstance, MenuItem } from '../types'

const props = defineProps<{
  view: MenuItem
  instance: ToolInstance
}>()

interface Subtask {
  id: string
  worker: string
  status: 'WORKING' | 'HANDOFF' | 'DONE'
  radius: string
  ts: string
}

// 每个实例一套演示子任务（占位，真实数据来自 projects/<hash>.json）
function genTasks(inst: ToolInstance): Subtask[] {
  const base = inst.id
  return [
    { id: `sub_${base}_refactor`,  worker: 'worker-1', status: 'WORKING', radius: 'src/core/*',  ts: '08:42:11' },
    { id: `sub_${base}_tests`,     worker: 'worker-2', status: 'HANDOFF', radius: 'tests/*',     ts: '08:45:30' },
    { id: `sub_${base}_docs`,      worker: 'worker-3', status: 'DONE',    radius: 'docs/*',      ts: '08:39:50' },
    { id: `sub_${base}_lint`,      worker: 'worker-1', status: 'DONE',    radius: 'src/**/*.ts', ts: '08:38:02' },
    { id: `sub_${base}_ci`,        worker: 'orchestrator', status: 'WORKING', radius: '.github/*', ts: '08:46:55' },
  ]
}

const tasks = ref<Subtask[]>([])
function bootstrap() { tasks.value = genTasks(props.instance) }
bootstrap()
watch(() => props.instance.id, () => bootstrap())

const columns: { key: Subtask['status']; label: string; color: string }[] = [
  { key: 'WORKING', label: '进行中', color: '#19c8b9' },
  { key: 'HANDOFF', label: '交接挂起', color: '#f5c31c' },
  { key: 'DONE',    label: '已完成', color: '#6fba2c' },
]

function colTasks(status: Subtask['status']) {
  return tasks.value.filter(t => t.status === status)
}
</script>

<template>
  <div class="tasks">
    <div class="tasks-head">
      <h2>📋 {{ instance.name }} 子任务流水线</h2>
      <span class="tasks-meta">active_task_id: task_20260626 · {{ tasks.length }} 子任务</span>
    </div>

    <div class="board">
      <div v-for="col in columns" :key="col.key" class="col">
        <div class="col-head">
          <span class="col-led" :style="{ background: col.color, boxShadow: `0 0 8px ${col.color}` }" />
          <span class="col-label">{{ col.label }}</span>
          <span class="col-count">{{ colTasks(col.key).length }}</span>
        </div>
        <div class="col-body">
          <div v-for="t in colTasks(col.key)" :key="t.id" class="card">
            <div class="card-id">{{ t.id }}</div>
            <div class="card-row"><span>worker</span><code>{{ t.worker }}</code></div>
            <div class="card-row"><span>radius</span><code class="radius">{{ t.radius }}</code></div>
            <div class="card-row"><span>更新</span><code>{{ t.ts }}</code></div>
          </div>
          <div v-if="!colTasks(col.key).length" class="empty">无</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tasks { max-width: 980px; margin: 0 auto; }
.tasks-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.tasks-head h2 { margin: 0; font-size: 17px; font-weight: 700; color: #f2f3f5; }
.tasks-meta { font-size: 12px; color: #7a7d84; font-family: 'SF Mono',Consolas,monospace; }

.board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.col {
  background: #232529;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  overflow: hidden;
}
.col-head {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.col-led { width: 8px; height: 8px; border-radius: 50%; }
.col-label { font-size: 13px; font-weight: 700; color: #f2f3f5; flex: 1; }
.col-count { font-size: 11px; font-weight: 700; color: #7a7d84; background: #2a2d33; padding: 1px 7px; border-radius: 8px; }
.col-body { padding: 10px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; }

.card {
  background: #2a2d33;
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 12px;
  padding: 10px 12px;
  transition: transform 0.15s, border-color 0.15s;
}
.card:hover { transform: translateY(-2px); border-color: rgba(25,200,185,0.3); }
.card-id { font-size: 12px; font-weight: 700; color: #19c8b9; margin-bottom: 6px; font-family: 'SF Mono',Consolas,monospace; word-break: break-all; }
.card-row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; padding: 2px 0; }
.card-row span { color: #7a7d84; }
.card-row code { color: #c9ccd1; font-family: 'SF Mono',Consolas,monospace; font-size: 10px; }
.card-row code.radius { color: #f5c31c; }
.empty { text-align: center; font-size: 12px; color: #565862; padding: 30px 0; }

@media (max-width: 880px) {
  .board { grid-template-columns: 1fr; }
}
</style>
