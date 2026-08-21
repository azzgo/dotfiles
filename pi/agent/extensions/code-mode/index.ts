/**
 * Code Mode — collapse pi's tool catalog into a single `run_code` tool plus an
 * injected TypeScript SDK. The model writes one TS program that composes many
 * tool calls via `await tools.name(args)`; the program runs in an isolated
 * worker thread and only its logs + return value re-enter model context.
 *
 * Port of DeepSeek Harness "PTC / Code Mode" to a pi extension. See
 * docs/adr/0001-code-mode-extension.md.
 *
 * Files:
 *   index.ts     entry: /code toggle, run_code tool, before_agent_start SDK
 *   worker.ts    worker bootstrap (event-driven message bridge, no polling)
 *   sdk.ts       JSON-Schema -> TS type projection + SDK text
 *   scheduler.ts bounded-concurrency sub-call pool
 *   config.json  blacklist / timeout / concurrency / size caps
 */
import type { ExtensionAPI, ToolInfo } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs";
import * as path from "node:path";
import { TaskPool } from "./scheduler.js";
import { generateSdk } from "./sdk.js";
import {
  createBashToolDefinition,
  createEditToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  createWriteToolDefinition,
} from "@earendil-works/pi-coding-agent";


const EXT_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Built-in tools bridged to real execute (shared withFileMutationQueue). */
const BRIDGED = ["read", "bash", "edit", "write", "grep", "find", "ls"];

interface CodeModeConfig {
	blacklist: string[];
	timeoutMs: number;
	maxConcurrent: number;
	maxResultBytes: number;
	maxRecordBytes: number;
}

const DEFAULT_CONFIG: CodeModeConfig = {
	blacklist: ["mcpScript"],
	timeoutMs: 60000,
	maxConcurrent: 10,
	maxResultBytes: 8192,
	maxRecordBytes: 50000,
};

function loadConfig(): CodeModeConfig {
	try {
		const raw = fs.readFileSync(path.join(EXT_DIR, "config.json"), "utf-8");
		const parsed = JSON.parse(raw) as Partial<CodeModeConfig>;
		return {
			...DEFAULT_CONFIG,
			...parsed,
			blacklist: Array.isArray(parsed.blacklist) ? parsed.blacklist : DEFAULT_CONFIG.blacklist,
		};
	} catch {
		return DEFAULT_CONFIG;
	}
}

const COLLAPSE = `You are in CODE MODE. run_code is the ONLY tool you may call directly. To perform any other action (read files, run commands, edit files, search, list directories, etc.), write a single TypeScript program and pass it to run_code using the injected SDK above. Compose multiple steps into one program to save round-trips. Do NOT call individual tools like read/bash/edit/write/grep/ls/find directly — they are not available in this mode.`;

function truncateStr(s: string, maxBytes: number): string {
	if (!s) return s;
	if (Buffer.byteLength(s, "utf-8") <= maxBytes) return s;
	let out = "";
	for (const ch of s) {
		if (Buffer.byteLength(out + ch, "utf-8") > maxBytes) break;
		out += ch;
	}
	return out + `\n… [truncated at ${maxBytes} bytes]`;
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return String(value);
	}
}

function fmtEmit(value: unknown): string {
	return typeof value === "string" ? value : safeStringify(value);
}

function buildResultText(logs: string[], valueStr: string | null, error: string | null): string {
	const parts: string[] = [];
	if (logs.length > 0) parts.push("── logs ──\n" + logs.join("\n"));
	if (valueStr != null) parts.push("── return value ──\n" + valueStr);
	if (error != null) parts.push("── error ──\n" + error);
	return parts.length > 0 ? parts.join("\n\n") : "(no output)";
}

