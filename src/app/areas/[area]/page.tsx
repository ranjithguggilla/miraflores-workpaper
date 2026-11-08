import { notFound } from "next/navigation";
import { Clock, PenLine, ShieldCheck, RotateCcw } from "lucide-react";
import { Shell, AREA_ICONS } from "@/components/shell";
import { Issues } from "@/components/issues";
import { LineTable } from "@/components/lines";
import { Money, Section, Badge, When, PageHeader, Empty, Person } from "@/components/ui";
import { ActionForm, Disclosure } from "@/components/client";
import { SignOffBadge } from "@/components/motion";
import { AREAS, areaForLine, areaName } from "@/lib/areas";
import { claims, openIssues, section, signOffs, timeByArea, verificationMap, versionLines, allEvents, liveEvents } from "@/lib/state";
import { signOff, logTime, addNote } from "@/lib/actions";
import { db, schema as s } from "@/db";
import { getActor, can } from "@/lib/session";
import { roleLabel } from "@/lib/labels";

export default async function Area({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!AREAS.some((a) => a.id === area)) notFound();
  const path = `/areas/${area}`;
  const actor = await getActor();
  const [lines, cm, ver, issues, so, time, firm, prior, std, staff, evs, v3] = await Promise.all([
    versionLines(), claims(), verificationMap(), openIssues(area), signOffs(), timeByArea(), section("firm"), section("prior_years"), db.select().from(s.standards), db.select().from(s.staff), allEvents(), db.select().from(s.returnVersions),
  ]);
  const areaLines = lines.filter((l) => areaForLine(l.key) === area);
  const folded = areaLines.filter((l) => /^F8949\.[AD]\.X/.test(l.key));
  const shown = areaLines.filter((l) => !/^F8949\.[AD]\.X/.test(l.key));
  const verified = shown.filter((l) => ver.has(`line:${l.key}`)).length;
  const adjusted = shown.filter((l) => cm.get(l.key)?.origin !== "engine").length;
  const mySign = so.filter((x) => x.scope === area);
  const notes = liveEvents(evs).filter((e) => e.targetRef === `area:${area}` && ["note", "question"].includes(e.kind));
  const budget = firm.budget_hours[area];
  const standards = std[0]?.data as any;
  const forms = [...new Set(shown.map((l) => l.form))];
  const work = issues.filter((i) => i.kind !== "variance");
  const variances = issues.filter((i) => i.kind === "variance");
  const blockers = work.filter((i) => i.severity === "blocker");
  const assets = area === "rentals_and_sale" ? ((v3.find((v) => v.version === "v3")?.assets as any[]) ?? []) : null;
  const name = (id: string) => staff.find((m) => m.id === id)?.name ?? id;
  return (
    <Shell path={path}>
      <PageHeader
        crumbs={[{ href: "/", label: "Inbox" }, { label: "Areas" }, { label: areaName(area) }]}
        title={<span className="flex items-center gap-2"><span className="text-fg-3 [&>svg]:w-5 [&>svg]:h-5">{AREA_ICONS[area]}</span>{areaName(area)}</span>}
        meta={`${forms.join(" · ")}${folded.length ? ` · ${folded.length} lot-level lines folded; all reconcile to the broker summary` : ""}`}
        actions={<ActionForm action={logTime} toast="Time logged" className="flex gap-1.5 items-center"><input type="hidden" name="_return" value={path} /><input type="hidden" name="area" value={area} /><input name="hours" type="number" step="0.25" placeholder="h" className="w-16" required /><input name="note" placeholder="What" className="w-36" /><button className="btn"><Clock /> Log time</button></ActionForm>}
        stats={[
          { label: "Lines", value: shown.length },
          { label: "Verified", value: <span className={verified === shown.length ? "text-ok" : ""}>{verified} <span className="text-fg-4 text-sm">/ {shown.length}</span></span> },
          { label: "Adjusted", value: adjusted },
          { label: "Open items", value: <span className={blockers.length ? "text-bad" : work.length ? "text-adj" : "text-ok"}>{work.length}{blockers.length ? <span className="text-sm"> · {blockers.length} blocking</span> : null}</span> },
          { label: "Swings vs 2024", value: variances.length },
          { label: "Hours", value: <span className={budget && (time[area] ?? 0) > budget ? "text-bad" : ""}>{(time[area] ?? 0).toFixed(1)} <span className="text-fg-4 text-sm">/ {budget ?? "—"}</span></span> },
        ]}
      />

      <Section title="Sign-offs" aside={<span>A sign-off covers a hash of every value in scope; any later change reopens it</span>}>
        <div className="card p-3 flex gap-3 flex-wrap items-center">
          {mySign.length ? mySign.map((x) => <SignOffBadge key={x.eventId} valid={x.valid}>{roleLabel(x.level)} · {name(x.by)} · <When d={x.at} />{x.valid ? "" : ` · reopened by ${x.invalidatedBy?.kind ?? "a change"} #${x.invalidatedBy?.id ?? ""}`}</SignOffBadge>) : <span className="text-fg-3 text-sm">No sign-offs yet.</span>}
          <span className="ml-auto flex gap-2 items-center">
            {["preparer", "reviewer", "partner"].map((lvl) => can(actor, `sign_off_${lvl}`) && (
              <ActionForm key={lvl} action={signOff} toast={`Signed off as ${lvl}`}><input type="hidden" name="_return" value={path} /><input type="hidden" name="scope" value={area} /><input type="hidden" name="level" value={lvl} /><button className="btn" disabled={blockers.length > 0}><PenLine /> Sign off as {lvl}</button></ActionForm>
            ))}
            {blockers.length > 0 && <span className="text-bad text-xs">Blocked by {blockers.length} open blocker{blockers.length > 1 ? "s" : ""}</span>}
          </span>
        </div>
      </Section>

      <Section title={`Open items (${work.length})`}>
        {work.length ? <Issues issues={work} path={path} /> : <Empty title="Nothing open in this area" hint="Checks, diagnostics, review notes and questions land here." />}
      </Section>

      {variances.length > 0 && (
        <Section title={`Swings from last year to explain (${variances.length})`}>
          <Disclosure summary={<span className="btn ghost">Show swings</span>} defaultOpen={variances.length <= 4}><div className="mt-2"><Issues issues={variances} path={path} filters={false} /></div></Disclosure>
        </Section>
      )}

      <Section title="Lines" aside={<span>Tick lines to verify them together</span>}>
        <LineTable lines={shown} claims={cm} verifications={ver} priorLines={prior.return_2024.lines} path={path} standards={standards} />
      </Section>

      {assets && assets.length > 0 && (
        <Section title="Depreciation by asset" aside={<span>Federal · California · AMT</span>} id="assets">
          <div className="card overflow-hidden"><table className="ledger text-xs">
            <thead><tr><th>Asset</th><th>Activity</th><th className="r">Cost</th><th>Placed</th><th>Method / life</th><th className="r">Fed prior</th><th className="r">Fed 2025</th><th className="r">CA prior</th><th className="r">CA 2025</th><th className="r">AMT diff</th><th>Disposed</th></tr></thead>
            <tbody>{assets.map((a: any) => (
              <tr key={a.asset_id}><td><span className="mono">{a.asset_id}</span><div className="text-fg-3">{a.description}</div></td><td>{a.activity}</td><td className="r"><Money v={a.cost} />{a.land_value_not_depreciated ? <div className="text-fg-3">land <Money v={a.land_value_not_depreciated} /></div> : null}</td><td className="num">{a.placed_in_service}</td><td>{a.method} / {a.life_years}y</td><td className="r"><Money v={a.federal?.prior_accumulated} /></td><td className="r"><Money v={a.federal?.depreciation_2025} /></td><td className="r"><Money v={a.california?.prior_accumulated} /></td><td className="r"><Money v={a.california?.depreciation_2025} /></td><td className="r"><Money v={a.amt?.difference_from_regular} /></td><td className="num">{a.disposed ?? ""}</td></tr>
            ))}</tbody>
          </table></div>
        </Section>
      )}

      <Section title="Area notes">
        <div className="card p-3">
          {notes.length ? notes.map((e) => <div key={e.id} className="text-sm py-2 border-b border-line last:border-0 flex gap-2"><Person name={name(e.actorId)} size={20} /><span className="text-fg-2">{(e.payload as any).text}</span><When d={e.at} /></div>) : <p className="text-fg-3 text-sm mb-2">No notes yet.</p>}
          <ActionForm action={addNote} toast="Note added" className="mt-2 flex gap-2 items-start"><input type="hidden" name="_return" value={path} /><input type="hidden" name="target" value={`area:${area}`} /><textarea name="text" placeholder="Note on this area…" className="min-h-[40px]" /><button className="btn self-end">Add note</button></ActionForm>
        </div>
      </Section>
    </Shell>
  );
}
