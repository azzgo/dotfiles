/**
 * Definition / Pattern file reader.
 *
 * Format contract (Markdown + YAML frontmatter, human-reviewable):
 *   ---
 *   name: bugfix
 *   description: One-line what this workflow is for
 *   nodes:
 *     - id: intake
 *       title: Receive & triage the defect
 *       type: human
 *       suggest: [grill-with-docs]
 *   ---
 *   ## intake
 *   Brief prose.
 *
 *   done-when: repro or root-cause hypothesis is recorded.
 *
 * Deliberately dependency-free: a strict line-based parser for exactly this
 * YAML subset. Anything outside the contract is rejected with readable
 * errors — never silently accepted.
 */
import type { DefNode, Definition, NodeType } from "./types";

const NODE_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TOP_LEVEL_KEYS = new Set(["name", "description", "nodes"]);
const NODE_KEYS = new Set(["id", "title", "type", "suggest"]);

export function isKebabCase(s: string): boolean {
	return NODE_ID_RE.test(s);
}

export interface ParseResult {
	definition?: Definition;
	errors: string[];
}

function splitFrontmatter(doc: string): { frontmatter: string; body: string } | null {
	if (!doc.startsWith("---")) return null;
	const end = doc.indexOf("\n---", 3);
	if (end === -1) return null;
	let after = doc.slice(end + 4); // skip "\n---"
	if (after.startsWith("\r")) after = after.slice(1);
	if (after.startsWith("\n")) after = after.slice(1);
	return { frontmatter: doc.slice(4, end), body: after };
}

function stripQuotes(s: string): string {
	if (s.length >= 2 && ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))) {
		return s.slice(1, -1);
	}
	return s;
}

function parseSuggest(value: string): string[] {
	const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
	if (inner === "") return [];
	return inner
		.split(",")
		.map((s) => stripQuotes(s.trim()))
		.filter((s) => s.length > 0);
}

/** Parse a Definition document. Returns ALL contract violations found. */
export function parseDefinition(doc: string, sourcePath?: string): ParseResult {
	const errors: string[] = [];
	const split = splitFrontmatter(doc);
	if (!split) return { errors: ["missing YAML frontmatter block (must start with '---' and close with '---')"] };
	const { frontmatter, body } = split;

	let name = "";
	let description = "";
	const nodes: DefNode[] = [];
	const seenIds = new Set<string>();

	let inNodes = false;
	let sawNodesKey = false;
	let current: { id?: string; title?: string; type?: string; suggest?: string[] } | null = null;

	const flush = (): void => {
		if (!current) return;
		const node: DefNode = {
			id: current.id ?? "",
			title: current.title ?? "",
			type: (current.type ?? "") as NodeType,
			suggest: current.suggest ?? [],
			brief: "",
			doneWhen: "",
		};
		if (!node.id) errors.push("a node is missing 'id:'");
		else if (!isKebabCase(node.id)) errors.push(`node id "${node.id}" must be kebab-case`);
		else if (seenIds.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
		else seenIds.add(node.id);
		if (!node.title) errors.push(`node ${node.id || "?"} is missing 'title:'`);
		if (node.type !== "human" && node.type !== "auto") {
			errors.push(`node ${node.id || "?"} has invalid type "${String(current.type ?? "")}" (must be 'human' or 'auto')`);
		}
		nodes.push(node);
		current = null;
	};

	const lines = frontmatter.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#")) continue;
		const lineNo = i + 1;
		if (/^\s/.test(line)) {
			const field = trimmed.replace(/^-\s+/, "");
			const isItemStart = /^-\s+/.test(trimmed) || trimmed === "-";
			if (isItemStart) {
				if (!inNodes) {
					errors.push(`line ${lineNo}: list item outside 'nodes:'`);
					continue;
				}
				flush();
				current = {};
			} else if (!current) {
				errors.push(`line ${lineNo}: indented field without a '- ' list item`);
				continue;
			}
			const m = field.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
			if (!m) {
				errors.push(`line ${lineNo}: cannot parse node field "${field}"`);
				continue;
			}
			const key = m[1]!;
			const value = m[2]!.trim();
			if (!NODE_KEYS.has(key)) {
				errors.push(`line ${lineNo}: unknown node field "${key}" (allowed: id, title, type, suggest)`);
				continue;
			}
			if (!current) continue;
			if (key === "id") current.id = stripQuotes(value);
			else if (key === "title") current.title = stripQuotes(value);
			else if (key === "type") current.type = stripQuotes(value);
			else if (key === "suggest") current.suggest = parseSuggest(value);
			continue;
		}
		const m = line.match(/^([A-Za-z_-]+)\s*:\s*(.*)$/);
		if (!m) {
			errors.push(`line ${lineNo}: cannot parse frontmatter line "${trimmed}"`);
			continue;
		}
		const key = m[1]!;
		const value = m[2]!.trim();
		if (!TOP_LEVEL_KEYS.has(key)) {
			errors.push(`line ${lineNo}: unknown frontmatter key "${key}" (allowed: name, description, nodes)`);
		}
		flush();
		inNodes = false;
		if (key === "nodes") {
			inNodes = true;
			sawNodesKey = true;
		} else if (key === "name") {
			name = stripQuotes(value);
		} else if (key === "description") {
			description = stripQuotes(value);
		}
	}
	flush();

	if (!sawNodesKey) errors.push("frontmatter is missing the 'nodes:' list");
	if (!name) errors.push("frontmatter is missing 'name:'");
	else if (!isKebabCase(name)) errors.push(`name "${name}" must be kebab-case`);
	if (!description) errors.push("frontmatter is missing 'description:'");
	if (nodes.length === 0) errors.push("'nodes:' must list at least one node");

	// body contract: every node needs a `## <id>` section with a `done-when:` line
	for (const node of nodes) {
		if (!node.id) continue;
		const section = extractSection(body, node.id);
		if (section === undefined) {
			errors.push(`body is missing the '## ${node.id}' section`);
			continue;
		}
		const doneWhen = readDoneWhen(section);
		if (doneWhen === undefined) {
			errors.push(`section '## ${node.id}' is missing a 'done-when:' line`);
			continue;
		}
		node.doneWhen = doneWhen;
		node.brief = section
			.split(/\r?\n/)
			.filter((l) => !/^done-when:/.test(l.trim()))
			.join("\n")
			.trim();
	}

	if (errors.length > 0) return { errors };
	return { definition: { name, description, nodes, sourcePath }, errors };
}

/** Extract the `## <heading>` section body (up to the next `## ` heading). */
export function extractSection(body: string, heading: string): string | undefined {
	const re = new RegExp(`^## ${escapeRe(heading)}\\s*$`, "m");
	const m = body.match(re);
	if (!m || m.index === undefined) return undefined;
	const rest = body.slice(m.index + m[0].length);
	const next = rest.match(/^## /m);
	const section = next && next.index !== undefined ? rest.slice(0, next.index) : rest;
	return section.trim();
}

function readDoneWhen(section: string): string | undefined {
	const line = section
		.split(/\r?\n/)
		.map((l) => l.trim())
		.find((l) => /^done-when:/.test(l));
	if (line === undefined) return undefined;
	return line.replace(/^done-when:\s*/, "").trim();
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
