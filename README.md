# 🚀 HermesOps (v5.0.0)
> **Distributed Multi-Agent Orchestration & Continuous Code Evolution Engine**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Bash](https://img.shields.io/badge/shell-bash-4ea15f.svg)](https://www.gnu.org/software/bash/)
[![Python](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)
[![Framework](https://img.shields.io/badge/Arch-Orchestrator--Workers-blueviolet.svg)]()

`HermesOps` 是一款专为复杂项目及机器人具身智能（Embodied AI）系统设计的**分布式多智能体代码演进与自动化交付控制台**。它抛弃了传统的单 Agent 碎步串行对话模式，通过一套高度确定性的本地状态机内核，统领、隔离并驱动多达 16 路大模型 Agent 军团，实现长生命周期的代码全自动安全演进。

---

## 🏗️ 核心设计哲学 (Standing on Shoulders of Giants)

`HermesOps` 在底层架构上像素级融合了当前业内最顶尖的 Agent 工程学思想：

* **Anthropic (Orchestrator-Workers)**：主帅 Agent 负责全局任务拆解（Decomposition）与特制回归测试桩（Synthesizing Tests）的布放，不直接触碰功能代码；微观层面的脏活累活由低成本、强执行力的小兵（Workers）在独立线程异步消费。
* **SWE-agent (ACI Sandbox)**：构建严格的智能体-计算机接口（ACI）围栏。Workers 被物理隔离在专用影子沙盒内，阻断全局代码库的越权扫描，防范幻觉污染。
* **LangGraph (Thread-level Persistence)**：引入线程级检查点机制。内核通过 `trap` 捕获每一次环境中断，将进度实时序列化为本地持久化 JSON，完美支持**断点续传**。
* **Microsoft AutoGen (Hand-off Protocol)**：定义标准的 A2A（Agent-to-Agent）控制权异步流转协议。当特定小兵编码遭遇瓶颈卡壳时，自动上抛 `handoff` 挂起现场，无感转交高阶 Agent 接管。
* **CodeGraph (LSP Blast Radius Verification)**：合并前置位联动 AST 拓扑与语义图谱对变更进行 diff 分析，强制锁定**爆炸半径（Blast Radius）**，拒绝越权污染。

---

## 📂 纯净目录骨架 (Topology)

```text
~/.hermes-ops/
├── bin/
│   └── hermes-ops                    # 统一全局 CLI 入口
├── config.json                       # 大模型基座与密钥中转配置
├── core/                             # 平台控制层内核
│   ├── env.sh                        # 环境变量与 TUI 配色
│   ├── grid_engine.sh                # 协同调度状态机内核 (GridEngine)
│   ├── loader.sh                     # 动态插件扫描与注册
│   ├── ui.sh                         # 终端 TUI 面板渲染控制
│   └── tools_handler.sh              # 基础工具链通信句柄
├── projects/                         # [长期记忆库] 存储项目哈希映射的长效快照
└── skills/                           # 沉淀的自动化重构与优化 Skill 算子库