import { Shell } from "@/components/shell";
import { Money, Ref, Section } from "@/components/ui";
import { section, versionLines, claims } from "@/lib/state";

export default async function PriorYear() {
  const [prior, lines, cm] = await Promise.all([section("prior_years"), versionLines(), claims()]);
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const r = prior.return_2024;
  const wp = prior.prior_preparer_workpaper;
  return (
    <Shell path="/prior-year">
      <h1 className="mb-1">Prior year: what Delta River did vs what we changed</h1>
      <p className="text-fg-3 text-sm mb-4">2024 return prepared by {r.prepared_by}, filed {r.filed}. Every 2024 line with a 2025 counterpart is linked.</p>
      <Section title="Prior preparer's notes and open items (D07)">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="card p-3"><div className="font-medium mb-1">Summary memo</div><p className="text-fg-2">{wp.summary_memo}</p><div className="font-medium mt-2 mb-1">Notes</div><ul className="list-disc pl-5">{wp.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul></div>
          <div className="card p-3"><div className="font-medium mb-1">Open items left</div><ul className="list-disc pl-5">{wp.open_items_left_by_prior_preparer.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul><div className="font-medium mt-2 mb-1">Our notes from the 2024 return</div><ul className="list-disc pl-5">{Object.entries(r.notes ?? {}).map(([k, v]) => <li key={k}><Ref r={`line:${k}`} /> {String(v)}</li>)}</ul></div>
        </div>
      </Section>
      <Section title="Basis by year">
        <div className="grid grid-cols-2 gap-4 text-xs">
          {Object.entries(prior.basis_records).map(([k, rows]) => {
            const TITLES: Record<string, string> = { scorp_lindqvist_family_woodworks: "S corporation · Lindqvist Family Woodworks", partnership_ridgeline: "Partnership · Ridgeline Real Estate Fund III", ira_nondeductible_basis_ngozi: "IRA nondeductible basis · Ngozi (Form 8606)", home_7709_barton_ridge: "Home · 7709 Barton Ridge Dr, Austin" };
            const FIELDS: Record<string, string> = { ending_stock_basis: "Ending stock basis", ending_capital_account: "Ending capital account", outside_basis: "Outside basis", form_8606_line_14: "Form 8606 line 14", price: "Purchase price", k1_income: "K-1 income", distributions: "Distributions" };
            return <div key={k} className="card p-3"><div className="font-medium mb-2">{TITLES[k] ?? k.replace(/_/g, " ")}</div><table className="ledger text-xs"><thead><tr><th>Year / event</th><th>Item</th><th className="r">Amount</th><th>Source</th></tr></thead><tbody>{(rows as any[]).flatMap((x, i) => Object.entries(x).filter(([kk]) => !["year", "event", "source"].includes(kk)).map(([kk, v], j) => <tr key={`${i}-${j}`}>{j === 0 ? <td className="num" rowSpan={Object.keys(x).filter((kk) => !["year", "event", "source"].includes(kk)).length}>{x.year ?? x.event}</td> : null}<td>{FIELDS[kk] ?? kk.replace(/_/g, " ")}</td><td className="r">{v == null ? <span className="text-fg-4">not computed</span> : <Money v={v as number} />}</td>{j === 0 ? <td className="text-fg-3" rowSpan={Object.keys(x).filter((kk) => !["year", "event", "source"].includes(kk)).length}>{x.source}</td> : null}</tr>))}</tbody></table></div>;
          })}
          <div className="card p-3"><div className="font-medium mb-1">S-corp basis roll-forward (ours, with D40)</div><div className="card overflow-hidden"><table className="ledger"><tbody><tr><td>2022 end</td><td className="num text-right">21,300</td><td className="text-fg-3">client worksheet (D07 p5)</td></tr><tr><td>2023 +14,100 −20,000</td><td className="num text-right">15,400</td><td className="text-fg-3"><Ref r="doc:D40" /></td></tr><tr><td>2024 +16,900 −30,000</td><td className="num text-right">2,300</td><td className="text-fg-3"><Ref r="doc:D06#p8" /></td></tr><tr><td>2025 +18,485 −42,000</td><td className="num text-right">0 (excess 21,215 → LT gain)</td><td className="text-fg-3"><Ref r="line:F7203.excess" /></td></tr></tbody></table></div></div>
        </div>
      </Section>
      <Section title="Carryovers into 2025 (agree to prior year)">
        <div className="card overflow-hidden"><table className="ledger text-sm"><thead><tr><th>Item</th><th className="text-right">Prior preparer</th><th>Used on</th></tr></thead><tbody>
          {Object.entries(prior.carryovers_into_2025).filter(([k, v]) => typeof v === "number").map(([k, v]) => { const used = lines.find((l) => l.sources.some((s) => s.includes(`carryovers_into_2025/${k}`))); return <tr key={k}><td>{k.replace(/_/g, " ")}</td><td className="text-right"><Money v={v as number} /></td><td>{used ? <><Ref r={`line:${used.key}`} /> <Money v={used.value} /></> : <span className="text-fg-3">—</span>}</td></tr>; })}
        </tbody></table></div>
      </Section>
      <Section title="2024 lines vs 2025">
        <div className="card overflow-hidden"><table className="ledger text-xs"><thead><tr><th>Line</th><th>Label</th><th className="text-right">2024</th><th className="text-right">2025 engine</th><th className="text-right">2025 current</th></tr></thead>
          <tbody>{Object.entries(r.lines as Record<string, number>).map(([k, v]) => { const l = byKey.get(k); const c = cm.get(k); return <tr key={k} id={k.replace(/[^A-Za-z0-9]/g, "_")}><td className="num">{l ? <Ref r={`line:${k}`} /> : k}</td><td>{(r.line_labels as any)[k] ?? l?.label}</td><td className="text-right"><Money v={v} /></td><td className="text-right">{l ? <Money v={l.value} /> : <span className="text-fg-3">n/a</span>}</td><td className="text-right">{c && c.origin !== "engine" ? <strong><Money v={c.current} /></strong> : ""}</td></tr>; })}</tbody></table></div>
      </Section>
    </Shell>
  );
}
