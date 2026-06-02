---
name: signoff
description: 生成验收交接文档
---
Write a signoff / acceptance handoff document based on the current conversation. The document captures what was agreed upon and the acceptance criteria, so a fresh agent can run the acceptance / verification workflow in a new session. Save to the temporary directory of the user's OS - not the current workspace.

The document should cover:

1. What is being handed off for acceptance (scope, background, key decisions)
2. Acceptance criteria — observable, verifiable conditions that define "done"
3. Verification steps — concrete actions to validate each criterion
4. Edge cases and risks to check
5. What is explicitly excluded (non-goals)

Include a "suggested skills" section in the document, which suggests skills that the agent should invoke.

Do not duplicate content already captured in other artifacts (PRDs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

user arguments: $@
