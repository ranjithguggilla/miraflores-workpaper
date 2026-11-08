import Link from "next/link";
import { Shell } from "@/components/shell";
import { Tag, When, PageHeader } from "@/components/ui";
import { docTypeLabel } from "@/lib/labels";
import { db, schema as s } from "@/db";
import { versionLines, allEvents, liveEvents, section } from "@/lib/state";
import { eq } from "drizzle-orm";

export default async function Documents() {
  const [docs, evs, lines, events, v3] = await Promise.all([db.select().from(s.documents).orderBy(s.documents.id), db.select({ id: s.extractedValues.id, docId: s.extractedValues.docId }).from(s.extractedValues), versionLines(), allEvents(), db.select().from(s.returnVersions).where(eq(s.returnVersions.version, "v3"))]);
  const used = new Set(v3[0].documentsUsed); const sup = new Set(v3[0].documentsSuperseded);
  const evDoc = new Map(evs.map((e) => [e.id, e.docId]));
  const landed = new Map<string, Set<string>>();
  for (const l of lines) for (const src of l.sources) { const d = evDoc.get(src); if (d) landed.set(d, (landed.get(d) ?? new Set()).add(l.key)); }
  const attachments = liveEvents(events).filter((e) => e.kind === "attach");
  const dupNote = (id: string) => lines.find((l) => l.note?.includes(`${id} is a second image`))?.note;
  return (
    <Shell path="/documents">
      <PageHeader crumbs={[{ href: "/", label: "Inbox" }, { label: "Documents" }]} title="Document index" meta={`${docs.length} documents · every one accounted for: used, superseded, duplicate, reference-only, or flagged as unused · ${attachments.length} attached by staff`} stats={[{ label: "Documents", value: docs.length }, { label: "Used by v3", value: docs.filter((d) => used.has(d.id)).length }, { label: "Superseded", value: sup.size }, { label: "Not used", value: <span className="text-bad">{docs.filter((d) => !used.has(d.id) && !sup.has(d.id)).length}</span> }, { label: "Corrected forms", value: docs.filter((d) => d.markedCorrected).length }]} />
      <div className="card overflow-hidden"><table className="ledger text-[13px]">
        <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>For</th><th>Received</th><th>Extraction</th><th>Landed on</th><th>Status</th></tr></thead>
        <tbody>{docs.map((d) => {
          const n = landed.get(d.id)?.size ?? 0;
          const dup = dupNote(d.id);
          return <tr key={d.id} id={d.id}><td className="num"><Link href={`/documents/${d.id}`} className="link">{d.id}</Link></td><td>{d.title}</td><td className="text-fg-3">{docTypeLabel(d.documentType)}</td><td className="text-fg-3">{({ taxpayer: "Ngozi", spouse: "Erik", joint: "Joint" } as Record<string, string>)[d.belongsTo] ?? d.belongsTo.replace("dependent:", "Dependent · ")}</td><td className="num text-fg-3 whitespace-nowrap">{d.receivedAt.toISOString().slice(0, 10)}</td><td>{d.extractionStatus === "extracted" ? <Tag kind="ok">extracted</Tag> : d.extractionStatus === "partial" ? <Tag kind="warn">partial</Tag> : <Tag>not extracted</Tag>}{d.markedCorrected && <Tag kind="warn">CORRECTED</Tag>}</td><td className="num">{n ? `${n} lines` : "—"}</td><td>{sup.has(d.id) ? <Tag kind="warn">superseded by D31</Tag> : dup ? <Tag>duplicate of D09</Tag> : used.has(d.id) ? (n ? <Tag kind="ok">used</Tag> : <Tag kind="engine">reference</Tag>) : <Tag kind="bad">not used by v3</Tag>}</td></tr>;
        })}</tbody>
      </table></div>
      {attachments.length > 0 && <div className="mt-5"><h2 className="mb-2">Attached by staff</h2><ul className="text-sm">{attachments.map((a) => <li key={a.id} className="py-1 border-b border-rule">{(a.payload as any).ref} → {a.targetRef} · {(a.payload as any).note} <span className="text-fg-3 text-xs">{a.actorId} <When d={a.at} /></span></li>)}</ul></div>}
    </Shell>
  );
}
