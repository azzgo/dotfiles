# Personal Wayfinder — 使用指南（给人看）

这份 README 是**用户向**说明：什么时候用、怎么用、边界在哪。  
给 agent 的方法论与命令约定分别在：

- [SKILL.md](./SKILL.md) — 方法与纪律（英文）
- [TASKMD-CONVENTION.md](./TASKMD-CONVENTION.md) — taskmd 字段/CLI 约定（英文）
- `pi/agent/prompts/wayfinder.md` — `/wayfinder` 薄入口

---

## 一句话

> **Wayfinder 管「路线怎么定」；Planning 管「路线怎么走完」。**  
> 雾浓用 Wayfinder，雾散就离开它。

它在本地用 **taskmd** 维护一张决策地图（Map）和若干决策票据（Ticket），一次只推进一张 Ticket，直到到达 Destination 的路径足够清楚。

---

## 它解决什么 / 不解决什么

### 解决

- 目标太大，一个 agent session 装不下
- 终点还看得见，但路径裹在雾里
- 需要先 **研究 / 盘问 / 原型 / 准备** 才能做方向选择
- 希望过几天回来还能接上「现在决策到哪了」

### 不解决

- 普通待办列表、日常 issue 管理
- 已经决策清楚后的**实现进度**（那是 Planning Files Runtime）
- 自动写生产代码、交付 destination 本身
- 团队多人认领 / 协作看板（本版刻意去掉）

---

## 和仓库里其它系统的边界

| 系统 | 角色 | 数据位置 |
|---|---|---|
| **Personal Wayfinder** | 决策期导航 | `.pi/wayfinder/tickets/` |
| **taskmd** | 本地后端 + 给人看的 Web UI | 同上（CLI/Web 操作） |
| **Planning Files Runtime** | 实现期进度与 goal overlay | `.pi/planning/` |

```text
雾里选路  →  Wayfinder（decide）
路清了    →  /plan-goal-set · /plan-goal-impl 或直接写代码（build）
```

不要把 Wayfinder Ticket 和 Planning Task 混叫「task」。

---

## 核心概念（记这几个就够）

| 词 | 是什么 |
|---|---|
| **Destination** | 这张图要到达的终点（够清楚的「到了长什么样」） |
| **Map** | 一张总览对象：终点、笔记、已决、雾、范围外 |
| **Chart** | *动作/模式*：澄清并**画出** Map（不是另一种对象） |
| **Ticket** | 一张决策/调查/原型/准备单元（不是实现任务） |
| **Frontier** | 依赖已满足、可以成为下一张 Current 的 pending Tickets |
| **Current Ticket** | 当前 session 正在推进的那一张 |
| **Not Yet Specified** | 在范围内但还说不精 → 正式的「雾」 |
| **Out of Scope** | 看得见但不属于本 Destination → 正式的「不做」 |

### Chart vs Map（容易混）

- **Map** = 地图本体（产物，会落盘）
- **Chart** = 制图 / 开图（`Chart the Map` 模式）
- **Work Through the Map** = 拿着已有地图往前走

```text
Chart  →  产生 / 重画 Map
Work   →  在已有 Map 上前进
```

---

## 前置条件

1. 本机已安装 **taskmd**（`command -v taskmd`）
2. 已执行过 `just install-pi`（技能与 prompt 链到本机）
3. 在**目标仓库**里使用（每个 repo 独立 workspace）

没有 taskmd 时：skill 会停，并要求你自己装或**明确授权** agent 安装。  
**不会**偷偷换成别的 issue tracker。

---

## 命令一览

| 命令 | 作用 |
|---|---|
| `/wayfinder` | 智能续航：看状态，自动进入 chart 或 work |
| `/wayfinder init` | 检查依赖 + 建 workspace，**不**建 Map |
| `/wayfinder chart <topic>` | 开新图（需要 topic；会先短澄清再落盘） |
| `/wayfinder work [名字]` | 推进一张 Current Ticket（可点名） |
| `/wayfinder status` | 只读状态，不改数据 |
| `/wayfinder ui` | 后台开 taskmd Web UI（给人看） |
| `/wayfinder help` | 命令说明 |

