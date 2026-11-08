import { Shell } from "@/components/shell";
import { ActionForm } from "@/components/client";
import { Money, Ref, Section, Tag, When } from "@/components/ui";
import { db, schema as s } from "@/db";
import { adjustedSummary, allEvents, liveEvents, openIssues, section, signOffs, verificationMap, versionLines, claims } from "@/lib/state";
import { getActor, can } from "@/lib/session";
import { signOff, freezeReturn, recordEfile, clientApprove, reopenSignOff } from "@/lib/actions";
import { maskText } from "@/lib/mask";
import { Seal } from "@/components/motion";

export default async function Filing() {
  const actor = await getActor();
  const [issues, so, sum, agency, std, snaps, evs, ver, lines, cm, staff, household] = await Promise.all([openIssues(), signOffs(), adjustedSummary(), section("tax_agency_records"), db.select().from(s.standards), db.select().from(s.snapshots).orderBy(s.snapshots.id), allEvents(), verificationMap(), versionLines(), claims(), db.select().from(s.staff), section("household")]);
  const live = liveEvents(evs);
  const rules = (std[0]?.data as any);
  const blockers = issues.filter((i) => i.blocksFiling || i.severity === "blocker");
  const proposed = sum.adjustments.filter((a) => a.status === "proposed");
  const efile = live.filter((e) => e.kind === "efile_result");
  const steps: { name: string; ok: boolean; why: string }[] = [
    { name: "Engagement letter and consents signed", ok: true, why: "D01, D02 signed 2026-01-12" },
    { name: "Identity verified", ok: !issues.some((i) => i.code === "SSN_MISMATCH"), why: issues.some((i) => i.code === "SSN_MISMATCH") ? "SSN mismatch open" : "D04, D05, D71 agree to organizer" },
    { name: "Prior-year return reviewed", ok: ver.has("line:F1040.11") || live.some((e) => e.kind === "note" && e.targetRef === "area:intake_and_engagement"), why: "verify a line against 2024 or note the review" },
    { name: "All documents accounted for", ok: !issues.some((i) => i.code === "DOC_UNUSED" || i.code === "SUMMARY_VS_DETAIL"), why: "document index: no unexplained unused docs / unread pages" },
    { name: "Prior-year variances explained", ok: !issues.some((i) => i.kind === "variance"), why: `${issues.filter((i) => i.kind === "variance").length} open` },
    { name: "Carryovers agreed to prior year", ok: ["SchD.6", "SchD.14", "F8582.1c", "F8606.2"].every((k) => ver.has(`line:${k}`)), why: "verify SchD.6, SchD.14, F8582.1c, F8606.2" },
    { name: "Estimated payments agreed to IRS and FTB records", ok: !issues.some((i) => /PAYMENTS_VS/.test(i.code ?? "")), why: "payments reconciliation" },
    { name: "Due diligence completed", ok: !issues.some((i) => i.code === "DUE_DILIGENCE_REQUIRED"), why: "Form 8867 for CTC/ODC" },
    { name: "Diagnostics resolved", ok: !issues.some((i) => i.kind === "diagnostic" && i.severity !== "info"), why: `${issues.filter((i) => i.kind === "diagnostic").length} open` },
    { name: "No open review notes that block filing", ok: !blockers.length, why: `${blockers.length} blocking` },
    { name: "No adjustments awaiting partner approval", ok: !proposed.length, why: `${proposed.length} proposed` },
    { name: "Reviewer sign-off (return)", ok: so.some((x) => x.scope === "return" && x.level === "reviewer" && x.valid), why: "" },
    { name: "Partner sign-off (return)", ok: so.some((x) => x.scope === "return" && x.level === "partner" && x.valid), why: "" },
    { name: "Client approval and e-file authorization", ok: so.some((x) => x.scope === "return" && x.level === "client" && x.valid), why: "Form 8879 / FTB 8879" },
  ];
  const ready = steps.every((x) => x.ok);
  const frozen = snaps.find((x) => x.kind === "freeze");
  const hash = (v: unknown) => v;
  return (
    <Shell path="/filing">
      <h1 className="mb-1">Filing</h1>
      <p className="text-fg-3 text-sm mb-4">Required steps from the firm's standards. Everything must be green before the return can be sealed.</p>
      <div className="grid grid-cols-[1fr_380px] gap-8">
        <div>
          <Section title="Required steps">
            <ul>{steps.map((x) => <li key={x.name} className="flex gap-2 py-1 border-b border-line text-sm"><span className={x.ok ? "text-ok" : "text-bad"}>{x.ok ? "✓" : "✗"}</span><span className="flex-1">{x.name}</span><span className="text-fg-3 text-xs">{x.why}</span></li>)}</ul>
          </Section>
          <Section title="Sign-offs on the return">
            <div className="flex gap-2 flex-wrap items-center">
              {so.filter((x) => x.scope === "return").map((x) => <span key={x.eventId} className={`tag ${x.valid ? "ok" : "bad"}`}>{x.level} · {staff.find((m) => m.id === x.by)?.name} · <When d={x.at} /> {x.valid ? "✓" : `reopened by #${x.invalidatedBy?.id}`}</span>)}
              {["reviewer", "partner"].map((lvl) => can(actor, `sign_off_${lvl}`) && <ActionForm key={lvl} action={signOff} toast="Signed off"><input type="hidden" name="_return" value="/filing" /><input type="hidden" name="scope" value="return" /><input type="hidden" name="level" value={lvl} /><button className="btn" disabled={blockers.length > 0}>Sign off return as {lvl}</button></ActionForm>)}
              {can(actor, "client_approve") && <ActionForm action={clientApprove} className="flex gap-1"><input type="hidden" name="_return" value="/filing" /><input name="pin" placeholder="e-signature PIN" className="w-32" required /><button className="btn primary">Approve & sign 8879</button></ActionForm>}
            </div>
            <p className="text-fg-3 text-xs mt-2">A sign-off records a hash of every current value in scope; any later adjustment in scope reopens it.</p>
          </Section>
          <Section title="Seal, file, amend">
            {frozen ? <div className="card p-3 text-sm mb-2 flex items-center gap-4"><Seal label="Filed · sealed" hash={frozen.hash} when={frozen.createdAt.toISOString().slice(0, 10)} /><span>{frozen.label} by {frozen.createdBy} <When d={frozen.createdAt} /> · fed due <Money v={(frozen.summary as any).federal.balance_due} /> · CA <Money v={(frozen.summary as any).california.balance_due} />. Changes after this point are an amendment on top.</span></div> : <p className="text-fg-3 text-sm mb-2">Not yet frozen.</p>}
            {snaps.filter((x) => x.kind === "amendment").map((x) => <div key={x.id} className="card p-3 text-sm mb-2"><Tag kind="warn">amendment {x.hash}</Tag> {x.label} by {x.createdBy} <When d={x.createdAt} /></div>)}
            {can(actor, "freeze") && <div className="flex gap-2"><ActionForm action={freezeReturn} className="flex gap-1"><input type="hidden" name="_return" value="/filing" /><input type="hidden" name="kind" value="freeze" /><input name="label" placeholder="label" /><button className="btn primary" disabled={!ready || !!frozen}>Freeze at filing</button></ActionForm>{frozen && <ActionForm action={freezeReturn} className="flex gap-1"><input type="hidden" name="_return" value="/filing" /><input type="hidden" name="kind" value="amendment" /><input name="label" placeholder="1040-X reason" /><button className="btn">Seal amendment</button></ActionForm>}</div>}
            {!ready && <p className="text-bad text-xs mt-1">Cannot freeze: required steps incomplete.</p>}
          </Section>
          <Section title="E-file results">
            <ul className="text-sm">{(agency.efile as any[]).map((e, i) => <li key={i} className="py-1 border-b border-line"><span className="num text-fg-3 text-xs">{e.date.slice(0, 16)}</span> {e.jurisdiction} <Tag kind={e.status === "accepted" ? "ok" : e.status === "rejected" ? "bad" : "warn"}>{e.status}</Tag> <span className="num text-xs">{e.submission_id}</span> {e.errors?.map((x: any) => <div key={x.code} className="text-bad text-xs">{x.code}: {x.message}</div>)}</li>)}
              {efile.map((e) => <li key={e.id} className="py-1 border-b border-line"><span className="num text-fg-3 text-xs">{e.at.toISOString().slice(0, 16)}</span> {(e.payload as any).jurisdiction} <Tag>{(e.payload as any).status}</Tag> {(e.payload as any).errors}</li>)}</ul>
            <ActionForm action={recordEfile} className="flex gap-1 mt-2 text-xs"><input type="hidden" name="_return" value="/filing" /><select name="jurisdiction"><option>federal</option><option>california</option></select><select name="status"><option>transmitted</option><option>accepted</option><option>rejected</option></select><input name="submissionId" placeholder="submission id" /><input name="errors" placeholder="errors" className="flex-1" /><button className="btn">Record</button></ActionForm>
          </Section>
        </div>
        <aside>
          <Section title="Agency records">
            <div className="text-xs card p-3 mb-2"><div className="font-medium">IRS transcript (D69)</div>{(agency.irs_account_transcript_2025 as any[]).map((snap, i) => <div key={i} className="mt-1"><div className="text-fg-3">as of {snap.as_of}</div>{snap.transactions.map((t: any, j: number) => <div key={j} className="num">{t.date} {t.code} {typeof t.amount === "number" ? t.amount.toLocaleString() : t.amount} <span className="text-fg-3">{t.description}</span></div>)}</div>)}</div>
            <div className="text-xs card p-3 mb-2"><div className="font-medium">FTB account</div>{(agency.ftb_account.tax_year_2025_payments as any[]).map((t, i) => <div key={i} className="num">{t.date} {t.amount.toLocaleString()}</div>)}{(agency.ftb_account.tax_year_2024_payments_after_filing as any[]).map((t, i) => <div key={i} className="num text-warn">{t.date} {t.amount.toLocaleString()} — {t.note}</div>)}</div>
            <div className="text-xs card p-3"><div className="font-medium">Notices</div>{(agency.notices as any[]).map((n) => <div key={n.id} className="mt-1"><Tag kind={n.status?.startsWith("Resolved") ? "ok" : "bad"}>{n.type}</Tag> {n.tax_year} · {n.dated} {n.summary ?? n.items_under_examination?.join(" · ")} {n.response_due ? <span className="text-bad">due {n.response_due}</span> : null} <Ref r={`doc:${n.document}`} /></div>)}</div>
          </Section>
          <Section title="Client copy">
            <p className="text-xs text-fg-2">Federal: total tax <Money v={sum.federal.total_tax} />, payments <Money v={sum.federal.payments} />, balance due <Money v={sum.federal.balance_due} />. California: total tax <Money v={sum.california.total_tax} />, payments <Money v={sum.california.payments} />, overpaid <Money v={-sum.california.balance_due} />.</p>
            <p className="text-xs text-fg-3 mt-1">Refund account: {household.bank_account_for_refund_or_payment.bank} · {household.bank_account_for_refund_or_payment.type} · ••••{String(household.bank_account_for_refund_or_payment.account).slice(-4)} (full number on the Client page after a logged unmask)</p>
          </Section>
        </aside>
      </div>
    </Shell>
  );
}
