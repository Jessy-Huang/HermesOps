/**
 * HermesOps 前端共享类型
 * 与 MainLayout.vue 内部接口对齐，供视图组件复用
 */

export type ToolType = 'Code' | 'Agent' | 'Gate'

export interface ToolInstance {
  id: string
  name: string
  type: ToolType
  cmd: string
  quota: string
  pros: string
  cons: string
  uuid: string
  sandbox: string
}

export interface MenuItem {
  key: string
  label: string
  icon: string
  desc?: string
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}