数据目录（本地，通常被 `.pi/` gitignore）：

```text
.pi/wayfinder/tickets/
```

---

## 推荐日常用法

### 第一次在某个 repo

```text
/wayfinder init
/wayfinder chart 我想做的模糊主题……
```

`chart` 会：

1. 短澄清 Destination 与边界  
2. 创建 Active Map（标题形如 `Wayfinder: <Destination>`）  
3. 创建第一批能说清的 Tickets 并接依赖  
4. 说不清的进 Not Yet Specified；明确不做的进 Out of Scope  

### 之后每次回来

```text
/wayfinder status    # 可选：先看一眼
/wayfinder           # 或 /wayfinder work
```

默认行为：

- 已有 Current Ticket → 继续它  
- 没有 → 从 Frontier 选（你点名优先）  
- **一次只认真推进一张** Ticket  

### 想自己看图 / 依赖

```text
/wayfinder ui
```

默认后台启动，浏览器打开 `http://localhost:8080`（端口以实际为准）。  
**人**用 Web UI 查看/偶尔手改；**agent** 仍用 CLI 改状态。

### 决策够清了

当：

1. Destination 够清楚  
2. 关键决策已在 Decisions So Far  
3. Frontier 上不再有「还得先决策」的 Ticket  
4. 剩下主要是「怎么实现」  

→ 关掉/完成这张 Map，切到实现侧（Planning 或直接开干）。

---

## Ticket 类型（规划层）

| 类型 | 用途 | 常见本地能力 |
|---|---|---|
| `research` | 查清事实 | `/explore-codebase` 等 |
| `grilling` | 和你对决策 | `grill-with-docs` |
| `prototype` | 廉价验证手感 | `prototype` |
| `setup` | 解锁后续决策的准备工作 | 无固定 skill |

实现阶段的拆分任务 **不要** 往这里塞。

---

## 硬边界（用的时候请记住）

1. **Plan, don't do** — 默认不交付生产实现  
2. **Single-Ticket Session** — 一次主推一张 Ticket  
3. **一个 repo 同时只有一个 Active Map**  
4. Destination 大变 → **关旧图、开新图**，不原地拧成另一件事  
5. **parent = 归属**；**dependency = 谁挡谁**（Frontier 只看依赖）  
6. 结论 **双写**：Ticket 全文 + Map Decisions So Far 一行摘要  
7. 雾和范围外要写正式区块，别装成已经想清楚或假装没看见  

---

## 最小心智图

```text
/wayfinder chart <topic>
        │
        ▼
   Active Map
   ├── Tickets + 依赖
   ├── Decisions So Far
   ├── Not Yet Specified（雾）
   └── Out of Scope（不做）
        │
        ▼
/wayfinder work  ──(一张)──►  决策变清
        │
        ▼
   实现阶段（Planning / 写代码）
```

---

## 文件导航

| 文件 | 给谁看 | 内容 |
|---|---|---|
| **README.md（本文件）** | 你 | 何时用、怎么用、边界 |
| SKILL.md | agent | 完整方法论与纪律 |
| TASKMD-CONVENTION.md | agent | taskmd 标签/状态/命令 |
| `../../prompts/wayfinder.md` | 触发 | 薄快捷入口，不重复方法 |

---

## 不该用的反例

| 场景 | 更好选择 |
|---|---|
| 「帮我实现这个已定方案」 | Planning / 直接实现 |
| 「这段代码怎么读」 | `/explore-codebase` |
| 「列一下今天要改的文件」 | 普通清单，不必开 Map |
| 「顺手把 planning-files-runtime 也融进来」 | 明确 Out of Scope，另开图或以后再说 |

---

## 版本定位

- **个人本地 skill**，放在本 dotfiles 仓库，不为分发  
- 后端固定为 **taskmd**（显式依赖）  
- 与 **Planning Files Runtime 隔离**，除非以后单独决定融合  
- skill/约定文档为英文；本 README 为中文用户指南  
