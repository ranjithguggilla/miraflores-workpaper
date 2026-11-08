import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/client";
import { Money, Ref, Section, When } from "@/components/ui";
import { db, schema as s } from "@/db";
import { section, allEvents, liveEvents, adjustmentsFromEvents, openIssues, claims } from "@/lib/state";
import { carryForward } from "@/lib/actions";
import { Disclosure } from "@/components/client";
import { humanize } from "@/lib/labels";
import { eq } from "drizzle-orm";

export default async function CarryForward() {
  const [v3, plan, evs, issues, cm, prior] = await Promise.all([db.select().from(s.returnVersions).where(eq(s.returnVersions.version, "v3")), section("planning_reference_2026"), allEvents(), openIssues(), claims(), section("prior_years")]);
  const carry = v3[0].carryoversOut as any;
  const CARRY: Record<string, string> = { capital_loss_short: "Capital loss carryover · short-term", capital_loss_long: "Capital loss carryover · long-term", passive_1450_fremont: "Suspended passive loss · 1450 Fremont Way", passive_1200_barton_hills: "Suspended passive loss · 1200 Barton Hills", minimum_tax_credit_from_2025_amt: "Minimum tax credit from 2025 AMT (Form 8801)", charitable: "Charitable contribution carryover", section_179: "Section 179 carryover", ira_nondeductible_basis_ngozi: "IRA nondeductible basis · Ngozi", scorp_stock_basis_end: "S corporation stock basis · year end", ridgeline_capital_account_end: "Ridgeline capital account · year end", sep_contribution_not_deductible_for_2025: "SEP contribution not deductible for 2025" };
  const fedEntries = Object.entries(carry.federal) as [string, number][];
  const nonZero = fedEntries.filter(([, v]) => v);
  const zeros = fedEntries.filter(([, v]) => !v);
  const adjs = adjustmentsFromEvents(evs).filter((a) => a.status === "approved");
  const judgments = liveEvents(evs).filter((e) => e.kind === "adjust" && (e.payload as any).authority);
  const done = liveEvents(evs).filter((e) => e.targetRef === "carryforward");
  const openForNext = issues.filter((i) => /PRIOR_OPEN_ITEM|OUTSIDE_SCOPE|CA_AMT|FBAR|AMT_CREDIT|SEP/.test(i.code ?? ""));
  const items = [
    ...Object.entries(carry.federal).filter(([, v]) => v).map(([k, v]) => `Federal · ${CARRY[k] ?? humanize(k)}: ${Number(v).toLocaleString()}`),
    ...Object.entries(carry.california.depreciation_basis_differences ?? {}).map(([k, v]) => `California depreciation basis difference · ${k}: ${Number(v).toLocaleString()}`),
    `${adjs.length} decisions with authority (listed under "Decisions this year")`,
    `${openForNext.length} items still open (listed under "Still open at year end")`,
    ...(plan.known_2026_changes_for_this_household as string[]).map((x) => `2026: ${x}`),
  ];
  return (
    <Shell path="/carry-forward">
      <h1 className="mb-1">Carry forward to 2026 — and plan</h1>
      <p className="text-fg-3 text-sm mb-4">Everything next year's preparer needs, with its history: carryovers (engine), our decisions and their authority, still-open items, and what changes in 2026.</p>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Section title="Carryovers (engine v3)">
            <div className="card overflow-hidden"><table className="ledger text-sm"><tbody>{nonZero.map(([k, v]) => <tr key={k}><td>{CARRY[k] ?? humanize(k)}</td><td className="r"><Money v={v} /></td></tr>)}{Object.entries(carry.california.depreciation_basis_differences ?? {}).map(([k, v]) => <tr key={k}><td>California depreciation basis difference · <span className="mono">{k}</span></td><td className="r"><Money v={v as number} /></td></tr>)}</tbody></table></div>
            {zeros.length > 0 && <Disclosure summary={<span className="btn ghost sm mt-2">Show {zeros.length} carryovers that are zero</span>}><div className="card overflow-hidden mt-2"><table className="ledger text-sm"><tbody>{zeros.map(([k]) => <tr key={k}><td className="text-fg-3">{CARRY[k] ?? humanize(k)}</td><td className="r text-fg-4">0</td></tr>)}</tbody></table></div></Disclosure>}
            <p className="text-xs text-fg-3 mt-1">These move if adjustments change the underlying lines; the engine cannot be rerun here, so carryovers affected by approved adjustments are flagged on the line.</p>
          </Section>
          <Section title="Decisions this year, with authority">{judgments.length ? judgments.map((e) => <div key={e.id} className="text-sm py-1 border-b border-line"><Ref r={e.targetRef} /> {(e.payload as any).reason} <span className="text-fg-3 text-xs">· {(e.payload as any).authority} · {e.actorId} <When d={e.at} /></span></div>) : <p className="text-fg-3 text-sm">No adjustments with a recorded authority yet.</p>}</Section>
          <Section title="Still open at year end">{openForNext.map((i) => <div key={i.id} className="text-sm py-1 border-b border-line">{i.title}</div>)}</Section>
        </div>
        <div>
          <Section title="2026 plan">
            <div className="card p-3 text-sm"><div className="font-medium">Federal estimates</div><div className="text-xs text-fg-2">{plan.federal_safe_harbor} Due {plan.federal_estimate_due_dates.join(", ")}.</div><div className="font-medium mt-2">California</div><div className="text-xs text-fg-2">{plan.california_safe_harbor} Installments {plan.california_installment_percentages.map((p: number) => `${p * 100}%`).join(" / ")} on {plan.california_estimate_due_dates.join(", ")}.</div><ul className="list-disc pl-5 text-xs mt-2">{plan.known_2026_changes_for_this_household.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>
          </Section>
          <Section title="Hand off">
            <ActionForm action={carryForward}><input type="hidden" name="_return" value="/carry-forward" />
              <ul className="text-xs">{items.map((it, i) => <li key={i} className="py-0.5"><label className="flex gap-2"><input type="checkbox" name="item" value={it} defaultChecked /> <span>{it}</span></label></li>)}</ul>
              <button className="btn primary mt-2">Record carry-forward note</button>
            </ActionForm>
            {done.map((e) => <div key={e.id} className="text-xs text-ok mt-2">Carried forward by {e.actorId} <When d={e.at} /> ({((e.payload as any).items ?? []).length} items)</div>)}
          </Section>
        </div>
      </div>
    </Shell>
  );
}
