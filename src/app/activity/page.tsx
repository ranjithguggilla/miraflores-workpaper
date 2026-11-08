import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/client";
import { Ref, RefChip, Section, Tag, When } from "@/components/ui";
import { describeRefs } from "@/lib/describe";
import { humanize, roleLabel } from "@/lib/labels";
import { maskText } from "@/lib/mask";
import { getActor } from "@/lib/session";
import { changesSince, allEvents, section } from "@/lib/state";
import { markSeen, undoEvent } from "@/lib/actions";
import { db, schema as s } from "@/db";

function describe(e: any) {
  const p = e.payload;
  switch (e.kind) {
    case "adjust": case "whatif_adjust": return `${p.old} → ${p.new} (fed ${p.taxEffectFed >= 0 ? "+" : ""}${p.taxEffectFed}, CA ${p.taxEffectCa >= 0 ? "+" : ""}${p.taxEffectCa}) — ${p.reason}`;
    case "verify": return `verified: ${String(p.type).replace(/_/g, " ")} ${p.evidence ?? ""} ${p.note ?? ""}`;
    case "sign_off": return p.approvesAdjustment ? `approved adjustment #${p.approvesAdjustment}` : `signed off as ${p.level}${p.note ? ` — ${p.note}` : ""}`;
    case "undo": return `undid #${e.reversesEventId} (${p.kind})`;
    case "resolve": return `resolved: ${p.resolution}`;
    case "time": return `${p.hours} h ${p.note ?? ""}`;
    case "view_sensitive": return `viewed sensitive data`;
    default: return p.text ?? p.ref ?? p.to ?? p.label ?? p.status ?? JSON.stringify(p).slice(0, 120);
  }
}

export default async function Activity() {
  const actor = await getActor();
  const [changes, all, staff, timeline] = await Promise.all([changesSince(actor.id), allEvents(), db.select().from(s.staff), section("timeline")]);
  const name = (id: string) => staff.find((m) => m.id === id)?.name ?? id;
  const mask = (t: string) => maskText(t);
  const described = new Map((await describeRefs([...new Set(all.map((e) => e.targetRef))])).map((d) => [d.ref, d]));
  const target = (r: string) => { const d = described.get(r); return d ? <RefChip d={d} /> : <Ref r={r} />; };
  const KIND: Record<string, string> = { view_sensitive: "Viewed sensitive data", sign_off: "Sign-off", whatif_adjust: "What-if change", whatif_create: "What-if created", whatif_close: "What-if closed", efile_result: "E-file result", standard_change: "Standards changed", issue_open: "Issue opened" };
  const kindLabelOf = (k: string) => KIND[k] ?? humanize(k);
  const batches = new Map<string, number>();
  for (const e of all) if (e.batchId) batches.set(e.batchId, (batches.get(e.batchId) ?? 0) + 1);
  return (
    <Shell path="/activity">
      <div className="flex justify-between items-end mb-4"><div><h1>Since {actor.name.split(" ")[0]} last looked</h1><p className="text-fg-3 text-sm">{changes.events.length} events by others since event #{changes.since}</p></div><ActionForm action={markSeen}><button className="btn primary">Mark all as seen</button></ActionForm></div>
      <Section title="What changed">
        {changes.events.length ? changes.events.map((e) => <div key={e.id} className="text-sm py-1 border-b border-line"><span className="text-fg-3 num text-xs">#{e.id}</span> <Tag>{kindLabelOf(e.kind)}</Tag> <strong>{name(e.actorId)}</strong> on {target(e.targetRef)} — {mask(describe(e))} <When d={e.at} /></div>) : <p className="text-fg-3 text-sm">Nothing new.</p>}
      </Section>
      <Section title="Full event log (append-only)">
        <div className="card overflow-hidden"><table className="ledger text-xs"><thead><tr><th>#</th><th>When</th><th>Who</th><th>Kind</th><th>Target</th><th>What</th><th></th></tr></thead>
          <tbody>{[...all].reverse().map((e) => <tr key={e.id} className={e.kind === "undo" ? "opacity-60" : ""}><td className="num">{e.id}</td><td><When d={e.at} /></td><td>{name(e.actorId)} <span className="text-fg-3">{roleLabel(e.actorRole)}</span></td><td><Tag>{kindLabelOf(e.kind)}</Tag>{e.scenarioId ? <Tag kind="engine">what-if {e.scenarioId}</Tag> : null}</td><td>{target(e.targetRef)}</td><td>{mask(describe(e))}{e.batchId ? <span className="text-fg-3"> · batch {e.batchId} ({batches.get(e.batchId)})</span> : null}</td><td>{!["undo", "view_sensitive", "freeze", "amend"].includes(e.kind) && <ActionForm action={undoEvent}><input type="hidden" name="_return" value="/activity" /><input type="hidden" name="eventId" value={e.id} /><button className="link">undo{e.batchId ? " batch" : ""}</button></ActionForm>}</td></tr>)}</tbody></table></div>
      </Section>
      <Section title="Season timeline (from the packet)">
        <ul className="text-xs">{(timeline as any[]).map((t) => <li key={t.id} className="py-1 border-b border-line"><span className="num text-fg-3">{t.at.slice(0, 10)}</span> {t.event.replace(/_/g, " ")} {t.actor ? `(${name(t.actor)})` : ""} {t.detail ? <span className="text-fg-2">— {t.detail}</span> : null} {t.refs?.map((r: string) => <Ref key={r} r={r.startsWith("D") ? `doc:${r}` : r.startsWith("v") ? `version:${r}` : r.startsWith("msg") ? `msg:${r.slice(4)}` : r.startsWith("qa") ? `qa:${r.slice(3)}` : r.startsWith("call") ? `call:${r.slice(5)}` : r} />)}</li>)}</ul>
      </Section>
    </Shell>
  );
}
