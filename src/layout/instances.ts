/**
 * HermesOps 工具实例注册表 — 单一数据源
 * 1~13 个 AI 编码工具，元数据源自 core/plugins/0[1-9]_*.sh 与 1[0-3]_*.sh
 * MainLayout.vue 与 InstancesView 共享此数据
 */
import type { ToolInstance } from '../types'

/** 由工具 id 生成确定性沙盒 UUID（UI 占位，真实 UUID 由后端 state 注入） */
function makeUuid(seed: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0')
  const a = hex(h, 8)
  const b = hex(Math.imul(h, 0x85ebca6b), 4)
  const c = hex((Math.imul(h, 0xc2b2ae35) & 0x0fff) | 0x4000, 4)
  const d = hex(Math.imul(h, 0x27d4eb2f), 12).slice(0, 12)
  return `${a}-${b}-${c}-${d}`
}

const RAW: Omit<ToolInstance, 'uuid' | 'sandbox'>[] = [
  { id: '01_codebuddy',      name: 'CodeBuddy',      type: 'Code',  cmd: 'codebuddy', quota: '∞ 无限',     pros: '完全免费|腾讯云npm',        cons: '企业版收费',         },
  { id: '02_qoder',          name: 'Qoder',          type: 'Code',  cmd: 'qodercli',  quota: '≈140次/日',  pros: '每日200次免费|Qwen3.7-Max', cons: '需登录使用',         },
  { id: '03_trae',           name: 'TRAE_SOLO',      type: 'Code',  cmd: 'Trae',      quota: '∞ 无限',     pros: '完全免费|AI原生IDE',        cons: '需下载桌面端',       },
  { id: '04_cursor',         name: 'Cursor',         type: 'Code',  cmd: 'cursor',    quota: '🔑 需配置',   pros: '业界标杆|智能度极高',       cons: '付费版昂贵',         },
  { id: '05_opencode',       name: 'OpenCode',       type: 'Code',  cmd: 'opencode',  quota: '🔑 需配置',   pros: '开源免费|支持75+模型',      cons: '需自备API Key',      },
  { id: '06_github_copilot', name: 'GitHub_Copilot', type: 'Code',  cmd: 'copilot',   quota: '≈1200次/月', pros: 'GitHub生态|对学生免费',     cons: '免费额度受限',       },
  { id: '07_claude_code',    name: 'Claude_Code',    type: 'Code',  cmd: 'claude',    quota: '🔑 需配置',   pros: 'Claude最强CLI|模型优秀',    cons: '强制需要官方订阅',   },
  { id: '08_codex',          name: 'Codex',          type: 'Code',  cmd: 'codex',     quota: '🔑 需配置',   pros: 'OpenAI出品|多端同步',       cons: '需订阅底层服务',     },
  { id: '09_qwen_code',      name: 'Qwen_Code',      type: 'Code',  cmd: 'qwen',      quota: '🔑 需配置',   pros: '阿里通义灵码|中文支持好',   cons: '需配置百炼密钥',     },
  { id: '10_windsurf',       name: 'Windsurf',       type: 'Code',  cmd: 'windsurf',  quota: '≈15积分',    pros: '多Agent协同|界面丝滑',      cons: '免费高阶积分受限',   },
  { id: '11_codegeex',       name: 'CodeGeeX',       type: 'Code',  cmd: 'codegeex',  quota: '≈35次/日',   pros: '清华团队出品|轻量迅速',     cons: '免费调用有频率限制', },
  { id: '12_mimo_code',      name: 'MiMo_Code',      type: 'Code',  cmd: 'mimo',      quota: '∞ 无限',     pros: '完全免费|超长无限上下文',    cons: '新工具生态建设中',   },
  { id: '13_hermes',         name: 'Hermes',         type: 'Agent', cmd: 'hermes',    quota: '🔑 需配置',   pros: '自进化Agent|300+开源模型',  cons: '首次部署需配置密钥', },
]

export const INSTANCES: ToolInstance[] = RAW.map(t => ({
  ...t,
  uuid: makeUuid(t.id),
  sandbox: `~/.hermesops/sandboxes/${t.id}`,
}))
