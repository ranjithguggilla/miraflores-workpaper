"use client";
import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ReactFlow, Background, Controls, Handle, Position, type Node, type Edge, type NodeProps, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { FileText, Hash, GitBranch, MessageSquare, Cpu } from "lucide-react";
import type { TraceGraph as TG, TraceNode } from "@/lib/trace";

const W = 230, H = 64;
const KIND = {
  doc: { color: "var(--ent-doc)", soft: "var(--ent-doc-soft)", icon: FileText, name: "Source page" },
  value: { color: "var(--ent-value)", soft: "var(--ent-value-soft)", icon: Hash, name: "Extracted value" },
  line: { color: "var(--ent-line)", soft: "var(--ent-line-soft)", icon: GitBranch, name: "Return line" },
  client: { color: "var(--ent-client)", soft: "var(--ent-client-soft)", icon: MessageSquare, name: "Client answer" },
  engine: { color: "var(--ent-engine)", soft: "var(--ent-engine-soft)", icon: Cpu, name: "Engine / prior year" },
} as const;

const fmt = (v: unknown) => typeof v === "number" ? (v < 0 ? `(${Math.abs(v).toLocaleString()})` : v.toLocaleString()) : v == null ? "" : String(v).slice(0, 18);

function TraceNodeView({ data }: NodeProps<Node<TraceNode & { dim: boolean }>>) {
  const k = KIND[data.kind]; const Icon = k.icon;
  return (
    <div className={`rounded-md border bg-s1 shadow-sm transition-opacity ${data.dim ? "opacity-25" : ""}`} style={{ width: W, height: H, borderColor: data.focus ? k.color : "var(--line)", boxShadow: data.focus ? `0 0 0 3px ${k.soft}` : undefined }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} /><Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <div className="flex h-full">
        <div className="w-1 rounded-l-md shrink-0" style={{ background: k.color }} />
        <div className="px-2.5 py-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: k.color }}><Icon className="w-3 h-3" /><span className="truncate">{data.kind === "line" ? data.label : k.name}</span>{data.adjusted && <span className="ml-auto badge adj" style={{ height: 16, fontSize: 10, padding: "0 5px" }}>adjusted</span>}</div>
          <div className="text-[12px] truncate text-fg">{data.kind === "line" ? data.sub : data.label}</div>
          <div className="flex justify-between gap-2 text-[11px] text-fg-3"><span className="truncate">{data.kind === "line" ? "" : data.sub}</span>{data.value !== undefined && <span className="num shrink-0 text-fg">{fmt(data.value)}</span>}</div>
        </div>
      </div>
    </div>
  );
}
const nodeTypes = { trace: TraceNodeView };

export function TraceGraphView({ graph, height = 460 }: { graph: TG; height?: number }) {
  const router = useRouter();
  const [hover, setHover] = useState<string | null>(null);
  const { nodes, edges, adj } = useMemo(() => {
    const g = new dagre.graphlib.Graph(); g.setDefaultEdgeLabel(() => ({})); g.setGraph({ rankdir: "LR", nodesep: 14, ranksep: 70, marginx: 10, marginy: 10 });
    graph.nodes.forEach((n) => g.setNode(n.id, { width: W, height: H })); graph.edges.forEach((e) => g.setEdge(e.source, e.target)); dagre.layout(g);
    const up = new Map<string, string[]>(), down = new Map<string, string[]>();
    for (const e of graph.edges) { up.set(e.target, [...(up.get(e.target) ?? []), e.source]); down.set(e.source, [...(down.get(e.source) ?? []), e.target]); }
    const nodes: Node[] = graph.nodes.map((n) => { const p = g.node(n.id); return { id: n.id, type: "trace", position: { x: p.x - W / 2, y: p.y - H / 2 }, data: { ...n, dim: false } }; });
    const edges: Edge[] = graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, animated: true, markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 }, style: { stroke: "var(--line-strong)" } }));
    return { nodes, edges, adj: { up, down } };
  }, [graph]);
  const connected = useMemo(() => {
    if (!hover) return null;
    const set = new Set<string>([hover]);
    const walk = (id: string, m: Map<string, string[]>) => { for (const n of m.get(id) ?? []) if (!set.has(n)) { set.add(n); walk(n, m); } };
    walk(hover, adj.up); walk(hover, adj.down); return set;
  }, [hover, adj]);
  const shownNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, dim: connected ? !connected.has(n.id) : false } })), [nodes, connected]);
  const shownEdges = useMemo(() => edges.map((e) => ({ ...e, className: connected && !(connected.has(e.source) && connected.has(e.target)) ? "dim" : "", style: { stroke: connected && connected.has(e.source) && connected.has(e.target) ? "var(--accent)" : "var(--line-strong)" } })), [edges, connected]);
  const onClick = useCallback((_: unknown, n: Node) => { const href = (n.data as TraceNode).href; if (href) router.push(href); }, [router]);
  return (
    <div className="card overflow-hidden" style={{ height }}>
      <ReactFlow nodes={shownNodes} edges={shownEdges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.15, maxZoom: 1 }} minZoom={0.2} maxZoom={1.6} onNodeMouseEnter={(_, n) => setHover(n.id)} onNodeMouseLeave={() => setHover(null)} onNodeClick={onClick} nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
        <Background gap={18} size={1} color="var(--line)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}

export function TraceLegend() {
  return <div className="flex gap-3 flex-wrap text-xs text-fg-3">{Object.entries(KIND).map(([k, v]) => <span key={k} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: v.color }} />{v.name}</span>)}<span className="ml-auto">Hover a node to light its path · click to open</span></div>;
}
