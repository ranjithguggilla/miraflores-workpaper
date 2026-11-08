import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, GitCompare, Sliders, CheckCheck, MessageSquare, Paperclip, Link2, Undo2, ThumbsUp, FileText, AlertTriangle } from "lucide-react";
import { Shell } from "@/components/shell";
import { Issues } from "@/components/issues";
import { PageSheet } from "@/components/page-sheet";
import { Money, Section, Badge, When, PageHeader, StatusBadge, Person, RefChip, Empty } from "@/components/ui";
import { ActionForm } from "@/components/client";
import { lineContext, claims, taxEffect, verificationMap, section } from "@/lib/state";
import { adjustLine, verifyLine, addNote, attachEvidence, undoEvent, approveAdjustment, linkRefs } from "@/lib/actions";
import { getActor, can } from "@/lib/session";
import { areaName } from "@/lib/areas";
import { db, schema as s } from "@/db";
import { maskText } from "@/lib/mask";
import { cookies } from "next/headers";
import { describeRefs } from "@/lib/describe";
import { verificationLabel, docTypeLabel, humanize } from "@/lib/labels";
import { traceGraph } from "@/lib/trace";
import { TraceGraphView, TraceLegend } from "@/components/trace-graph";
import { Network } from "lucide-react";

export default async function LinePage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ s?: string }> }) {
  const { key: raw } = await params;
  const key = decodeURIComponent(raw);
  const sp = await searchParams;
  const ctx = await lineContext(key);
  if (!ctx) notFound();
  const actor = await getActor();
  const path = `/lines/${encodeURIComponent(key)}`;
  const [cm, ver, std, staff, client] = await Promise.all([claims(), verificationMap(), db.select().from(s.standards), db.select().from(s.staff), section("client")]);
  const claim = cm.get(key)!;
  const standards = std[0]?.data as any;
  const rate = await taxEffect(key, 1);
  const verifs = ver.get(`line:${key}`) ?? [];
  const notes = ctx.events.filter((e) => ["note", "question", "answer", "attach", "link"].includes(e.kind));
  const qas = ctx.otherSources.filter((x) => x.startsWith("qa:")).map((x) => (client.questionnaire as any[]).find((q) => q.id === `qa-${x.slice(3)}`)).filter(Boolean);
  const otherRefs = await describeRefs(ctx.otherSources.filter((x) => !x.startsWith("qa:")));
  const name = (id: string) => staff.find((m) => m.id === id)?.name ?? id;
  const openIssues = ctx.issues.filter((i) => i.status === "open");
  const graph = await traceGraph(key);
  const unmaskedDoc = (await cookies()).get("unmask")?.value;

  return (
    <Shell path={path}>
      <PageHeader
        crumbs={[{ href: "/", label: "Inbox" }, { href: `/areas/${ctx.area}`, label: areaName(ctx.area) }, { label: `${ctx.line.form} line ${ctx.line.line}` }]}
        title={<span className="flex items-center gap-3"><span className="mono text-xl">{key}</span><StatusBadge origin={claim.origin} verified={verifs.map((v) => String((v.payload as any).type))} /></span>}
        meta={<>{ctx.line.label}{ctx.line.note && <span className="block mt-1 text-fg-3">Engine note: {ctx.line.note}</span>}</>}
        stats={[
          { label: "Engine (v3)", value: <Money v={ctx.line.value} /> },
          { label: claim.origin === "engine" ? "Current (same as engine)" : `Current · ${humanize(claim.origin)}`, value: <Money v={claim.current} />, tone: claim.origin === "adjusted" ? "text-adj" : claim.origin === "proposed" ? "text-prop" : "" },
          { label: "2024 filed", value: <Money v={ctx.priorValue} /> },
          { label: "Jurisdiction · rule", value: <span className="text-sm">{ctx.line.jurisdiction} · <span className="mono">{ctx.line.rule}</span></span> },
          { label: rate.category.startsWith("payments") ? "Balance effect per $1 · payment" : "Tax effect per $1 · linear estimate", value: <span className="text-sm num">fed {rate.fed.toFixed(3)} · CA {rate.ca.toFixed(3)}</span> },
        ]}
      />

      <Section title={<span className="flex items-center gap-2"><Network className="w-4 h-4 text-fg-3" /> Trace</span>} aside={<span>{graph.nodes.length} nodes · {graph.edges.length} edges{graph.truncated ? " · deeper inputs folded" : ""}</span>}>
        <TraceGraphView graph={graph} />
        <div className="mt-2"><TraceLegend /></div>
      </Section>

      <div className="grid grid-cols-[1fr_380px] gap-8">
        <div>
          <Section title={<span className="flex items-center gap-2"><ArrowDownToLine className="w-4 h-4 text-fg-3" /> Where it came from</span>}>
            {!ctx.evs.length && !ctx.inputs.length && !ctx.otherSources.length && <Empty title="Engine constant" hint="This line has no document source or input lines." />}
            {ctx.inputs.length > 0 && (
              <div className="card overflow-hidden mb-3"><table className="ledger"><thead><tr><th>Input line</th><th>Label</th><th className="r">Engine</th><th className="r">Current</th></tr></thead>
                <tbody>{ctx.inputs.map((l) => { const c = cm.get(l.key); return <tr key={l.key}><td><Link href={`/lines/${encodeURIComponent(l.key)}`} className="link mono">{l.key}</Link></td><td>{l.label}</td><td className="r"><Money v={l.value} /></td><td className="r">{c?.origin !== "engine" ? <strong><Money v={c?.current} /></strong> : <span className="text-fg-4">=</span>}</td></tr>; })}</tbody></table></div>
            )}
            {ctx.evs.map((e) => {
              const doc = ctx.docs.find((d) => d.id === e.docId)!;
              const pg = ctx.pages.find((p) => p.docId === e.docId && p.n === e.page)!;
              const onPage = e.textAsRead && ["ssn", "ein", "account_number"].includes(e.valueType) ? pg.printedContent.includes(e.textAsRead) : true;
              return (
                <div key={e.id} className="card p-4 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="w-4 h-4 text-fg-3" />
                    <Link href={`/documents/${doc.id}#p${e.page}`} className="link font-medium">{doc.id} · {doc.title}</Link>
                    <span className="text-fg-3 text-xs">{docTypeLabel(doc.documentType)}, page {e.page}</span>
                    <span className="ml-auto flex gap-1.5"><Badge tone={e.confidence < 0.9 ? "adj" : "ok"}>Confidence {e.confidence}</Badge>{!onPage && <Badge tone="bad" icon={<AlertTriangle />}>Read text not on page</Badge>}</span>
                  </div>
                  <div className="text-sm mt-2 text-fg-2"><span className="text-fg-3">{e.label}</span> — read as <span className="hl">{["ssn", "account_number"].includes(e.valueType) && !(actor.sensitiveClearance && unmaskedDoc === `doc:${doc.id}`) ? maskText(e.textAsRead ?? "") : e.textAsRead || "(blank)"}</span> → <strong className="num text-fg">{["ssn", "account_number"].includes(e.valueType) && !(actor.sensitiveClearance && unmaskedDoc === `doc:${doc.id}`) ? maskText(String(e.value)) : typeof e.value === "number" ? <Money v={e.value} /> : JSON.stringify(e.value)}</strong></div>
                  <PageSheet content={actor.sensitiveClearance && unmaskedDoc === `doc:${doc.id}` ? pg.printedContent : maskText(pg.printedContent)} highlight={["ssn", "account_number"].includes(e.valueType) && !(actor.sensitiveClearance && unmaskedDoc === `doc:${doc.id}`) ? null : e.textAsRead} position={e.position} compact />
                </div>
              );
            })}
            {qas.map((q: any) => <div key={q.id} className="card p-4 mb-3 text-sm"><div className="flex items-center gap-2 text-fg-3 text-xs"><MessageSquare className="w-3.5 h-3.5" /> Client questionnaire · question {q.id.slice(3)} · answered by {q.answered_by} on {q.answered_at.slice(0, 10)}</div><div className="text-fg-2 mt-1">{q.question}</div><div className="font-medium mt-1">“{q.answer}”</div></div>)}
            {otherRefs.length > 0 && <div className="flex flex-wrap gap-1.5">{otherRefs.map((d) => <RefChip key={d.ref} d={d} />)}</div>}
          </Section>

          <Section title={<span className="flex items-center gap-2"><ArrowUpFromLine className="w-4 h-4 text-fg-3" /> Where it goes</span>}>
            {ctx.usedBy.length ? <div className="card overflow-hidden"><table className="ledger"><tbody>{ctx.usedBy.map((l) => <tr key={l.key}><td><Link href={`/lines/${encodeURIComponent(l.key)}`} className="link mono">{l.key}</Link></td><td>{l.label}</td><td className="r"><Money v={l.value} /></td></tr>)}</tbody></table></div> : <Empty title="Final line" hint="Nothing downstream uses this value." />}
          </Section>

          <Section title={<span className="flex items-center gap-2"><GitCompare className="w-4 h-4 text-fg-3" /> Across versions</span>}>
            <div className="grid grid-cols-4 gap-3">
              {ctx.versions.sort((a, b) => a.version.localeCompare(b.version)).map((v) => <div key={v.version} className="tile"><div className="text-fg-3 text-xs">{v.version}</div><div className="text-base"><Money v={v.value} /></div></div>)}
              <div className="tile"><div className="text-fg-3 text-xs">2024 filed</div><div className="text-base"><Money v={ctx.priorValue} /></div></div>
            </div>
          </Section>

          <Section title={`Open items on this line (${openIssues.length})`}>
            {ctx.issues.length ? <Issues issues={ctx.issues} path={path} filters={false} /> : <Empty title="No issues on this line" />}
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-1 flex items-center gap-2"><Sliders className="w-4 h-4" /> Adjust</h3>
            <p className="text-xs text-fg-3 mb-3">The original stays. Effects over {(standards?.partner_threshold ?? 1000).toLocaleString()} wait for a partner.</p>
            {can(actor, "adjust") ? (
              <ActionForm action={adjustLine} toast="Adjustment recorded" className="space-y-2">
                <input type="hidden" name="_return" value={path} /><input type="hidden" name="key" value={key} />
                {sp.s && <input type="hidden" name="scenario" value={sp.s} />}
                <input name="value" placeholder={`New value (now ${String(claim.current)})`} className="w-full" required />
                <input name="reason" placeholder="Why — required" className="w-full" required />
                <input name="authority" placeholder="Authority (IRC §, Reg., Pub.)" className="w-full" />
                <select name="issue" className="w-full"><option value="">Resolves an open issue…</option>{openIssues.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.title.slice(0, 60)}</option>)}</select>
                <button className="btn primary w-full justify-center">Record adjustment</button>
              </ActionForm>
            ) : <p className="text-fg-3 text-xs">Your role cannot adjust.</p>}
          </div>

          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2"><CheckCheck className="w-4 h-4" /> Verify</h3>
            <ActionForm action={verifyLine} toast="Verification recorded" className="space-y-2">
              <input type="hidden" name="_return" value={path} /><input type="hidden" name="key" value={key} />
              <select name="type" className="w-full">{(standards?.verification_types ?? []).map((t: string) => <option key={t} value={t}>{verificationLabel(t)}</option>)}</select>
              <input name="evidence" placeholder="Evidence (e.g. doc:D11#p2, msg:08)" className="w-full" />
              <input name="note" placeholder="Note" className="w-full" />
              <button className="btn w-full justify-center">Record verification</button>
            </ActionForm>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Note or question</h3>
            <ActionForm action={addNote} toast="Added" className="space-y-2">
              <input type="hidden" name="_return" value={path} /><input type="hidden" name="target" value={`line:${key}`} />
              <textarea name="text" placeholder="Review note, or a question for the client or a colleague" required />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select name="kind"><option value="note">Review note</option><option value="question">Question</option></select>
                <select name="to"><option value="">To…</option>{staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                <input type="date" name="due" />
                <label className="flex items-center gap-2 text-fg-2"><input type="checkbox" name="blocks" className="h-4 w-4 p-0" /> Blocks filing</label>
              </div>
              <button className="btn w-full justify-center">Add</button>
            </ActionForm>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 flex items-center gap-2"><Paperclip className="w-4 h-4" /> Attach evidence · link</h3>
            <ActionForm action={attachEvidence} toast="Evidence attached" className="flex gap-1.5 mb-2"><input type="hidden" name="_return" value={path} /><input type="hidden" name="target" value={`line:${key}`} /><input name="ref" placeholder="Ref or file name" className="flex-1 min-w-0" required /><button className="btn icon" title="Attach"><Paperclip /></button></ActionForm>
            <ActionForm action={linkRefs} toast="Linked" className="flex gap-1.5"><input type="hidden" name="_return" value={path} /><input type="hidden" name="from" value={`line:${key}`} /><input name="to" placeholder="line:… doc:… py:…" className="flex-1 min-w-0" required /><select name="relation" className="w-28"><option>related</option><option>same_money</option><option>related_year</option><option>related_return</option><option>duplicate_of</option></select><button className="btn icon" title="Link"><Link2 /></button></ActionForm>
          </div>

          <div className="card p-4">
            <h3 className="mb-3">History on this line</h3>
            <div className="space-y-3 text-xs">
              {ctx.adjustments.map((a) => (
                <div key={a.eventId} className="border-l-2 pl-3" style={{ borderColor: a.status === "approved" ? "var(--adj)" : "var(--prop)" }}>
                  <div className="flex items-center gap-2 flex-wrap"><Badge tone={a.status === "approved" ? "adj" : "prop"}>{a.status === "approved" ? "Adjusted" : "Awaiting partner"}</Badge><span className="num"><Money v={a.old} /> → <strong><Money v={a.new} /></strong></span><span className="text-fg-3">fed <Money v={a.taxEffectFed} signed /> · CA <Money v={a.taxEffectCa} signed /></span></div>
                  <div className="text-fg-2 mt-1">{a.reason}{a.authority ? <span className="text-fg-3"> · {a.authority}</span> : null}</div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap"><Person name={name(a.by)} size={18} /><When d={a.at} />{a.approvedBy && <span className="text-ok">· approved by {name(a.approvedBy)}</span>}</div>
                  <div className="flex gap-1.5 mt-2">
                    {a.status === "proposed" && can(actor, "approve_adjustment") && <ActionForm action={approveAdjustment} toast="Approved"><input type="hidden" name="_return" value={path} /><input type="hidden" name="eventId" value={a.eventId} /><button className="btn sm primary"><ThumbsUp /> Approve</button></ActionForm>}
                    <ActionForm action={undoEvent} toast="Undone" confirm="Undo this adjustment?"><input type="hidden" name="_return" value={path} /><input type="hidden" name="eventId" value={a.eventId} /><button className="btn sm ghost"><Undo2 /> Undo</button></ActionForm>
                  </div>
                </div>
              ))}
              {verifs.map((v) => <div key={v.id} className="border-l-2 border-ok pl-3"><div className="flex items-center gap-2 flex-wrap"><Badge tone="ok" icon={<CheckCheck />}>{verificationLabel(String((v.payload as any).type))}</Badge>{(v.payload as any).evidence && <span className="mono text-fg-3">{String((v.payload as any).evidence)}</span>}</div>{(v.payload as any).note && <div className="text-fg-2 mt-1">{(v.payload as any).note}</div>}<div className="mt-1 flex items-center gap-2"><Person name={name(v.actorId)} size={18} /><When d={v.at} /><ActionForm action={undoEvent} toast="Undone" className="ml-auto"><input type="hidden" name="_return" value={path} /><input type="hidden" name="eventId" value={v.id} /><button className="btn sm ghost"><Undo2 /></button></ActionForm></div></div>)}
              {notes.map((e) => <div key={e.id} className="border-l-2 border-line-strong pl-3"><div className="flex items-center gap-2"><Badge>{humanize(e.kind)}</Badge>{(e.payload as any).relation && <span className="text-fg-3">{(e.payload as any).relation}</span>}</div><div className="text-fg-2 mt-1">{(e.payload as any).text ?? (e.payload as any).ref ?? (e.payload as any).to}</div><div className="mt-1 flex items-center gap-2"><Person name={name(e.actorId)} size={18} /><When d={e.at} /></div></div>)}
              {ctx.links.filter((l) => l.targetRef !== `line:${key}`).map((l) => <div key={l.id} className="text-fg-3">← linked from <span className="mono">{l.targetRef}</span> ({(l.payload as any).relation})</div>)}
              {!ctx.adjustments.length && !verifs.length && !notes.length && <p className="text-fg-3">Nothing yet.</p>}
            </div>
          </div>
        </aside>
      </div>
    </Shell>
  );
}
