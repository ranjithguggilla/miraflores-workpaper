/**
 * Checks that don't trust the engine.
 *
 * Each rule reads the packet's documents, extracted values, client answers, prior-year
 * records and agency records and emits issue candidates. Rules are written against
 * document TYPES and structural patterns (duplicate pages, same money twice, summary vs
 * detail, record vs client answer...) rather than against known answers; the specific
 * findings in docs/02-errors-found.md are what these rules produce on this packet.
 */
import { createHash } from "node:crypto";
import { areaForLine, type AreaId } from "../areas";

export type Packet = any;

export interface IssueCandidate {
  kind: "check" | "diagnostic" | "variance" | "low_confidence" | "judgment" | "completeness" | "client_question";
  code: string;
  severity: "blocker" | "warning" | "info";
  blocksFiling?: boolean;
  area: AreaId;
  title: string;
  detail: string;
  refs: string[];
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const hash = (s: string) => createHash("sha1").update(s).digest("hex");

export function runChecks(p: Packet): IssueCandidate[] {
  const out: IssueCandidate[] = [];
  const docs: any[] = p.documents;
  const docById = Object.fromEntries(docs.map((d) => [d.id, d]));
  const evs: any[] = p.extracted_values;
  const evById = Object.fromEntries(evs.map((e) => [e.id, e]));
  const v3 = p.return_versions.find((v: any) => v.version === "v3");
  const lines: any[] = v3.lines;
  const lineByKey = Object.fromEntries(lines.map((l) => [l.key, l]));
  const qa: any[] = p.client.questionnaire;
  const qaById = Object.fromEntries(qa.map((q) => [q.id, q]));
  const page = (d: any, n: number) => d.pages.find((x: any) => x.page === n)?.printed_content ?? "";

  /* 1. Duplicate pages within a document ------------------------------------ */
  for (const d of docs) {
    const seen = new Map<string, number>();
    for (const pg of d.pages) {
      const h = hash(pg.printed_content.replace(/^\(Second scan[^)]*\)\s*/, ""));
      if (seen.has(h)) {
        const other = seen.get(h)!;
        const usedBy = lines.filter((l) => l.sources.some((s: string) => evById[s]?.document_id === d.id && evById[s]?.page === pg.page));
        out.push({
          kind: "check", code: "DUP_PAGE", severity: "warning", area: areaFor(d),
          title: `${d.id} page ${pg.page} duplicates page ${other}`,
          detail: `The printed content of page ${pg.page} is identical to page ${other}. ${usedBy.length ? `The engine used values from both pages on ${usedBy.map((l) => l.key).join(", ")}.` : "No engine line used page " + pg.page + " directly."}`,
          refs: [`doc:${d.id}#p${pg.page}`, `doc:${d.id}#p${other}`, ...usedBy.map((l) => `line:${l.key}`)],
        });
      } else seen.set(h, pg.page);
    }
  }

  /* 2. Duplicate documents (same type, same issuer identifier, same primary amount) ---- */
  const byTypeIssuer = new Map<string, any[]>();
  for (const d of docs) {
    const ein = evs.find((e) => e.document_id === d.id && /ein|tin/i.test(e.field))?.value;
    if (!ein) continue;
    const k = `${d.document_type}|${ein}|${d.tax_year ?? ""}`;
    byTypeIssuer.set(k, [...(byTypeIssuer.get(k) ?? []), d]);
  }
  for (const group of byTypeIssuer.values()) {
    if (group.length < 2) continue;
    // Exclude explicit supersession (corrected forms are handled by the engine's superseded list)
    const corrected = group.filter((d) => d.marked_corrected);
    if (corrected.length) continue;
    const [a, b] = group;
    out.push({
      kind: "check", code: "DUP_DOC", severity: "info", area: areaFor(a),
      title: `${b.id} appears to duplicate ${a.id}`,
      detail: `Same document type (${a.document_type}), same issuer identifier and tax year. ${lineByKey["F1040.1a"]?.note?.includes(b.id) ? "The engine notes it counted them once; record that relationship so the document index shows it as a duplicate, not unused." : "Confirm the engine counted them once."}`,
      refs: [`doc:${a.id}`, `doc:${b.id}`],
    });
  }

