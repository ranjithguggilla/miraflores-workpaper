import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/client";
import { Ref, Section, Tag } from "@/components/ui";
import { section, versionLines, openIssues } from "@/lib/state";
import { getActor } from "@/lib/session";
import { maskValue } from "@/lib/mask";
import { humanize } from "@/lib/labels";
import { unmask } from "@/lib/actions";
import { cookies } from "next/headers";
import { IssueCard } from "@/components/issues";

export default async function Client() {
  const actor = await getActor();
  const [client, household, lines, issues] = await Promise.all([section("client"), section("household"), versionLines(), openIssues()]);
  const unm = (await cookies()).get("unmask")?.value === "household";
  const show = actor.sensitiveClearance && unm;
  const usedBy = (id: string) => lines.filter((l) => l.sources.includes(id)).map((l) => l.key);
  const questions = issues.filter((i) => i.kind === "client_question" && i.code === "QUESTION");
  const m = (v: unknown) => (show ? String(v ?? "") : maskValue(v));
  return (
    <Shell path="/client">
      <h1 className="mb-4">Client: household, answers, messages</h1>
      <Section title="Household" aside={actor.sensitiveClearance ? (show ? <Tag kind="bad">unmasked — logged</Tag> : <ActionForm action={unmask}><input type="hidden" name="_return" value="/client" /><input type="hidden" name="ref" value="household" /><button className="btn">Show SSNs / bank (logged)</button></ActionForm>) : <Tag kind="warn">masked for your role</Tag>}>
        <div id="household" className="grid grid-cols-2 gap-3 text-sm">
          {(household.people as any[]).map((p) => <div key={p.id} className="card p-3"><div className="font-medium">{p.name} <Tag>{humanize(p.role)}</Tag></div><div className="num text-fg-2">SSN {m(p.ssn)} · DOB {p.dob}{p.ip_pin ? ` · IP PIN ${show ? p.ip_pin : "••••••"}` : ""}</div><div className="text-fg-3 text-xs">{p.occupation ?? p.relationship}{p.full_time_student ? " · full-time student" : ""}{p.note ? ` · ${p.note}` : ""}{p.own_income ? ` · ${p.own_income}` : ""}</div></div>)}
          <div className="card p-3"><div className="font-medium">Residency</div>{(household.residency as any[]).map((r, i) => <div key={i} className="num text-fg-2">{r.state} {r.from} → {r.to} ({r.status})</div>)}<div className="text-fg-3 text-xs mt-1">{(household.addresses as any[]).map((a) => `${a.address} (${a.type}, ${a.from}→${a.to ?? "now"})`).join(" · ")}</div></div>
          <div className="card p-3"><div className="font-medium">Refund / payment account</div>{(() => { const b = household.bank_account_for_refund_or_payment; const last4 = String(b.account).slice(-4); return <div className="text-fg-2">{b.bank} · {b.type} · <span className="num">{show ? b.account : `••••${last4}`}</span>{show && <span className="text-fg-3 text-xs"> · routing <span className="num">{b.routing}</span></span>}</div>; })()}<div className="text-fg-3 text-xs">Prior-year AGI for e-signature: {household.prior_year_agi_for_esignature}</div></div>
          <div className="card p-3 col-span-2"><div className="font-medium">Related returns</div>{(household.related_returns as any[]).map((r, i) => <div key={i} className="text-fg-2 text-xs">{r.who}: {r.return} — prepared by {r.prepared_by}; in packet: {String(r.in_this_packet)}</div>)}</div>
        </div>
      </Section>
      <Section title={`Open questions to the client (${questions.length})`}>{questions.map((i) => <IssueCard key={i.id} issue={i} path="/client" />)}{!questions.length && <p className="text-fg-3 text-sm">None open. Ask one from any line.</p>}</Section>
      <Section title="Questionnaire">
        <div className="card overflow-hidden"><table className="ledger text-[13px]"><thead><tr><th>#</th><th>Question</th><th>Answer</th><th>By</th><th>Used by</th></tr></thead>
          <tbody>{(client.questionnaire as any[]).map((q) => <tr key={q.id} id={q.id}><td className="num">{q.id}</td><td className="text-fg-2">{q.question}</td><td>{q.answer}</td><td className="text-fg-3 text-xs">{q.answered_by}</td><td>{usedBy(q.id).map((k) => <Ref key={k} r={`line:${k}`} />).reduce<React.ReactNode[]>((a, x, i) => [...a, i ? ", " : "", x], [])}</td></tr>)}</tbody></table></div>
      </Section>
      <Section title="Messages">{(client.messages as any[]).map((mm) => <div key={mm.id} id={mm.id} className="text-sm py-2 border-b border-line"><span className="num text-fg-3 text-xs">{mm.id} · {mm.sent_at.slice(0, 10)} · {mm.from}</span><div>{mm.text}</div></div>)}</Section>
      <Section title="Call notes">{(client.call_notes as any[]).map((c) => <div key={c.id} id={c.id} className="text-sm card p-3"><div className="text-fg-3 text-xs">{c.id} · {c.date.slice(0, 10)} · {c.participants.join(", ")}</div><ul className="list-disc pl-5">{c.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul></div>)}</Section>
    </Shell>
  );
}
