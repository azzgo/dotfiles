---
name: spawn-model-selection
description: Shared single-source-of-truth for choosing which model to run a sub-agent on when dispatching via the dispatch tool (sub-dispatch extension). Referenced by impl-with-spawn and how to avoid maintaining the model-priority list in multiple places. Not meant to be invoked standalone.
disable-model-invocation: true
---

# Sub-agent Model Selection

Single source of truth for picking which model to run a spawned sub-agent on. Providers / agents vary by machine (pi, cursor, opencode-go, etc. differ from machine to machine). **Never hard-code a mapping — probe the environment before dispatching and choose heuristically.**

## Decision rules

1. **User explicitly names an agent** → use it directly.
2. **User names a model** (e.g. `deepseek-v4-pro`) → use `pi --list-models`  to find which agent can run it. **pi runs every provider configured on pi and is the universal fallback.**
3. **Neither specified** → pick from what is **actually available on this machine**, cheapest-first, good-enough:

   - **Simple / mechanical tasks** (refactor, add tests, fix typo, commit messages, cleanup):
     1. `minimax-cn/MiniMax-M2.7` — generous quota, first choice for light tasks (~200K context)
     3. `deepseek/deepseek-v4-flash` — 1M context, for mid-weight tasks
     4. Local Ollama small models — commit messages, cleanup only; **max 2 concurrent**

   - **Complex / long-context tasks** (multi-file design, large refactor, architecture):
     1. `deepseek/deepseek-v4-flash` — 1M context, best value for long-context scenarios

   - **Notes**:
     - `deepseek/deepseek-v4-pro` is no longer recommended by default after the price hike — use only when the user explicitly requests it.
     - `MiniMax-M3` is excluded — unstable instruction following.
     - Prefer `zai-api/glm-5.3-flash` or `deepseek/deepseek-v4-flash-vision-exp` for multimodal; it's the default fallback when no multimodal capability is needed either.
     - Alternates when a provider is rate-limited: `ark/deepseek-v4-flash`, `openrouter/xiaomi/mimo-v2.5`, `openrouter/tencent/hy3`.

## Hard rules

- **Always pass the model as `provider/model` (fully qualified)** in the dispatch `model` parameter. Bare model ids are ambiguous once two or more providers expose the same id — pi errors out with `Model "x" is ambiguous across providers`, the spawn fails with `exitCode null`, and the failure looks like a mystery. Verified 2026-09-17: bare `deepseek-v4-flash` and `glm-5.3-flash` both fail this way (6 providers each).
- **Local Ollama concurrency cap**: an ollama model shares this machine's GPU/CPU with the main agent — never keep more than **2 sub-agents running concurrently**. Dispatch at most 2 at a time, wait for completions, then dispatch the next batch.
- **Trust the actual `pi --list-models` output**; model ids and provider availability drift over time — **never assume they exist**. When unsure, default to `pi` (the dispatch default agent). When `pi --list-models` shows a model only once, the provider prefix is still required by the rule above; copy the `provider/model` string verbatim from the listing.
