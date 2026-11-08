import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { Shell } from "@/components/shell";
import { PageHeader, Section } from "@/components/ui";
import { CHECK_LABELS } from "@/lib/labels";

/** The reviewer's page: what this app is built on, what it will never do, and the numbers that prove the packet loaded as delivered. */
export default async function WhyTrustThis() {
  const packetSha = (() => { try { return createHash("sha256").update(readFileSync("data/packet.json")).digest("hex"); } catch { return "unavailable"; } })();
  const [counts] = await db.execute(sql`select (select count(*) from documents)::int as docs, (select count(*) from pages)::int as pages, (select count(*) from extracted_values)::int as "values", (select count(*) from return_lines)::int as lines, (select count(*) from issues)::int as issues, (select count(*) from events)::int as events, (select count(*) from events where kind='undo')::int as undos, (select count(*) from events where kind='view_sensitive')::int as views`) as unknown as [Record<string, number>];
  const byCode = await db.select({ code: s.issues.code, open: sql<number>`sum(case when status='open' then 1 else 0 end)::int`, total: sql<number>`count(*)::int` }).from(s.issues).groupBy(s.issues.code).orderBy(sql`count(*) desc`);
  const never = [
    "Change a return value without an event that says who, when, why, and the tax effect. The database rejects UPDATE and DELETE on the event log.",
    "Show a Social Security number, bank account or IP PIN to anyone until a cleared user unmasks it, and that unmask is itself an event in the view log.",
    "Let someone approve or sign off on work they recorded themselves.",
    "Freeze the return while a required step is red, or change it after the freeze without an amendment.",
    "Recompute the return. Tax effects are Δ × the engine's per-dollar rate and are labelled as estimates.",
    "Import a packet that fails validation; a bad file rolls back and the previous contents stay.",
  ];
  return (
    <Shell path="/why-trust-this">
      <PageHeader crumbs={[{ href: "/", label: "Inbox" }, { label: "Why trust this" }]} title="Why trust this workpaper" meta="The identity of the data, the invariants the code enforces, and the counts you can check yourself." />
      <Section title="The packet, as delivered">
        <div className="card p-4 grid grid-cols-2 gap-4 text-sm">
          <div><div className="text-fg-3 text-xs">SHA-256 of data/packet.json</div><div className="mono text-xs break-all mt-1">{packetSha}</div></div>
          <div className="grid grid-cols-3 gap-3">{([["Documents", counts.docs, 74], ["Pages", counts.pages, 199], ["Extracted values", counts.values, 3012], ["Return lines (3 versions)", counts.lines, 1877], ["Issues from rules + diagnostics", counts.issues, 101], ["Events on the log", counts.events, null]] as [string, number, number | null][]).map(([k, v, want]) => <div key={k}><div className="text-fg-3 text-xs">{k}</div><div className="num text-lg">{Number(v).toLocaleString()}</div>{want !== null && <div className={`text-xs ${v === want ? "text-ok" : "text-bad"}`}>{v === want ? "matches the packet" : `expected ${want}`}</div>}</div>)}</div>
        </div>
      </Section>
      <Section title="What this app will never do">
        <ol className="card p-4 text-sm space-y-2 list-decimal list-inside">{never.map((n) => <li key={n} className="prose-max">{n}</li>)}</ol>
      </Section>
      <Section title="Independent checks on this packet" aside={<span>{byCode.length} rule codes · {counts.undos} undos and {counts.views} logged unmasks on the event log</span>}>
        <div className="card overflow-hidden"><table className="ledger text-sm"><thead><tr><th>Rule</th><th className="r">Findings</th><th className="r">Still open</th></tr></thead><tbody>{byCode.map((r) => <tr key={r.code}><td>{CHECK_LABELS[r.code ?? ""] ?? r.code} <span className="mono text-fg-4 text-xs">{r.code}</span></td><td className="r num">{r.total}</td><td className="r num">{r.open}</td></tr>)}</tbody></table></div>
      </Section>
      <Section title="Check it yourself">
        <div className="card p-4 text-sm prose-max"><p><span className="mono">GET /api/health</span> returns the database state, the event count and this packet hash. <span className="mono">npm run verify:packet</span> asserts 25 structural facts about the file; <span className="mono">npm run verify:errors</span> re-derives every figure in the error log from it; <span className="mono">npm test</span> and <span className="mono">npm run test:e2e</span> cover the rules, the event-derived state, the role matrix, masking, and the six user flows.</p></div>
      </Section>
    </Shell>
  );
}
