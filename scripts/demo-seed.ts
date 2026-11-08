/**
 * Optional: seed a plausible mid-season workpaper history on top of the imported packet,
 * so the demo opens with verifications, adjustments, sign-offs and a reopened sign-off.
 * Everything here goes through the same event log the UI writes to.
 */
import "dotenv/config";
import { eq, like, sql } from "drizzle-orm";
import { db, schema as s } from "../src/db";
import { claims, scopeHash, taxEffect } from "../src/lib/state";

async function ev(actorId: string, actorRole: string, kind: any, targetRef: string, payload: Record<string, unknown>, at: string, extra: any = {}) {
  const [row] = await db.insert(s.events).values({ actorId, actorRole, kind, targetRef, payload, at: new Date(at), ...extra }).returning();
  return row;
}
async function issueId(code: string, titleLike: string) {
  const [i] = await db.select().from(s.issues).where(sql`${s.issues.code} = ${code} and ${s.issues.title} like ${"%" + titleLike + "%"}`);
  return i?.id;
}
async function resolve(id: number | undefined, by: string, resolution: string, at: string) {
  if (!id) return;
  await db.update(s.issues).set({ status: "resolved", resolvedBy: by, resolvedAt: new Date(at), resolution }).where(eq(s.issues.id, id));
  await ev(by, by === "st-02" ? "reviewer" : "preparer", "resolve", `issue:${id}`, { resolution }, at);
}
async function adjust(by: string, role: string, key: string, newV: number, reason: string, authority: string, at: string, issue?: number) {
  const cm = await claims();
  const old = cm.get(key)!.current as number;
  const te = await taxEffect(key, newV - old);
  const requiresPartner = Math.max(Math.abs(te.fed), Math.abs(te.ca)) > 1000 && role !== "partner";
  const e = await ev(by, role, "adjust", `line:${key}`, { old, new: newV, delta: newV - old, reason, authority, taxEffectFed: te.fed, taxEffectCa: te.ca, category: te.category, requiresPartner, issueId: issue ?? null }, at);
  if (issue) await resolve(issue, by, `Adjusted ${key}: ${old} → ${newV}`, at);
  return e;
}

