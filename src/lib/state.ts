import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema as s } from "@/db";
import { areaForLine, rateCategoryForLine, type AreaId } from "./areas";
import { normalizeSource } from "./refs";

export const CURRENT_VERSION = "v3";
export type Line = typeof s.returnLines.$inferSelect;
export type Event = typeof s.events.$inferSelect;
export type Issue = typeof s.issues.$inferSelect;

/* ---------- packet sections ---------- */
export async function section<T = any>(key: string): Promise<T> {
  const [row] = await db.select().from(s.packetSections).where(eq(s.packetSections.key, key));
  return row?.data as T;
}

/* ---------- events ---------- */
export async function allEvents(scenarioId: number | null = null): Promise<Event[]> {
  return db.select().from(s.events).where(scenarioId === null ? isNull(s.events.scenarioId) : eq(s.events.scenarioId, scenarioId)).orderBy(asc(s.events.id));
}

/** Events that are not undone. */
export function liveEvents(evs: Event[]): Event[] {
  const undone = new Set(evs.filter((e) => e.kind === "undo").map((e) => e.reversesEventId));
  return evs.filter((e) => e.kind !== "undo" && !undone.has(e.id));
}

export async function eventsFor(targetRef: string, scenarioId: number | null = null): Promise<Event[]> {
  const evs = await db.select().from(s.events).where(and(eq(s.events.targetRef, targetRef), scenarioId === null ? isNull(s.events.scenarioId) : eq(s.events.scenarioId, scenarioId))).orderBy(asc(s.events.id));
  return liveEvents(evs);
}

/* ---------- lines & claims ---------- */
export async function versionLines(version = CURRENT_VERSION): Promise<Line[]> {
  return db.select().from(s.returnLines).where(eq(s.returnLines.version, version));
}

export type Adjustment = {
  eventId: number; lineKey: string; old: number | string | null; new: number | string | null; delta: number;
  reason: string; authority?: string; by: string; role: string; at: Date;
  taxEffectFed: number; taxEffectCa: number; status: "proposed" | "approved"; approvedBy?: string; requiresPartner: boolean; batchId?: string | null;
};

export function adjustmentsFromEvents(evs: Event[]): Adjustment[] {
  const live = liveEvents(evs);
  const approvals = new Map<number, Event>();
  for (const e of live) if (e.kind === "sign_off" && (e.payload as any).approvesAdjustment) approvals.set((e.payload as any).approvesAdjustment as number, e);
  return live.filter((e) => e.kind === "adjust").map((e) => {
    const p = e.payload as any;
    const ap = approvals.get(e.id);
    return {
      eventId: e.id, lineKey: e.targetRef.replace(/^line:/, ""), old: p.old, new: p.new, delta: Number(p.delta ?? 0),
      reason: p.reason, authority: p.authority, by: e.actorId, role: e.actorRole, at: e.at,
      taxEffectFed: Number(p.taxEffectFed ?? 0), taxEffectCa: Number(p.taxEffectCa ?? 0),
      status: p.requiresPartner && !ap ? "proposed" : "approved", approvedBy: ap?.actorId, requiresPartner: !!p.requiresPartner, batchId: e.batchId,
    };
  });
}

/** Current value of every line = engine value + the net of approved adjustments (proposed ones shown separately). */
export type Claim = { key: string; engine: unknown; current: unknown; origin: "engine" | "adjusted" | "proposed"; adjustments: Adjustment[]; area: AreaId };
export async function claims(version = CURRENT_VERSION, scenarioId: number | null = null): Promise<Map<string, Claim>> {
  const [lines, evs] = await Promise.all([versionLines(version), allEvents(scenarioId)]);
  const adjs = adjustmentsFromEvents(scenarioId === null ? evs : [...(await allEvents(null)), ...evs]);
  const byLine = new Map<string, Adjustment[]>();
  for (const a of adjs) byLine.set(a.lineKey, [...(byLine.get(a.lineKey) ?? []), a]);
  const out = new Map<string, Claim>();
  for (const l of lines) {
    const as = byLine.get(l.key) ?? [];
    const approved = as.filter((a) => a.status === "approved");
    let current: unknown = l.value;
    if (approved.length) current = approved[approved.length - 1].new;
    out.set(l.key, { key: l.key, engine: l.value, current, origin: approved.length ? "adjusted" : as.length ? "proposed" : "engine", adjustments: as, area: areaForLine(l.key) });
  }
  return out;
}

