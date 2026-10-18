import fs from "node:fs";
import path from "node:path";
import { isFrontier, repoRoot, workspaceId, type Store } from "./store.ts";

interface NodeData {
  id: string;
  title: string;
  status: string;
  type: string;
  frontier: boolean;
  parent?: string;
  dependencies: string[];
}

export const UNIT_PX = 7;
export const PAD_PX = 12;
export function unitBudget(): number {
  return Math.floor((W - PAD_PX * 2) / UNIT_PX);
}

export function charUnits(ch: string): number {
  return (ch.codePointAt(0) ?? 0) > 0x2e7f ? 2 : 1;
}

export function truncateTitle(title: string, budget: number): string {
  let w = 0;
  for (let i = 0; i < title.length; i++) {
    w += charUnits(title[i]);
    if (w > budget - 1) return title.slice(0, i) + "…";
  }
  return title;
}

const W = 190;
const H = 74;
const ROW = 118;

function depDepth(n: NodeData, byId: Map<string, NodeData>, members: Set<string>): number {
  let best = 0;
  for (const d of n.dependencies) {
    if (!members.has(d)) continue;
    const dep = byId.get(d);
    if (!dep) continue;
    best = Math.max(best, depDepth(dep, byId, members) + 1);
  }
  return best;
}

function layout(nodes: NodeData[], byId: Map<string, NodeData>): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const maps = nodes.filter((n) => n.type === "map");
  const COL = W + 60;
  maps.forEach((m, mi) => {
    const baseX = 40 + mi * 640;
    const members = nodes.filter((n) => n.parent === m.id).sort((a, b) => a.id.localeCompare(b.id));
    const memberIds = new Set(members.map((n) => n.id));
    pos.set(m.id, { x: baseX + COL, y: 90 });
    const buckets = new Map<number, NodeData[]>();
    for (const n of members) {
      const d = depDepth(n, byId, memberIds);
      if (!buckets.has(d)) buckets.set(d, []);
      buckets.get(d)!.push(n);
    }
    for (const [d, bucket] of buckets) {
      bucket.forEach((n, i) => {
        pos.set(n.id, { x: baseX + i * COL, y: 90 + ROW * (d + 1) });
      });
    }
  });
  return pos;
}

