import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { versionLines, claims } from "./state";
import { docTypeLabel } from "./labels";
import { maskText } from "./mask";

export type TraceNode = { id: string; kind: "doc" | "value" | "line" | "client" | "engine"; label: string; sub?: string; value?: unknown; href?: string; focus?: boolean; adjusted?: boolean };
export type TraceEdge = { id: string; source: string; target: string };
export type TraceGraph = { nodes: TraceNode[]; edges: TraceEdge[]; truncated: boolean };

/** Build the trace graph around one line: sources beneath it (down to the page field) and every line it feeds (up to the final lines). */
export async function traceGraph(key: string, opts = { down: 4, up: 10, maxNodes: 70 }): Promise<TraceGraph> {
  const [lines, cm] = await Promise.all([versionLines(), claims()]);
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const usedBy = new Map<string, string[]>();
  for (const l of lines) for (const i of l.inputs) usedBy.set(i, [...(usedBy.get(i) ?? []), l.key]);

  const nodes = new Map<string, TraceNode>();
  const edges = new Map<string, TraceEdge>();
  let truncated = false;
  const addEdge = (a: string, b: string) => edges.set(`${a}→${b}`, { id: `${a}→${b}`, source: a, target: b });
  const addLine = (k: string) => {
    if (nodes.has(`line:${k}`)) return;
    const l = byKey.get(k); if (!l) return;
    const c = cm.get(k);
    nodes.set(`line:${k}`, { id: `line:${k}`, kind: "line", label: k, sub: l.label.length > 60 ? l.label.slice(0, 57) + "…" : l.label, value: c?.current ?? l.value, href: `/lines/${encodeURIComponent(k)}`, focus: k === key, adjusted: c?.origin !== "engine" });
  };

  // down
  const evIds = new Set<string>();
  const qaIds = new Set<string>();
  const walkDown = (k: string, depth: number) => {
    const l = byKey.get(k); if (!l) return;
    addLine(k);
    for (const src of l.sources) {
      if (src.startsWith("ev-")) { evIds.add(src); addEdge(`ev:${src}`, `line:${k}`); }
      else if (src.startsWith("qa-")) { qaIds.add(src); addEdge(`qa:${src}`, `line:${k}`); }
      else if (src.startsWith("ref:") || src.startsWith("py:")) { const id = `ref:${src}`; nodes.set(id, { id, kind: "engine", label: src.startsWith("py:") ? "2024 return" : "Engine parameter", sub: src.replace(/^ref:|^py:\//, "").replace(/_/g, " ").slice(0, 50), href: src.startsWith("py:") ? "/prior-year" : "/firm#parameters" }); addEdge(id, `line:${k}`); }
    }
    if (depth === 0) { if (l.inputs.length) truncated = true; return; }
    for (const i of l.inputs) { if (nodes.size > opts.maxNodes) { truncated = true; return; } addLine(i); addEdge(`line:${i}`, `line:${k}`); walkDown(i, depth - 1); }
  };
  walkDown(key, opts.down);

  // up
  const walkUp = (k: string, depth: number) => {
    if (depth === 0) return;
    for (const parent of usedBy.get(k) ?? []) { if (nodes.size > opts.maxNodes) { truncated = true; return; } addLine(parent); addEdge(`line:${k}`, `line:${parent}`); walkUp(parent, depth - 1); }
  };
  walkUp(key, opts.up);

  // values and their pages
  if (evIds.size) {
    const evs = await db.select().from(s.extractedValues).where(inArray(s.extractedValues.id, [...evIds]));
    const docIds = [...new Set(evs.map((e) => e.docId))];
    const docs = await db.select().from(s.documents).where(inArray(s.documents.id, docIds));
    const dmap = new Map(docs.map((d) => [d.id, d]));
    for (const e of evs) {
      nodes.set(`ev:${e.id}`, { id: `ev:${e.id}`, kind: "value", label: e.label, sub: `read as “${maskText(e.textAsRead ?? "")}” · confidence ${e.confidence}`, value: ["ssn", "account_number"].includes(e.valueType) ? maskText(String(e.value)) : e.value, href: `/documents/${e.docId}#p${e.page}` });
      const pid = `doc:${e.docId}#p${e.page}`; const d = dmap.get(e.docId)!;
      if (!nodes.has(pid)) nodes.set(pid, { id: pid, kind: "doc", label: `${d.id} · page ${e.page}`, sub: `${d.title} — ${docTypeLabel(d.documentType)}`, href: `/documents/${d.id}#p${e.page}` });
      addEdge(pid, `ev:${e.id}`);
    }
  }
  for (const q of qaIds) nodes.set(`qa:${q}`, { id: `qa:${q}`, kind: "client", label: `Client questionnaire ${q.slice(3)}`, sub: "answer used as a source", href: `/client#${q}` });

  return { nodes: [...nodes.values()], edges: [...edges.values()], truncated };
}
