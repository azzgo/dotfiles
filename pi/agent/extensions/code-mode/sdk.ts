/**
 * SDK generation for code mode.
 *
 * Projects tool JSON-Schema parameters to TypeScript declarations and renders
 * the `declare const tools` SDK block injected into the system prompt.
 */

export interface ToolSdkInfo {
	name: string;
	description?: string;
	/** JSON-Schema / TypeBox parameter schema (runtime object). */
	parameters?: unknown;
}

const CONTROL_WORDS = new Set([
	"return", "if", "else", "for", "while", "switch", "try", "catch", "finally",
	"throw", "function", "class", "const", "let", "var", "async", "await",
	"do", "break", "continue", "import", "export", "new", "typeof", "instanceof",
]);

/** Recursively project a JSON-Schema node to a TS type string. */
function schemaToTs(schema: any, depth = 0): string {
	if (schema == null || typeof schema !== "object") return "unknown";
	if (depth > 12) return "unknown";

	// anyOf / oneOf -> union of members
	if (Array.isArray(schema.anyOf)) {
		const parts = schema.anyOf.map((s: any) => schemaToTs(s, depth + 1));
		return `(${parts.join(" | ")})`;
	}
	if (Array.isArray(schema.oneOf)) {
		const parts = schema.oneOf.map((s: any) => schemaToTs(s, depth + 1));
		return `(${parts.join(" | ")})`;
	}

	const t = schema.type;
	switch (t) {
		case "string":
			return "string";
		case "number":
		case "integer":
			return "number";
		case "boolean":
			return "boolean";
		case "null":
			return "null";
		case "array": {
			const items = schema.items ? schemaToTs(schema.items, depth + 1) : "unknown";
			return `${items}[]`;
		}
		case "object": {
			const props = schema.properties;
			if (!props || typeof props !== "object") return "Record<string, unknown>";
			const required: string[] = Array.isArray(schema.required) ? schema.required : [];
			const lines: string[] = [];
			for (const [key, sub] of Object.entries(props as Record<string, any>)) {
				const isRequired = required.includes(key);
				const subTs = schemaToTs(sub, depth + 1);
				lines.push(`  ${JSON.stringify(key)}${isRequired ? "" : "?"}: ${subTs};`);
			}
			return `{\n${lines.join("\n")}\n}`;
		}
		case "array" as string:
			return "unknown[]";
		default:
			break;
	}

	// enum without explicit type
	if (Array.isArray(schema.enum)) {
		const parts = schema.enum.map((v: any) => JSON.stringify(v));
		return parts.join(" | ");
	}

	return "unknown";
}

/** Build the TS declaration string for a single tool. */
function toolDecl(info: ToolSdkInfo): string {
	const paramsTs = info.parameters ? schemaToTs(info.parameters, 0) : "{}";
	const lines: string[] = [];
	if (info.description) {
		for (const dline of info.description.split("\n")) {
			lines.push(`  /** ${dline} */`);
		}
	}
	lines.push(`  ${JSON.stringify(info.name)}(args: ${paramsTs}): Promise<string>;`);
	return lines.join("\n");
}

const SDK_HEADER = `/**
 * CODE MODE SDK — TypeScript bindings for tools callable inside run_code.
 *
 * Write ONE async TypeScript program and pass it as \`code\` to run_code
 * (and a short \`description\` to label the call).
 *
 * Inside the program you get the \`tools\` global and an \`emit\` function:
 *
 *   const listing = await tools.bash({ command: "ls -la" });
 *   emit(listing);
 *   return { entryCount: listing.split("\\n").length };
 *
 * Multi-agent orchestration (sub-dispatch):
 *   const impl = await tools.dispatch({ agent: "pi", prompt: "implement X" });
 *   const review = await tools.dispatch({ agent: "codex", prompt: "review the diff" });
 *   emit(impl.output); emit(review.output);
 *   return { implOk: impl.ok, reviewOk: review.ok };
 * Rules:
 * - The program body is async; top-level \`await\` works.
 * - End with \`return <value>;\`, or let a final simple expression be returned.
 *   For object/array/string results, use \`return { ... };\` explicitly.
 * - \`tools.<name>(args)\` returns the tool's text output (Promise<string>);
 *   \`tools.dispatch(...)\` is the exception — it resolves to a structured object
 *   \`{ ok, exitCode, output }\` (read fields directly, no JSON.parse).
 * - Only what you \`emit()\` / \`console.log\` and your return value are shown
 *   to the model. Intermediate tool results are NOT echoed back.
 * - Independent read-only calls may overlap under \`Promise.all([...])\`.
 * - A rejected tool call throws inside the program; wrap with try/catch to handle.
 */`;

/** Render the full SDK block for a set of tools. */
/** Dedicated declaration for the `dispatch` sub-agent bridge (sub-dispatch). */
const DISPATCH_DECL = `  /** dispatch — spawn a sub-agent as a subprocess and await its completion (foreground).
   * Resolves to a structured object { ok: boolean, exitCode: number|null, output: string }
   * (output is tail-truncated by the sub-dispatch engine) — NOT a string, so read
   * fields directly without JSON.parse.
   * Each dispatch has its own internal timeout (default 600s) and the run's
   * wall-clock cap is paused while a dispatch is in flight.
   * Example:
   *   const r = await tools.dispatch({ agent: "pi", prompt: "implement X" });
   *   if (!r.ok) { emit("dispatch failed: " + r.output); return; }
   *   emit(r.output); // or extract/summarize from r.output */
  dispatch(args: { agent: string; prompt: string; timeout?: number }): Promise<{ ok: boolean; exitCode: number | null; output: string }>;`;
export function generateSdk(tools: ToolSdkInfo[]): string {
	const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
	const decls = sorted.map((t) => (t.name === "dispatch" ? DISPATCH_DECL : toolDecl(t))).join("\n");
	return [
		SDK_HEADER,
		"",
		"declare const tools: {",
		decls,
		"};",
		"",
		"declare function emit(value: unknown): void;",
		"",
	].join("\n");
}

export { CONTROL_WORDS };
