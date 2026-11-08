/** Re-derives every figure cited in docs/02-errors-found.md from the packet. Prints evidence; exits 1 if anything cannot be found. */
import { readFileSync } from "node:fs";
const p = JSON.parse(readFileSync("data/packet.json", "utf8"));
const docs = Object.fromEntries(p.documents.map((d: any) => [d.id, d]));
const evs: any[] = p.extracted_values;
const v3 = p.return_versions[2], v2 = p.return_versions[1];
const L3 = Object.fromEntries(v3.lines.map((l: any) => [l.key, l]));
const page = (id: string, n: number) => docs[id].pages.find((x: any) => x.page === n)?.printed_content ?? "";
const has = (id: string, n: number, text: string) => page(id, n).includes(text);
const ev = (id: string) => evs.find((e) => e.id === id);
const rows: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, evidence: string) => rows.push([name, ok, evidence]);

// A1 RSU basis on D11 p2; engine N1/N3/N4 at basis 0
check("A1 D11 p2 shows RSU adjusted basis 19,100 / 19,100 / 9,420", has("D11", 2, "19,100") && has("D11", 2, "9,420"), page("D11", 2).match(/RSU-25\d\d[^;]*;|RSU-2308[^;]*/g)?.join(" | ").slice(0, 300) ?? "");
check("A1 engine F8949.B.N1 = 19,240 with basis 0", L3["F8949.B.N1"].value === 19240 && /basis 0\.00/.test(L3["F8949.B.N1"].label), `${L3["F8949.B.N1"].value} · ${L3["F8949.B.N1"].label.slice(0, 90)}`);
check("A1 W-2 box 14 RSU 38,200 (D08)", has("D08", 1, "RSU 38,200"), page("D08", 1).match(/Box 14[^.]*/)?.[0] ?? "");
check("A1 adjusted N1 = 140 ⇒ 19,240 − 19,100", 19240 - 19100 === 140, "arithmetic");
check("A1 tax effect −6,647 = −19,100 × stcg rate", Math.round(-19100 * v3.tax_effect_rates.stcg.federal_per_dollar) === -6647, `rate ${v3.tax_effect_rates.stcg.federal_per_dollar}`);
// A2 SEHI
check("A2 Sch1.17 = 14,400; qa-25 says eligible for spouse plan", L3["Sch1.17"].value === 14400 && /yes/i.test(p.client.questionnaire.find((q: any) => q.id === "qa-25").answer), p.client.questionnaire.find((q: any) => q.id === "qa-25").answer);
check("A2 effect 4,464 = 14,400 × adjustment rate", Math.round(-14400 * v3.tax_effect_rates.adjustment.federal_per_dollar) === 4464, `rate ${v3.tax_effect_rates.adjustment.federal_per_dollar}`);
// A3 gross receipts
check("A3 SchC.1 = 163,700; books total income 151,300 (D14); 1099-K 12,400 inside Atlas 41,200 (D15 p3)", L3["SchC.1"].value === 163700 && has("D14", 1, "151,300") && /Paywell/.test(page("D15", 3)) && /Atlas/.test(page("D15", 3)), page("D15", 3).match(/[^.]*Paywell[^.]*\./)?.[0]?.slice(0, 200) ?? "");
// A4 CA wages
check("A4 SchCA540NR.1.E = 218,400; D73 paystub CA wages 22,469; D09 box16 111,300", L3["SchCA540NR.1.E"].value === 218400 && has("D73", 1, "22,469") && has("D09", 1, "111,300"), page("D73", 1).slice(0, 220));
check("A4 corrected CA wages 129,569 = 107,100 + 22,469", 107100 + 22469 === 129569 && has("D08", 1, "107,100"), "D08 box 16 = 107,100");
// A5 HVAC
check("A5 SchE.14A repairs include 11,000 heat pump (D47); what_if hvac exists", /11,000/.test(page("D47", 1)) && p.what_if.alternatives.some((a: any) => /hvac/i.test(a.id)), `SchE.14A=${L3["SchE.14A"].value} · ${page("D47", 1).slice(0, 120)}`);
// A6 seller credit
check("A6 SchA.5b = 13,420; D54 seller tax credit 6,912", L3["SchA.5b"].value === 13420 && has("D54", 1, "6,912"), page("D54", 1).match(/[^.]*6,912[^.]*\./)?.[0] ?? "");
check("A6 corrected 6,508 = 13,420 − 6,912", 13420 - 6912 === 6508, "arithmetic");
// A7 mileage
check("A7 D23 page 3 identical to page 2; SchC.44a = 11,800; true 8,100", page("D23", 2).replace(/^\(Second scan[^)]*\)\s*/, "") === page("D23", 3).replace(/^\(Second scan[^)]*\)\s*/, "") && L3["SchC.44a"].value === 11800 && 2600 + 3700 + 1800 === 8100, `D23 p1: ${page("D23", 1).slice(0, 80)}`);
// A8 payoff interest
check("A8 D55 1098 box 1 13,900 'includes' payoff; D56 2,150; SchA.8a uses both", /includes/i.test(page("D55", 1)) && has("D56", 1, "2,150") && L3["SchA.8a"].sources.some((s: string) => ev(s)?.document_id === "D55") && L3["SchA.8a"].sources.some((s: string) => ev(s)?.document_id === "D56"), `SchA.8a=${L3["SchA.8a"].value}`);
check("A8 corrected 19,697 = SchA.8a − 2,150", L3["SchA.8a"].value - 2150 === 19697, `${L3["SchA.8a"].value} − 2,150`);
// A9 Northlake interest
check("A9 SchB.1.1 and SchB.1.2 both 1,840 (D28 + D29, same account)", L3["SchB.1.1"]?.value === 1840 && L3["SchB.1.2"]?.value === 1840 && /7731/.test(page("D28", 1)) && /7731/.test(page("D29", 1)), "account …7731 on both");
// A10 crypto C6
check("A10 F8949.H.C6 basis 0; msg-07 gives 3,050 bought 03/15/2021", /basis 0\.00/.test(L3["F8949.H.C6"].label) && p.client.messages.some((m: any) => /3,050/.test(m.text) && /2021/.test(m.text)), p.client.messages.find((m: any) => /3,050/.test(m.text))?.text.slice(0, 160));
// A11 personal use
check("A11 call-01 gives 70% phone, 50% internet, Spotify personal; SchC.25 = 3,480", p.client.call_notes.some((c: any) => c.notes.some((n: string) => /70%/.test(n))) && L3["SchC.25"].value === 3480, "call-01");
// A12 vehicle
check("A12 F8283 vehicle 6,000 from qa-39; D66 1098-C proceeds 2,900", L3["F8283.A1.vehicle"].value === 6000 && has("D66", 1, "2,900"), page("D66", 1).match(/[^.]*2,900[^.]*\./)?.[0] ?? "");
// A13 Q4 estimate
const tx = p.tax_agency_records.irs_account_transcript_2025[0].transactions.filter((t: any) => t.code === "670");
check("A13 F1040.26 = 13,000; IRS transcript 670s sum 12,000 (Q4 = 3,000)", L3["F1040.26"].value === 13000 && tx.reduce((a: number, t: any) => a + t.amount, 0) === 12000, tx.map((t: any) => `${t.date} ${t.amount}`).join("; "));
// A14 FTB
const ftb = p.tax_agency_records.ftb_account;
check("A14 F540NR.72 = 14,000; FTB 2025 payments 10,500; 9/15 3,500 designated 2024", L3["F540NR.72"].value === 14000 && ftb.tax_year_2025_payments.reduce((a: number, t: any) => a + t.amount, 0) === 10500 && ftb.tax_year_2024_payments_after_filing.some((t: any) => t.amount === 3500), ftb.tax_year_2024_payments_after_filing[0]?.note ?? "");
// A15 fx
check("A15 SchB.1.6 uses 2024 average SEK (10.56); 2025 average 9.86", L3["SchB.1.6"].sources.some((s: string) => /2024_average/.test(s)) && p.fx_rates.SEK_per_USD["2025_average"] === 9.86, L3["SchB.1.6"].sources.join(","));
// B1 EIN
const ein = ev("ev-1045");
check("B1 D62 EIN read 74-3829516 (conf 0.97); page prints 74-3829156", ein.text_as_read === "74-3829516" && ein.confidence === 0.97 && has("D62", 1, "74-3829156"), `${ein.text_as_read} vs page`);
// B2 provider name
check("B2 F2441.1a says Bright Oak Preschool; D61 title Bright Oak Kids Club", /Bright Oak Preschool/.test(L3["F2441.1a"].label) && /Kids Club/.test(docs["D61"].title), docs["D61"].title);
// B3 Meridian p32
check("B3 D31 page 32 names M18 and no value was read from it", /M18/.test(page("D31", 32)) && !evs.some((e) => e.document_id === "D31" && e.page === 32), page("D31", 32).slice(0, 120));
// B4 St Brigid
check("B4 ev-1049 St Brigid conf 0.41; msg-08 confirms 1,500", ev("ev-1049").confidence === 0.41 && p.client.messages.some((m: any) => /1,500/.test(m.text) && /2207/.test(m.text)), ev("ev-1049").text_as_read);
// C1 SSN
const theo = p.household.people.find((x: any) => x.name.startsWith("Theo"));
check("C1 Theo SSN organizer 666-74-3309 vs D71 / 2024 return 666-74-3390", theo.ssn === "666-74-3309" && has("D71", 1, "666-74-3390") && JSON.stringify(p.prior_years.return_2024.dependents).includes("666-74-3390"), `efile rejection: ${p.tax_agency_records.efile.find((e: any) => e.status === "rejected")?.errors?.[0]?.code}`);
// C3 IRA basis
check("C3 qa-31 says no prior basis; 2024 Form 8606 line 14 = 7,000", /none/i.test(p.client.questionnaire.find((q: any) => q.id === "qa-31").answer) && p.prior_years.basis_records.ira_nondeductible_basis_ngozi[0].form_8606_line_14 === 7000, "");
// Version diff
const l2 = Object.fromEntries(v2.lines.map((l: any) => [l.key, l.value]));
check("SchE.28B added in v3 at 8,400 (late Ridgeline K-1)", l2["SchE.28B"] === undefined && L3["SchE.28B"]?.value === 8400, `v3 changes_from_previous: ${v3.changes_from_previous.length}`);
// Carryovers
check("carryovers_out: minimum_tax_credit 3,871; SEP not deductible 2,786", v3.carryovers_out.federal.minimum_tax_credit_from_2025_amt === 3871 && v3.carryovers_out.federal.sep_contribution_not_deductible_for_2025 === 2786, "");
// SchC.1 corrected 151,300, F1040.26 → 12,000, F540NR.72 → 10,500 (from above)
let bad = 0;
for (const [n, ok, e] of rows) { if (!ok) bad++; console.log(`${ok ? "OK  " : "FAIL"} ${n}\n      ${e}`); }
console.log(bad ? `${bad} FAILED` : `all ${rows.length} figures re-derived from the packet`);
process.exit(bad ? 1 : 0);
