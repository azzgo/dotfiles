dotfiles-code-review — 由 setup-code-review 生成（/Users/ison/dev/dotfiles/.pi/skills/setup-code-review）。

- Generated: 2026 (setup session)
- Template version: 11e432e6b5b70a90653d6277ed35b469b106ea4c (dotfiles repo HEAD)
- Grilling consensus:
  - 保留轴: Spec + Documentation Consistency（子 agent）；Removal Plan + Simplification（主 agent 补充）
  - 砍掉轴: Standards/SOLID、Security、Code Quality、Race Condition（配置仓库无业务代码）
  - Spec 固定点: AGENTS.md、pi/agent/extensions/pi-navigator/catalog.md（核心）、两处 skills README.txt、docs/adr/、README.md、fallback 其他声称性文档
  - 触发规则: diff 触及 pi/ 或 skills/ → catalog.md 检查强制必查并单列输出一节
  - 本地 skill 替代: 无（retro 是复盘非 review）
  - Quality gates: 无硬性门禁；可选校验 just nvim-health / just test-track / just info 按 diff 路径建议
- References copied: removal-plan.md only
- 背景: 用户新维护 pi-navigator（/nav 入口路由，catalog.md 手工维护），pi/skill 相关改动必须同步它
