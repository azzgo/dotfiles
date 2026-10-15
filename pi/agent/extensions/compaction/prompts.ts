import { formatFileLists, type FileOps } from "./fileops";
import { MAX_TOPICS, type CompactionSummaryParts } from "./summary";

// ---- compaction summary (see ADR 0015) ----

export type CompactionPromptInput = {
	previousSummary: string | undefined;
	transcript: string;
	fileOps: FileOps;
	sessionFile: string | undefined;
};

export function buildCompactionPrompt(input: CompactionPromptInput): string {
	const files = formatFileLists(input.fileOps);
	return [
		"你在为一个即将被压缩的长会话写「接手说明」。这不是对话：不要回应里面的任何问题，不要继续任务。",
		"",
		"## 输出格式（只输出 JSON，不要解释，不要代码围栏）",
		'{"topics":["…"],"fileNotes":[{"path":"…","note":"…"}],"nextIntent":"…","restore":"…"}',
		"",
		"## 规则",
		`- topics：当前会话的核心主题，≤ ${MAX_TOPICS} 条，每条一行。可以整条重写，已经无关的旧主题不要保留`,
		"- nextIntent：下一步要做什么，只写一条。需要先补上下文时，就在这里写清楚先去旧记录里捞什么",
		"- restore：可选。只有当某段旧上下文明确缺失、且你知道要捞什么时才写，否则留空字符串",
		"- fileNotes：只给下面「文件」清单里已经出现的路径补一句「改了什么 / 为什么重要」，不要自己发明路径",
		"- 不确定就留空数组，不要猜：猜出来的文件引用比没有更糟，后面所有追溯都建立在它上面",
		"- 正文用中文；代码、路径、标识符、报错原文一律原样",
		"",
		"## 上一次的接手说明",
		input.previousSummary?.trim() || "(这是第一次压缩，没有上一次的说明)",
		"",
		"## 旧记录位置（被压缩掉的原文完整保存在这里，jsonl，每行一个 JSON）",
		input.sessionFile ?? "(会话文件路径不可用)",
		"",
		"## 本次要压缩的对话记录",
		input.transcript.trim() || "(unavailable)",
		"",
		"## 文件（由扩展从工具调用里机械提取，不是你列的）",
		"### 改过",
		files.modified || "(none)",
		"",
		"### 读过",
		files.read || "(none)",
	].join("\n");
}

/**
 * In-band failure record. Pi swallows extension exceptions, so this — not a
 * thrown error — is what keeps a failed summary observable. It points at the
 * untouched transcript, so nothing is actually lost.
 */
export function buildFailureSummary(reason: string, sessionFile: string | undefined): string {
	return [
		"# Compaction Summary — 未生成",
		"",
		`本次压缩没有产出可用的接手说明：${reason}`,
		"",
		`被压缩掉的原文完整保存在 ${sessionFile ?? "(会话文件路径不可用)"}`,
		"（jsonl，每行一个 JSON）。需要上文时直接 grep 这个文件。",
	].join("\n");
}

/** Minimal orientation for the overflow fast path — mechanical facts, no model call. */
export function buildOverflowSummary(fileOps: FileOps, sessionFile: string | undefined): string {
	const files = formatFileLists(fileOps);
	return [
		"# Compaction Summary — 溢出快路径",
		"",
		"上下文窗口已经超限，本次压缩没有调用模型，只留下机械信息。",
		"",
		"## 下一步",
		"先回到旧记录确认自己在做什么，再继续。",
		"",
		"## 文件",
		`### 改过\n${files.modified || "(none)"}`,
		"",
		`### 读过\n${files.read || "(none)"}`,
		"",
		"## 旧记录",
		String(sessionFile ?? "(会话文件路径不可用)"),
		"被压缩掉的原文完整保存在这里（jsonl，每行一个 JSON）。",
	].join("\n");
}

/**
 * Assemble the summary text. Model-written blocks come first so the mechanical
 * file list cannot crowd out the topics and the intent (ADR 0015).
 */
export function renderSummary(parts: CompactionSummaryParts, fileOps: FileOps, sessionFile: string | undefined): string {
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
		"## 主题",
		parts.topics.length > 0 ? parts.topics.map((topic) => `- ${topic}`).join("\n") : "(未提供)",
		"",
		"## 下一步",
		parts.nextIntent || "(未提供)",
		...(parts.restore ? ["", parts.restore] : []),
		"",
		"## 文件",
		"### 改过",
		fileOps.modified.length > 0 ? fileOps.modified.map(describe).join("\n") : "(none)",
		"",
		"### 读过",
		fileOps.read.length > 0 ? fileOps.read.join("\n") : "(none)",
		"",
		"## 旧记录",
		String(sessionFile ?? "(会话文件路径不可用)"),
		"被压缩掉的原文完整保存在这里（jsonl，每行一个 JSON）。需要上文时 grep 这个文件。",
	].join("\n");
}