export async function rates(version = CURRENT_VERSION): Promise<Record<string, { federal_per_dollar: number; california_per_dollar: number }>> {
  const [v] = await db.select().from(s.returnVersions).where(eq(s.returnVersions.version, version));
  return v.taxEffectRates as any;
}

export async function taxEffect(lineKey: string, delta: number): Promise<{ fed: number; ca: number; category: string }> {
  const r = await rates();
  const category = rateCategoryForLine(lineKey);
  // A payment is not income: one more dollar paid is one dollar less due. Reported in the same fed/ca slots so balance-due math stays uniform.
  if (category === "payments_federal") return { fed: -delta, ca: 0, category };
  if (category === "payments_california") return { fed: 0, ca: -delta, category };
  const rate = r[category] ?? r.ordinary_income;
  return { fed: Math.round(delta * rate.federal_per_dollar), ca: Math.round(delta * rate.california_per_dollar), category };
}

/** Return summary adjusted by approved adjustments' tax effects. */
export async function adjustedSummary(scenarioId: number | null = null) {
  const [v] = await db.select().from(s.returnVersions).where(eq(s.returnVersions.version, CURRENT_VERSION));
  const base = v.summary as any;
  const evs = scenarioId === null ? await allEvents(null) : [...(await allEvents(null)), ...(await allEvents(scenarioId))];
  const adjs = adjustmentsFromEvents(evs).filter((a) => a.status === "approved" || scenarioId !== null);
  const fed = adjs.reduce((a, x) => a + x.taxEffectFed, 0);
  const ca = adjs.reduce((a, x) => a + x.taxEffectCa, 0);
  // payment lines change the balance 1:1 without a tax effect
  const payDelta = adjs.filter((a) => /^(F1040\.26|F1040\.25a|F540NR\.7[123])$/.test(a.lineKey)).reduce((a, x) => a + x.delta, 0);
  const caPay = adjs.filter((a) => /^F540NR\.7/.test(a.lineKey)).reduce((a, x) => a + x.delta, 0);
  const fedPay = payDelta - caPay;
  return {
    base, adjustments: adjs,
    federal: { ...base.federal, total_tax: base.federal.total_tax + fed, payments: base.federal.payments + fedPay, balance_due: base.federal.balance_due + fed - fedPay },
    california: { ...base.california, total_tax: base.california.total_tax + ca, payments: base.california.payments + caPay, balance_due: base.california.balance_due + ca - caPay },
    deltas: { fed, ca, fedPay, caPay },
  };
}

/* ---------- trace context for one line ---------- */
export async function lineContext(key: string) {
  const lines = await versionLines();
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const line = byKey.get(key);
  if (!line) return null;
  const inputs = line.inputs.map((k) => byKey.get(k)).filter(Boolean) as Line[];
  const usedBy = lines.filter((l) => l.inputs.includes(key));
  const evIds = line.sources.filter((x) => x.startsWith("ev-"));
  const evs = evIds.length ? await db.select().from(s.extractedValues).where(inArray(s.extractedValues.id, evIds)) : [];
  const docIds = [...new Set(evs.map((e) => e.docId))];
  const docs = docIds.length ? await db.select().from(s.documents).where(inArray(s.documents.id, docIds)) : [];
  const pageRows = docIds.length ? await db.select().from(s.pages).where(inArray(s.pages.docId, docIds)) : [];
  const otherSources = line.sources.filter((x) => !x.startsWith("ev-")).map(normalizeSource);
  const events = await eventsFor(`line:${key}`);
  const allEv = await allEvents();
  const adjs = adjustmentsFromEvents(allEv).filter((a) => a.lineKey === key);
  const issueRows = await db.select().from(s.issues).where(sql`${s.issues.refs} @> ${JSON.stringify([`line:${key}`])}::jsonb`);
  const prior = await section("prior_years");
  const priorValue = prior?.return_2024?.lines?.[key];
  const versions = await db.select().from(s.returnLines).where(eq(s.returnLines.key, key));
  // Undo rows must be in the query, or liveEvents cannot see what was reversed.
  const links = liveEvents(await db.select().from(s.events).where(and(or(eq(s.events.kind, "link"), eq(s.events.kind, "undo")), isNull(s.events.scenarioId)))).filter((e) => e.kind === "link" && (e.targetRef === `line:${key}` || (e.payload as any).to === `line:${key}`));
  return { line, inputs, usedBy, evs, docs, pages: pageRows, otherSources, events, adjustments: adjs, issues: issueRows, priorValue, versions, links, area: areaForLine(key), category: rateCategoryForLine(key) };
}

