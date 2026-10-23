import fs from "node:fs";

import { Type } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";

import { buildCompactionSummary, resolveSummaryModel } from "./compaction";
import { compactionConfigPath, parseModelRef, readCompactionConfig, writeSummaryModel } from "./model-config";
import { formatHits, grepSessionJsonl, type SessionGrepRole } from "./session-grep";
import { NOTICE_THRESHOLD_PERCENT } from "./types";

const COMPACTION_MODEL_HELP = [
	"/compaction-model — 选一个专门写压缩摘要的模型",
	"  /compaction-model                 显示当前配置与可用模型",
	"  /compaction-model <provider/id>   指定摘要模型（例如 magpie/nas/deepseek/deepseek-flash）",
	"  /compaction-model reset           清除配置，回落到当前会话模型",
].join("\n");

const sessionGrepTool = defineTool({
	name: "session_grep",
	label: "Session Grep",
	description:
		"Search the current session transcript (jsonl) for text. Returns matching messages with role, timestamp and an excerpt. Use it to recover context that a compaction summary dropped.",
	exposure: "codemode",
	parameters: Type.Object({
		query: Type.String({ description: "Text or regular expression to search for" }),
		role: Type.Optional(
			Type.Union([Type.Literal("user"), Type.Literal("assistant"), Type.Literal("toolResult")], {
				description: "Only match messages of this role",
			}),
		),
		since: Type.Optional(Type.String({ description: "ISO timestamp lower bound, inclusive" })),
		until: Type.Optional(Type.String({ description: "ISO timestamp upper bound, inclusive" })),
		limit: Type.Optional(Type.Number({ description: "Maximum hits (default 20)" })),
	}),

	async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
		const file = ctx.sessionManager?.getSessionFile();
		if (!file) {
			return {
				content: [{ type: "text", text: "本会话还没有落盘的 transcript 文件，无法检索。" }],
				details: { hits: 0 },
			};
		}
		let lines: string[];
		try {
			lines = fs.readFileSync(file, "utf8").split("\n");
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [{ type: "text", text: `读取 transcript 失败：${message}` }],
				details: { hits: 0 },
			};
		}
		const hits = grepSessionJsonl(lines, {
			query: params.query,
			role: params.role as SessionGrepRole | undefined,
			since: params.since,
			until: params.until,
			limit: params.limit,
		});
		return {
			content: [{ type: "text", text: formatHits(hits) }],
			details: { hits: hits.length },
		};
	},
});

export default function compactionExtension(pi: ExtensionAPI): void {
	let noticeSent = false;

	// Compaction Summary as handoff (docs/adr/0020-compaction-summary-handoff.md).
	//
	// The handler never throws and never returns undefined: Pi's ExtensionRunner.emit()
	// swallows handler exceptions and treats the resulting undefined exactly like
	// "no extension result", which would silently reinstate built-in summarization.
	// Failures are therefore recorded in-band as the mechanical Compaction Fallback.
	pi.on("session_before_compact", async (event, ctx) => {
		return buildCompactionSummary(event, ctx);
	});

	// Compaction Notice: one hint per session when the window gets crowded.
	// Compacting stays a human decision — this never compacts by itself.
	pi.on("agent_end", async (_event, ctx) => {
		if (noticeSent) return;
		const usage = ctx.getContextUsage();
		if (!usage || usage.percent === null || usage.percent === undefined) return;
		if (usage.percent < NOTICE_THRESHOLD_PERCENT) return;
		noticeSent = true;
		if (ctx.hasUI) {
			ctx.ui.notify(
				`上下文已用 ${usage.percent.toFixed(0)}%，建议 /compact（压缩由你决定）`,
				"info",
			);
		}
	});

	pi.on("session_compact", async () => {
		noticeSent = false;
	});

	pi.registerCommand("compaction-model", {
		description: "Compaction: choose the model that writes the compaction summary.",
		handler: async (args, ctx) => {
			const argument = args.trim();
			if (argument === "") {
				await showSummaryModel(ctx);
				return;
			}
			if (argument === "reset" || argument === "none") {
				writeSummaryModel(undefined);
				if (ctx.hasUI) ctx.ui.notify("已清除摘要模型配置，压缩摘要将使用当前会话模型。", "info");
				return;
			}
			const ref = parseModelRef(argument);
			if (!ref) {
				if (ctx.hasUI) ctx.ui.notify(`模型格式无效：${argument}（应为 provider/modelId）`, "error");
				return;
			}
			const model = ctx.modelRegistry.find(ref.provider, ref.modelId);
			if (!model) {
				if (ctx.hasUI) ctx.ui.notify(`找不到模型 ${argument}`, "error");
				await showAvailableModels(ctx);
				return;
			}
			writeSummaryModel(argument);
			if (ctx.hasUI) ctx.ui.notify(`摘要模型已设为 ${argument}（配置：${compactionConfigPath()}）`, "info");
		},
	});

	pi.registerTool(sessionGrepTool);
}

async function showSummaryModel(ctx: ExtensionContext): Promise<void> {
	const configured = readCompactionConfig().summaryModel;
	const choice = resolveSummaryModel(ctx);
	const lines = [
		COMPACTION_MODEL_HELP,
		"",
		`配置文件：${compactionConfigPath()}`,
		`当前配置：${configured ?? "(未配置，使用会话模型)"}`,
		`实际使用：${choice.model ? `${choice.model.provider}/${choice.model.id}` : "(无可用模型)"}`,
	];
	if (choice.problem) lines.push(`提示：${choice.problem}`);
	lines.push("", `配置来源：${choice.source}`);
	if (ctx.hasUI) ctx.ui.notify(lines.join("\n"), "info");
}

async function showAvailableModels(ctx: ExtensionContext): Promise<void> {
	const available = ctx.modelRegistry.getAvailable();
	const suggestions = available
		.map((model) => `${model.provider}/${model.id}`)
		.filter((id) => /flash|mini/i.test(id))
		.slice(0, 10);
	if (!ctx.hasUI) return;
	ctx.ui.notify(
		suggestions.length > 0 ? `可用的候选模型：\n${suggestions.join("\n")}` : "没有可用模型。",
		"info",
	);
}
