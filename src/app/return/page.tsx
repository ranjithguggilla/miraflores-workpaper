import Link from "next/link";
import { Shell } from "@/components/shell";
import { Money, Section, Tag } from "@/components/ui";
import { claims, versionLines, section, adjustedSummary } from "@/lib/state";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";

const SUMMARY_KEYS = ["F1040.1z", "F1040.2b", "F1040.3b", "F1040.7", "F1040.8", "F1040.9", "F1040.10", "F1040.11", "F1040.12", "F1040.13", "F1040.15", "F1040.16", "F1040.17", "F1040.19", "F1040.20", "F1040.22", "F1040.23", "F1040.24", "F1040.25a", "F1040.26", "F1040.33", "F1040.37"];
const CA_KEYS = ["F540NR.13", "F540NR.17", "F540NR.19", "F540NR.31", "F540NR.32", "F540NR.35", "F540NR.40", "ScheduleS.credit", "F540NR.64", "F540NR.71", "F540NR.72", "F540NR.78", "F540NR.97"];

export default async function Return() {
  const [lines, cm, prior, sum, v3] = await Promise.all([versionLines(), claims(), section("prior_years"), adjustedSummary(), db.select().from(s.returnVersions).where(eq(s.returnVersions.version, "v3"))]);
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const py = prior.return_2024.lines as Record<string, number>;
  const pyLabel = prior.return_2024.line_labels as Record<string, string>;
  const row = (k: string) => { const l = byKey.get(k); const c = cm.get(k); if (!l) return null; const p = py[k]; const d = typeof c?.current === "number" && typeof p === "number" ? c.current - p : null; return <tr key={k}><td className="num"><Link href={`/lines/${encodeURIComponent(k)}`} className="link">{k}</Link></td><td>{l.label}</td><td className="text-right text-fg-3"><Money v={p} /></td><td className="text-right"><Money v={l.value} /></td><td className="text-right">{c?.origin !== "engine" ? <strong><Money v={c?.current} /></strong> : <span className="text-fg-3">=</span>}</td><td className="text-right">{d !== null && <span className={Math.abs(d) > 1000 ? "text-warn" : "text-fg-3"}><Money v={d} signed /></span>}</td></tr>; };
  const forms = [...new Set(lines.map((l) => l.form))];
  const carry = v3[0]?.carryoversOut as any;
  return (
    <Shell path="/return">
      <h1 className="mb-1">Return summary vs last year</h1>
      <p className="text-fg-3 text-sm mb-4">Engine v3 with approved adjustments applied. Tax effect of adjustments: fed <Money v={sum.deltas.fed} signed /> · CA <Money v={sum.deltas.ca} signed />. A fuller tax computation lives on each line.</p>
      <Section title="Federal (Form 1040)">
        <div className="card overflow-hidden"><table className="ledger"><thead><tr><th>Line</th><th>Label</th><th className="text-right">2024</th><th className="text-right">Engine</th><th className="text-right">Current</th><th className="text-right">Δ vs 2024</th></tr></thead><tbody>{SUMMARY_KEYS.map(row)}</tbody></table></div>
        <div className="flex gap-4 mt-2 text-sm"><div className="card px-3 py-2">Total tax <strong><Money v={sum.federal.total_tax} /></strong></div><div className="card px-3 py-2">Payments <strong><Money v={sum.federal.payments} /></strong></div><div className="card px-3 py-2">Balance due <strong><Money v={sum.federal.balance_due} /></strong></div><div className="card px-3 py-2">Penalty <Money v={sum.federal.penalty} /></div></div>
      </Section>
      <Section title="California (Form 540NR, part-year)">
        <div className="card overflow-hidden"><table className="ledger"><thead><tr><th>Line</th><th>Label</th><th className="text-right">2024 (540)</th><th className="text-right">Engine</th><th className="text-right">Current</th><th></th></tr></thead><tbody>{CA_KEYS.map(row)}</tbody></table></div>
        <div className="flex gap-4 mt-2 text-sm"><div className="card px-3 py-2">Total tax <strong><Money v={sum.california.total_tax} /></strong></div><div className="card px-3 py-2">Payments <strong><Money v={sum.california.payments} /></strong></div><div className="card px-3 py-2">Balance <strong><Money v={sum.california.balance_due} /></strong></div></div>
      </Section>
      <Section title="Carryovers out of 2025 (engine)">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="card overflow-hidden"><table className="ledger"><tbody>{Object.entries(carry?.federal ?? {}).map(([k, v]) => <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="text-right"><Money v={v as number} /></td></tr>)}</tbody></table></div>
          <div className="card overflow-hidden"><table className="ledger"><tbody>{Object.entries(carry?.california ?? {}).map(([k, v]) => <tr key={k}><td>CA {k.replace(/_/g, " ")}</td><td className="text-right num">{typeof v === "object" ? JSON.stringify(v) : <Money v={v as number} />}</td></tr>)}</tbody></table></div>
        </div>
      </Section>
      <Section title="Forms view">
        <div className="flex flex-wrap gap-2">{forms.map((f) => <Link key={f} href={`/search?q=${f}.`} className="tag">{f} ({lines.filter((l) => l.form === f).length})</Link>)}</div>
      </Section>
    </Shell>
  );
}
