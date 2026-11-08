import Link from "next/link";
import { AlertOctagon, Hourglass, CalendarClock, ArrowRight, Inbox as InboxIcon } from "lucide-react";
import { Shell, AREA_ICONS } from "@/components/shell";
import { Issues } from "@/components/issues";
import { Money, Section, PageHeader, Badge, Empty, Avatar } from "@/components/ui";
import { Disclosure } from "@/components/client";
import { Ticker } from "@/components/motion";
import { getActor } from "@/lib/session";
import { adjustedSummary, openIssues, signOffs, timeByArea, section } from "@/lib/state";
import { AREAS } from "@/lib/areas";
import { db, schema as s } from "@/db";

export default async function Inbox() {
  const actor = await getActor();
  const [issues, summary, so, time, firm, staff] = await Promise.all([openIssues(), adjustedSummary(), signOffs(), timeByArea(), section("firm"), db.select().from(s.staff)]);
  const work = issues.filter((i) => i.kind !== "variance");
  const mine = work.filter((i) => i.assignedTo === actor.id);
  const blockers = work.filter((i) => i.blocksFiling || i.severity === "blocker");
  const proposed = summary.adjustments.filter((a) => a.status === "proposed");
  const variances = issues.filter((i) => i.kind === "variance");
  const unassigned = work.filter((i) => !i.assignedTo);
  const deadlines: any[] = firm.deadlines;
  const today = new Date("2026-10-26");
  const nextDeadlines = deadlines.filter((d) => new Date(d.date) >= new Date("2026-03-01")).slice(0, 4);
  const first = actor.name.split(" ")[0];
  return (
    <Shell path="/">
      <PageHeader
        title={`What needs ${first}`}
        meta={`${mine.length} assigned to you · ${blockers.length} blocking filing · ${proposed.length} awaiting partner · ${variances.length} swings to explain`}
        stats={[
          { label: "Federal balance due · engine", value: <Ticker value={summary.base.federal.balance_due} /> },
          { label: "Federal balance due · current", value: <Ticker value={summary.federal.balance_due} />, tone: summary.federal.balance_due < summary.base.federal.balance_due ? "text-ok" : "text-bad" },
          { label: "California · engine", value: <Ticker value={summary.base.california.balance_due} /> },
          { label: "California · current", value: <Ticker value={summary.california.balance_due} /> },
          { label: "Blocking filing", value: <span className={blockers.length ? "text-bad" : "text-ok"}>{blockers.length}</span> },
          { label: "Awaiting partner", value: <span className={proposed.length ? "text-prop" : ""}>{proposed.length}</span> },
        ]}
      />

      <Section title="Areas">
        <div className="grid grid-cols-3 gap-3">
          {AREAS.map((a) => {
            const n = work.filter((i) => i.area === a.id);
            const bl = n.filter((i) => i.severity === "blocker").length;
            const signed = so.filter((x) => x.scope === a.id && x.valid);
            const b = firm.budget_hours[a.id];
            const t = time[a.id] ?? 0;
            return (
              <Link key={a.id} href={`/areas/${a.id}`} className="card p-4 hover:border-line-strong transition-colors group">
                <div className="flex items-center gap-2 mb-2"><span className="text-fg-3 [&>svg]:w-4 [&>svg]:h-4">{AREA_ICONS[a.id]}</span><span className="font-medium flex-1">{a.name}</span><ArrowRight className="w-4 h-4 text-fg-4 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {n.length ? <Badge tone={bl ? "bad" : "adj"}>{n.length} open{bl ? ` · ${bl} blocking` : ""}</Badge> : <Badge tone="ok">Nothing open</Badge>}
                  {signed.length > 0 && <Badge tone="ok">Signed: {signed.map((x) => x.level).join(", ")}</Badge>}
                  {b != null && <span className={`num ml-auto ${t > b ? "text-bad" : "text-fg-3"}`}>{t.toFixed(1)} / {b} h</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </Section>

      {blockers.length > 0 && (
        <Section title={<span className="flex items-center gap-2"><AlertOctagon className="w-4 h-4 text-bad" /> Blocking filing ({blockers.length})</span>}>
          <Issues issues={blockers} path="/" showArea filters={false} />
        </Section>
      )}

      {proposed.length > 0 && (
        <Section title={<span className="flex items-center gap-2"><Hourglass className="w-4 h-4 text-prop" /> Adjustments awaiting partner approval ({proposed.length})</span>}>
          <div className="card overflow-hidden"><table className="ledger"><thead><tr><th>Line</th><th>Change</th><th className="r">Federal effect</th><th className="r">California effect</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>{proposed.map((a) => <tr key={a.eventId}><td><Link href={`/lines/${encodeURIComponent(a.lineKey)}`} className="link mono">{a.lineKey}</Link></td><td className="num"><Money v={a.old} /> → <Money v={a.new} /></td><td className="r"><Money v={a.taxEffectFed} signed /></td><td className="r"><Money v={a.taxEffectCa} signed /></td><td className="text-fg-2 max-w-md truncate">{a.reason}</td><td><span className="inline-flex items-center gap-1.5"><Avatar name={staff.find((m) => m.id === a.by)?.name ?? a.by} size={20} />{staff.find((m) => m.id === a.by)?.name}</span></td></tr>)}</tbody></table></div>
        </Section>
      )}

      <Section title={`Assigned to you (${mine.length})`}>
        {mine.length ? <Issues issues={mine} path="/" showArea /> : <Empty icon={<InboxIcon />} title="Nothing assigned to you" hint="Items appear here when someone assigns them or when a check names you." />}
      </Section>

      <Section title={<span className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-fg-3" /> Deadlines</span>}>
        <div className="card overflow-hidden"><table className="ledger"><tbody>{deadlines.map((d, i) => <tr key={i}><td>{d.what}</td><td className="r num text-fg-3 whitespace-nowrap">{d.date}</td></tr>)}</tbody></table></div>
      </Section>

      <Section title={`Swings from last year to explain (${variances.length})`} aside={<span>Over {firm.starter_standards.variance_review.flag_if_change_over_percent}% and {firm.starter_standards.variance_review.and_over_amount.toLocaleString()} vs 2024</span>}>
        <Disclosure summary={<span className="btn ghost">Show all {variances.length} swings</span>}>
          <div className="mt-2"><Issues issues={variances} path="/" showArea filters={false} pageSize={25} /></div>
        </Disclosure>
      </Section>

      {unassigned.length > 0 && <Section title={`Unassigned (${unassigned.length})`}><Issues issues={unassigned} path="/" showArea /></Section>}
    </Shell>
  );
}
