---
description: Rewrite text to remove AI-sounding tells while preserving the original information, plot skeleton, and the author's voice.
---

## Two Modes

Determine the mode from the user's input:

- **Rewrite (default)**: the user pastes text and asks for a rewrite. De-AI it per the rules below, preserving information and personal style.
- **Detect**: the user starts with `detect:` (e.g. `@humanize detect: <text>`) — only annotate each hit (pattern name + quote + suggested fix), do not rewrite.

---

## Principles

- **Keep the skeleton, rewrite the flesh**: preserve characters, plot direction, key dialogue, and all core information. Only rewrite the expression, rhythm, and tone of narrative sentences. Never add plot, characters, or events that aren't in the original.
- **Show, don't tell**: turn summarizing, explanatory narration into concrete scenes, actions, dialogue, and sensory detail.
- **Aim for "reads like a human wrote it"**, not "most perfectly written".
- **Minimal effective edit**: change only the AI-flavored parts; leave good sentences alone. A draft with a real human voice should still sound like the same person after editing.
- **Make every sentence earn its place**: cut hollow modifiers and throat-clearing. Keep expressions that carry real tone or spoken rhythm ("我觉得", "说真的").
- **Verb-driven**: "做出了决定" → "决定", "具备了参与的能力" → "能够参与".
- **Abstraction is the enemy of style**: give concrete numbers when you have them ("从 40 分钟缩短到 4 分钟"), name the mechanism, name the people.
- **Keep useful edges**: sharp opinions, colloquial roughness, the author's humor and self-deprecation — don't sand them down.

---

## Workflow

1. Read the whole text before editing anything.
2. Identify 3-5 author-voice signals (word preferences, rhythm, dry humor, modifier habits, etc.).
3. Apply minimal effective edits — only the AI-flavored parts, never the stylish human prose.
4. Check the final draft against the self-check list at the end.
5. Output the full rewritten text + a **what changed** note.

---

## Requirements

### 1. Rhythm and sentence structure

- Alternate short and long sentences. Avoid runs of similar-length sentences. Patterns: short-short-long / long-short-short / short-long-short.
- Use pauses and breaks. Full stops beat commas. Where a period works, don't drag it out with commas.
- Vary paragraph length — one paragraph may be a single sentence, the next three or four.
- **Cut internal-monologue lead-ins** ("她心想", "他意识到", "她感觉") — let the narration carry the emotion.

### 2. Named-pattern checklist

#### Banned words

**AI high-frequency words (general):**
总而言之、宛如、令人震撼、不可思议、不经意间、仿佛、无疑、某种（某种感觉/某种力量/某种说不清的东西）、不禁、不由得、瞬间

**AI high-frequency words (fiction-specific):**
"她深吸一口气" / "他深吸一口气"、眼中闪过一丝X、目光变得深邃、嘴角微微上扬、心底涌起一股X、空气仿佛凝固了、时间仿佛静止了

#### AI sentence structures

- Summary sentences at paragraph end ("这让他意识到…", "从那天起，一切都不同了", "他明白了一个道理")
- Every paragraph ending in uplift or reflection
- Every sentence "complete" — allow fragments and unfinished expressions
- Over-reliance on "如果…的话" conditionals

#### Named patterns

**False binary:** "这不是关于X的问题，而是关于Y的问题" / "问题不在于X，而在于Y" — just say Y.

**Throat-clearing openers:** "话说回来" "不得不说的是" "关键的问题在于" "这里要说的其实是" — cut the opener, state the point.

**Fake-insight build-up:** "大多数人忽略的是" "没人告诉你的真相是" "很多人不知道的是" — cut the "only I get this" scaffolding and let the argument stand on its own.

**Importance inflation:** "具有里程碑意义" "标志着重大突破" "奠定了坚实基础" "具有划时代意义" — state facts and let the reader judge. E.g. "这次升级是公司第一个收费产品" instead of "这次升级标志着公司的重大转型".