async function main() {
  const P = "st-01", R = "st-02", H = "st-03";
  // Priya starts: verifies W-2 lines against documents (bulk), logs time
  const b1 = "b-w2";
  for (const k of ["F1040.1a", "F1040.25a", "F8959.1", "Sch3.11"]) await ev(P, "preparer", "verify", `line:${k}`, { type: "agreed_to_source_document", evidence: "doc:D08", note: "Agreed to W-2s D08 and D09; D10 is a phone photo of D09.", bulk: true }, "2026-03-10T15:10:00Z", { batchId: b1 });
  await ev(P, "preparer", "time", "area:wages_and_stock_compensation", { hours: 1.5, note: "W-2s, stock supplement, 3921/3922" }, "2026-03-10T17:00:00Z");
  await ev(P, "preparer", "time", "area:intake_and_engagement", { hours: 1.0, note: "engagement, IDs, prior return" }, "2026-03-09T17:00:00Z");
  await resolve(await issueId("DUP_DOC", "D10"), P, "D10 is a phone photo of D09 (same EIN, same boxes). Engine counted once; linked as duplicate.", "2026-03-10T15:20:00Z");
  await ev(P, "preparer", "link", "doc:D10", { to: "doc:D09", relation: "duplicate_of", note: "phone photo of the same W-2" }, "2026-03-10T15:21:00Z");

  // RSU basis: the big one. Priya adjusts the three lots from the supplement; partner approval required.
  const z1 = await issueId("ZERO_BASIS", "N1");
  await adjust(P, "preparer", "F8949.B.N1", 140, "Adjusted basis 19,100 per Corvane stock plan supplement D11 (400 sh × 47.75 vest FMV); W-2 box 14 RSU 38,200 already taxed as wages.", "IRC §83; Pub. 525; Form 8949 code B", "2026-03-11T16:00:00Z", z1);
  await adjust(P, "preparer", "F8949.B.N3", -620, "Adjusted basis 19,100 per D11 lot RSU-2505.", "IRC §83; Form 8949 code B", "2026-03-11T16:05:00Z", await issueId("ZERO_BASIS", "N3"));
  await adjust(P, "preparer", "F8949.E.N4", 5880, "Adjusted basis 9,420 per D11 lot RSU-2308 (300 sh × 31.40).", "IRC §83; Form 8949 code B", "2026-03-11T16:08:00Z", await issueId("ZERO_BASIS", "N4"));
  await ev(P, "preparer", "verify", "line:F8949.B.N1", { type: "agreed_to_source_document", evidence: "doc:D11#p2", note: "Basis agreed to supplement; vest FMV agrees to W-2 box 14 / 400 sh." }, "2026-03-11T16:10:00Z");
  await ev(P, "preparer", "link", "line:F8949.B.N1", { to: "ev:0030", relation: "same_money", note: "W-2 box 14 RSU 38,200 = lots RSU-2502 + RSU-2505 basis" }, "2026-03-11T16:11:00Z");

  // Partner approves N1 and N4 (tax effect > 1,000); leaves N3 (small) — it's auto-approved since under threshold.
  const adjs = await db.select().from(s.events).where(eq(s.events.kind, "adjust"));
  for (const a of adjs.filter((x) => ["line:F8949.B.N1", "line:F8949.E.N4"].includes(x.targetRef))) await ev(H, "partner", "sign_off", a.targetRef, { level: "partner", approvesAdjustment: a.id, note: "Supplement reviewed; agree." }, "2026-03-12T20:00:00Z");

  // Mileage: duplicate page; Priya adjusts miles and the car expense
  await adjust(P, "preparer", "SchC.44a", 8100, "Page 3 of D23 is a rescan of page 2; log totals 2,600 + 3,700 + 1,800. Odometer 17,740 total miles supports 8,100 business.", "Rev. Proc. 2019-46", "2026-03-13T15:00:00Z", await issueId("DUP_PAGE", "D23"));
  await adjust(P, "preparer", "SchC.9", 5670, "8,100 miles × 0.70.", "Notice 2025-5 standard mileage rate", "2026-03-13T15:02:00Z");

  // Interest double count — small, auto-approved
  await adjust(P, "preparer", "SchB.1.2", 0, "D29 is the standalone 1099-INT for the same Northlake bank-sweep interest already on the composite D28 (account 7731). Counted once.", "", "2026-03-13T15:30:00Z", await issueId("SAME_MONEY", "1,840"));

  // Review note from Daniel that blocks filing, and a question to the client
  const n = await ev(R, "reviewer", "note", "line:Sch1.17", { text: "SE health insurance: client says Erik was eligible for Ngozi's plan all year (qa-25). 2024 took no deduction for the same reason. Remove unless client shows otherwise.", blocksFiling: true }, "2026-03-28T14:00:00Z");
  await db.insert(s.issues).values({ kind: "review_note", code: "REVIEW_NOTE", severity: "blocker", blocksFiling: true, area: "business", title: "Review note on Sch1.17: SE health insurance — remove (eligible for spouse's employer plan)", detail: (n.payload as any).text, refs: ["line:Sch1.17", `event:${n.id}`, "qa:25"], assignedTo: P, due: "2026-04-03", createdBy: R, createdAt: new Date("2026-03-28T14:00:00Z") });
  const q = await ev(P, "preparer", "question", "line:F8949.H.C6", { text: "Coinhaven lot C6 (0.05 BTC, transferred in 2025-06-01): what did you pay for it, when, and is there any record?", to: "cu-02" }, "2026-03-20T16:00:00Z");
  const [qi] = await db.insert(s.issues).values({ kind: "client_question", code: "QUESTION", severity: "warning", blocksFiling: false, area: "investments_and_digital_assets", title: "Question on F8949.H.C6: cost basis of the transferred-in BTC lot", detail: (q.payload as any).text, refs: ["line:F8949.H.C6", `event:${q.id}`], assignedTo: "cu-02", due: "2026-04-10", createdBy: P, createdAt: new Date("2026-03-20T16:00:00Z") }).returning();
  // Client answers (msg-07 on 2026-06-30) — answer becomes evidence; Priya adjusts
  await ev("cu-02", "client", "answer", "line:F8949.H.C6", { text: "Bought on another exchange 03/15/2021 for about 3,050, moved to Coinhaven in June. Bank statement line to 'CryptoNorth' 03/15/2021 3,050 attached.", issueId: qi.id }, "2026-06-30T18:02:00Z");
  await resolve(qi.id, "cu-02", "Answered by client (msg-07); bank statement line attached.", "2026-06-30T18:02:00Z");
  await ev(P, "preparer", "attach", "line:F8949.H.C6", { ref: "msg:07", note: "bank statement line 03/15/2021 CryptoNorth 3,050", fileName: "cryptonorth_bank_line_2021-03.pdf" }, "2026-07-01T14:00:00Z");

  // Preparer sign-off on wages area, then a later adjustment in that area reopens it (demonstrates sign-offs that reopen)
  let cm = await claims();
  await ev(P, "preparer", "sign_off", "area:wages_and_stock_compensation", { level: "preparer", coveredHash: scopeHash(cm, "wages_and_stock_compensation") }, "2026-03-14T17:00:00Z");
  await ev(R, "reviewer", "sign_off", "area:wages_and_stock_compensation", { level: "reviewer", coveredHash: scopeHash(cm, "wages_and_stock_compensation") }, "2026-03-30T17:00:00Z");
  // Corrected paystub arrives; Priya logs a note; nothing changes in federal wages, so sign-offs stand.
  // Reviewer sign-off on business area, then Priya's later Sch C adjustment reopens it:
  cm = await claims();
  await ev(R, "reviewer", "sign_off", "area:business", { level: "reviewer", coveredHash: scopeHash(cm, "business") }, "2026-03-30T17:30:00Z");
  await adjust(P, "preparer", "SchC.27a.1", 6634, "Spotify Family 216 is personal (call-01); removed from software.", "IRC §262", "2026-04-02T15:00:00Z", await issueId("PERSONAL_IN_BOOKS", "Spotify"));

  await ev(P, "preparer", "time", "area:business", { hours: 2.25, note: "books to tax, mileage, contractors" }, "2026-04-02T17:00:00Z");
  await ev(R, "reviewer", "time", "area:business", { hours: 0.75, note: "review" }, "2026-03-30T18:00:00Z");
  await ev(P, "preparer", "verify", "line:SchA.11", { type: "confirmed_with_client", evidence: "msg:08", note: "St. Brigid 1,500 confirmed by phone; check #2207 12/21/2025." }, "2026-07-01T17:00:00Z");
  await resolve(await issueId("LOW_CONFIDENCE", "D64"), P, "Client confirmed 1,500 (msg-08, check #2207).", "2026-07-01T17:01:00Z");

  // Marcus (no clearance) looks at a document; Helen unmasks once (logged)
  await ev("st-04", "preparer", "note", "area:deductions_and_credits", { text: "Started on donation receipts and 2441." }, "2026-03-25T15:00:00Z");
  await ev(H, "partner", "view_sensitive", "doc:D04", { field: "license_no" }, "2026-03-12T19:00:00Z");

  await db.insert(s.cursors).values({ actorId: R, lastSeenEventId: 12 }).onConflictDoNothing();
  console.log("Seeded demo history.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
