import Link from "next/link";
import { Shell } from "@/components/shell";
import { Money, Section, Tag } from "@/components/ui";
import { db, schema as s } from "@/db";
import { claims, versionLines } from "@/lib/state";

export default async function Versions({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const sp = await searchParams;
  const vs = await db.select().from(s.returnVersions).orderBy(s.returnVersions.version);
  const snaps = await db.select().from(s.snapshots).orderBy(s.snapshots.id);
  const a = sp.a ?? "v2", b = sp.b ?? "current";
  async function valuesOf(v: string): Promise<Map<string, unknown>> {
    if (v === "current") return new Map([...(await claims()).values()].map((c) => [c.key, c.current]));
    if (v.startsWith("snap:")) { const sn = snaps.find((x) => x.id === Number(v.slice(5))); return new Map(Object.entries((sn?.lines as any) ?? {})); }
    return new Map((await versionLines(v)).map((l) => [l.key, l.value]));
  }
  const [va, vb, labels] = await Promise.all([valuesOf(a), valuesOf(b), versionLines("v3")]);
  const lab = new Map(labels.map((l) => [l.key, l.label]));
  const keys = [...new Set([...va.keys(), ...vb.keys()])].filter((k) => JSON.stringify(va.get(k)) !== JSON.stringify(vb.get(k)));
  const opts = [...vs.map((v) => v.version), "current", ...snaps.map((x) => `snap:${x.id}`)];
  return (
    <Shell path="/versions">
      <h1 className="mb-1">Versions</h1>
      <p className="text-fg-3 text-sm mb-4">Three engine runs, the current workpaper state, and sealed snapshots. Compare any two.</p>
      <div className="grid grid-cols-3 gap-3 mb-5">{vs.map((v) => <div key={v.version} className="card p-3 text-sm"><div className="font-medium">{v.version} <span className="text-fg-3 text-xs">{v.computedAt.toISOString().slice(0, 10)}</span></div><div className="text-fg-2 text-xs">{v.trigger}</div><div className="num mt-1">fed due <Money v={(v.summary as any).federal.balance_due} /> · CA <Money v={(v.summary as any).california.balance_due} /></div><div className="text-fg-3 text-xs">{v.documentsUsed.length} docs · {(v.changesFromPrevious as any[]).length} lines changed · {v.diagnostics.length} diagnostics</div></div>)}
        {snaps.map((x) => <div key={x.id} className="card p-3 text-sm"><div className="font-medium">{x.kind}: {x.label} <Tag kind="engine">sealed {x.hash}</Tag></div><div className="text-fg-3 text-xs">{x.createdBy} · {x.createdAt.toISOString().slice(0, 10)} · at event #{x.atEventId}</div><div className="num mt-1">fed due <Money v={(x.summary as any).federal.balance_due} /> · CA <Money v={(x.summary as any).california.balance_due} /></div></div>)}
      </div>
      <form className="flex gap-2 items-center mb-3 text-sm"><span>Compare</span><select name="a" defaultValue={a}>{opts.map((o) => <option key={o}>{o}</option>)}</select><span>with</span><select name="b" defaultValue={b}>{opts.map((o) => <option key={o}>{o}</option>)}</select><button className="btn">Compare</button></form>
      <Section title={`${keys.length} lines differ between ${a} and ${b}`}>
        <div className="card overflow-hidden"><table className="ledger text-xs"><thead><tr><th>Line</th><th>Label</th><th className="text-right">{a}</th><th className="text-right">{b}</th><th className="text-right">Δ</th></tr></thead>
          <tbody>{keys.map((k) => { const x = va.get(k), y = vb.get(k); const d = typeof x === "number" && typeof y === "number" ? y - x : null; return <tr key={k}><td className="num"><Link href={`/lines/${encodeURIComponent(k)}`} className="link">{k}</Link></td><td>{lab.get(k)}</td><td className="text-right"><Money v={x} /></td><td className="text-right"><Money v={y} /></td><td className="text-right">{d !== null ? <Money v={d} signed /> : ""}</td></tr>; })}</tbody></table></div>
      </Section>
    </Shell>
  );
}
