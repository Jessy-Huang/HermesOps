<script setup lang="ts">
/**
 * ErrorCard — 错误/边界卡片
 * 红色调，用于 stderr fallback / 未授权 / 空输出兜底
 */
defineProps<{
  text: string
}>()
</script>

<template>
  <div class="err-card">
    <span class="err-icon">⚠</span>
    <div class="err-body">
      <div class="err-title">执行异常</div>
      <pre class="err-text">{{ text }}</pre>
    </div>
  </div>
</template>

<style scoped>
.err-card {
  align-self: flex-start;
  max-width: 82%;
  margin-bottom: 8px;
  display: flex;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(224,90,90,0.08);
  border: 1px solid rgba(224,90,90,0.3);
}
.err-icon { font-size: 14px; color: #e05a5a; flex-shrink: 0; margin-top: 1px; }
.err-title { font-size: 11px; font-weight: 700; color: #e05a5a; margin-bottom: 4px; letter-spacing: 0.02em; }
.err-text {
  margin: 0;
  font-family: 'SF Mono','Fira Code',Consolas,monospace;
  font-size: 11.5px;
  line-height: 1.55;
  color: #d88;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
}
</style>
