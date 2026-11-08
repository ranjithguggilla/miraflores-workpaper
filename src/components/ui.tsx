import Link from "next/link";
import type { ReactNode } from "react";
import { AlertOctagon, AlertTriangle, Info, CheckCircle2, CircleDashed, Hourglass, Cpu, FileText, User, MessageSquare, History, Sliders, GitBranch, Hash } from "lucide-react";
import { refHref, refLabel } from "@/lib/refs";
import { initials, roleLabel, verificationLabel } from "@/lib/labels";
import type { Described } from "@/lib/describe";

export function Money({ v, signed = false, className = "" }: { v: unknown; signed?: boolean; className?: string }) {
  if (typeof v !== "number") return <span className={`num ${className}`}>{v == null || v === "" ? "—" : String(v)}</span>;
  const abs = Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: Number.isInteger(v) ? 0 : 2 });
  const neg = v < 0;
  return <span className={`num ${neg ? "text-bad" : ""} ${className}`}>{neg ? `(${abs})` : signed && v > 0 ? `+${abs}` : abs}</span>;
}

export function Badge({ tone = "", icon, children, className = "" }: { tone?: "ok" | "adj" | "prop" | "bad" | "info" | "engine" | "outline" | ""; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <span className={`badge ${tone} ${className}`}>{icon}{children}</span>;
}

export function Sev({ s }: { s: string }) {
  if (s === "blocker") return <Badge tone="bad" icon={<AlertOctagon />}>Blocker</Badge>;
  if (s === "warning") return <Badge tone="adj" icon={<AlertTriangle />}>Warning</Badge>;
  return <Badge tone="info" icon={<Info />}>Info</Badge>;
}

export function StatusBadge({ origin, verified }: { origin: "engine" | "adjusted" | "proposed"; verified: string[] }) {
  return (
    <span className="inline-flex gap-1 flex-wrap">
      {origin === "adjusted" && <Badge tone="adj" icon={<Sliders />}>Adjusted</Badge>}
      {origin === "proposed" && <Badge tone="prop" icon={<Hourglass />}>Awaiting partner</Badge>}
      {verified.length ? <Badge tone="ok" icon={<CheckCircle2 />}>{verified.map(verificationLabel).join(", ")}</Badge> : <Badge tone="outline" icon={<CircleDashed />}>Unverified</Badge>}
    </span>
  );
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return <span title={name} className="inline-flex items-center justify-center rounded-full font-medium shrink-0" style={{ width: size, height: size, fontSize: size * 0.42, background: `oklch(0.9 0.05 ${hue})`, color: `oklch(0.35 0.08 ${hue})` }}>{initials(name)}</span>;
}

export function Person({ name, role, size = 22 }: { name: string; role?: string; size?: number }) {
  return <span className="inline-flex items-center gap-1.5"><Avatar name={name} size={size} /><span>{name}</span>{role && <span className="text-fg-3 text-xs">· {roleLabel(role)}</span>}</span>;
}

const refIcon: Record<string, ReactNode> = { doc: <FileText />, value: <Hash />, line: <GitBranch />, client: <MessageSquare />, prior: <History />, person: <User />, param: <Cpu />, whatif: <Sliders /> };
export const ENTITY_TONE: Record<string, string> = { doc: "ent-doc", value: "ent-value", line: "ent-line", client: "ent-client", prior: "ent-line", person: "ent-person", param: "ent-engine", engine: "ent-engine", whatif: "ent-engine", area: "ent-line", issue: "", event: "ent-engine" };

/** Human-described reference chip. */
export function RefChip({ d }: { d: Described }) {
  const inner = <span className={`badge ${ENTITY_TONE[d.kind] ?? "outline"}`} title={d.sub ?? d.label}>{refIcon[d.kind] ?? <Hash />}<span className="truncate max-w-[32ch]">{d.label}</span>{d.sub && <span className="opacity-70 truncate max-w-[28ch]">· {d.sub}</span>}</span>;
  return d.href ? <Link href={d.href} className="hover:opacity-80">{inner}</Link> : inner;
}

/** Fallback when refs weren't pre-described. */
export function Ref({ r }: { r: string }) {
  const href = refHref(r);
  return href ? <Link href={href} className="link mono">{refLabel(r)}</Link> : <span className="mono text-fg-3">{refLabel(r)}</span>;
}

export function When({ d }: { d: Date | string | null | undefined }) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  return <time className="text-fg-3 text-xs" dateTime={dt.toISOString()}>{dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} {dt.toISOString().slice(11, 16)}</time>;
}

export function Section({ title, children, aside, id }: { title: ReactNode; children: ReactNode; aside?: ReactNode; id?: string }) {
  return <section id={id} className="mb-8"><div className="flex items-center justify-between mb-3 gap-4"><h2>{title}</h2>{aside && <div className="text-xs text-fg-3 flex items-center gap-2">{aside}</div>}</div>{children}</section>;
}

export function PageHeader({ crumbs, title, meta, actions, stats }: { crumbs?: { href?: string; label: string }[]; title: ReactNode; meta?: ReactNode; actions?: ReactNode; stats?: { label: string; value: ReactNode; tone?: string }[] }) {
  return (
    <header className="mb-6">
      {crumbs && <nav className="text-xs text-fg-3 mb-2 flex gap-1.5">{crumbs.map((c, i) => <span key={i} className="flex gap-1.5">{i > 0 && <span>/</span>}{c.href ? <Link href={c.href} className="hover:text-fg">{c.label}</Link> : <span>{c.label}</span>}</span>)}</nav>}
      <div className="flex items-start justify-between gap-6">
        <div><h1>{title}</h1>{meta && <p className="text-fg-3 text-sm mt-1">{meta}</p>}</div>
        {actions && <div className="flex gap-2 items-center shrink-0">{actions}</div>}
      </div>
      {stats && <div className="grid gap-3 mt-5" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 6)}, minmax(0,1fr))` }}>{stats.map((s, i) => <div key={i} className="tile"><div className="text-fg-3 text-xs">{s.label}</div><div className={`text-lg mt-0.5 font-medium ${s.tone ?? ""}`}>{s.value}</div></div>)}</div>}
    </header>
  );
}

export function Empty({ icon, title, hint }: { icon?: ReactNode; title: string; hint?: string }) {
  return <div className="panel py-8 text-center"><div className="mx-auto mb-2 w-9 h-9 rounded-full bg-s3 flex items-center justify-center text-fg-3 [&>svg]:w-4 [&>svg]:h-4">{icon ?? <CheckCircle2 />}</div><div className="text-sm font-medium">{title}</div>{hint && <div className="text-xs text-fg-3 mt-1">{hint}</div>}</div>;
}

export function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton ${className}`} />; }

/** Compatibility: older pages used <Tag kind="ok|warn|bad|engine">. */
export function Tag({ kind, children }: { kind?: "ok" | "warn" | "bad" | "engine" | ""; children: ReactNode }) {
  const tone = kind === "warn" ? "adj" : kind === "ok" ? "ok" : kind === "bad" ? "bad" : kind === "engine" ? "engine" : "";
  return <Badge tone={tone as any}>{children}</Badge>;
}
