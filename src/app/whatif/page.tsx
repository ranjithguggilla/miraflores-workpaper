import Link from "next/link";
import { ActionForm } from "@/components/client";
import { Shell } from "@/components/shell";
import { Money, Section, Tag } from "@/components/ui";
import { db, schema as s } from "@/db";
import { adjustedSummary, allEvents, liveEvents, section } from "@/lib/state";
import { createScenario, closeScenario, promoteScenario, adjustLine } from "@/lib/actions";

export default async function WhatIf({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const sp = await searchParams;
  const [scenarios, whatif, base] = await Promise.all([db.select().from(s.scenarios).orderBy(s.scenarios.id), section("what_if"), adjustedSummary()]);
  const sid = sp.s ? Number(sp.s) : scenarios.find((x) => !x.closed)?.id;
  const scen = scenarios.find((x) => x.id === sid);
  const scenSummary = sid ? await adjustedSummary(sid) : null;
  const scenEvents = sid ? liveEvents(await allEvents(sid)).filter((e) => e.kind === "whatif_adjust") : [];
  const path = `/whatif${sid ? `?s=${sid}` : ""}`;
  return (
    <Shell path="/whatif">
      <h1 className="mb-1">What-ifs</h1>
      <p className="text-fg-3 text-sm mb-4">Try changes on a scratch branch of the event log. Nothing touches the workpaper until you promote. Tax effects use the engine's per-dollar rates; the engine's own precomputed alternatives are below.</p>
      <div className="grid grid-cols-[1fr_1fr] gap-6">
        <div>
          <Section title="Scenarios" aside={<ActionForm action={createScenario} className="flex gap-1"><input name="name" placeholder="name" /><button className="btn">New scenario</button></ActionForm>}>
            {scenarios.map((x) => <div key={x.id} className={`card p-2 mb-1 text-sm flex justify-between ${x.id === sid ? "border-ink-2" : ""}`}><Link href={`/whatif?s=${x.id}`} className="link">{x.name}</Link><span className="text-fg-3 text-xs">{x.createdBy} {x.closed && <Tag>closed</Tag>}</span></div>)}
            {!scenarios.length && <p className="text-fg-3 text-sm">None yet.</p>}
          </Section>
          {scen && scenSummary && (
            <Section title={`Scenario: ${scen.name}`} aside={!scen.closed && <div className="flex gap-1"><ActionForm action={promoteScenario}><input type="hidden" name="id" value={scen.id} /><button className="btn primary">Promote to workpaper</button></ActionForm><ActionForm action={closeScenario}><input type="hidden" name="id" value={scen.id} /><button className="btn">Discard</button></ActionForm></div>}>
              <div className="flex gap-3 text-sm mb-3"><div className="card px-3 py-2">Federal due: <Money v={base.federal.balance_due} /> → <strong><Money v={scenSummary.federal.balance_due} /></strong></div><div className="card px-3 py-2">California: <Money v={base.california.balance_due} /> → <strong><Money v={scenSummary.california.balance_due} /></strong></div></div>
              <ul className="text-sm">{scenEvents.map((e) => { const p = e.payload as any; return <li key={e.id} className="py-1 border-b border-line"><Link href={`/lines/${encodeURIComponent(e.targetRef.slice(5))}?s=${scen.id}`} className="link num">{e.targetRef.slice(5)}</Link> <Money v={p.old} /> → <Money v={p.new} /> · fed <Money v={p.taxEffectFed} signed /> / CA <Money v={p.taxEffectCa} signed /> · {p.reason}</li>; })}</ul>
              {!scen.closed && <ActionForm action={adjustLine} className="flex gap-1 mt-3 text-xs flex-wrap"><input type="hidden" name="_return" value={path} /><input type="hidden" name="scenario" value={scen.id} /><input name="key" placeholder="line key e.g. Sch1.17" className="w-36" required /><input name="value" placeholder="new value" className="w-28" required /><input name="reason" placeholder="why" className="flex-1" required /><button className="btn">Try it</button></ActionForm>}
            </Section>
          )}
        </div>
        <div>
          <Section title="Engine-computed alternatives (what_if)">
            {(whatif.alternatives as any[]).map((a) => <div key={a.id} className="card p-3 mb-2 text-sm"><div className="font-medium">{a.description}</div><div className="num text-xs text-fg-2 mt-1">federal tax {a.federal.total_tax_change >= 0 ? "+" : ""}{a.federal.total_tax_change.toLocaleString()} · California {a.california.total_tax_change >= 0 ? "+" : ""}{a.california.total_tax_change.toLocaleString()} · {a.changed_lines.length} lines change</div><details className="mt-1"><summary className="text-xs text-fg-3">changed lines</summary><ul className="text-xs">{a.changed_lines.map((c: any) => <li key={c.key}><Link href={`/lines/${encodeURIComponent(c.key)}`} className="link num">{c.key}</Link>: {c.old ?? "—"} → {c.new}</li>)}</ul></details></div>)}
            <div className="card p-3 text-sm"><div className="font-medium">Extension (filed 2026-04-14 from v2)</div><div className="text-xs text-fg-2">Federal: estimated balance {whatif.extension.federal.estimated_balance.toLocaleString()}, paid with 4868 {whatif.extension.federal.paid_with_form_4868.toLocaleString()} ({whatif.extension.federal.rule}). California: {whatif.extension.california.estimated_balance.toLocaleString()}, paid {whatif.extension.california.paid_with_ftb_3519}.</div></div>
          </Section>
        </div>
      </div>
    </Shell>
  );
}
