/**
 * Load the packet as delivered. Idempotent: wipes and reloads the immutable layer,
 * then (re)runs the independent checks and seeds them as issues. Workpaper events
 * are preserved unless --reset is passed.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema as s } from "../src/db";
import { runChecks } from "../src/lib/checks";

const RESET = process.argv.includes("--reset");
const file = process.argv.find((a) => a.endsWith(".json")) ?? "data/packet.json";

// Validate before touching the database: a truncated or wrong file must never leave a half-loaded store.
let p: any;
try {
  p = JSON.parse(readFileSync(file, "utf8"));
} catch (e: any) {
  console.error(`Cannot parse ${file}: ${e.message}. Nothing was changed.`);
  process.exit(1);
}
const problems: string[] = [];
if (!Array.isArray(p?.documents) || !p.documents.length) problems.push("documents[] missing");
if (!Array.isArray(p?.extracted_values) || !p.extracted_values.length) problems.push("extracted_values[] missing");
if (!Array.isArray(p?.return_versions) || p.return_versions.length !== 3) problems.push("return_versions must have 3 versions");
for (const k of ["household", "client", "firm", "prior_years", "tax_agency_records", "timeline", "engine_reference", "what_if", "fx_rates", "packet"]) if (!p?.[k]) problems.push(`${k} missing`);
if (p?.documents && p.documents.some((d: any) => !Array.isArray(d.pages) || d.pages.length !== d.page_count)) problems.push("a document's pages do not match its page_count");
if (problems.length) {
  console.error(`Packet ${file} failed validation: ${problems.join("; ")}. Nothing was changed.`);
  process.exit(1);
}

async function main() {
  console.log(`Importing ${file} (${p.packet.name} ${p.packet.version})`);

  if (RESET) {
    await db.execute(sql`truncate events, issues, scenarios, snapshots, standards, cursors restart identity`);
  }
  await db.execute(sql`truncate documents, pages, extracted_values, return_lines, return_versions, staff, packet_sections cascade`);

  await db.insert(s.documents).values(p.documents.map((d: any) => ({
    id: d.id, title: d.title, documentType: d.document_type, issuer: d.issuer ?? null, belongsTo: d.belongs_to,
    taxYear: d.tax_year ?? null, receivedAt: new Date(d.received_at), uploadedBy: d.uploaded_by ?? null, fileName: d.file_name ?? null,
    pageCount: d.page_count, markedCorrected: d.marked_corrected ?? null,
    extractionStatus: d.extraction.status, extractionReason: d.extraction.reason ?? null,
  })));

  const pageRows = p.documents.flatMap((d: any) => d.pages.map((pg: any) => ({
    docId: d.id, n: pg.page, printedContent: pg.printed_content,
    contentHash: createHash("sha1").update(pg.printed_content).digest("hex"),
  })));
  for (let i = 0; i < pageRows.length; i += 500) await db.insert(s.pages).values(pageRows.slice(i, i + 500));

  const evRows = p.extracted_values.map((e: any) => ({
    id: e.id, docId: e.document_id, page: e.page, field: e.field, label: e.label, value: e.value,
    valueType: e.value_type, textAsRead: e.text_as_read ?? null, position: e.position ?? null, confidence: e.confidence,
  }));
  for (let i = 0; i < evRows.length; i += 500) await db.insert(s.extractedValues).values(evRows.slice(i, i + 500));

  for (const v of p.return_versions) {
    await db.insert(s.returnVersions).values({
      version: v.version, computedAt: new Date(v.computed_at), trigger: v.trigger,
      documentsUsed: v.documents_used, documentsSuperseded: v.documents_superseded, summary: v.summary,
      taxEffectRates: v.tax_effect_rates, carryoversOut: v.carryovers_out ?? null, assets: v.assets ?? null,
      diagnostics: v.diagnostics, changesFromPrevious: v.changes_from_previous,
    });
    const rows = v.lines.map((l: any) => ({
      version: v.version, key: l.key, jurisdiction: l.jurisdiction, form: l.form, line: l.line, label: l.label,
      value: l.value, rule: l.rule ?? null, inputs: l.inputs ?? [], sources: l.sources ?? [], note: l.note ?? null,
    }));
    for (let i = 0; i < rows.length; i += 500) await db.insert(s.returnLines).values(rows.slice(i, i + 500));
  }

  await db.insert(s.staff).values([
    ...p.firm.staff.map((m: any) => ({ id: m.id, name: m.name, role: m.role, credential: m.credential ?? null, sensitiveClearance: !!m.sensitive_data_clearance, activeFrom: m.active_from ?? null, note: m.note ?? null })),
    ...p.firm.client_users.map((c: any) => ({ id: c.id, name: c.name, role: "client", credential: null, sensitiveClearance: true, activeFrom: null, note: "Client user: sees own data and approval/signature steps only." })),
  ]);

  for (const key of ["packet", "readme", "household", "client", "firm", "prior_years", "tax_agency_records", "timeline", "engine_reference", "what_if", "planning_reference_2026", "post_filing_rates", "fx_rates"]) {
    await db.insert(s.packetSections).values({ key, data: p[key] });
  }

  // Firm standards start from the packet's starter_standards (editable by the administrator role later).
  const existing = await db.select().from(s.standards);
  if (!existing.length) await db.insert(s.standards).values({ id: "current", data: p.firm.starter_standards, updatedBy: "import" });

  // Independent checks → issues. Re-running keeps resolved issues resolved (matched on code+title).
  const candidates = runChecks(p);
  const existingIssues = await db.select().from(s.issues);
  const have = new Set(existingIssues.map((i) => i.code + "|" + i.title));
  const fresh = candidates.filter((c) => !have.has(c.code + "|" + c.title));
  if (fresh.length) {
    await db.insert(s.issues).values(fresh.map((c) => ({
      kind: c.kind, code: c.code, severity: c.severity, blocksFiling: !!c.blocksFiling, area: c.area,
      title: c.title, detail: c.detail, refs: c.refs, createdBy: `system:${c.code}`,
      assignedTo: p.firm.assignment_at_start.preparer, due: p.firm.deadlines.find((d: any) => /hand-off/.test(d.what))?.date ?? null,
    })));
  }
  console.log(`documents ${p.documents.length}, pages ${pageRows.length}, values ${evRows.length}, lines ${p.return_versions.reduce((a: number, v: any) => a + v.lines.length, 0)}, checks ${candidates.length} (${fresh.length} new)`);
  const byCode: Record<string, number> = {};
  for (const c of candidates) byCode[c.code] = (byCode[c.code] ?? 0) + 1;
  console.table(byCode);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
