/**
 * Xfer — unidirectional cross-project handoff extension
 *
 * Generate a markdown handoff doc via /handoff-style prompt,
 * send it via Unix socket to another Pi instance.
 *
 * ⚡ One-way only, no wait. Reply by calling /xfer again.
 *
 * Install:
 *   just install-pi    # auto symlink to ~/.pi/agent/extensions/
 *
 * Usage:
 *   /xfer                     — help
 *   /xfer list                — list peers (Tab complete)
 *   /xfer rename <name>       — rename this agent
 *   /xfer <target> <req>      — handoff (LLM doc + xfer_to)
 *
 * LLM Tool:
 *   xfer_to(target, summary, handoff_document)
 *       → write /tmp/pi-xfer-<id>.md
 *       → socket notify target {file, summary}
 *       → return handoff_id immediately (no wait)
 *
 * Reply also via /xfer:
 *   To reply, /xfer <original sender> <message>.
 *   Each xfer is independent one-way.
 *
 * Protocol:
 *   Unix socket @ ~/pi-handoff/agents/<name>.sock
 *   Message: xfer-notify (JSON lines, one-way)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Constants ──

const XFER_DIR = path.join(os.homedir(), "pi-handoff", "agents");
const CONNECT_TIMEOUT_MS = 5_000;

// ── Utils ──

function msgId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function encodeAgentName(name: string): string {
  return encodeURIComponent(name);
}

function decodeAgentName(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

function endpointForName(name: string): string {
  return path.join(XFER_DIR, `${encodeAgentName(name)}.sock`);
}

function deriveName(pi: ExtensionAPI): string {
  const flag = pi.getFlag("xfer-name") as string | undefined;
  if (flag) return flag;
  try {
    const sPath = path.join(process.cwd(), ".pi", "settings.json");
    if (fs.existsSync(sPath)) {
      const s = JSON.parse(fs.readFileSync(sPath, "utf-8"));
      if (s.name) return s.name;
    }
  } catch { /* fall through */ }
  const base = path.basename(process.cwd()) || `pi-${process.pid}`;
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}_${suffix}`;
}

function listPeers(myName: string): string[] {
  try {
    fs.mkdirSync(XFER_DIR, { recursive: true });
    return fs.readdirSync(XFER_DIR)
      .filter(f => f.endsWith(".sock"))
      .map(f => f.replace(/\.sock$/, ""))
      .map(decodeAgentName)
      .filter(n => n !== myName)
      .sort();
  } catch { return []; }
}

/** Connect to target socket, send, wait ack, close */
function sendNotify(target: string, msg: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const endpoint = endpointForName(target);
    if (!fs.existsSync(endpoint)) {
      return reject(new Error(`peer "${target}" not found`));
    }
    const sock = net.createConnection(endpoint);
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("connect timeout"));
    }, CONNECT_TIMEOUT_MS);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.write(JSON.stringify(msg) + "\n");
    });
    sock.on("data", (chunk) => {
      try {
        const resp = JSON.parse(chunk.toString());
        if (resp.type === "ack") resolve();
      } catch { /* ignore */ }
      sock.end();
    });
    sock.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

// ── Extension ──

export default function (pi: ExtensionAPI) {
  pi.registerFlag("xfer-name", {
    description: "Override xfer agent name (default: current directory name)",
    type: "string",
    default: undefined,
  });

  // ── State ──

  let identity: {
    name: string;
    cwd: string;
    endpoint: string;
    server: net.Server | null;
  } | null = null;

  // ── Socket Server (inbound xfer) ──

  function createServer(): net.Server {
    return net.createServer((socket) => {
      let buf = "";
      socket.on("data", (chunk) => {
        buf += chunk.toString();
        const nl = buf.indexOf("\n");
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);

        let msg: any;
        try { msg = JSON.parse(line); } catch { return; }

        // only handle xfer-notify (one-way handoff)
        if (msg.type === "xfer-notify") {
          // inject followUp so LLM reads doc and handles request
          pi.sendMessage({
            customType: "xfer-inbound",
            content:
              `📨 [Xfer from **${msg.from}**]\n\n` +
              `**Request**: ${msg.summary}\n\n` +
              `**Doc**: \`${msg.file}\`\n\n` +
              `Read the doc and handle the request.` +
              `\n\nXfer is one-way — only reply if you have meaningful new information to communicate back.`,
            display: true,
          }, { deliverAs: "followUp", triggerTurn: true });

          socket.write(JSON.stringify({ type: "ack", msg_id: msg.msg_id }) + "\n");
        }
      });
    });
  }

  // ── Startup: register socket ──

  pi.on("session_start", async (_event, ctx) => {
    const name = deriveName(pi);
    fs.mkdirSync(XFER_DIR, { recursive: true });
    const endpoint = endpointForName(name);
    try { fs.unlinkSync(endpoint); } catch { /* ok */ }

    identity = { name, cwd: ctx.cwd || process.cwd(), endpoint, server: null };

    const server = createServer();
    identity.server = server;
    server.listen(endpoint, () => {
      ctx.ui.setStatus("xfer", `📡 ${name}`);
    });
  });

  // ── /xfer command ──

  pi.registerCommand("xfer", {
    description:
      "Xfer: one-way handoff to another Pi.\n" +
      "  /xfer <target> <request>  — generate doc and send\n" +
      "  /xfer list               — list peers\n" +
      "  /xfer rename <name>      — rename this agent",

    getArgumentCompletions: (prefix: string): AutocompleteItem[] | null => {
      const peers = listPeers(identity?.name ?? "");
      const all: AutocompleteItem[] = [
        { value: "list", label: "list", description: "List available peers" },
        { value: "rename", label: "rename", description: "Rename this agent" },
        ...peers.map(p => ({
          value: p, label: p, description: `Peer agent: ${p}`,
        })),
      ];
      const filtered = all.filter(i => i.value.startsWith(prefix));
      return filtered.length > 0 ? filtered : null;
    },

    handler: async (args, ctx) => {
      const parts = (args ?? "").trim().split(/\s+/);
      const cmd = parts[0];

      // ── help ──
      if (!cmd || cmd === "help") {
        ctx.ui.notify(
          "📡 /xfer <target> <request> — generate handoff doc\n" +
          "   /xfer list               — list peers\n" +
          "   /xfer rename <name>      — rename this agent\n" +
          "\n" +
          "💡 One-way, no wait. Reply via /xfer.",
          "info",
        );
        return;
      }

      // ── list ──
      if (cmd === "list") {
        const peers = listPeers(identity?.name ?? "");
        ctx.ui.notify(
          peers.length
            ? `📡 Peers: ${peers.join(", ")}`
            : "📡 No peers found",
          "info",
        );
        return;
      }

      // ── rename ──
      if (cmd === "rename") {
        const newName = parts[1];
        if (!newName) {
          ctx.ui.notify("Usage: /xfer rename <name>", "error");
          return;
        }
        if (!identity) return;
        try { identity.server?.close(); } catch { /* ok */ }
        try { fs.unlinkSync(identity.endpoint); } catch { /* ok */ }
        identity.name = newName;
        identity.endpoint = endpointForName(newName);
        const server = createServer();
        identity.server = server;
        await new Promise<void>(resolve => server.listen(identity.endpoint, resolve));
        ctx.ui.setStatus("xfer", `📡 ${newName}`);
        ctx.ui.notify(`✅ Renamed to "${newName}"`, "success");
        return;
      }

      // ── /xfer <target> <requirement...> ──
      const target = cmd;
      const requirement = parts.slice(1).join(" ");
      if (!requirement) {
        ctx.ui.notify(`Usage: /xfer ${target} <request>`, "error");
        return;
      }

      const targetEndpoint = endpointForName(target);
      if (!fs.existsSync(targetEndpoint)) {
        ctx.ui.notify(`❌ Peer "${target}" not found — use /xfer list`, "error");
        return;
      }

      pi.sendUserMessage(
        `## Handoff Request (one-way)\n\n` +
        `**Target**: ${target}\n` +
        `**From**: ${identity.name}\n` +
        `**Request**: ${requirement}\n\n` +
        `Based on chat context, write a markdown handoff doc ` +
        `and call \`xfer_to\` to send it to ${target}.\n\n` +
        `Handoff doc must include:\n` +
        `- Context summary\n` +
        `- Problem to solve\n` +
        `- Specific requirements\n` +
        `- Relevant files/code references\n` +
        `- **Suggested skills**: Skills from the agent's repertoire that would help complete the task.\n` +
        `- **Return address**: from=\`${identity.name}\`. Only reply back if you have new information to share.\n` +
        `- Notes\n\n` +
        `Note: xfer is one-way, no reply wait. Returns handoff_id upon delivery.`,
        { deliverAs: "followUp", triggerTurn: true },
      );
    },
  });

  // ── xfer_to tool (one-way, no wait) ──

  pi.registerTool({
    name: "xfer_to",
    label: "Transfer to Pi",
    description:
      "Send a handoff markdown document to another Pi agent (unidirectional, no reply waiting).\n\n" +
      "Steps:\n" +
      "1. Compose a comprehensive markdown handoff document\n" +
      "2. Call xfer_to with: target name, one-sentence summary, full document body\n" +
      "3. The tool saves the doc to /tmp/ and sends a socket notification to the target\n" +
      "4. Returns immediately with a handoff_id — no reply waiting\n\n" +
      "IMPORTANT: One-way handoff. Do NOT reply with acknowledgements or " +
      "unnecessary follow-ups. Only xfer back if you have meaningful new " +
      "information to share.\n\n" +
      "Example:\n" +
      "  User: /xfer proj-b investigate API timeout\n" +
      "  → LLM generates handoff doc → calls xfer_to(target='proj-b', ...)",

    parameters: Type.Object({
      target: Type.String({
        description: "Target agent name (use /xfer list to see available targets).",
      }),
      summary: Type.String({
        description: "One-sentence summary of what you need from the target.",
      }),
      handoff_document: Type.String({
        description:
          "Full markdown handoff document. Include: context, problem, " +
          "specific request for the target, relevant files/code, " +
          "suggested skills for the target agent, and notes.",
      }),
    }),

    async execute(_callId, params, _signal, onUpdate, ctx) {
      const { target, summary, handoff_document } = params as any;
      if (!identity) throw new Error("xfer not initialised");

      const mid = msgId();
      const tmpFile = path.join(os.tmpdir(), `pi-xfer-${mid}.md`);

      // 1. write handoff doc to tmp
      fs.writeFileSync(tmpFile, handoff_document, "utf-8");

      // 2. notify target
      if (onUpdate) {
        onUpdate({
          content: [{ type: "text", text: `📨 Sending to "${target}"...` }],
          details: {},
        });
      }

      try {
        await sendNotify(target, {
          type: "xfer-notify",
          msg_id: mid,
          from: identity.name,
          file: tmpFile,
          summary,
        });
      } catch (err: any) {
        try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
        throw new Error(`xfer: failed to notify "${target}" — ${err.message}`);
      }

      // 3. done, return immediately (no wait)
      return {
        content: [{
          type: "text",
          text: `✅ Sent to "${target}" (handoff_id: ${mid})\n\nDoc: ${tmpFile}\n\n` +
                `One-way handoff — reply via /xfer if needed.`,
        }],
        details: {
          target,
          handoff_id: mid,
          document: tmpFile,
          status: "sent",
        },
      };
    },
  });

  // ── Cleanup ──

  pi.on("session_shutdown", async () => {
    if (identity) {
      try { identity.server?.close(); } catch { /* ok */ }
      try { fs.unlinkSync(identity.endpoint); } catch { /* ok */ }
    }
  });
}