/* ---------- verification summary per line ---------- */
export async function verificationMap(): Promise<Map<string, Event[]>> {
  // Undo rows must be in the query, or liveEvents cannot see what was reversed.
  const evs = liveEvents(await db.select().from(s.events).where(and(or(eq(s.events.kind, "verify"), eq(s.events.kind, "undo")), isNull(s.events.scenarioId))));
  const m = new Map<string, Event[]>();
  for (const e of evs) if (e.kind === "verify") m.set(e.targetRef, [...(m.get(e.targetRef) ?? []), e]);
  return m;
}

/* ---------- sign-offs ---------- */
export type SignOffStatus = { scope: string; level: string; by: string; at: Date; valid: boolean; invalidatedBy?: Event; eventId: number };

export function scopeHash(claimMap: Map<string, Claim>, scope: string): string {
  const keys = [...claimMap.values()].filter((c) => scope === "return" || c.area === scope).map((c) => `${c.key}=${JSON.stringify(c.current)}`).sort();
  return createHash("sha1").update(keys.join("\n")).digest("hex").slice(0, 12);
}

export async function signOffs(): Promise<SignOffStatus[]> {
  const evs = liveEvents(await allEvents());
  const cm = await claims();
  const out: SignOffStatus[] = [];
  for (const e of evs.filter((x) => x.kind === "sign_off" && !(x.payload as any).approvesAdjustment)) {
    const p = e.payload as any;
    const scope = e.targetRef.replace(/^area:/, "");
    const nowHash = scopeHash(cm, scope);
    // invalidated by any later approved adjustment inside the scope, or by a reopen event
    const later = evs.find((x) => x.id > e.id && ((x.kind === "adjust" && (scope === "return" || areaForLine(x.targetRef.replace(/^line:/, "")) === scope)) || (x.kind === "reopen" && x.targetRef === e.targetRef)));
    out.push({ scope, level: p.level, by: e.actorId, at: e.at, valid: p.coveredHash === nowHash && !later, invalidatedBy: later, eventId: e.id });
  }
  return out;
}

/* ---------- issues ---------- */
export async function openIssues(area?: string): Promise<Issue[]> {
  const rows = await db.select().from(s.issues).where(area ? and(eq(s.issues.status, "open"), eq(s.issues.area, area)) : eq(s.issues.status, "open")).orderBy(desc(s.issues.severity), asc(s.issues.id));
  const order = { blocker: 0, warning: 1, info: 2 } as Record<string, number>;
  return rows.sort((a, b) => order[a.severity] - order[b.severity] || a.id - b.id);
}

/* ---------- what changed since I last looked ---------- */
export async function changesSince(actorId: string) {
  const [cur] = await db.select().from(s.cursors).where(eq(s.cursors.actorId, actorId));
  const since = cur?.lastSeenEventId ?? 0;
  const evs = await db.select().from(s.events).where(and(sql`${s.events.id} > ${since}`, isNull(s.events.scenarioId))).orderBy(desc(s.events.id));
  return { since, events: evs.filter((e) => e.actorId !== actorId) };
}

/* ---------- time vs budget ---------- */
export async function timeByArea() {
  const evs = liveEvents(await db.select().from(s.events).where(eq(s.events.kind, "time")));
  const m: Record<string, number> = {};
  for (const e of evs) { const a = e.targetRef.replace(/^area:/, ""); m[a] = (m[a] ?? 0) + Number((e.payload as any).hours ?? 0); }
  return m;
}
