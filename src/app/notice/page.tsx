import { Shell } from "@/components/shell";
import { Money, Ref, RefChip, Section, Tag, When } from "@/components/ui";
import { describeRefs } from "@/lib/describe";
import { normalizeSource } from "@/lib/refs";
import { verificationLabel } from "@/lib/labels";
import { db, schema as s } from "@/db";
import { section, versionLines, claims, verificationMap, allEvents, liveEvents, adjustmentsFromEvents } from "@/lib/state";
import { inArray, sql } from "drizzle-orm";

/** A notice response is the subgraph under the examined lines: the lines, every adjustment and verification on them, the source values and the pages they came from. Self-contained. */
export default async function Notice({ searchParams }: { searchParams: Promise<{ lines?: string }> }) {
  const sp = await searchParams;
  const agency = await section("tax_agency_records");
  const notice = (agency.notices as any[]).find((n) => n.items_under_examination);
  const defaultKeys = ["SchA.12", "F8283.A1.stock", "F8283.A1.vehicle", "SchC.1"];
  const keys = sp.lines ? sp.lines.split(",").map((x) => x.trim()).filter(Boolean) : defaultKeys;
  const [lines, cm, ver, evs] = await Promise.all([versionLines(), claims(), verificationMap(), allEvents()]);
  const byKey = new Map(lines.map((l) => [l.key, l]));
  // walk inputs recursively
  const closure = new Set<string>();
  const walk = (k: string) => { if (closure.has(k) || !byKey.has(k)) return; closure.add(k); for (const i of byKey.get(k)!.inputs) walk(i); };
  keys.forEach(walk);
  const subset = [...closure].map((k) => byKey.get(k)!);
  const evIds = [...new Set(subset.flatMap((l) => l.sources.filter((x) => x.startsWith("ev-"))))];
  const values = evIds.length ? await db.select().from(s.extractedValues).where(inArray(s.extractedValues.id, evIds)) : [];
  const docIds = [...new Set(values.map((v) => v.docId))];
  const docs = docIds.length ? await db.select().from(s.documents).where(inArray(s.documents.id, docIds)) : [];
  const pages = docIds.length ? await db.select().from(s.pages).where(inArray(s.pages.docId, docIds)) : [];
  const adjs = adjustmentsFromEvents(evs).filter((a) => closure.has(a.lineKey));
  const srcDesc = new Map((await describeRefs([...new Set(subset.flatMap((l) => l.sources.map(normalizeSource)))])).map((d) => [d.ref, d]));
  const live = liveEvents(evs).filter((e) => e.targetRef.startsWith("line:") && closure.has(e.targetRef.slice(5)) && ["note", "answer", "attach", "verify"].includes(e.kind));
  return (
    <Shell path="/notice">
      <h1 className="mb-1">Notice response</h1>
      <p className="text-fg-3 text-sm mb-3">Everything under the examined lines, in one place: values, source pages, verifications, adjustments, notes. Print this page or export it; nothing on it depends on the rest of the system.</p>
      {notice && <div className="card p-3 text-sm mb-4"><Tag kind="bad">{notice.type}</Tag> dated {notice.dated}, response due {notice.response_due} · <Ref r={`doc:${notice.document}`} /><ul className="list-disc pl-5 mt-1">{notice.items_under_examination.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul></div>}
      <form className="flex gap-2 mb-5 text-sm"><input name="lines" defaultValue={keys.join(", ")} className="flex-1" /><button className="btn">Build response for these lines</button></form>
      <Section title={`Examined lines and everything beneath them (${subset.length} lines)`}>
        <div className="card overflow-hidden"><table className="ledger text-xs"><thead><tr><th>Line</th><th>Label</th><th className="text-right">As filed</th><th>Verified</th><th>Sources</th></tr></thead>
          <tbody>{subset.map((l) => <tr key={l.key}><td className="num"><Ref r={`line:${l.key}`} /></td><td>{l.label}</td><td className="text-right"><Money v={cm.get(l.key)?.current} /></td><td>{(ver.get(`line:${l.key}`) ?? []).map((v) => verificationLabel(String((v.payload as any).type))).join(", ") || <span className="text-fg-3">—</span>}</td><td><span className="flex flex-wrap gap-1">{l.sources.map((x) => { const dd = srcDesc.get(normalizeSource(x)); return dd ? <RefChip key={x} d={dd} /> : <span key={x} className="mono text-fg-3">{x}</span>; })}</span></td></tr>)}</tbody></table></div>
      </Section>
      <Section title="Adjustments and decisions">
        {adjs.length ? adjs.map((a) => <div key={a.eventId} className="text-sm py-1 border-b border-line">{a.lineKey}: <Money v={a.old} /> → <Money v={a.new} /> — {a.reason}{a.authority ? ` (${a.authority})` : ""} <span className="text-fg-3 text-xs">{a.by} <When d={a.at} /> {a.status}</span></div>) : <p className="text-fg-3 text-sm">No adjustments on these lines.</p>}
        {live.map((e) => <div key={e.id} className="text-xs py-1 border-b border-line"><Tag>{e.kind}</Tag> {e.targetRef.slice(5)}: {(e.payload as any).text ?? (e.payload as any).ref ?? (e.payload as any).note} <span className="text-fg-3">{e.actorId} <When d={e.at} /></span></div>)}
      </Section>
      <Section title={`Source documents (${docs.length}) and the exact fields`}>
        {docs.map((d) => <div key={d.id} className="mb-4"><div className="font-medium text-sm">{d.id} — {d.title} <span className="text-fg-3 text-xs">received {d.receivedAt.toISOString().slice(0, 10)}</span></div>
          {[...new Set(values.filter((v) => v.docId === d.id).map((v) => v.page))].sort().map((pn) => { const pg = pages.find((p) => p.docId === d.id && p.n === pn)!; const vs = values.filter((v) => v.docId === d.id && v.page === pn); return <div key={pn} className="page-sheet mt-1 text-[11px]"><div className="text-fg-3 mb-1">page {pn} · fields: {vs.map((v) => `${v.label} = ${v.textAsRead}`).join("; ")}</div>{pg.printedContent}</div>; })}
        </div>)}
      </Section>
    </Shell>
  );
}
