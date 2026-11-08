import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/client";
import { Money, Ref, Section, Tag, When } from "@/components/ui";
import { db, schema as s } from "@/db";
import { section, timeByArea, allEvents, liveEvents, openIssues } from "@/lib/state";
import { getActor, can } from "@/lib/session";
import { updateStandards } from "@/lib/actions";
import { AREAS, areaName } from "@/lib/areas";

function flatten(o: any, prefix = ""): Record<string, unknown> { return Object.entries(o).reduce((acc, [k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? Object.assign(acc, flatten(v, prefix + k + ".")) : Object.assign(acc, { [prefix + k]: Array.isArray(v) ? v.join(", ") : v })), {} as Record<string, unknown>); }

export default async function Firm() {
  const actor = await getActor();
  const [std, staff, firm, time, evs, engine, issues] = await Promise.all([db.select().from(s.standards), db.select().from(s.staff), section("firm"), timeByArea(), allEvents(), section("engine_reference"), openIssues()]);
  const data = std[0]?.data as any;
  const views = evs.filter((e) => e.kind === "view_sensitive");
  const byActor: Record<string, number> = {};
  for (const e of liveEvents(evs)) byActor[e.actorId] = (byActor[e.actorId] ?? 0) + 1;
  return (
    <Shell path="/firm">
      <h1 className="mb-4">Firm: standards, people, protection, budget</h1>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <Section title="Standards (data, not code)" aside={can(actor, "standards") ? <Tag kind="ok">you can edit</Tag> : <Tag>administrator edits</Tag>}>
            <div className="text-sm card p-3">
              <div>Variance review: flag if change over <strong>{data.variance_review.flag_if_change_over_percent}%</strong> and <strong>{data.variance_review.and_over_amount.toLocaleString()}</strong> vs {data.variance_review.compare_to}</div>
              <div>Partner sign-off above tax effect <strong>{(data.partner_threshold ?? 1000).toLocaleString()}</strong></div>
              <div className="mt-2 font-medium">Verification types</div><div className="flex gap-1 flex-wrap">{data.verification_types.map((t: string) => <Tag key={t}>{t.replace(/_/g, " ")}</Tag>)}</div>
              <div className="mt-2 font-medium">Rules</div><ul className="list-disc pl-5 text-xs">{data.rules.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
              <div className="mt-2 font-medium">Required steps</div><ol className="list-decimal pl-5 text-xs">{data.required_steps.map((r: string, i: number) => <li key={i}>{r}</li>)}</ol>
              {can(actor, "standards") && <ActionForm action={updateStandards} className="mt-3 grid grid-cols-2 gap-1 text-xs"><input type="hidden" name="_return" value="/firm" /><input name="flag_pct" placeholder="variance %" /><input name="flag_amt" placeholder="variance amount" /><input name="partner_threshold" placeholder="partner threshold" /><input name="new_verification_type" placeholder="new verification type" /><input name="new_rule" placeholder="new rule" className="col-span-2" /><button className="btn col-span-2">Update standards</button></ActionForm>}
              {std[0]?.updatedBy && <div className="text-fg-3 text-xs mt-1">last updated by {std[0].updatedBy} <When d={std[0].updatedAt} /></div>}
            </div>
          </Section>
          <Section title="People, roles, assignments">
            <div className="card overflow-hidden"><table className="ledger text-sm"><thead><tr><th>Name</th><th>Role</th><th>Clearance</th><th>Events</th><th>Open items</th></tr></thead><tbody>{staff.map((m) => <tr key={m.id}><td>{m.name}{m.credential ? ` ${m.credential}` : ""}<div className="text-fg-3 text-xs">{m.note}</div></td><td>{m.role.replace(/_/g, " ")}</td><td>{m.sensitiveClearance ? <Tag kind="ok">full</Tag> : <Tag kind="warn">masked</Tag>}</td><td className="num">{byActor[m.id] ?? 0}</td><td className="num">{issues.filter((i) => i.assignedTo === m.id).length}</td></tr>)}</tbody></table></div>
            <p className="text-fg-3 text-xs mt-1">Assignment at start: preparer {firm.assignment_at_start.preparer}, reviewer {firm.assignment_at_start.reviewer}, partner {firm.assignment_at_start.partner}. Paid preparer signing: {firm.firm_identity.paid_preparer_signing_returns}.</p>
          </Section>
        </div>
        <div>
          <Section title="Time against budget">
            <div className="card overflow-hidden"><table className="ledger text-sm"><thead><tr><th>Area</th><th className="text-right">Logged</th><th className="text-right">Budget</th><th></th></tr></thead><tbody>{AREAS.map((a) => { const b = firm.budget_hours[a.id]; const t = time[a.id] ?? 0; return <tr key={a.id}><td>{a.name}</td><td className="text-right num">{t.toFixed(2)}</td><td className="text-right num">{b ?? "—"}</td><td>{b && t > b ? <Tag kind="bad">over</Tag> : null}</td></tr>; })}<tr><td><strong>Total</strong></td><td className="text-right num"><strong>{Object.values(time).reduce((a, b) => a + b, 0).toFixed(2)}</strong></td><td className="text-right num"><strong>{Object.values(firm.budget_hours).reduce((a: number, b: any) => a + b, 0)}</strong></td><td></td></tr></tbody></table></div>
            <p className="text-fg-3 text-xs mt-1">Fee: fixed 4,800 (D01).</p>
          </Section>
          <Section title="Sensitive-data view log">
            {can(actor, "view_logs") ? (views.length ? <ul className="text-xs">{views.map((e) => <li key={e.id} className="py-1 border-b border-line">{staff.find((m) => m.id === e.actorId)?.name} ({e.actorRole}) unmasked <Ref r={e.targetRef} /> <When d={e.at} /></li>)}</ul> : <p className="text-fg-3 text-sm">No unmasked views yet.</p>) : <p className="text-fg-3 text-sm">Visible to administrator, partner and quality reviewer.</p>}
          </Section>
          <Section title="Engine parameters (given)">
            <div id="parameters" className="card overflow-hidden max-h-96 overflow-y-auto"><table className="ledger text-xs"><tbody>{Object.entries(flatten(engine.parameters)).map(([k, v]) => <tr key={k}><td className="text-fg-2">{k.split(".").map((p) => p.replace(/_/g, " ")).join(" › ")}</td><td className="r num">{typeof v === "number" ? v.toLocaleString() : String(v)}</td></tr>)}</tbody></table></div>
          </Section>
        </div>
      </div>
    </Shell>
  );
}