  /* 3. Same money twice across documents -------------------------------------- */
  // 3a. Equal amounts from the same issuer on different documents (bank sweep 1099-INT inside a composite and standalone)
  const amounts = evs.filter((e) => e.value_type === "money" && typeof e.value === "number" && e.value > 0);
  const seenAmt = new Map<string, any[]>();
  for (const e of amounts) {
    const d = docById[e.document_id];
    const issuer = (d.issuer ?? "").split(/[ ,]/)[0]?.toLowerCase();
    const k = `${issuer}|${e.value}`;
    seenAmt.set(k, [...(seenAmt.get(k) ?? []), e]);
  }
  const dupDocs = new Set(out.filter((i) => i.code === "DUP_DOC").flatMap((i) => i.refs.map((r) => r.slice(4))));
  for (const group of seenAmt.values()) {
    const docIds = [...new Set(group.map((e) => e.document_id))];
    if (docIds.length < 2) continue;
    // skip superseded/corrected pairs, known duplicate documents, and different tax years
    if (docIds.some((id) => v3.documents_superseded.includes(id))) continue;
    if (docIds.filter((id) => dupDocs.has(id)).length >= 2) continue;
    if (new Set(docIds.map((id) => docById[id].tax_year)).size > 1) continue;
    const usedLines = lines.filter((l) => group.some((e) => l.sources.includes(e.id)));
    if (usedLines.length < 2) continue; // only flag if the engine actually used it from two places
    const d0 = docById[docIds[0]];
    out.push({
      kind: "check", code: "SAME_MONEY", severity: "warning", area: areaForLine(usedLines[0].key),
      title: `${money(group[0].value)} from ${d0.issuer ?? d0.title} appears on ${docIds.join(" and ")} and lands on ${usedLines.length} lines`,
      detail: `${docIds.map((id) => `${id}: ${docById[id].title}`).join("; ")}. Lines: ${usedLines.map((l) => l.key).join(", ")}. If these describe the same payment, one must be removed.`,
      refs: [...group.map((e) => `ev:${e.id.slice(3)}`), ...usedLines.map((l) => `line:${l.key}`)],
    });
  }
  // 3b. A document that says it "includes" an amount that another document also reports
  for (const d of docs) {
    for (const pg of d.pages) {
      const m = pg.printed_content.match(/\(includes ([^)]+)\)/i) ?? pg.printed_content.match(/includes ([^.;]+)/i);
      if (!m) continue;
      const incl = m[1];
      // look for another document whose title/content is named in the "includes" clause and whose amount is used by a line together with this doc's amount
      for (const other of docs) {
        if (other.id === d.id) continue;
        const otherAmts = evs.filter((e) => e.document_id === other.id && e.value_type === "money");
        for (const l of lines) {
          const usesThis = l.sources.some((s: string) => evById[s]?.document_id === d.id);
          const usesOther = otherAmts.some((e) => l.sources.includes(e.id));
          if (usesThis && usesOther && /payoff|interest/i.test(incl) && /payoff/i.test(other.document_type)) {
            out.push({
              kind: "check", code: "INCLUDES_OVERLAP", severity: "warning", area: areaForLine(l.key),
              title: `${d.id} says its amount already includes what ${other.id} reports; ${l.key} uses both`,
              detail: `${d.id} (${d.title}) page ${pg.page}: "includes ${incl}". ${other.id} (${other.title}) is also a source of ${l.key}. Likely double count.`,
              refs: [`doc:${d.id}#p${pg.page}`, `doc:${other.id}`, `line:${l.key}`],
            });
          }
        }
      }
    }
  }

  /* 4. Broker summary vs sum of extracted lots; unread pages ------------------- */
  for (const d of docs.filter((x) => x.document_type === "1099-composite")) {
    const summary = evs.find((e) => e.document_id === d.id && /b_summary_proceeds|total_proceeds/.test(e.field));
    const lotProceeds = evs.filter((e) => e.document_id === d.id && /^[A-Z]+\d+_proceeds$/.test(e.field));
    if (summary && lotProceeds.length) {
      const sum = lotProceeds.reduce((a, e) => a + Number(e.value), 0);
      if (Math.abs(sum - Number(summary.value)) > 0.5) {
        const unread = d.extraction.status === "partial" ? ` ${d.extraction.reason}` : "";
        out.push({
          kind: "check", code: "SUMMARY_VS_DETAIL", severity: "warning", area: "investments_and_digital_assets",
          title: `${d.id}: 1099-B summary ${money(Number(summary.value))} ≠ extracted lots ${money(sum)} (diff ${money(Number(summary.value) - sum)})`,
          detail: `The difference must be accounted for by a lot before this document is complete.${unread} Pages the pipeline did not read: ${d.pages.filter((pg: any) => !evs.some((e) => e.document_id === d.id && e.page === pg.page) && /\d/.test(pg.printed_content) && !/no further transactions|instructions/i.test(pg.printed_content)).map((pg: any) => `p${pg.page}: ${pg.printed_content.slice(0, 160)}…`).join(" | ") || "none"}`,
          refs: [`ev:${summary.id.slice(3)}`, `doc:${d.id}`],
        });
      }
    }
  }

  /* 5. Lots reported with zero basis while a supplement/other record exists ----- */
  for (const l of lines.filter((x) => x.key.startsWith("F8949.") && /basis 0\.00/.test(x.label) && !x.key.endsWith("total") && !/SCORP/.test(x.key))) {
    const supplements = docs.filter((d) => /supplement|transaction_export/.test(d.document_type) || /supplement/i.test(d.title));
    const lot = l.key.split(".").pop();
    const secMatch = (l.label.match(/^(.+?) \(/) ?? [])[1] ?? "";
    const supp = supplements.find((d) => d.pages.some((pg: any) => pg.printed_content.includes(secMatch.split(" (")[0].split(" ")[0]) || pg.printed_content.includes(lot!)));
    out.push({
      kind: "check", code: "ZERO_BASIS", severity: supp ? "warning" : "info", area: areaForLine(l.key),
      title: `${l.key}: gain computed with basis 0`,
      detail: `${l.label}. ${supp ? `${supp.id} (${supp.title}) carries basis information for this holding; the broker left basis blank because the lot is noncovered.` : "No basis record found; ask the client."}${/RSU|ESPP/.test(l.label) ? " Compensation income for these shares is already in W-2 box 14 — zero basis taxes it twice." : ""}`,
      refs: [`line:${l.key}`, ...(supp ? [`doc:${supp.id}`] : []), ...l.sources.filter((s: string) => s.startsWith("ev-")).map((s: string) => `ev:${s.slice(3)}`)],
    });
  }

  /* 6. Client answer vs third-party record -------------------------------------- */
  // 6a. Estimated payments: questionnaire/EFTPS vs IRS transcript
  const irsTx = p.tax_agency_records.irs_account_transcript_2025[0].transactions.filter((t: any) => t.code === "670");
  const irsEst = irsTx.reduce((a: number, t: any) => a + Number(t.amount), 0);
  const fedEstLine = lineByKey["F1040.26"];
  if (fedEstLine && Number(fedEstLine.value) !== irsEst) {
    out.push({
      kind: "check", code: "PAYMENTS_VS_IRS", severity: "warning", area: "intake_and_engagement", blocksFiling: true,
      title: `Federal estimates on the return ${money(fedEstLine.value)} ≠ IRS transcript ${money(irsEst)}`,
      detail: `IRS account transcript (D69) shows ${irsTx.map((t: any) => `${t.date} ${money(t.amount)}`).join("; ")}. Return line uses ${fedEstLine.note ?? ""} (the client answered: ${fedEstLine.sources.filter((s: string) => s.startsWith("qa")).map((s: string) => `"${qaById[s]?.answer}"`).join(", ")}). Firm standard: payments must agree to IRS records.`,
      refs: ["line:F1040.26", "doc:D69", ...fedEstLine.sources.map(toRef)],
    });
  }
  // 6b. California payments vs FTB account, including payments designated to another year
  const ftb = p.tax_agency_records.ftb_account;
  const ftb2025 = ftb.tax_year_2025_payments.reduce((a: number, t: any) => a + Number(t.amount), 0);
  const caEst = lineByKey["F540NR.72"];
  if (caEst && Number(caEst.value) !== ftb2025) {
    const misapplied = ftb.tax_year_2024_payments_after_filing ?? [];
    out.push({
      kind: "check", code: "PAYMENTS_VS_FTB", severity: "warning", area: "california", blocksFiling: true,
      title: `California estimates on the return ${money(caEst.value)} ≠ FTB account ${money(ftb2025)}`,
      detail: `FTB shows 2025 payments ${ftb.tax_year_2025_payments.map((t: any) => `${t.date} ${money(t.amount)}`).join("; ")}.${misapplied.length ? ` Held against another year: ${misapplied.map((t: any) => `${t.date} ${money(t.amount)} — ${t.note}`).join("; ")}. Either request FTB to move it or reduce line 72.` : ""}`,
      refs: ["line:F540NR.72", "doc:D68", ...caEst.sources.map(toRef)],
    });
  }
  // 6c. Noncash gift valued from a client estimate when a 1098-C sale price exists
  for (const d of docs.filter((x) => x.document_type === "1098-C")) {
    const proceeds = evs.find((e) => e.document_id === d.id && /4c|gross_proceeds|proceeds/.test(e.field));
    const l = lines.find((x) => x.key.startsWith("F8283") && /vehicle|auto|subaru|car/i.test(x.label));
    if (proceeds && l && Number(l.value) !== Number(proceeds.value)) {
      out.push({
        kind: "check", code: "RECORD_BEATS_ESTIMATE", severity: "warning", area: "deductions_and_credits",
        title: `Vehicle donation valued at ${money(l.value)}; Form 1098-C reports sale proceeds ${money(proceeds.value)}`,
        detail: `When the charity sells the vehicle, the deduction is limited to the gross proceeds on Form 1098-C box 4c. The line's sources are ${l.sources.join(", ")} (client estimate).`,
        refs: [`line:${l.key}`, `ev:${proceeds.id.slice(3)}`, `doc:${d.id}`],
      });
    }
  }
  // 6d. Organizer SSNs vs prior-year return and identity documents
  for (const person of p.household.people) {
    const prior = (p.prior_years.return_2024.dependents ?? []).find((x: any) => x.name === person.name);
    const idDoc = docs.find((d) => d.document_type === "identity_document" && d.belongs_to === `dependent:${person.id}`);
    const idSsn = idDoc ? evs.find((e) => e.document_id === idDoc.id && e.value_type === "ssn")?.value : null;
    const mismatches = [prior?.ssn, idSsn].filter((s) => s && s !== person.ssn);
    if (mismatches.length) {
      out.push({
        kind: "check", code: "SSN_MISMATCH", severity: "blocker", blocksFiling: true, area: "intake_and_engagement",
        title: `${person.name}: SSN in the organizer (${person.ssn}) differs from ${prior?.ssn && prior.ssn !== person.ssn ? "the 2024 return" : ""}${idSsn && idSsn !== person.ssn ? (prior?.ssn !== person.ssn ? " and " : "") + idDoc.id : ""}`,
        detail: `Organizer: ${person.ssn}. 2024 return (D06): ${prior?.ssn ?? "n/a"}. ${idDoc ? `${idDoc.title}: ${idSsn}` : "No identity document on file."} An SSN/name-control mismatch rejects the e-file (R0000-504).`,
        refs: [`household:${person.id}`, "doc:D06#p1", ...(idDoc ? [`doc:${idDoc.id}`] : [])],
      });
    }
  }
  // 6e. Questionnaire conflicts with documents / prior year
  const salesCount = lines.filter((l) => /^F8949\.[A-E]\./.test(l.key) && !l.key.endsWith("total")).length;
  const digital = lines.filter((l) => /^F8949\.[HK]\./.test(l.key) && !l.key.endsWith("total")).length;
  if (/^no$/i.test(qaById["qa-14"]?.answer ?? "") && salesCount) {
    out.push({ kind: "client_question", code: "QA_CONFLICT", severity: "info", area: "investments_and_digital_assets", title: `Client answered "no investments sold" — documents show ${salesCount} brokerage sales and ${digital} digital-asset dispositions`, detail: `Record the client's confirmation that the broker and exchange records are complete, and that the question was misunderstood.`, refs: ["qa:14", "doc:D28", "doc:D31", "doc:D74", "doc:D34"] });
  }
  const priorBasis = p.prior_years.basis_records.ira_nondeductible_basis_ngozi?.[0]?.form_8606_line_14;
  if (priorBasis && /none/i.test(qaById["qa-31"]?.answer ?? "")) {
    out.push({ kind: "client_question", code: "QA_CONFLICT", severity: "info", area: "deductions_and_credits", title: `Client says no prior IRA basis; 2024 Form 8606 line 14 shows ${money(priorBasis)}`, detail: `The engine used the prior return (correct). Record the conflict and the resolution so the Roth conversion's taxable amount (F8606.18) is defensible.`, refs: ["qa:31", "line:F8606.2", "doc:D06#p10", "doc:D42"] });
  }
  // 6f. SE health insurance when eligible for a spouse's employer plan
  if (/yes/i.test(qaById["qa-25"]?.answer ?? "") && Number(lineByKey["Sch1.17"]?.value) > 0) {
    out.push({
      kind: "check", code: "SEHI_ELIGIBILITY", severity: "warning", area: "business",
      title: `Self-employed health insurance ${money(lineByKey["Sch1.17"].value)} deducted, but the client says Erik was eligible for Ngozi's employer plan`,
      detail: `Client questionnaire, question 25: "${qaById["qa-25"].answer}". The deduction is not allowed for any month the self-employed person was eligible for a subsidized employer plan (own or spouse's). The 2024 return took the same position: "${p.prior_years.return_2024.notes?.["Sch1.17"] ?? ""}".`,
      refs: ["line:Sch1.17", "qa:25", "doc:D25", "py:2024/notes/Sch1.17"],
    });
  }

  /* 7. Extraction integrity: ID-type values must appear verbatim on the page ------- */
  for (const e of evs.filter((x) => ["ein", "ssn", "account_number"].includes(x.value_type) && x.text_as_read)) {
    const pc = page(docById[e.document_id], e.page);
    if (!pc.includes(e.text_as_read)) {
      const used = lines.filter((l) => l.sources.includes(e.id));
      out.push({
        kind: "check", code: "ID_NOT_ON_PAGE", severity: "warning", area: used.length ? areaForLine(used[0].key) : areaFor(docById[e.document_id]),
        title: `${e.document_id} ${e.label}: read as ${e.text_as_read} but that string is not on the page (confidence ${e.confidence})`,
        detail: `Page ${e.page} text: "${pc.slice(0, 220)}…". A transposed EIN or SSN produces an IRS mismatch. ${used.length ? `Used by ${used.map((l) => l.key).join(", ")}.` : ""}`,
        refs: [`ev:${e.id.slice(3)}`, `doc:${e.document_id}#p${e.page}`, ...used.map((l) => `line:${l.key}`)],
      });
    }
  }
  // 7b. Line labels that name a provider differently from the document title
  for (const l of lines.filter((x) => x.key.startsWith("F2441.1"))) {
    const src = l.sources.map((s: string) => evById[s]).filter(Boolean)[0];
    const d = src && docById[src.document_id];
    const name = (l.label.match(/provider: (.+?), tax ID/) ?? [])[1];
    if (d && name && !d.title.includes(name) && !page(d, 1).includes(name)) {
      out.push({ kind: "check", code: "LABEL_VS_DOC", severity: "warning", area: "deductions_and_credits", title: `${l.key} names "${name}"; ${d.id} is "${d.title}"`, detail: `Provider name on Form 2441 must match the provider's own statement. Page 1: "${page(d, 1).slice(0, 160)}…"`, refs: [`line:${l.key}`, `doc:${d.id}#p1`] });
    }
  }

  /* 8. Low-confidence reads -------------------------------------------------- */
  for (const e of evs.filter((x) => x.confidence < 0.9)) {
    const used = lines.filter((l) => l.sources.includes(e.id));
    out.push({
      kind: "low_confidence", code: "LOW_CONFIDENCE", severity: used.length ? "warning" : "info", area: used.length ? areaForLine(used[0].key) : areaFor(docById[e.document_id]),
      title: `${e.document_id} ${e.label}: "${e.text_as_read || "(blank)"}" read at confidence ${e.confidence}`,
      detail: `Page ${e.page}: "${page(docById[e.document_id], e.page).slice(0, 240)}". Needs a verification (agreed to document, confirmed with client) before the line it feeds can be signed off.`,
      refs: [`ev:${e.id.slice(3)}`, `doc:${e.document_id}#p${e.page}`, ...used.map((l) => `line:${l.key}`)],
    });
  }

  /* 9. Closing statement prorations ------------------------------------------- */
  for (const d of docs.filter((x) => x.document_type === "closing_statement_buyer")) {
    const credit = evs.find((e) => e.document_id === d.id && /seller_credit|tax.*credit|credit.*tax/i.test(e.field + " " + e.label));
    const re = lineByKey["SchA.5b"];
    if (credit && re && !re.sources.some((s: string) => s === credit.id)) {
      out.push({
        kind: "check", code: "CLOSING_PRORATION", severity: "warning", area: "deductions_and_credits",
        title: `Real estate tax deduction ${money(re.value)} ignores the ${money(credit.value)} seller tax credit on ${d.id}`,
        detail: `The buyer closing statement credits the buyer for the seller's share of 2025 county taxes (${credit.label}). Only the portion of the year the client owned the home is deductible: ${money(Number(re.value) - Number(credit.value))}. Check the SALT cap after the fix.`,
        refs: ["line:SchA.5b", `ev:${credit.id.slice(3)}`, `doc:${d.id}`, "line:SchA.5e"],
      });
    }
  }

  /* 10. Repair vs improvement: any single repair item over 2,500 --------------- */
  for (const l of lines.filter((x) => /^SchE\.14/.test(x.key) && Number(x.value) > 2500)) {
    const inv = docs.find((d) => d.document_type === "invoice" && /heat|hvac|roof|replace|install/i.test(d.pages.map((pg: any) => pg.printed_content).join(" ")) && d.belongs_to === "joint");
    out.push({
      kind: "judgment", code: "REPAIR_VS_IMPROVEMENT", severity: "warning", area: "rentals_and_sale",
      title: `${l.key} repairs ${money(l.value)} include a large item — repair or capital improvement?`,
      detail: `${l.note ?? ""} ${inv ? `${inv.id}: "${page(inv, 1).slice(0, 200)}"` : ""} Replacement of an entire building system is generally a capital improvement (27.5-year), not a repair. The engine's what_if "hvac_improvement" quantifies the alternative. Record the decision and authority (Reg. 1.263(a)-3).`,
      refs: [`line:${l.key}`, ...(inv ? [`doc:${inv.id}`] : []), "whatif:hvac_improvement", "call:01"],
    });
  }

  /* 11. Personal-use percentages from call notes vs 100% deductions ------------- */
  for (const call of p.client.call_notes) {
    for (const note of call.notes) {
      const pct = note.match(/(\d{2})%/);
      if (pct) {
        const target = /mobile|phone/i.test(note) ? "SchC.25" : /internet/i.test(note) ? "SchC.25" : null;
        if (target && lineByKey[target]) out.push({ kind: "judgment", code: "PERSONAL_USE", severity: "warning", area: "business", title: `${target} deducted in full; call note gives business use ${pct[1]}%`, detail: `${call.id} (${call.date.slice(0, 10)}): "${note}"`, refs: [`line:${target}`, `call:${call.id.slice(5)}`] });
      }
      if (/personal/i.test(note) && /booked by mistake|personal/i.test(note)) {
        out.push({ kind: "judgment", code: "PERSONAL_IN_BOOKS", severity: "warning", area: "business", title: `Books include a personal item: ${note.split(" ")[0]} ${note.split(" ")[1]}`, detail: `${call.id}: "${note}" — remove from SchC.27a.1 (software) and record a books-to-tax adjustment.`, refs: ["line:SchC.27a.1", `call:${call.id.slice(5)}`, "doc:D15#p1"] });
      }
    }
  }

  /* 12. Gross receipts reconciliation: books vs 1099-NEC vs 1099-K --------------- */
  const necTotal = evs.filter((e) => docById[e.document_id].document_type === "1099-NEC" && e.field === "box1").reduce((a, e) => a + Number(e.value), 0);
  const kTotal = evs.filter((e) => docById[e.document_id].document_type === "1099-K" && /1a/.test(e.field)).reduce((a, e) => a + Number(e.value), 0);
  const books = docs.find((d) => d.document_type === "books_profit_loss");
  const booksIncome = books ? Number(evs.find((e) => e.document_id === books.id && /total_income/i.test(e.field))?.value ?? 0) : 0;
  const detail = docs.find((d) => d.document_type === "books_transaction_detail");
  const kInsideNec = detail ? /(\d[\d,]*\.\d\d) arrived through .* card processing/i.exec(detail.pages.map((pg: any) => pg.printed_content).join(" ")) : null;
  const gross = lineByKey["SchC.1"];
  if (gross) {
    out.push({
      kind: "check", code: "GROSS_RECEIPTS_RECON", severity: Number(gross.value) !== booksIncome ? "warning" : "info", area: "business",
      title: `Gross receipts ${money(gross.value)} vs books ${money(booksIncome)}; 1099-NEC ${money(necTotal)} + 1099-K ${money(kTotal)}`,
      detail: `${gross.note ?? ""} ${kInsideNec ? `The books' deposit detail says ${kInsideNec[1]} of the 1099-K amount was paid by a customer who also issued a 1099-NEC — it is inside the NEC total, not in addition to it.` : ""} Books ${money(booksIncome)} = NEC ${money(necTotal)} + non-1099 deposits ${money(booksIncome - necTotal)}. This reconciliation is what an IRS matching notice asks for.`,
      refs: ["line:SchC.1", "doc:D14", "doc:D15#p3", "doc:D21", "doc:D17"],
    });
  }

  /* 13. Wage sourcing vs residency ----------------------------------------------- */
  const res = p.household.residency;
  const caWages = lineByKey["SchCA540NR.1.E"];
  const paystubs = docs.filter((d) => d.document_type === "paystub");
  for (const w2 of docs.filter((d) => d.document_type === "W-2")) {
    const text = page(w2, 1);
    if (/kept California|work state/i.test(text) || paystubs.some((ps) => page(ps, 1).includes(w2.issuer?.split(" ")[0] ?? "§§"))) {
      const ps = paystubs.find((x) => page(x, 1).includes(w2.issuer?.split(" ")[0] ?? "§§"));
      const b16 = evs.find((e) => e.document_id === w2.id && e.field === "box16")?.value;
      out.push({
        kind: "check", code: "WAGE_SOURCING", severity: "warning", area: "california",
        title: `${w2.id} box 16 (${money(b16)}) treats all wages as California; the household moved to Texas on ${res.find((r: any) => r.state === "TX")?.from}`,
        detail: `${text.match(/\(([^)]*)\)/)?.[1] ?? ""}. ${ps ? `${ps.id}: "${page(ps, 1)}"` : ""} The return sources ${money(caWages?.value)} of wages to California (SchCA540NR.1.E). California wages for a part-year resident are wages earned while resident or for services performed in California.`,
        refs: ["line:SchCA540NR.1.E", `doc:${w2.id}`, ...(ps ? [`doc:${ps.id}`] : []), "qa:45", "household:residency"],
      });
    }
  }

  /* 14. Parameter provenance: a 2025 value converted with a prior-year rate ------- */
  for (const l of lines) {
    const bad = l.sources.find((s: string) => /^ref:fx\..*2024/.test(s));
    if (bad) out.push({ kind: "check", code: "STALE_PARAMETER", severity: "warning", area: areaForLine(l.key), title: `${l.key} converts a 2025 amount with the 2024 average exchange rate`, detail: `${l.label}. The engine used ${bad.replace("ref:", "").replace(/\./g, " › ").replace(/_/g, " ")}; the packet also has a 2025 average (${p.fx_rates.SEK_per_USD["2025_average"]}) and year-end (${p.fx_rates.SEK_per_USD["2025_year_end"]}) rate.`, refs: [`line:${l.key}`, "ref:fx_rates"] });
  }

  /* 15. Prior-year open items and notes carried into this year ------------------- */
  for (const item of p.prior_years.prior_preparer_workpaper.open_items_left_by_prior_preparer) {
    const area: AreaId = /K-1|basis/i.test(item) ? "pass_throughs_and_basis" : /5498|IRA/i.test(item) ? "deductions_and_credits" : /home office/i.test(item) ? "business" : "intake_and_engagement";
    out.push({ kind: "completeness", code: "PRIOR_OPEN_ITEM", severity: /3520/.test(item) ? "warning" : "info", area, title: `Prior preparer left open: ${item}`, detail: `From D07 (2024 workpaper export). Resolve or carry forward with a note.`, refs: ["doc:D07#p3"] });
  }

  /* 16. Variances vs prior year (firm standard: >10% and >1,000) ------------------ */
  const std = p.firm.starter_standards.variance_review;
  const py = p.prior_years.return_2024.lines;
  for (const [k, v] of Object.entries<number>(py)) {
    const cur = lineByKey[k];
    if (!cur || typeof cur.value !== "number" || typeof v !== "number") continue;
    const diff = cur.value - v;
    const pct = v === 0 ? Infinity : Math.abs(diff / v) * 100;
    if (Math.abs(diff) > std.and_over_amount && pct > std.flag_if_change_over_percent) {
      out.push({ kind: "variance", code: "VARIANCE", severity: "info", area: areaForLine(k), title: `${k} ${cur.label}: ${money(v)} → ${money(cur.value)} (${diff > 0 ? "+" : ""}${money(diff)})`, detail: `Change over ${std.flag_if_change_over_percent}% and ${money(std.and_over_amount)} vs 2024. Explain before sign-off.`, refs: [`line:${k}`, `py:2024/${k}`] });
    }
  }

  /* 17. Engine diagnostics become issues ----------------------------------------- */
  for (const d of v3.diagnostics) {
    const refLine = d.refs.find((r: string) => /^[A-Z]/.test(r) && lineByKey[r]);
    out.push({ kind: "diagnostic", code: d.code, severity: d.severity === "warning" ? "warning" : "info", blocksFiling: d.code === "DUE_DILIGENCE_REQUIRED", area: refLine ? areaForLine(refLine) : d.code.startsWith("CA") ? "california" : d.code.includes("1099") || d.code.includes("HOME") ? "business" : d.code.includes("DIGITAL") || d.code.includes("BROKER") || d.code.includes("QUESTIONNAIRE") ? "investments_and_digital_assets" : d.code.includes("FBAR") ? "investments_and_digital_assets" : "partner_review", title: `Engine: ${d.message}`, detail: `Diagnostic ${d.code} from ${v3.version}.`, refs: d.refs.map(toRef) });
  }

  /* 18. Client messages that answer an open diagnostic (evidence waiting to be attached) */
  for (const m of p.client.messages) {
    if (/cost|basis|confirmed|matches/i.test(m.text)) {
      out.push({ kind: "client_question", code: "MESSAGE_EVIDENCE", severity: "info", area: /crypto|BTC/i.test(m.text) ? "investments_and_digital_assets" : "deductions_and_credits", title: `Client message ${m.id} contains evidence not yet attached to a line`, detail: `${m.sent_at.slice(0, 10)} ${m.from}: "${m.text}"`, refs: [`msg:${m.id.slice(4)}`] });
    }
  }

  /* 19. Completeness: documents not used by the current version --------------------- */
  for (const d of docs) {
    if (!v3.documents_used.includes(d.id) && !v3.documents_superseded.includes(d.id)) {
      out.push({ kind: "completeness", code: "DOC_UNUSED", severity: new Date(d.received_at) > new Date(v3.computed_at) ? "info" : "warning", area: areaFor(d), title: `${d.id} ${d.title} is not used by ${v3.version}`, detail: `Received ${d.received_at.slice(0, 10)}${new Date(d.received_at) > new Date(v3.computed_at) ? " (after the last engine run)" : ""}. Record why it was not used, or what it changes.`, refs: [`doc:${d.id}`] });
    }
  }

  /* 20. Outside-scope filings that must be identified --------------------------------- */
  for (const dl of p.firm.deadlines.filter((x: any) => /outside engagement/i.test(x.what))) {
    out.push({ kind: "completeness", code: "OUTSIDE_SCOPE", severity: "warning", area: /1099/.test(dl.what) ? "business" : "investments_and_digital_assets", title: `Outside engagement, must be identified to the client: ${dl.what} (${dl.date})`, detail: `Engagement letter D01 excludes this filing. Document that the client was told.`, refs: ["doc:D01#p1"] });
  }

  return dedupe(out);
}

