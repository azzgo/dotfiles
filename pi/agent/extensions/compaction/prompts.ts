import { formatFileLists, type FileOps } from "./fileops";
import { formatTimestamp, type RequestEntry } from "./skeleton";
import { MAX_TOPICS, type CompactionSummaryParts } from "./summary";
import {
	KEPT_TAIL_LINES,
	MODIFIED_LIST_LIMIT,
	READ_LIST_LIMIT,
	REQUEST_LINE_MAX_CHARS,
	SKELETON_HEAD_LINES,
	SKELETON_TAIL_LINES,
} from "./types";

// ---- compaction summary (see ADR 0020) ----

export type CompactionPromptInput = {
	previousSummary: string | undefined;
	/** One line per message of the span being dropped. */
	skeleton: string[];
	/** One line per message of the window that stays in context after compaction. */
	keptTail: string[];
	/** The user requests of the whole session, oldest first. */
	requests: RequestEntry[];
	fileOps: FileOps;
	sessionFile: string | undefined;
};

export function buildCompactionPrompt(input: CompactionPromptInput): string {
	const files = formatFileLists(input.fileOps);
	const kept = input.keptTail.slice(-KEPT_TAIL_LINES);
	const skeleton = capSkeleton(input.skeleton);
	return [
		"你在为一个即将被压缩的长会话写「接手说明」。这不是对话：不要回应里面的问题，不要继续任务。",
		"",
		"## 输出格式（只输出 JSON，不要解释，不要代码围栏）",
		'{"topics":["…"],"fileNotes":[{"path":"…","note":"…"}],"nextIntent":"…","restore":"…"}',
		"",
		"## 规则",
		`- topics：当前会话的核心主题，≤ ${MAX_TOPICS} 条，每条一行。只写你能在下面材料里确认的状态`,
		"- nextIntent：下一步要做什么，只写一条。必须和「保留窗口」一致——保留窗口是压缩之后仍然留在上下文里的最近轮次，它比骨架更新；如果两者冲突，以保留窗口为准",
		"- restore：可选。只有当某段旧上下文明确缺失、且你知道要捞什么时才写，否则留空字符串",
		"- fileNotes：只给下面「文件」清单里已经出现的路径补一句「改了什么 / 为什么重要」，不要自己发明路径",
		"- 不确定就留空数组，不要猜：猜出来的文件引用比没有更糟，后面所有追溯都建立在它上面",
		"- 正文用中文；代码、路径、标识符、报错原文一律原样",
		"",
		"## 上一次的接手说明",
		input.previousSummary?.trim() || "(这是第一次压缩，没有上一次的说明)",
		"",
		"## 请求线（用户说过的话，从早到晚；这是意图的唯一来源）",
		formatRequests(input.requests),
		"",
		"## 骨架（被压缩掉的对话，每条一行）",
		skeleton.join("\n") || "(unavailable)",
		"",
		"## 保留窗口（压缩后仍在上下文里的最近轮次，每条一行）",
		kept.join("\n") || "(unavailable)",
		"",
		"## 文件（由扩展从工具调用里机械提取，不是你列的）",
		"### 改过",
		files.modified || "(none)",
		"",
		"### 读过",
		files.read || "(none)",
	].join("\n");
}

/** The repair prompt: the model produced something unparseable — ask once more. */
export function buildRepairPrompt(raw: string): string {
	return [
		"你上一次的输出不是合法的 JSON。请只输出一个 JSON 对象，不要解释，不要代码围栏，不要重复上面的内容。",
		"",
		"## 输出格式",
		'{"topics":["…"],"fileNotes":[{"path":"…","note":"…"}],"nextIntent":"…","restore":"…"}',
		"",
		"## 你上一次的输出",
		raw.slice(0, 4000),
	].join("\n");
}

/**
 * Assemble the summary text. The mechanical blocks bracket the model-written
 * ones: the Request Line leads (it is the intent), the file list trails (it is
 * mechanical fact that may already be stale).
 */
