# Memory Routing Plan

> 目标：从“堆上下文”升级到“路由上下文”。

## 1. 记忆分层

### Layer 1 — 主上下文（最贵）
仅保留：
- 身份（SOUL / USER）
- 规则（AGENTS）
- 最近记忆（近 1-2 天 daily memory）
- 当前目标（来自 SESSION-STATE 摘要）

### Layer 2 — 工作记忆
- `SESSION-STATE.md`
- `memory/working-buffer.md`

用途：
- 长任务进展
- 当前约束
- 下一步
- 压缩前交接

### Layer 3 — 长期记忆
- `MEMORY.md`
- `memory/YYYY-MM-DD.md`

用途：
- 长期偏好 / 事实
- 每日事件日志

### Layer 4 — 专题知识库
- `references/`
- 项目目录下 README / docs

用途：
- 长篇资料
- 研究笔记
- 架构说明
- 可被人和 Agent 共用的知识文件

## 2. 路由规则

### 什么时候读 `SESSION-STATE.md`
- 任务持续超过 30 分钟
- 跨多轮
- 涉及多文件改动
- 会话上下文高于 60%

### 什么时候读 `MEMORY.md`
- 主会话
- 涉及长期偏好 / 重要历史判断 / 人与项目背景

### 什么时候读 `references/`
- 问题需要专题知识
- 任务进入某一具体子域（房产 / OpenClaw / Agent 系统 / 项目分析）

### 什么时候启用 `working-buffer`
- 会话上下文 > 60%
- 长调研/长开发任务进入后半段
- 已出现多轮中间结论

## 3. 原则
- 常驻内容最少化
- 运行时状态与长期知识分开
- 专题文档只按需读
- 交接信息优先于历史聊天
- 结构化状态优先于“模型自己记住”

## 4. 近期落地动作
- 为 `references/` 增加统一索引（已完成）
- 为研究任务定义交替式提取工作流（见 `research-workflow.md`）
- 长任务默认更新 `SESSION-STATE.md`
- 继续把项目型细节从 `AGENTS.md` 中剥离到 `references/` / 项目目录