export function renderMapHtml(store: Store): string {
  const byId = new Map(store.tickets.map((t) => [t.id, t]));
  const budget = unitBudget();
  const nodes: NodeData[] = store.tickets.map((t) => ({
    id: t.id,
    title: t.title,
    titleShort: truncateTitle(t.title, budget),
    status: t.status,
    type: t.type,
    frontier: isFrontier(t, byId),
    parent: t.parent,
    dependencies: t.dependencies,
  }));
  const nById = new Map(nodes.map((n) => [n.id, n]));
  const pos = layout(nodes, nById);
  let mx = 0;
  let my = 0;
  for (const p of pos.values()) {
    mx = Math.max(mx, p.x + W);
    my = Math.max(my, p.y + H);
  }
  const nodesJson = JSON.stringify(nodes).replace(/</g, "\\u003c");
  const posJson = JSON.stringify(Object.fromEntries(pos)).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Wayfinder Map</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font: 13px/1.4 -apple-system, "PingFang SC", sans-serif; background: #11141a; color: #dde3ec; }
  #bar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; display: flex; gap: 12px; align-items: center;
         padding: 8px 14px; background: #181c26ee; backdrop-filter: blur(6px); border-bottom: 1px solid #2a3040; flex-wrap: wrap; }
  #bar b { font-size: 14px; }
  #bar label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
  #bar .legend span { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; }
  svg { display: block; }
  .node rect { rx: 10; fill: #1d2330; stroke: #3a4358; stroke-width: 1.5; cursor: pointer; transition: stroke .15s, filter .15s; }
  .node.map > rect { fill: #232a3d; }
  .node.frontier > rect { stroke: #ffb454; stroke-width: 2.5; filter: drop-shadow(0 0 6px #ffb45488); }
  .node.dim { opacity: .18; }
  .node.lit > rect { stroke: #6fc3ff; stroke-width: 2.5; }
  .node text { fill: #dde3ec; pointer-events: none; }
  .node .id { font-weight: 700; fill: #8ab4ff; }
  .node .meta { fill: #93a0b8; font-size: 11px; }
  .node .title { fill: #e8edf5; }
  text.meta.st-pending { fill:#8ab4ff !important } text.meta.st-in-progress { fill:#ffb454 !important }
  text.meta.st-waiting-human { fill:#c792ea !important } text.meta.st-completed { fill:#6bd68a !important }
  text.meta.st-cancelled { fill:#7c8698 !important } text.meta.st-blocked { fill:#ff7a7a !important }
  .edge { stroke: #3a4358; stroke-width: 1.4; fill: none; }
  .edge.dep { stroke-dasharray: 6 4; stroke: #4d6a8a; }
  .edge.lit { stroke: #6fc3ff; stroke-width: 2.2; }
  .edge.dim { opacity: .12; }
</style>
</head>
<body>
<div id="bar">
  <b>Wayfinder Map</b>
  <span>Frontier:
    <span class="legend"><span style="background:#ffb454"></span>highlighted</span>
  </span>
  <span>Status:</span><span id="stFilters"></span>
  <span>Type:</span><span id="tyFilters"></span>
  <span id="hint" style="color:#93a0b8">click node = trace chain · click map = collapse subtree</span>
</div>
<svg id="canvas" width="${mx + 40}" height="${my + 40}" style="margin-top:44px"></svg>
<script>
const NODES = ${nodesJson};
const POS = ${posJson};
const W = ${W}, H = ${H};
const svg = document.getElementById("canvas");
const NS = "http://www.w3.org/2000/svg";
const byId = Object.fromEntries(NODES.map(n => [n.id, n]));
const collapsed = new Set();
let lit = null;

function chain(id) {
  const up = new Set(), down = new Set();
  const walk = (n, set, dir, depthGuard) => {
    if (depthGuard > 50) return;
    if (dir === "up") {
      if (n.parent && !set.has(n.parent)) { set.add(n.parent); walk(byId[n.parent], set, "up", depthGuard+1); }
      for (const d of n.dependencies) if (!set.has(d)) { set.add(d); walk(byId[d], set, "up", depthGuard+1); }
    } else {
      for (const m of NODES) {
        if (m.parent === n.id && !set.has(m.id)) { set.add(m.id); walk(m, set, "down", depthGuard+1); }
        if (m.dependencies.includes(n.id) && !set.has(m.id)) { set.add(m.id); walk(m, set, "down", depthGuard+1); }
      }
    }
  };
  walk(byId[id], up, "up", 0); walk(byId[id], down, "down", 0);
  return { up, down };
}

function visibleInCollapsed(n) {
  let cur = n;
  while (cur.parent) {
    if (collapsed.has(cur.parent)) return false;
    cur = byId[cur.parent];
    if (!cur) break;
  }
  return true;
}

function applyFilters() {
  return {
    status: [...document.querySelectorAll("#stFilters input:checked")].map(i => i.value),
    type: [...document.querySelectorAll("#tyFilters input:checked")].map(i => i.value),
  };
}

function render() {
  svg.innerHTML = "";
  const f = applyFilters();
  const show = n => f.status.includes(n.status) && f.type.includes(n.type);
  const chains = lit ? chain(lit) : null;
  const inChain = new Set(lit ? [lit, ...chains.up, ...chains.down] : []);

  function edge(fromId, toId, isDep) {
    const to = POS[toId], from = POS[fromId];
    if (!to || !from) return;
    const p = document.createElementNS(NS, "path");
    const x1 = to.x + W/2, y1 = to.y + H, x2 = from.x + W/2, y2 = from.y;
    p.setAttribute("d", \`M \${x1} \${y1} C \${x1} \${y1+40}, \${x2} \${y2-40}, \${x2} \${y2}\`);
    p.setAttribute("class", "edge" + (isDep ? " dep" : ""));
    if (lit) {
      const inSet = (id) => id === lit || chains.up.has(id) || chains.down.has(id);
      p.classList.add(inSet(toId) && inSet(fromId) ? "lit" : "dim");
    }
    svg.appendChild(p);
  }

  for (const n of NODES) {
    if (!POS[n.id] || !visibleInCollapsed(n)) continue;
    if (n.parent && POS[n.parent]) edge(n.parent, n.id, false);
    for (const d of n.dependencies) {
      if (POS[d]) edge(d, n.id, true);
    }
  }

  for (const n of NODES) {
    if (!POS[n.id] || !visibleInCollapsed(n)) continue;
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "node" + (n.type === "map" ? " map" : "") + (n.frontier ? " frontier" : ""));
    g.setAttribute("transform", \`translate(\${POS[n.id].x},\${POS[n.id].y})\`);
    if (lit && !inChain.has(n.id)) g.classList.add("dim");
    if (lit && inChain.has(n.id) && n.id !== lit) g.classList.add("lit");
    if (!show(n) && !(lit && inChain.has(n.id))) g.classList.add("dim");
    const rect = document.createElementNS(NS, "rect");
    rect.setAttribute("width", W); rect.setAttribute("height", H);
    g.appendChild(rect);
    const title = n.titleShort;
    const full = document.createElementNS(NS, "title");
    full.textContent = n.title;
    g.appendChild(full);
    const mk = (x, y, cls, txt, anchor) => {
      const t = document.createElementNS(NS, "text");
      t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("class", cls);
      if (anchor) t.setAttribute("text-anchor", anchor);
      t.textContent = txt; g.appendChild(t);
    };
    mk(12, 24, "id", n.id);
    mk(W - 12, 24, "meta st-" + n.status, n.type + " · " + n.status, "end");
    const tt = document.createElementNS(NS, "text");
    tt.setAttribute("x", 12); tt.setAttribute("y", 46); tt.setAttribute("class", "title");
    tt.textContent = title; g.appendChild(tt);
    if (n.frontier) mk(12, 64, "meta", "◆ frontier", "start");
    g.addEventListener("click", () => {
      if (n.type === "map") {
        collapsed.has(n.id) ? collapsed.delete(n.id) : collapsed.add(n.id);
        render();
      } else {
        lit = lit === n.id ? null : n.id;
        render();
      }
    });
    svg.appendChild(g);
  }
}

const STATUSES = ["pending","in-progress","waiting-human","completed","cancelled","blocked"];
const TYPES = ["map","research","prototype","grilling","setup"];
function mkFilters(el, values) {
  for (const v of values) {
    const l = document.createElement("label");
    const i = document.createElement("input");
    i.type = "checkbox"; i.value = v; i.checked = true; i.onchange = render;
    l.appendChild(i); l.appendChild(document.createTextNode(v));
    el.appendChild(l);
  }
}
mkFilters(document.getElementById("stFilters"), STATUSES);
mkFilters(document.getElementById("tyFilters"), TYPES);
render();
</script>
</body>
</html>
`;
}

export function defaultMapOut(): string {
  return path.join(process.env.TMPDIR ?? "/tmp", `wayfinder-${storeTag()}.html`);
}

function storeTag(): string {
  return workspaceId(repoRoot()).replace(/[^a-zA-Z0-9]/g, "");
}

export function writeMap(store: Store, out: string): string {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderMapHtml(store));
  return out;
}