export default function (pi: ExtensionAPI) {
	let codeModeOn = false;
	let savedActiveTools: string[] | null = null;
	let seq = 0;

	const getBlacklistSet = () => new Set([...loadConfig().blacklist, "run_code"]);

	/** Tools the run_code bridge can actually execute (SDK + bridge stay in sync). */
	function getBridgedToolInfos(): ToolInfo[] {
		const all = pi.getAllTools();
		const blacklist = getBlacklistSet();
		const universe = savedActiveTools && savedActiveTools.length ? new Set(savedActiveTools) : null;
		return all.filter(
			(t) =>
				BRIDGED.includes(t.name) &&
				!blacklist.has(t.name) &&
				(!universe || universe.has(t.name)),
		);
	}

	// ── /code toggle ──
	pi.registerCommand("code", {
		description: "Toggle code mode (fold the tool catalog into run_code + injected SDK)",
		handler: async (_args, ctx) => {
			if (!codeModeOn) {
				savedActiveTools = pi.getActiveTools();
				pi.setActiveTools(["run_code"]);
				codeModeOn = true;
				ctx.ui.notify("Code mode ON — only run_code is callable; SDK injected.", "info");
			} else {
				pi.setActiveTools(
					savedActiveTools && savedActiveTools.length
						? savedActiveTools
						: pi.getAllTools().map((t) => t.name),
				);
				savedActiveTools = null;
				codeModeOn = false;
				ctx.ui.notify("Code mode OFF — native tools restored.", "info");
			}
		},
	});

	// ── SDK + collapse injection ──
	pi.on("before_agent_start", async (event) => {
		if (!codeModeOn) return;
		const infos = getBridgedToolInfos();
		let sdk = "";
		if (infos.length > 0) {
			sdk =
				"\n\n" +
				generateSdk(
					infos.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
				);
		}
		return { systemPrompt: event.systemPrompt + sdk + "\n\n" + COLLAPSE };
	});

	// ── run_code tool ──
	pi.registerTool({
		name: "run_code",
		label: "Run Code",
		description:
			"Write and run a TypeScript program that composes multiple tool calls via the injected SDK " +
			"(`await tools.<name>(args)`). The program runs in an isolated worker; only its logs and return " +
			"value are shown back. `code` is the program body (async; end with `return <value>;` or let the " +
			"final expression be the return value). `description` labels the call in the UI.",
		promptSnippet: "Run a TypeScript program composing multiple tool calls via the injected SDK",
		promptGuidelines: [
			"Use run_code to compose several read/bash/edit/etc. operations into a single TypeScript program; the tools are exposed as the injected `tools` global.",
		],
		parameters: Type.Object({
			code: Type.String({
				description: "TypeScript program body (async; end with return <value> or let the final expression be the return value).",
			}),
			description: Type.Optional(
				Type.String({ description: "Short description of what the program does (labels the call in the UI)." }),
			),
		}),

		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const { code, description } = params as { code: string; description?: string };

			if (!codeModeOn) {
				return {
					content: [
						{
							type: "text",
							text: "run_code is disabled: code mode is OFF. Use the native tools directly (read/bash/edit/...). Type /code to enable code mode.",
						},
					],
					isError: true,
					details: {},
				};
			}

			const cfg = loadConfig();
			const cwd = ctx.cwd;
			const callId = `run_code-${++seq}`;

			// Real built-in tool definitions -> real execute (shared withFileMutationQueue).
			const defs: Record<
				string,
				{
					execute(
						toolCallId: string,
						params: unknown,
						signal: AbortSignal | undefined,
						onUpdate: unknown,
						ctx: unknown,
					): Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean; details?: unknown }>;
				}
			> = {
				read: createReadToolDefinition(cwd),
				bash: createBashToolDefinition(cwd),
				edit: createEditToolDefinition(cwd),
				write: createWriteToolDefinition(cwd),
				grep: createGrepToolDefinition(cwd),
				find: createFindToolDefinition(cwd),
				ls: createLsToolDefinition(cwd),
			};
			const blacklist = getBlacklistSet();

			const pool = new TaskPool(cfg.maxConcurrent);
			const calls: Array<Record<string, unknown>> = [];
			const activeSubCalls: Array<Promise<void>> = [];
			const runAbort = new AbortController();
			const onSignalAbort = () => {
				if (!runAbort.signal.aborted) runAbort.abort();
			};
			signal?.addEventListener("abort", onSignalAbort, { once: true });

			const execSubCall = (name: string, args: unknown) =>
				pool.run(async (): Promise<string> => {
					const def = defs[name];
					if (!def || blacklist.has(name)) {
						throw new Error(`Tool "${name}" is not callable inside code mode.`);
					}
					const subId = `${callId}.${++seq}`;
					let result: any;
					let error: unknown = null;
					try {
						result = await def.execute(subId, args, runAbort.signal, undefined, ctx);
					} catch (e) {
						error = e;
					}
					const textContent = (result?.content ?? [])
						.filter((c: any) => c.type === "text")
						.map((c: any) => c.text ?? "")
						.join("\n");
					calls.push({
						id: subId,
						name,
						args,
						content: truncateStr(textContent, cfg.maxRecordBytes),
						isError: error ? true : !!result?.isError,
						hasImage: (result?.content ?? []).some((c: any) => c.type === "image"),
						details: result?.details ?? undefined,
					});
					if (error) throw error;
					return textContent;
				});

			const workerPath = path.join(EXT_DIR, "worker.ts");
			const worker = new Worker(workerPath, { workerData: { code } });

			const logs: string[] = [];
			let settled = false;
			let resolveDone!: (v: { value: unknown; logs: string[] }) => void;
			let rejectDone!: (e: Error) => void;
			const done = new Promise<{ value: unknown; logs: string[] }>((res, rej) => {
				resolveDone = res;
				rejectDone = rej;
			});

			worker.on("message", (msg: any) => {
				if (settled || !msg) return;
				if (msg.kind === "call") {
					const p = execSubCall(msg.name, msg.args)
						.then((value) => {
							if (!worker.terminated) worker.postMessage({ kind: "reply", id: msg.id, ok: true, value });
						})
						.catch((e: any) => {
							if (!worker.terminated)
								worker.postMessage({ kind: "reply", id: msg.id, ok: false, message: e?.message ?? String(e) });
						});
					activeSubCalls.push(p);
				} else if (msg.kind === "emit") {
					const line = fmtEmit(msg.value);
					logs.push(line);
					onUpdate?.({ content: [{ type: "text", text: line }] });
				} else if (msg.kind === "done") {
					settled = true;
					resolveDone({ value: msg.value, logs });
				} else if (msg.kind === "error") {
					settled = true;
					rejectDone(new Error(msg.message || "code run failed"));
				}
			});
			worker.on("error", (e) => {
				if (!settled) {
					settled = true;
					rejectDone(e);
				}
			});
			worker.on("exit", (code) => {
				if (!settled) {
					settled = true;
					rejectDone(new Error(`code run worker exited with code ${code}`));
				}
			});

			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				runAbort.abort();
				worker.terminate();
				rejectDone(Object.assign(new Error("Code run timed out"), { kind: "timeout" }));
			}, cfg.timeoutMs);

			try {
				const { value, logs: outLogs } = await done;
				// Drain any fire-and-forget sub-calls so file mutations settle before we return.
				await Promise.allSettled(activeSubCalls);
				const valueStr = truncateStr(safeStringify(value), cfg.maxResultBytes);
				const contentText = buildResultText(outLogs, valueStr, null);
				return {
					content: [{ type: "text", text: contentText }],
					details: { status: "ok", description, calls, logs: outLogs, value },
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				const contentText = buildResultText(logs, null, message);
				return {
					content: [{ type: "text", text: contentText }],
					isError: true,
					details: { status: "error", description, calls, logs, error: message },
				};
			} finally {
				clearTimeout(timer);
				signal?.removeEventListener("abort", onSignalAbort);
				if (!worker.terminated) worker.terminate();
			}
		},
	});
}

