---
name: spawn-model-selection
description: Shared single-source-of-truth for choosing which model to run a sub-agent on when dispatching via the dispatch tool (sub-dispatch extension). Referenced by impl-with-spawn and explore-codebase to avoid maintaining the model-priority list in multiple places. Not meant to be invoked standalone.
disable-model-invocation: true
---

# Sub-agent Model Selection

Single source of truth for picking which model to run a spawned sub-agent on. Providers / agents vary by machine (pi, cursor, opencode-go, etc. differ from machine to machine). **Never hard-code a mapping — probe the environment before dispatching and choose heuristically.**

## Decision rules

1. **User explicitly names an agent** → use it directly.
2. **User names a model** (e.g. `deepseek-v4-pro`) → use `pi --list-models` (then `agent --list-models` if present) to find which agent can run it. **pi runs every provider configured on pi and is the universal fallback.**
3. **Neither specified** → pick from what is **actually available on this machine**, cheapest-first, good-enough:

   - **Simple / mechanical tasks** (refactor, add tests, fix typo, commit messages, cleanup):
     1. `minimax-m2.7` — generous quota, first choice for light tasks (~200K context)
     2. `opencode/mimo-v2.5` — 1M context multimodal ($0.14/$0.28 per 1M)
     3. `deepseek-v4-flash` — 1M context, for mid-weight tasks
     4. Local Ollama small models — commit messages, cleanup only; **max 2 concurrent**

   - **Complex / long-context tasks** (multi-file design, large refactor, architecture):
     1. `deepseek-v4-flash` — 1M context, best value for long-context scenarios
     2. `opencode/mimo-v2.5` — 1M context multimodal fallback

   - **Notes**:
     - `deepseek-v4-pro` is no longer recommended by default after the price hike — use only when the user explicitly requests it.
     - `MiniMax-M3` is excluded — unstable instruction following.
     - Prefer `mimo-v2.5` for multimodal; it's the default fallback when no multimodal capability is needed either.
   - Cursor-exclusive Composer models → `cursor` (`agent`); fall back to `pi` if unavailable.

4. **Model runs on local ollama** → it shares this machine's GPU/CPU with the main agent. **Cap concurrent dispatches at 2.**

## Hard rules

- **Trust the actual `pi --list-models` output**; opencode-go / official deepseek mentioned elsewhere are only "maybe available" examples — **never assume they exist**. When unsure, default to `pi` (the dispatch default agent).
- **Concurrency limit (local ollama):** never keep more than **2 sub-agents running concurrently** — parallel work beyond that thrashes local GPU/CPU and memory. Dispatch at most 2 at a time, wait for completions, then dispatch the next batch.
