import Link from "next/link";
import { ActionForm } from "@/components/client";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { PageSheet } from "@/components/page-sheet";
import { Money, Ref, Section, Tag } from "@/components/ui";
import { db, schema as s } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { versionLines } from "@/lib/state";
import { getActor } from "@/lib/session";
import { maskText, maskValue, SENSITIVE_TYPES, SENSITIVE_FIELD } from "@/lib/mask";
import { unmask } from "@/lib/actions";
import { cookies } from "next/headers";
import { IssueCard } from "@/components/issues";

export default async function Doc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc] = await db.select().from(s.documents).where(eq(s.documents.id, id));
  if (!doc) notFound();
  const actor = await getActor();
  const unmasked = (await cookies()).get("unmask")?.value === `doc:${id}`;
  const showSensitive = actor.sensitiveClearance && unmasked;
  const [pages, evs, lines, issues] = await Promise.all([
    db.select().from(s.pages).where(eq(s.pages.docId, id)).orderBy(s.pages.n),
    db.select().from(s.extractedValues).where(eq(s.extractedValues.docId, id)),
    versionLines(),
    db.select().from(s.issues).where(sql`${s.issues.refs}::text like ${`%"doc:${id}%`}`),
  ]);
  const evIds = new Set(evs.map((e) => e.id));
  const landed = lines.filter((l) => l.sources.some((x) => evIds.has(x)));
  const byEv = new Map<string, string[]>();
  for (const l of lines) for (const x of l.sources) if (evIds.has(x)) byEv.set(x, [...(byEv.get(x) ?? []), l.key]);
  const path = `/documents/${id}`;
  const hasSensitive = evs.some((e) => SENSITIVE_TYPES.has(e.valueType) || SENSITIVE_FIELD.test(e.field));
  return (
    <Shell path={path}>
      <div className="text-xs text-fg-3"><Link href="/documents" className="link">Documents</Link> · {doc.documentType} · {doc.belongsTo} · received {doc.receivedAt.toISOString().slice(0, 10)} · {doc.pageCount} pages</div>
      <h1 className="mb-1">{doc.id} — {doc.title}</h1>
      <div className="flex gap-2 mb-4 items-center">{doc.markedCorrected && <Tag kind="warn">CORRECTED</Tag>}<Tag kind={doc.extractionStatus === "extracted" ? "ok" : "warn"}>{doc.extractionStatus}</Tag>{doc.extractionReason && <span className="text-fg-3 text-sm">{doc.extractionReason}</span>}
        {hasSensitive && (actor.sensitiveClearance ? (showSensitive ? <Tag kind="bad">unmasked view — logged</Tag> : <ActionForm action={unmask}><input type="hidden" name="_return" value={path} /><input type="hidden" name="ref" value={`doc:${id}`} /><button className="btn">Show sensitive data (logged)</button></ActionForm>) : <Tag kind="warn">sensitive data masked for your role</Tag>)}
      </div>

      <div className="grid grid-cols-[1fr_400px] gap-8">
        <div>
          {pages.map((pg) => {
            const pev = evs.filter((e) => e.page === pg.n);
            const content = showSensitive ? pg.printedContent : maskText(pg.printedContent);
            return (
              <Section key={pg.n} title={`Page ${pg.n}`} aside={<span className="text-xs text-fg-3">{pev.length} values read{pev.length === 0 && /\d/.test(pg.printedContent) && !/no further|instructions/i.test(pg.printedContent) ? " — nothing read from a page with figures" : ""}</span>}>
                <PageSheet id={`p${pg.n}`} content={content} highlights={pev.map((e) => ({ text: showSensitive || !(SENSITIVE_TYPES.has(e.valueType) || SENSITIVE_FIELD.test(e.field)) ? (e.textAsRead ?? "") : "", id: e.id, position: e.position }))} />
                {pev.length > 0 && (
                  <div className="card overflow-hidden"><table className="ledger text-xs mt-2"><thead><tr><th>Field</th><th>Read as</th><th>Value</th><th>Conf.</th><th>Landed on</th></tr></thead>
                    <tbody>{pev.map((e) => {
                      const sens = SENSITIVE_TYPES.has(e.valueType) || SENSITIVE_FIELD.test(e.field);
                      const onPage = e.textAsRead ? pg.printedContent.includes(e.textAsRead) : true;
                      return <tr key={e.id} id={e.id}><td><Link href={`/values/${e.id}`} className="link">{e.label}</Link><div className="text-fg-3">{e.field}</div></td><td className="num">{sens && !showSensitive ? maskValue(e.textAsRead) : e.textAsRead || <span className="text-fg-3">(blank)</span>}{!onPage && <div className="text-bad">not on page</div>}</td><td className="num">{sens && !showSensitive ? maskValue(e.value) : typeof e.value === "number" ? <Money v={e.value} /> : String(e.value)}</td><td><Tag kind={e.confidence < 0.9 ? "warn" : ""}>{e.confidence}</Tag></td><td>{(byEv.get(e.id) ?? []).map((k) => <Ref key={k} r={`line:${k}`} />).reduce<React.ReactNode[]>((a, x, i) => [...a, i ? ", " : "", x], []) || <span className="text-fg-3">—</span>}</td></tr>;
                    })}</tbody></table></div>
                )}
              </Section>
            );
          })}
        </div>
        <aside>
          <Section title={`Lands on ${landed.length} lines`}>
            <ul className="text-sm">{landed.map((l) => <li key={l.key} className="py-1 border-b border-line"><Ref r={`line:${l.key}`} /> <span className="text-fg-2">{l.label.slice(0, 60)}</span></li>)}</ul>
            {!landed.length && <p className="text-fg-3 text-sm">No return line uses a value from this document.</p>}
          </Section>
          <Section title="Issues referencing this document">{issues.map((i) => <IssueCard key={i.id} issue={i} path={path} />)}{!issues.length && <p className="text-fg-3 text-sm">None.</p>}</Section>
        </aside>
      </div>
    </Shell>
  );
}
