/**
 * HermesOps 导航矩阵 — 单一数据源
 * 4 大功能区 × 16 菜单项
 * MainLayout 与 App.vue / 视图组件共享此元数据
 */
import type { MenuSection, MenuItem } from './types'

export const MENU: MenuSection[] = [
  {
    title: '核心控制',
    items: [
      { key: 'chat',      label: '对话',     icon: '💬', desc: 'AI 交互主视窗，展示当前工具的推理与气泡交互' },
      { key: 'instances', label: '实例',     icon: '⚙️', desc: '1~13 个 AI 编码工具切换中枢' },
      { key: 'remote',    label: '远程控制', icon: '📡', desc: '远程 GPU 集群连接与挂载状态' },
    ],
  },
  {
    title: '工作区',
    items: [
      { key: 'tasks',    label: '任务',   icon: '📋', desc: '子任务流水线看板，读取 projects/*.json 快照' },
      { key: 'terminal', label: '终端',   icon: '🖥️', desc: 'xterm.js 实时 TTY 终端流' },
      { key: 'canvas',   label: '画布',   icon: '🎨', desc: '代码调用依赖关系图谱' },
      { key: 'editor',   label: '编辑器', icon: '🛠️', desc: 'ACI 沙盒文件预览与 Diff' },
      { key: 'changes',  label: '变更',   icon: '🔄', desc: 'hermesops verify 前的 Git diff 暂存区' },
      { key: 'plugins',  label: '插件',   icon: '🔌', desc: 'Skill 算子加载状态管理' },
    ],
  },
  {
    title: '可观测',
    items: [
      { key: 'metrics', label: '统计', icon: '📉', desc: 'Token 消耗 / 耗时 / 成功率看板' },
      { key: 'tracing', label: '链路', icon: '🔗', desc: 'Hand-off 控制权流转生命周期图' },
      { key: 'monitor', label: '监控', icon: '⚡', desc: '宿主机 CPU / GPU / 内存负载' },
      { key: 'logs',    label: '日志', icon: '📝', desc: 'stdout / stderr 滚动日志控制台' },
    ],
  },
  {
    title: '配置',
    items: [
      { key: 'settings',  label: '设置',   icon: '🔧', desc: 'config.json 全局中心配置' },
      { key: 'shortcuts', label: '快捷键', icon: '⌨️', desc: '前端热键绑定' },
      { key: 'docs',      label: '文档',   icon: '📄', desc: '使用指南与 1~13 工具开发契约' },
    ],
  },
]

export const ALL_ITEMS: MenuItem[] = MENU.flatMap(s => s.items)

export const findItem = (key: string): MenuItem | undefined =>
  ALL_ITEMS.find(i => i.key === key)