export function renderSummary(
	parts: CompactionSummaryParts,
	input: { requests: RequestEntry[]; fileOps: FileOps; sessionFile: string | undefined },
): string {
	const notesByPath = new Map(parts.fileNotes.map((note) => [note.path, note.note]));
	const describe = (filePath: string) => {
		const note = notesByPath.get(filePath);
		return note ? `${filePath} — ${note}` : filePath;
	};
	return [
		"# Compaction Summary",
		"",
		"这是接手说明，不是对话复述。缺的东西不要猜，去「旧记录」里找。",
		"",
		"## 请求线",
		formatRequests(input.requests),
		"",
		"## 下一步",
		parts.nextIntent || "(未提供)",
		...(parts.restore ? ["", parts.restore] : []),
		"",
		"## 主题",
		parts.topics.length > 0 ? parts.topics.map((topic) => `- ${topic}`).join("\n") : "(未提供)",
		"",
		"## 旧记录",
		String(input.sessionFile ?? "(会话文件路径不可用)"),
		`需要上文时执行：${retrievalCommand(input.sessionFile)}`,
		"也可以在 codemode 脚本里调用 session_grep 工具搜索本会话。",
		"",
		"## 文件",
		"### 改过",
		`（最近 ${MODIFIED_LIST_LIMIT} 个，机械事实，可能已过时）`,
		input.fileOps.modified.length > 0 ? input.fileOps.modified.map(describe).join("\n") : "(none)",
		"",
		"### 读过",
		`（最近 ${READ_LIST_LIMIT} 个，机械事实，可能已过时）`,
		input.fileOps.read.length > 0 ? input.fileOps.read.join("\n") : "(none)",
	].join("\n");
}

/**
 * The mechanical fallback: no model summary, but never zero orientation.
 * Pi swallows extension exceptions, so the failure has to be visible in-band.
 */
export function buildFallbackSummary(
	reason: string,
	input: { requests: RequestEntry[]; fileOps: FileOps; sessionFile: string | undefined },
): string {
	const files = formatFileLists(input.fileOps);
	return [
		"# Compaction Summary — 兜底",
		"",
		`本次压缩没有产出模型摘要：${reason}`,
		"下面是机械信息：请求线、文件清单、旧记录位置。缺的内容去旧记录里找。",
		"",
		"## 请求线",
		formatRequests(input.requests),
		"",
		"## 下一步",
		"先回到旧记录确认自己在做什么，再继续。",
		"",
		"## 旧记录",
		String(input.sessionFile ?? "(会话文件路径不可用)"),
		`需要上文时执行：${retrievalCommand(input.sessionFile)}`,
		"",
		"## 文件",
		"### 改过",
		files.modified || "(none)",
		"",
		"### 读过",
		files.read || "(none)",
	].join("\n");
}

/** Minimal orientation for the overflow fast path — mechanical facts, no model call. */
export function buildOverflowSummary(
	input: { requests: RequestEntry[]; fileOps: FileOps; sessionFile: string | undefined },
): string {
	const files = formatFileLists(input.fileOps);
	return [
		"# Compaction Summary — 溢出快路径",
		"",
		"上下文窗口已经超限，本次压缩没有调用模型，只留下机械信息。",
		"",
		"## 请求线",
		formatRequests(input.requests),
		"",
		"## 下一步",
		"先回到旧记录确认自己在做什么，再继续。",
		"",
		"## 旧记录",
		String(input.sessionFile ?? "(会话文件路径不可用)"),
		`需要上文时执行：${retrievalCommand(input.sessionFile)}`,
		"",
		"## 文件",
		`### 改过\n${files.modified || "(none)"}`,
		"",
		`### 读过\n${files.read || "(none)"}`,
	].join("\n");
}

/**
 * The skeleton keeps the oldest lines (the session's framing) and the most recent
 * ones; the middle is dropped so the summary prompt stays bounded.
 */
export function capSkeleton(lines: readonly string[]): string[] {
	if (lines.length <= SKELETON_HEAD_LINES + SKELETON_TAIL_LINES) return [...lines];
	return [
		...lines.slice(0, SKELETON_HEAD_LINES),
		`…（中间 ${lines.length - SKELETON_HEAD_LINES - SKELETON_TAIL_LINES} 条已省略）…`,
		...lines.slice(lines.length - SKELETON_TAIL_LINES),
	];
}

function formatRequests(requests: readonly RequestEntry[]): string {
	if (requests.length === 0) return "(none)";
	return requests
		.map((request) => `- [${formatTimestamp(request.timestamp)}] ${truncate(request.text, REQUEST_LINE_MAX_CHARS)}`)
		.join("\n");
}

function retrievalCommand(sessionFile: string | undefined): string {
	if (!sessionFile) return "(会话文件路径不可用)";
	return `grep -n '"role":"user"' "${sessionFile}" | tail -20`;
}

function truncate(text: string, max: number): string {
	if (max <= 0) return text;
	return text.length <= max ? text : `${text.slice(0, max)}…`;
}