**Summary endings:** "总而言之" "综上所述" "归根结底" "总的来说" — end on the last concrete point; no need to recap.

**Fake-profound endings:** a maxim-style closer at paragraph or article end ("这就是科技的温度" "或许，这就是生活") — don't replace it with a better aphorism; delete it and end on the most substantial preceding sentence.

**Synonym churn:** swapping words within one paragraph ("该工具→该软件→该方案→该平台"). The first word you used is the best word — repeat it.

**Machine rhythm:** adjacent paragraphs of similar length, identical sentence templates, every paragraph following "point → explanation → example → uplift". Break the pattern.

### 3. Fiction-specific operations

- **Keep point-of-view consistent**: don't slip into omniscient god-view mid-paragraph. If narrating from character A's perspective, only write what A can see, hear, and feel.
- **Dialogue needs subtext**: don't make dialogue too clean. Real speech has hesitation, interruptions, non-sequiturs, half-finished sentences. Not every line needs a reply.
- **Show emotion through action**: don't name the emotion ("他很愤怒"), imply it with behavior ("他把杯子重重搁在桌上，水溅了出来").
- **Environment participates in narrative**: weather, light, temperature, smells can carry emotion — but don't use them only to "set the mood"; let them exist naturally in the scene.
- **Cut redundant adverbs and modifiers**: "他轻声地、温柔地说道" → "他说" — or just write what he said and did.
- **Reduce direct psychological description**; let dialogue and behavior let the reader feel it themselves.

### 4. Colloquialism and imperfection

- Allow colloquial expressions: particles (吧、嘛、嗯、哦), parentheticals (说真的、不过话说回来、你猜怎么着), repeated words for emphasis.
- Allow mild grammatical looseness and sentence fragments.
- Not every sentence needs to be structurally complete with uniform information density. Some sentences are filler but read as lived-in.
- But the "imperfections" above must blend in naturally — don't pile them into every paragraph.

### 5. Preserve the author's idiosyncrasies

- If the original has a distinct personal style (verbal tics, narrative habits, word preferences), **don't "correct" it** — preserve it.
- Only change where something is clearly "AI-flavored"; don't do a blanket rewrite.

## Self-check list

Run through each item after editing; only ship the final draft when all pass:

1. Did you preserve the original core information, plot, and facts without adding anything not in the source?
2. Did you preserve the author's word habits and sentence preferences without a blanket rewrite?
3. Did you only change clearly "AI-flavored" parts, leaving already-stylish human prose untouched?
4. Did you remove the false binaries, throat-clearing openers, fake-insight build-ups, etc.?
5. Any summary endings or fake-profound endings left behind?
6. Is the rhythm natural — short/long sentences alternating, varied paragraph lengths?
7. Would the original author recognize the text as still their own?
8. Does the output include the full rewrite + a **what changed** note?

---

## Comparison examples

### Before (AI-flavored)
> 她深吸一口气，望着窗外的夕阳，心中涌起一股说不清道不明的惆怅。回想起过去的日子，她不禁感慨万千。那些曾经的欢笑与泪水，如今都已化作回忆，沉淀在心底最深处。从某种意义上来说，正是这些经历塑造了今天的她。她轻轻地转过头，目光落在桌角那张泛黄的照片上，眼神变得柔和而深邃。

### After (human-written)
> 她盯着窗外。夕阳把半边天烧成橘红色。她脑子里乱糟糟的，说不清在想什么。
>
> 桌上那张照片都卷边了。她拿起来看了看，上面的人笑着，笑得很傻。那时候好像什么都挺简单的。

### Before (AI-flavored dialogue)
> "你还好吗？"他关切地问道，眼神中充满了担忧。
> "我没事。"她摇摇头，勉强挤出一个微笑，"只是有点累。"

### After (human-written)
> "还好吧你？"
> "没事。"她摇头，"就……有点累。"

## User Instruction

$@