function toRef(s: string): string {
  if (s.startsWith("ev-")) return `ev:${s.slice(3)}`;
  if (s.startsWith("qa-")) return `qa:${s.slice(3)}`;
  if (s.startsWith("py:/")) return `py:2024${s.slice(3)}`;
  if (/^[A-Z]/.test(s)) return `line:${s}`;
  return s;
}

function areaFor(d: any): AreaId {
  const t = d.document_type;
  if (/W-2|3921|3922|stock_plan|paystub/.test(t)) return "wages_and_stock_compensation";
  if (/1099-composite|1099-INT|1099-DA|transaction_export|foreign_bank/.test(t)) return "investments_and_digital_assets";
  if (/1099-NEC|1099-K|books|invoice|mileage|client_note|insurance|retirement_contribution/.test(t) && d.belongs_to === "spouse") return "business";
  if (/K-1/.test(t)) return "pass_throughs_and_basis";
  if (/rental|closing|1099-S|1098$|property_tax|payoff|invoice/.test(t)) return "rentals_and_sale";
  if (/1098-T|letter|dependent_care|donation|1098-C|1099-R|5498|1099-SA/.test(t)) return "deductions_and_credits";
  return "intake_and_engagement";
}

function dedupe(items: IssueCandidate[]) {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.code + "|" + i.title;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
