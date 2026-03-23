# SESSION-STATE.md

> 主会话工作内存（短期）

## Current Focus
- 继续优化记忆系统：从“堆上下文”升级到“路由上下文”
- 建立 references 索引与研究类任务的交替式提取流程

## Recent Decisions (WAL)
- 2026-03-23 11:37 UTC | collaboration-terminology | Leo 纠正：当前对齐的是“三人协作/两层Agent架构”，不是“写稿子/写作架构” | 影响：后续群内表述、SOP 与公告统一使用“协作架构”表述
- 2026-03-23 02:38 UTC | two-layer-agent | 确定两层架构原则：所有复杂任务先进入主控；主控决定是否派发给 mini；mini 负责执行、沉淀、回报 | 影响：影响主控/执行层职责边界、任务路由与知识同步策略
- 2026-03-22 12:24 UTC | ssh-brute-guard | 执行 sudo bash ~/.openclaw/workspace/scripts/ssh-brute-guard.sh | 影响：影响：cron任务输出
- 2026-03-22 09:44 UTC | channel-routing | 后续微信通道主要承接 Leo 私人及果果相关任务需求 | 影响：影响 TG/微信职责分工与会话使用策略
- 2026-03-21 11:55 UTC | agent-swarm | TradingAgents 项目暂不落地，先作为学习储备 | 影响：影响后续 Agent Swarm 设计参考优先级
- 2026-03-21 05:18 UTC | memory-system | 同意将 MSA 思想落成当前系统具体改动项 | 影响：影响记忆分层、索引与研究工作流
- 2026-03-13 11:13 UTC | raiden-game | 新增第四种武器：HOMING 跟踪弹 | 影响：影响武器掉落与射击逻辑
- 2026-03-13 11:08 UTC | raiden-game | 关卡流程延长约两倍，并新增两个小Boss | 影响：影响关卡脚本、敌人波次与Boss节奏
- 2026-03-13 10:54 UTC | raiden-game | 新增任务：武器掉落动画 + 副武器跟踪导弹，完成后上传 | 影响：影响视觉反馈、战斗层次与交付流程
- 2026-03-13 10:46 UTC | raiden-game | 采用A方案三种武器：机炮/扩散/激光 | 影响：影响掉落、射击逻辑与Boss战手感
- 2026-03-13 10:18 UTC | raiden-game | 继续增强：正式菜单、最高分、Boss第三阶段 | 影响：影响成品完整度与关卡高潮
- 2026-03-13 10:14 UTC | raiden-game | 继续增强：暂停菜单、音量开关、美术升级 | 影响：影响交互完整性与成品质感
- 2026-03-13 10:11 UTC | raiden-game | 用户要求Boss战更燃一些 | 影响：影响Boss音乐、弹幕与特效反馈
- 2026-03-13 10:01 UTC | raiden-game | 风格选A经典雷电系；难度选A爽玩型 | 影响：影响游戏美术、敌人设计与关卡节奏
- 2026-03-18 09:29 UTC | ssh-brute-guard | 执行 sudo bash ~/.openclaw/workspace/scripts/ssh-brute-guard.sh | 影响：cron任务输出
- 2026-03-12 05:56 UTC | ssh-brute-guard | 执行 sudo bash ~/.openclaw/workspace/scripts/ssh-brute-guard.sh | 影响：cron任务输出
- 2026-03-10 05:35 UTC | proactive-agent | 新增快捷写入脚本 wal-log.sh | 影响：降低手工记录成本
- 2026-03-10 | proactive-agent | 启用精简版规则（WAL/工作缓冲/VBR） | 影响：主会话执行流程

## Active Constraints
- 系统级变更需先向 Leo 汇报
- Dashboard 不暴露公网

## Next Actions
- [ ] 继续收敛安全 warn（按优先级）
- [ ] 需要时启用 working-buffer
