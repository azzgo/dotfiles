/**
 * Xfer — 跨项目单向对话交接扩展
 *
 * 将当前对话通过 /handoff prompt 风格生成 markdown 交接文档，
 * 通过 Unix socket 单向发送给另一台 Pi 实例。
 *
 * ⚡ 纯单向发送，不等待回复。调用方想回传时，再调 /xfer 发一次即可。
 *
 * 安装:
 *   just install-pi    # 自动 symlink 到 ~/.pi/agent/extensions/
 *
 * 用法:
 *   /xfer                     — 帮助
 *   /xfer list                — 列出可用 peer（Tab 补全）
 *   /xfer rename <name>       — 重命名当前 agent
 *   /xfer <target> <要求>     — 发起交接（LLM 生成文档 + 调用 xfer_to）
 *
 * LLM 工具:
 *   xfer_to(target, summary, handoff_document)
 *       → 写 /tmp/pi-xfer-<id>.md
 *       → socket 通知目标 {file, summary}
 *       → 立即返回 handoff_id（不等待）
 *
 * 回传同样用 /xfer：
 *   当你想回复对方时，再调 /xfer <原发送方> <回复内容> 即可。
 *   每个 xfer 都是独立的单向消息。
 *
 * 协议:
 *   Unix socket @ ~/pi-handoff/agents/<name>.sock
 *   消息: xfer-notify (JSON lines, 单向)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import * as net from "node:net";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── 常量 ──

const XFER_DIR = path.join(os.homedir(), "pi-handoff", "agents");
const CONNECT_TIMEOUT_MS = 5_000;

// ── 工具函数 ──

function msgId(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
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
  return path.basename(process.cwd()) || `pi-${process.pid}`;
}

function listPeers(myName: string): string[] {
  try {
    fs.mkdirSync(XFER_DIR, { recursive: true });
    return fs.readdirSync(XFER_DIR)
      .filter(f => f.endsWith(".sock"))
      .map(f => f.replace(/\.sock$/, ""))
      .filter(n => n !== myName)
      .sort();
  } catch { return []; }
}

/** 连接目标 socket，发消息，等 ack，断开 */
function sendNotify(target: string, msg: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const endpoint = path.join(XFER_DIR, `${target}.sock`);
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

// ── 扩展 ──

export default function (pi: ExtensionAPI) {
  pi.registerFlag("xfer-name", {
    description: "Override xfer agent name (default: current directory name)",
    type: "string",
    default: undefined,
  });

  // ── 状态 ──

  let identity: {
    name: string;
    cwd: string;
    endpoint: string;
    server: net.Server | null;
  } | null = null;

  // ── Socket Server（接收外来 xfer）──

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

        // 只处理 xfer-notify（单向交接通知）
        if (msg.type === "xfer-notify") {
          // 注入 followUp，让当前 LLM 读到交接文档和处理要求
          pi.sendMessage({
            customType: "xfer-inbound",
            content:
              `📨 [Xfer from **${msg.from}**]\n\n` +
              `**要求**: ${msg.summary}\n\n` +
              `**交接文档**: \`${msg.file}\`\n\n` +
              `请先读取交接文档，然后按要求处理。`,
            display: true,
          }, { deliverAs: "followUp", triggerTurn: true });

          socket.write(JSON.stringify({ type: "ack", msg_id: msg.msg_id }) + "\n");
        }
      });
    });
  }

  // ── 启动：注册 socket ──

  pi.on("session_start", async (_event, ctx) => {
    const name = deriveName(pi);
    fs.mkdirSync(XFER_DIR, { recursive: true });
    const endpoint = path.join(XFER_DIR, `${name}.sock`);
    try { fs.unlinkSync(endpoint); } catch { /* ok */ }

    identity = { name, cwd: ctx.cwd || process.cwd(), endpoint, server: null };

    const server = createServer();
    identity.server = server;
    server.listen(endpoint, () => {
      ctx.ui.setStatus("xfer", `📡 ${name}`);
    });
  });

  // ── /xfer 命令 ──

  pi.registerCommand("xfer", {
    description:
      "Xfer: 单向发送 handoff 给另一个 Pi。\n" +
      "  /xfer <target> <要求>  — 生成文档并发给目标\n" +
      "  /xfer list              — 查看可用 peer\n" +
      "  /xfer rename <name>     — 重命名当前 agent",

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

      // ── 帮助 ──
      if (!cmd || cmd === "help") {
        ctx.ui.notify(
          "📡 /xfer <target> <要求> — 生成 handoff 文档并发给目标\n" +
          "   /xfer list           — 查看可用 peer\n" +
          "   /xfer rename <name>  — 重命名当前 agent\n" +
          "\n" +
          "💡 单向发送，不等待回复。回传请再调一次 /xfer。",
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
        identity.endpoint = path.join(XFER_DIR, `${newName}.sock`);
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
        ctx.ui.notify(`Usage: /xfer ${target} <一句话要求>`, "error");
        return;
      }

      const targetEndpoint = path.join(XFER_DIR, `${target}.sock`);
      if (!fs.existsSync(targetEndpoint)) {
        ctx.ui.notify(`❌ Peer "${target}" not found — use /xfer list`, "error");
        return;
      }

      pi.sendUserMessage(
        `## 任务交接请求（单向）\n\n` +
        `**目标 Agent**: ${target}\n` +
        `**一句话要求**: ${requirement}\n\n` +
        `请根据当前对话上下文，生成一份 handoff markdown 文档，` +
        `然后调用 \`xfer_to\` tool 发送给 ${target}。\n\n` +
        `handoff 文档应包含：\n` +
        `- 背景/上下文摘要\n` +
        `- 要解决的问题\n` +
        `- 对目标的具体要求\n` +
        `- 相关的文件/代码引用\n` +
        `- 备注或注意事项\n\n` +
        `注意：xfer 是单向发送，不等待回复。发给目标后会立即返回一个 handoff_id 供参考。`,
        { deliverAs: "followUp", triggerTurn: true },
      );
    },
  });

  // ── xfer_to tool（单向发送，不等待回复）──

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
      "To send a response back, the other Pi will use /xfer to send a new handoff.\n\n" +
      "Example:\n" +
      "  User: /xfer proj-b 帮我查接口超时原因\n" +
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
          "specific request for the target, relevant files/code, and notes.",
      }),
    }),

    async execute(_callId, params, _signal, onUpdate, ctx) {
      const { target, summary, handoff_document } = params as any;
      if (!identity) throw new Error("xfer not initialised");

      const mid = msgId();
      const tmpFile = path.join(os.tmpdir(), `pi-xfer-${mid}.md`);

      // 1. 写交接文档到临时文件
      fs.writeFileSync(tmpFile, handoff_document, "utf-8");

      // 2. 发送通知给目标
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

      // 3. 单向发送完成，立即返回（不等待回复）
      return {
        content: [{
          type: "text",
          text: `✅ Sent to "${target}" (handoff_id: ${mid})\n\n交接文档: ${tmpFile}\n\n` +
                `这是一个单向交接，不等待回复。` +
                `对方如需回传，会通过 /xfer 再发一条新消息。`,
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

  // ── 关闭清理 ──

  pi.on("session_shutdown", async () => {
    if (identity) {
      try { identity.server?.close(); } catch { /* ok */ }
      try { fs.unlinkSync(identity.endpoint); } catch { /* ok */ }
    }
  });
}
