---
name: squash commits
description: 合并前压缩 commits，默认目标分支为 master
argument-hint: "[target-branch]"
---

Before merging to the target branch, squash all commits into one.
- Target branch: **$1**
  - Use the first argument to override, e.g. `/squash-commit develop`.

