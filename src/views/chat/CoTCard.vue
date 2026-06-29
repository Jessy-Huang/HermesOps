<script setup lang="ts">
/**
 * CoTCard — 思考耗时折叠卡片
 * 浅灰色带箭头的折叠栏，点击切换展开/收起
 */
import { ref, computed } from 'vue'

const props = defineProps<{
  text: string
  durationS?: number
}>()

const expanded = ref(false)
const preview = computed(() => {
  const t = props.text.trim()
  return t.length > 60 ? t.slice(0, 60) + '…' : t
})
</script>

<template>
  <div class="cot-card" :class="{ expanded }">
    <button class="cot-header" @click="expanded = !expanded">
      <span class="cot-arrow">{{ expanded ? '▾' : '▸' }}</span>
      <span class="cot-label">已思考<span v-if="durationS">（用时 {{ durationS }} 秒）</span></span>
      <span class="cot-preview">{{ preview }}</span>
    </button>
    <div class="cot-body-wrap">
      <div class="cot-body">{{ text }}</div>
    </div>
  </div>
</template>

<style scoped>
.cot-card {
  align-self: flex-start;
  max-width: 82%;
  margin-bottom: 8px;
  border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  overflow: hidden;
  transition: border-color 0.2s;
}
.cot-card.expanded { border-color: rgba(25,200,185,0.25); }
.cot-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  color: #7a7d84;
  text-align: left;
  transition: color 0.15s;
}
.cot-header:hover { color: #c9ccd1; }
.cot-arrow { font-size: 10px; color: #565862; transition: transform 0.2s; }
.cot-label { font-weight: 600; white-space: nowrap; }
.cot-preview { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.6; font-style: italic; }

.cot-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4,0,0.2,1);
}
.cot-card.expanded .cot-body-wrap { grid-template-rows: 1fr; }
.cot-body {
  overflow: hidden;
  padding: 0 14px;
  font-size: 12px;
  line-height: 1.65;
  color: #9a9da4;
  white-space: pre-wrap;
  word-break: break-word;
}
.cot-card.expanded .cot-body { padding: 0 14px 12px; }
</style>
