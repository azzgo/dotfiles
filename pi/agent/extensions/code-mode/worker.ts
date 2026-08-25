/**
 * run_code worker bootstrap.
 *
 * Runs a single model-written TypeScript program in an isolated worker thread.
 * The `tools` global proxies every sub-call back to the host over the message
 * port (pure event-driven: post {id,name,args} and await the matching reply —
 * no polling, no sleep). `emit` and a `console` shim stream lines to the host.
 * `require` (rooted at the host cwd), `__dirname`, and `__filename` are
 * injected into the program scope so Node builtins work inside the ESM
 * worker (a bare `new Function` would have no `require` at all).
 *
 * This file must stay "erasable TypeScript": it is executed via Node's native
 * type-stripping (requires Node >= 23.6, or --experimental-strip-types).
 */
import { parentPort, workerData } from "node:worker_threads";
import { createRequire } from "node:module";
import * as path from "node:path";

const port = parentPort;
if (!port) {
	throw new Error("run_code worker: no parentPort");
}

const code: string = (workerData as { code: string }).code ?? "";
const cwd: string = (workerData as { cwd?: string }).cwd ?? process.cwd();

/** Injected into every program: require resolves from the host cwd (so
 * `require("fs")` / `require("node:fs")` and project-local packages work),
 * and __dirname/__filename point at the session cwd. */
const nodeRequire = createRequire(path.join(cwd, "__run_code__.cjs"));
const programDirname = cwd;
const programFilename = path.join(cwd, "__run_code__.ts");

interface PendingCall {
	resolve: (value: unknown) => void;
	reject: (err: unknown) => void;
	name: string;
}

let nextId = 1;
const pending = new Map<number, PendingCall>();

port.on("message", (msg: any) => {
	if (!msg || msg.kind !== "reply") return;
	const p = pending.get(msg.id);
	if (!p) return;
	pending.delete(msg.id);
	if (msg.ok) {
		p.resolve(msg.value);
	} else {
		const err: any = new Error(msg.message || "tool call failed");
		err.toolName = p.name;
		p.reject(err);
	}
});

const tools = new Proxy({} as Record<string, (args: unknown) => Promise<unknown>>, {
	get(_t, prop: string) {
		// Guard against Promise/thenable protocol probing.
		if (typeof prop !== "string" || prop === "then" || prop === "catch" || prop === "finally") {
			return undefined;
		}
		return (args: unknown): Promise<unknown> => {
			const id = nextId++;
			return new Promise((resolve, reject) => {
				pending.set(id, { resolve, reject, name: prop });
				port.postMessage({ kind: "call", id, name: prop, args });
			});
		};
	},
});

function emit(value: unknown): void {
	port.postMessage({ kind: "emit", value });
}

/** Re-fetch a byte slice of a past run_code call's persisted return value
 * (ADR 0003). Handled host-side as a pure session read — bypasses the
 * sub-call scheduler and the details.calls audit. */
function fetchResult(
	toolCallId: string,
	offset: number,
	size?: number,
): Promise<{ totalBytes: number; content: string; nextOffset: number | null }> {
	const id = nextId++;
	return new Promise((resolve, reject) => {
		pending.set(id, { resolve, reject, name: "fetchResult" });
		port.postMessage({ kind: "fetch", id, toolCallId, offset, size });
	});
}

function fmt(v: unknown): string {
	if (v === undefined) return "undefined";
	if (typeof v === "string") return v;
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}

const consoleShim = {
	log: (...a: unknown[]) => emit(a.map(fmt).join(" ")),
	info: (...a: unknown[]) => emit(a.map(fmt).join(" ")),
	warn: (...a: unknown[]) => emit("[warn] " + a.map(fmt).join(" ")),
	error: (...a: unknown[]) => emit("[error] " + a.map(fmt).join(" ")),
};

/** Find the start index of the last top-level statement in `code`. */
function lastStatementStart(code: string): number {
	let brace = 0;
	let paren = 0;
	let bracket = 0;
	let last = -1;
	let i = 0;
	const n = code.length;
	while (i < n) {
		const ch = code[i];
		const next = code[i + 1];
		// line comment
		if (ch === "/" && next === "/") {
			while (i < n && code[i] !== "\n") i++;
			continue;
		}
		// block comment
		if (ch === "/" && next === "*") {
			i += 2;
			while (i < n && !(code[i] === "*" && code[i + 1] === "/")) i++;
			i += 2;
			continue;
		}
		// string / template / char
		if (ch === '"' || ch === "'" || ch === "`") {
			const quote = ch;
			i++;
			while (i < n) {
				if (quote === "`" && code[i] === "\\") {
					i += 2;
					continue;
				}
				if (code[i] === quote) {
					if (quote === "`" && code[i + 1] === "$" && code[i + 2] === "{") {
						// template interpolation
						i += 3;
						break;
					}
					i++;
					break;
				}
				i++;
			}
			continue;
		}
		if (ch === "{") {
			if (brace === 0 && paren === 0 && bracket === 0) last = i + 1;
			brace++;
		} else if (ch === "}") {
			brace = Math.max(0, brace - 1);
			if (brace === 0 && paren === 0 && bracket === 0) last = i + 1;
		} else if (ch === "(") {
			paren++;
		} else if (ch === ")") {
			paren = Math.max(0, paren - 1);
		} else if (ch === "[") {
			bracket++;
		} else if (ch === "]") {
			bracket = Math.max(0, bracket - 1);
		} else if (ch === ";") {
			if (brace === 0 && paren === 0 && bracket === 0) last = i + 1;
		}
		i++;
	}
	return last;
}

const FIRST_KEYWORD = /^(return\b|if\b|else\b|for\b|while\b|switch\b|try\b|catch\b|finally\b|throw\b|function\b|class\b|const\b|let\b|var\b|async\b|do\b|break\b|continue\b|import\b|export\b|new\b|typeof\b|\{|\/\/|\/\*)/;

/** Turn "last expression is the return value" into an explicit return. */
function withLastExpressionReturn(code: string): string {
	const s = code.trim();
	if (!s) return "";
	const idx = lastStatementStart(s);
	const last = idx < 0 ? s : s.slice(idx).trim();
	if (!last) return s;
	if (FIRST_KEYWORD.test(last)) {
		// Last statement is a control/declaration: rely on explicit return.
		return s;
	}
	if (idx < 0) return "return (" + last + ");";
	return s.slice(0, idx) + "\nreturn (" + last + ");";
}

async function run(): Promise<void> {
	const body = "return (async () => {\n" + withLastExpressionReturn(code) + "\n})();";
	// eslint-disable-next-line no-new-func
	const fn = new Function("tools", "emit", "fetchResult", "console", "require", "__dirname", "__filename", body);
	const value = await fn(tools, emit, fetchResult, consoleShim, nodeRequire, programDirname, programFilename);
	port.postMessage({ kind: "done", value: value === undefined ? null : value });
}

run().catch((err: any) => {
	port.postMessage({
		kind: "error",
		message: err && err.message ? String(err.message) : String(err),
	});
});
