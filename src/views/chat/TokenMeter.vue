<script setup lang="ts">
/**
 * TokenMeter — 🪙 Token 开销实时计量器
 * 低调小字：Input / Output / Cost
 * 无数据时显示"计量不可用"（非结构化工具如 mimo/opencode）
 */
import { computed } from 'vue'

const props = defineProps<{
  inputTokens?: number
  outputTokens?: number
  costUsd?: number
  durationMs?: number
  unavailable?: boolean
}>()

const fmt = (n: number) => {
  if (!n) return '0'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const cost = computed(() => {
  const c = props.costUsd ?? 0
  if (c === 0) return '$0.00'
  return '$' + c.toFixed(4)
})

const dur = computed(() => {
  const ms = props.durationMs ?? 0
  if (ms < 1000) return ms + 'ms'
  return (ms / 1000).toFixed(1) + 's'
})

const hasData = computed(() => props.inputTokens || props.outputTokens)
</script>

<template>
  <div class="meter">
    <template v-if="unavailable || !hasData">
      <span class="m-item na">Token 计量不可用 · 该工具未提供用量数据</span>
      <template v-if="durationMs">
        <span class="m-sep">·</span>
        <span class="m-item">{{ dur }}</span>
      </template>
    </template>
    <template v-else>
      <span class="m-item">Input <b>{{ fmt(inputTokens || 0) }}</b></span>
      <span class="m-sep">·</span>
      <span class="m-item">Output <b>{{ fmt(outputTokens || 0) }}</b></span>
      <span class="m-sep">·</span>
      <span class="m-item">Cost <b>{{ cost }}</b></span>
      <template v-if="durationMs">
        <span class="m-sep">·</span>
        <span class="m-item">{{ dur }}</span>
      </template>
    </template>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  padding: 0 2px;
  font-size: 10px;
  color: #565862;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em;
}
.m-item b { color: #7a7d84; font-weight: 600; }
.m-item.na { font-style: italic; opacity: 0.7; }
.m-sep { opacity: 0.5; }
</style>
