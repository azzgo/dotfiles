dotfiles-code-review — 由 setup-code-review 生成（仓库内 `.pi/skills/setup-code-review`）。

- Generated: 2026 (setup session)
- Template version: 11e432e6b5b70a90653d6277ed35b469b106ea4c (dotfiles repo HEAD)
- Grilling consensus:
  - 保留轴: Spec + Documentation Consistency（子 agent）；Removal Plan + Simplification（主 agent 补充）
  - 砍掉轴: Standards/SOLID、Security、Code Quality、Race Condition（配置仓库无业务代码）
  - Spec 固定点: AGENTS.md、两处 skills README.txt、docs/adr/、README.md、fallback 其他声称性文档
  - 触发规则: diff 触及 md/txt/README、docs/、skills/、pi/、justfile recipe、根目录增删、install recipe 软链目标 → 文档一致性检查
  - 本地 skill 替代: 无（retro 是复盘非 review）
  - Quality gates: 无硬性门禁；可选校验 just nvim-health / just test-track / just info 按 diff 路径建议
- References copied: removal-plan.md only
- 背景: 曾强制同步 pi-navigator/catalog.md；该扩展于 2026-10-20 退役删除（ADR 0018），相关强制检查已移除
