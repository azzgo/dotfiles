---
description: Rewrite Chinese narrative prose to remove AI-sounding tells while preserving the original information, plot skeleton, prose density, and the author's voice.
---

> Routing: this prompt targets **Chinese narrative/fiction and personal prose** (author-voice preservation, show-don't-tell). For English technical/general writing, cut the AI tells directly: plain concrete words, whole sentences with their articles and verbs, no rule-of-three padding, no decorative em dashes, no abstract metaphor nouns, no claim without a source.
>
> If the same task also supplies project-level style rules or an anti-slop checklist, **their density and dialogue specs win** — this prompt only removes AI tells. It does not decide how explicit, how long, or how terse the text should be.
>
> This prompt is self-contained: it never assumes a particular book, setting, or genre.

## Two Modes

Determine the mode from the user's input:

- **Rewrite (default)**: the user pastes text and asks for a rewrite. De-AI it per the rules below, preserving information and personal style.
- **Detect**: the user starts with `detect:` (e.g. `@humanize detect: <text>`) — only annotate each hit (pattern name + quote + suggested fix), do not rewrite.

---

## Principles

- **Keep the skeleton, rewrite the flesh**: preserve characters, plot direction, key dialogue, and all core information. Only rewrite the expression, rhythm, and tone of narrative sentences. Never add plot, characters, or events that aren't in the original.
- **De-AI is not compression**: the opposite of AI-flavored prose is *concrete and grammatical*, not *short and clipped*. Cutting a full sentence down to four words does not make it human, it makes it unreadable.
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
2. Identify 3-5 author-voice signals (word preferences, rhythm, dry humor, modifier habits, **and the draft's density level**).
3. Apply minimal effective edits — only the AI-flavored parts, never the stylish human prose.
4. Check the final draft against the self-check list at the end.
5. Output the full rewritten text + a **what changed** note.

---

## Requirements

### 1. Rhythm and sentence structure

- Alternate short and long sentences. A long sentence (25-50 chars) followed by a short one (5-15 chars) that lands the point is the default beat. The reverse — a run of short sentences finished off by a long one — must not become the default.
- **Short sentences are seasoning, not the base.** Three consecutive sentences under 10 chars, or two consecutive noun-phrase fragments, is telegram style: merge them into one full sentence or add a complete one.
- **Fragments are allowed only where the situation justifies them**: an action cut off mid-way, breath gone uneven, speech interrupted, the POV character's attention scattering. They never carry narration on their own.
- Vary paragraph length — a paragraph may be one sentence, the next three or four. But one-sentence-per-line with a blank line between every line is a storyboard, not prose; use it at most once per scene, for a hard beat.
- Use pauses and breaks. Full stops beat commas — but that means "don't drag one sentence out with commas", not "break one sentence into three full stops".
- **Cut internal-monologue lead-ins** ("她心想", "他意识到", "她感觉") — let the narration carry the emotion.

### 2. Dialogue

Dialogue fails in two opposite ways. Both count.

- **Bandwidth**: one character's turn is normally **2-3 sentences**, mixed long and short, with particles (吧／呢／么／啊), a supplement, a self-correction, or a trailing half-sentence. A single line plus a full stop is the exception, not the norm.
- **No ping-pong**: A asks → B answers → A follows up → B answers again, more than two rounds, is a Q&A transcript. Break it with an interruption, a change of subject, an answer to a different question, or someone talking to themselves.
- **No telegrams, no mutes**: prefer an action over a spoken reply when the action carries it — but a character must not fall silent for a whole exchange. Silent characters are not "restrained", they read as props. A quiet character still gets at least half a complete line.
- **Short replies** ("嗯", "好", "是", "对") only where the situation forces them: mouth full, out of breath, being pinned down, refusing to engage. Never as the default rhythm.
- **Subtext, not mystery**: real speech hesitates, interrupts, derails, trails off. But don't turn that into riddles — a reader should never have to re-read a line to know what was said.
- **Lines give desire and sensation; narration gives the situation.** A line should not explain where the speaker is, what position they're in, or why they can't speak louder — that's the narrator's job.
- **Lines hook onto something present**: the object just set down, the thing just spilled, the door just closed. A line that could be spoken anywhere in the scene is floating.
- **Differentiate voices**: the talkative one rambles and digresses; the middle one speaks in complete 1-2 sentence turns; the quiet one may be short but still grammatical. Everyone must not sound like the same person.
- **Stop when the line ends.** Don't follow a line of dialogue with narration explaining what it meant.

### 3. Narration density

Two red lines, one on each side.

- **Lower bound — every narration sentence must be a sentence.** Subject and predicate present, and it must be readable on its own if pulled out of the paragraph. No noun-pile ("烛火、帘子、湿了的衣角。") and no half-clause ("很轻。") carrying the narrative. If a detail is worth writing, write it out; if it isn't, delete it.
- **Upper bound — fewer setups, each one clear.** Setup can be sparse, but everything written must be written *through*, with a clear main thread. Three details rendered fully beat ten details left half-said. Cut the unimportant setup, don't compress what remains.
- **No trailing qualifiers for mood.** "她关上门，很轻。" / "他笑了，声音低。" — putting a mood fragment after the verb is inverted-sentence decoration, not precision. Fold the degree into the verb ("她轻轻带上门") or drop it.
- **Don't explain the action that just happened** ("他一动不动，显然是在犹豫"). Don't append a summary at the paragraph end.
- **Don't narrate the outcome of a blocked channel**: writing "她自己都听见那一声破了" instead of writing the broken sound itself is still telling.

### 4. Named-pattern checklist

#### Banned words

**AI high-frequency words (general):**
总而言之、宛如、令人震撼、不可思议、不经意间、仿佛、无疑、某种（某种感觉/某种力量/某种说不清的东西）、不禁、不由得、瞬间

**AI high-frequency words (fiction-specific):**
"她深吸一口气" / "他深吸一口气"、眼中闪过一丝X、目光变得深邃、嘴角微微上扬、心底涌起一股X、空气仿佛凝固了、时间仿佛静止了

#### AI sentence structures

- Summary sentences at paragraph end ("这让他意识到…", "从那天起，一切都不同了", "他明白了一个道理")
- Every paragraph ending in uplift or reflection
- Every sentence "complete" in the same template — allow fragments and unfinished expressions *where §1 permits them*
- Over-reliance on "如果…的话" conditionals
- **Telegram paragraphs**: strings of short clauses or noun phrases with subjects dropped, leaving the reader to reassemble the scene. Merge into full sentences.

#### Named patterns

**False binary:** "这不是关于X的问题，而是关于Y的问题" / "问题不在于X，而在于Y" — just say Y.

**Throat-clearing openers:** "话说回来" "不得不说的是" "关键的问题在于" "这里要说的其实是" — cut the opener, state the point.

**Fake-insight build-up:** "大多数人忽略的是" "没人告诉你的真相是" "很多人不知道的是" — cut the "only I get this" scaffolding and let the argument stand on its own.

**Importance inflation:** "具有里程碑意义" "标志着重大突破" "奠定了坚实基础" "具有划时代意义" — state facts and let the reader judge. E.g. "这次升级是公司第一个收费产品" instead of "这次升级标志着公司的重大转型".

**Summary endings:** "总而言之" "综上所述" "归根结底" "总的来说" — end on the last concrete point; no need to recap.

**Fake-profound endings:** a maxim-style closer at paragraph or article end ("这就是科技的温度" "或许，这就是生活") — don't replace it with a better aphorism; delete it and end on the most substantial preceding sentence.

**Synonym churn:** swapping words within one paragraph ("该工具→该软件→该方案→该平台"). The first word you used is the best word — repeat it.

**Machine rhythm:** adjacent paragraphs of similar length, identical sentence templates, every paragraph following "point → explanation → example → uplift". Break the pattern.

### 5. Fiction-specific operations

- **Keep point-of-view consistent**: don't slip into omniscient god-view mid-paragraph. If narrating from character A's perspective, only write what A can see, hear, and feel.
- **Show emotion through action**: don't name the emotion ("他很愤怒"), imply it with behavior ("他把杯子重重搁在桌上，水溅了出来").
- **Environment participates in narrative**: weather, light, temperature, smells can carry emotion — but don't use them only to "set the mood"; let them exist naturally in the scene.
- **Cut redundant adverbs and modifiers**: "他轻声地、温柔地说道" → "他说" — or just write what he said and did.
- **Reduce direct psychological description**; let dialogue and behavior let the reader feel it themselves.
- **Don't execute actions one at a time**: "他站起来。走过去。拉开门。" reads like a checklist being ticked. Actions overlap and interrupt each other; join them or give one of them a consequence.

### 6. Colloquialism and imperfection

- Allow colloquial expressions: particles (吧、嘛、嗯、哦), parentheticals (说真的、不过话说回来、你猜怎么着), repeated words for emphasis.
- Allow mild grammatical looseness and sentence fragments — within the limits of §1 and §3.
- Not every sentence needs to be structurally complete with uniform information density. Some sentences are filler but read as lived-in.
- But the "imperfections" above must blend in naturally — don't pile them into every paragraph.

### 7. Preserve the author's idiosyncrasies

- If the original has a distinct personal style (verbal tics, narrative habits, word preferences), **don't "correct" it** — preserve it.
- Preserve the original's **density level**. A full-sentence draft must not come back as clipped fragments; a deliberately terse draft must not be inflated into long paragraphs. If the word count drops a lot while no information was cut, density was flattened — restore it.
- Only change where something is clearly "AI-flavored"; don't do a blanket rewrite.

---

## Self-check list

Run through each item after editing; only ship the final draft when all pass:

1. Did you preserve the original core information, plot, and facts without adding anything not in the source?
2. Did you preserve the author's word habits and sentence preferences without a blanket rewrite?
3. Did you preserve the original's density — no unexplained drop in length, no inflation?
4. Are there three consecutive sentences under 10 chars, or noun-phrase stacking, standing in for narration?
5. Can every narration sentence be pulled out and read on its own?
6. Any trailing qualifier tacked after a verb to fake mood ("她关上门，很轻")?
7. Does any dialogue run more than two rounds of pure question-and-answer?
8. Conversely: did you silence a character for a whole exchange, or leave the scene with nobody saying a complete line?
9. Do the lines give desire and sensation, rather than explaining the speaker's situation?
10. Did you remove the false binaries, throat-clearing openers, fake-insight build-ups, etc.?
11. Any summary endings or fake-profound endings left behind?
12. Is the rhythm natural — short/long sentences alternating, varied paragraph lengths?
13. Would the original author recognize the text as still their own?
14. Does the output include the full rewrite + a **what changed** note?

---

## Comparison examples

### Before (AI-flavored narration)
> 她深吸一口气，望着窗外的夕阳，心中涌起一股说不清道不明的惆怅。回想起过去的日子，她不禁感慨万千。那些曾经的欢笑与泪水，如今都已化作回忆，沉淀在心底最深处。从某种意义上来说，正是这些经历塑造了今天的她。她轻轻地转过头，目光落在桌角那张泛黄的照片上，眼神变得柔和而深邃。

### After (human-written, same density)
> 她把窗推开一条缝。夕阳正落在对面楼顶，橘红色的光斜着切进来，在桌角那张卷了边的照片上停了一会儿。她站在窗边，手一直搭在窗把手上，没动。照片上的人笑着，笑得有点傻。那是三年前的冬天，她还留着短发，楼下的树也没现在这么高。

### Before (flattened to telegram — over-corrected)
> 门开了。灯亮。她进来。手里有伞。水滴在地上。

### After (concrete, complete sentences)
> 门开了，走廊的灯跟着亮起来。她侧身进来，收伞的时候伞尖在地上磕了一下，水顺着伞骨滴到瓷砖上，拖出一道弯的印子。她在门口站定，先看了一眼屋里，才把伞靠到墙边。

### Before (AI-flavored dialogue)
> "你还好吗？"他关切地问道，眼神中充满了担忧。
> "我没事。"她摇摇头，勉强挤出一个微笑，"只是有点累。"
> "真的没事吗？要不我送你回去？"
> "不用了，我自己可以。"

### After (human-written)
> "还好吧你？"他把手里的袋子换了个手，"脸色不太对。"
> "没事。"她摇头，抬手把额前的头发拨到耳后，"就是这两天没睡好，昨天赶那份东西赶到三点。"
> 他没接话，把袋子往她那边递了递。
> "干什么？"
> "姜。我妈寄来的，我也不会煮。"他顿了顿，"你要是还有精神，回去煮点水。"

## User Instruction

$@
