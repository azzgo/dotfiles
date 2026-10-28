---
name: env-harness
description: Bring up the verification environment, check readiness, then hand off to a Verify Playbook. Teardown when the run finishes.
disable-model-invocation: true
---

# Env Harness

Project-local environment procedure for verification. Get to **ready**, hand off to the active Verify Playbook, and tear down when that playbook finishes.

> Replace placeholders when `create-env-harness` authors this file. Keep requirement-specific acceptance steps out of this skill.

## Bring-up

1. **<entrypoint>** — e.g. script / compose / just recipe to run.
2. **<config / seeds / flags>** — only what verification needs.
3. **<optional services>** — …

## Readiness

All must pass before hand-off:

- [ ] <check: command or URL and expected signal>
- [ ] <check>
- [ ] <check>

On failure: stop, report which check failed, leave bring-up artifacts as-is for debugging unless the user asks for teardown.

**Ready signal:** <one short line the agent can report, e.g. “env ready — hand off to Verify Playbook”>

## Hand-off

Load and follow the consuming repo’s Verify Playbook for the requirement under test. Do not start playbook steps until readiness passes.

## Teardown

After the Playbook finishes (pass or fail):

1. **<stop processes / stacks>**
2. **<revert overrides / env vars>**
3. **<optional data cleanup>** — only if aligned as safe/default.

Report what was torn down and what was left running on purpose.
