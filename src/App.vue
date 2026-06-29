<script setup lang="ts">
/**
 * App.vue — HermesOps 前端根组件
 * 接收 MainLayout 的 scoped slot（view + instance），动态切换 16 个视图面板
 */
import type { Component } from 'vue'
import MainLayout from './layout/MainLayout.vue'
import type { ToolInstance, MenuItem } from './types'

import PanelView from './views/PanelView.vue'
import ChatView from './views/ChatView.vue'
import TerminalView from './views/TerminalView.vue'
import LogsView from './views/LogsView.vue'
import TasksView from './views/TasksView.vue'
import InstancesView from './views/InstancesView.vue'

// 有专门实现的视图；其余 11 个走通用占位 PanelView
const RICH_VIEWS: Record<string, Component> = {
  chat: ChatView,
  instances: InstancesView,
  tasks: TasksView,
  terminal: TerminalView,
  logs: LogsView,
}

function resolveView(key: string): Component {
  return RICH_VIEWS[key] ?? PanelView
}
</script>

<template>
  <MainLayout v-slot="{ view, instance }">
    <component
      :is="resolveView(view)"
      :view="{ key: view } as MenuItem"
      :instance="instance as ToolInstance"
    />
  </MainLayout>
</template>
