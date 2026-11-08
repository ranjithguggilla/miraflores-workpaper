"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema as s } from "@/db";
import { getActor, can } from "./session";
import { claims, scopeHash, taxEffect, adjustedSummary, allEvents, liveEvents, CURRENT_VERSION, adjustmentsFromEvents } from "./state";
import { areaForLine } from "./areas";
import type { EventKind } from "@/db/schema";

/** Kinds a client user may write: only their own approval/e-signature. Everything else is staff work. */
const CLIENT_KINDS = new Set<EventKind>(["sign_off", "answer", "resolve"]);
/** Kinds still allowed after the return is frozen (the record stays sealed; only reading, noting, amending and filing results continue). */
const AFTER_FREEZE_KINDS = new Set<EventKind>(["note", "time", "view_sensitive", "amend", "efile_result", "resolve", "assign", "attach", "link", "undo"]);

async function isFrozen(): Promise<boolean> {
  const [last] = await db.select().from(s.snapshots).orderBy(desc(s.snapshots.id)).limit(1);
  return last?.kind === "freeze";
}

async function emit(kind: EventKind, targetRef: string, payload: Record<string, unknown>, extra: Partial<{ batchId: string; reversesEventId: number; scenarioId: number | null }> = {}) {
  const actor = await getActor();
  if (actor.role === "client" && !(CLIENT_KINDS.has(kind) && (kind !== "sign_off" || (payload as any).level === "client"))) throw new Error("Not permitted: clients can only approve and e-sign their return.");
  if (!AFTER_FREEZE_KINDS.has(kind) && !(kind === "sign_off" && (payload as any).level === "client") && (await isFrozen())) throw new Error("The return is frozen at filing. Seal an amendment to change it.");
  const [row] = await db.insert(s.events).values({ kind, targetRef, payload, actorId: actor.id, actorRole: actor.role, batchId: extra.batchId ?? null, reversesEventId: extra.reversesEventId ?? null, scenarioId: extra.scenarioId ?? null }).returning();
  return row;
}

function back(fd: FormData) {
  const r = String(fd.get("_return") ?? "");
  if (r) { revalidatePath(r); }
  revalidatePath("/", "layout");
}

/* ---------- role switcher ---------- */
export async function switchActor(fd: FormData) {
  const id = String(fd.get("actor"));
  const c = await cookies();
  c.set("actor", id, { path: "/", httpOnly: true, sameSite: "lax" });
  revalidatePath("/", "layout");
  redirect(String(fd.get("_return") || "/"));
}

/* ---------- verify ---------- */
export async function verifyLine(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "verify")) throw new Error("Not permitted");
  const key = String(fd.get("key"));
  await emit("verify", `line:${key}`, { type: String(fd.get("type")), evidence: String(fd.get("evidence") ?? ""), note: String(fd.get("note") ?? "") });
  back(fd);
}

/* ---------- adjust (with live tax effect; partner approval above the firm threshold) ---------- */
export async function adjustLine(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "adjust")) throw new Error("Not permitted");
  const key = String(fd.get("key"));
  const scenarioId = fd.get("scenario") ? Number(fd.get("scenario")) : null;
  const cm = await claims(CURRENT_VERSION, scenarioId);
  const claim = cm.get(key);
  const oldV = claim?.current;
  const rawNew = String(fd.get("value"));
  const newV: number | string = isFinite(Number(rawNew)) && rawNew.trim() !== "" ? Number(rawNew) : rawNew;
  const delta = typeof newV === "number" && typeof oldV === "number" ? newV - oldV : 0;
  const te = await taxEffect(key, delta);
  const [std] = await db.select().from(s.standards);
  const threshold = Number((std?.data as any)?.partner_threshold ?? 1000);
  const requiresPartner = Math.max(Math.abs(te.fed), Math.abs(te.ca)) > threshold && scenarioId === null;
  const batchId = String(fd.get("batch") ?? "") || null;
  const ev = await emit(scenarioId ? "whatif_adjust" : "adjust", `line:${key}`, {
    old: oldV, new: newV, delta, reason: String(fd.get("reason") ?? ""), authority: String(fd.get("authority") ?? ""),
    taxEffectFed: te.fed, taxEffectCa: te.ca, category: te.category, requiresPartner, issueId: fd.get("issue") ? Number(fd.get("issue")) : null,
  }, { batchId: batchId ?? undefined, scenarioId });
  if (fd.get("issue")) await resolveIssueInternal(Number(fd.get("issue")), `Adjusted ${key}: ${oldV} → ${newV}`);
  back(fd);
}

export async function approveAdjustment(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "approve_adjustment")) throw new Error("Partner or quality reviewer only");
  const id = Number(fd.get("eventId"));
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, id));
  if (!ev) throw new Error("Adjustment not found");
  if (ev.actorId === actor.id) throw new Error("Firm rule: you cannot approve an adjustment you recorded.");
  await emit("sign_off", ev.targetRef, { level: "partner", approvesAdjustment: id });
  back(fd);
}

/* ---------- bulk: act on many items at once, one batch id, undoable together ---------- */
export async function bulkVerify(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "verify")) throw new Error("Not permitted");
  const keys = fd.getAll("keys").map(String);
  const batchId = `b-${Date.now()}`;
  for (const k of keys) await emit("verify", `line:${k}`, { type: String(fd.get("type")), note: String(fd.get("note") ?? ""), bulk: true }, { batchId });
  back(fd);
}

export async function undoEvent(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "adjust")) throw new Error("Not permitted for your role");
  const id = Number(fd.get("eventId"));
  const [ev] = await db.select().from(s.events).where(eq(s.events.id, id));
  if (!ev) return;
  if (ev.batchId) {
    const batch = await db.select().from(s.events).where(eq(s.events.batchId, ev.batchId));
    for (const b of batch) await emit("undo", b.targetRef, { kind: b.kind }, { reversesEventId: b.id });
  } else {
    await emit("undo", ev.targetRef, { kind: ev.kind }, { reversesEventId: ev.id });
  }
  back(fd);
}

/* ---------- notes, questions, answers, attachments ---------- */
export async function addNote(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "note")) throw new Error("Not permitted for your role");
  const target = String(fd.get("target"));
  const kind = String(fd.get("kind") ?? "note") as EventKind;
  const text = String(fd.get("text") ?? "").trim();
  if (!text) return;
  const blocks = fd.get("blocks") === "on";
  const ev = await emit(kind, target, { text, blocksFiling: blocks, to: String(fd.get("to") ?? "") });
  // Review notes that block filing and client questions become issues so they show in the inbox and gate filing.
  if (kind === "question" || blocks) {
    const lineKey = target.replace(/^line:/, "");
    await db.insert(s.issues).values({
      kind: kind === "question" ? "client_question" : "review_note", code: kind === "question" ? "QUESTION" : "REVIEW_NOTE",
      severity: blocks ? "blocker" : "warning", blocksFiling: blocks, area: target.startsWith("line:") ? areaForLine(lineKey) : target.startsWith("area:") ? target.slice(5) : "partner_review",
      title: `${kind === "question" ? "Question" : "Review note"} on ${target.replace(/^line:/, "")}: ${text.slice(0, 80)}`, detail: text,
      refs: [target, `event:${ev.id}`], assignedTo: String(fd.get("to") ?? "") || null, createdBy: actor.id, due: String(fd.get("due") ?? "") || null,
    });
  }
  back(fd);
}

export async function attachEvidence(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "attach")) throw new Error("Not permitted for your role");
  const target = String(fd.get("target"));
  await emit("attach", target, { ref: String(fd.get("ref")), note: String(fd.get("note") ?? ""), fileName: String(fd.get("fileName") ?? "") });
  back(fd);
}

export async function linkRefs(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "attach")) throw new Error("Not permitted for your role");
  await emit("link", String(fd.get("from")), { to: String(fd.get("to")), relation: String(fd.get("relation")), note: String(fd.get("note") ?? "") });
  back(fd);
}

/* ---------- issues ---------- */
async function resolveIssueInternal(id: number, resolution: string) {
  const actor = await getActor();
  await db.update(s.issues).set({ status: "resolved", resolvedBy: actor.id, resolvedAt: new Date(), resolution }).where(eq(s.issues.id, id));
  await emit("resolve", `issue:${id}`, { resolution });
}
export async function resolveIssue(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "resolve")) throw new Error("Not permitted");
  const id = Number(fd.get("id"));
  const status = String(fd.get("status") ?? "resolved");
  if (status === "open") {
    await db.update(s.issues).set({ status: "open", resolvedBy: null, resolvedAt: null, resolution: null }).where(eq(s.issues.id, id));
    await emit("reopen", `issue:${id}`, {});
  } else {
    await resolveIssueInternal(id, String(fd.get("resolution") ?? ""));
    if (status === "wont_fix") await db.update(s.issues).set({ status: "wont_fix" }).where(eq(s.issues.id, id));
  }
  back(fd);
}

export async function assignIssue(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "assign")) throw new Error("Not permitted for your role");
  const id = Number(fd.get("id"));
  const to = String(fd.get("to") ?? "") || null;
  const due = String(fd.get("due") ?? "") || null;
  await db.update(s.issues).set({ assignedTo: to, due }).where(eq(s.issues.id, id));
  await emit("assign", `issue:${id}`, { to, due });
  back(fd);
}

export async function answerQuestion(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "answer")) throw new Error("Not permitted for your role");
  const id = Number(fd.get("id"));
  const text = String(fd.get("text") ?? "").trim();
  const [issue] = await db.select().from(s.issues).where(eq(s.issues.id, id));
  const target = issue.refs.find((r) => r.startsWith("line:")) ?? `issue:${id}`;
  await emit("answer", target, { text, issueId: id });
  await resolveIssueInternal(id, `Answered: ${text}`);
  back(fd);
}

/* ---------- sign-offs ---------- */
export async function signOff(fd: FormData) {
  const actor = await getActor();
  const level = String(fd.get("level"));
  if (!can(actor, `sign_off_${level}`)) throw new Error("Not permitted for this level");
  const scope = String(fd.get("scope"));
  const [std] = await db.select().from(s.standards);
  const rules: string[] = (std?.data as any)?.rules ?? [];
  // Rule: a person may not review or sign off on work they prepared.
  if (rules.some((r) => /may not review/i.test(r)) && level !== "preparer") {
    const prepared = liveEvents(await allEvents()).some((e) => e.actorId === actor.id && ["adjust", "verify"].includes(e.kind) && (scope === "return" || areaForLine(e.targetRef.replace(/^line:/, "")) === scope));
    if (prepared) throw new Error("Firm rule: you prepared work in this scope and cannot sign it off.");
  }
  const cm = await claims();
  await emit("sign_off", scope === "return" ? "return" : `area:${scope}`, { level, coveredHash: scopeHash(cm, scope), note: String(fd.get("note") ?? "") });
  back(fd);
}

export async function reopenSignOff(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "reopen")) throw new Error("Not permitted for your role");
  await emit("reopen", String(fd.get("target")), { reason: String(fd.get("reason") ?? "") });
  back(fd);
}

/* ---------- time ---------- */
export async function logTime(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "time")) throw new Error("Not permitted for your role");
  await emit("time", `area:${fd.get("area")}`, { hours: Number(fd.get("hours")), note: String(fd.get("note") ?? "") });
  back(fd);
}

/* ---------- sensitive views ---------- */
export async function unmask(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "unmask")) throw new Error("No clearance");
  const ref = String(fd.get("ref"));
  await emit("view_sensitive", ref, { field: String(fd.get("field") ?? "") });
  const c = await cookies();
  c.set("unmask", ref, { path: "/", maxAge: 60 });
  back(fd);
}

/* ---------- what-if scenarios ---------- */
export async function createScenario(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "whatif")) throw new Error("Not permitted for your role");
  const [row] = await db.insert(s.scenarios).values({ name: String(fd.get("name") || "Scenario"), baseVersion: CURRENT_VERSION, createdBy: actor.id }).returning();
  await emit("whatif_create", `scenario:${row.id}`, { name: row.name }, { scenarioId: row.id });
  revalidatePath("/whatif");
  redirect(`/whatif?s=${row.id}`);
}

export async function closeScenario(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "whatif")) throw new Error("Not permitted for your role");
  const id = Number(fd.get("id"));
  await db.update(s.scenarios).set({ closed: true }).where(eq(s.scenarios.id, id));
  await emit("whatif_close", `scenario:${id}`, {}, { scenarioId: id });
  revalidatePath("/whatif");
}

/** Promote a scenario: replay its adjustments into the real workpaper as one batch. */
export async function promoteScenario(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "adjust")) throw new Error("Not permitted for your role");
  const id = Number(fd.get("id"));
  const evs = liveEvents(await allEvents(id)).filter((e) => e.kind === "whatif_adjust");
  const batchId = `scn-${id}`;
  // Same threshold rule as adjustLine: it is firm data, not code, and partners are not exempt from a second pair of eyes.
  const [std] = await db.select().from(s.standards);
  const threshold = Number((std?.data as any)?.partner_threshold ?? 1000);
  for (const e of evs) {
    const p = e.payload as any;
    const requiresPartner = Math.max(Math.abs(p.taxEffectFed), Math.abs(p.taxEffectCa)) > threshold;
    await emit("adjust", e.targetRef, { ...p, requiresPartner, fromScenario: id }, { batchId });
  }
  await db.update(s.scenarios).set({ closed: true }).where(eq(s.scenarios.id, id));
  revalidatePath("/", "layout");
  redirect("/activity");
}

/* ---------- freeze at filing, amend on top ---------- */
export async function freezeReturn(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "freeze")) throw new Error("Partner only");
  const kind = String(fd.get("kind") ?? "freeze");
  const cm = await claims();
  const lines: Record<string, unknown> = {};
  for (const c of cm.values()) lines[c.key] = c.current;
  const summary = await adjustedSummary();
  const [last] = await db.select().from(s.events).orderBy(desc(s.events.id)).limit(1);
  const hash = createHash("sha1").update(JSON.stringify(lines)).digest("hex").slice(0, 12);
  const [snap] = await db.insert(s.snapshots).values({ kind, label: String(fd.get("label") || (kind === "freeze" ? "Filed return" : "Amended return")), createdBy: actor.id, atEventId: last?.id ?? 0, lines, summary: { federal: summary.federal, california: summary.california }, hash }).returning();
  await emit(kind === "freeze" ? "freeze" : "amend", `snapshot:${snap.id}`, { hash, label: snap.label });
  back(fd);
}

export async function recordEfile(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "file_result")) throw new Error("Not permitted for your role");
  await emit("efile_result", "return", { jurisdiction: String(fd.get("jurisdiction")), status: String(fd.get("status")), submissionId: String(fd.get("submissionId") ?? ""), errors: String(fd.get("errors") ?? "") });
  back(fd);
}

export async function clientApprove(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "client_approve")) throw new Error("Client only");
  const cm = await claims();
  await emit("sign_off", "return", { level: "client", coveredHash: scopeHash(cm, "return"), pin: String(fd.get("pin") ?? ""), note: "Form 8879 / FTB 8879 e-signature" });
  back(fd);
}

/* ---------- firm standards ---------- */
export async function updateStandards(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "standards")) throw new Error("Administrator only");
  const [std] = await db.select().from(s.standards);
  const data = { ...(std?.data as any) };
  const vr = { ...(data.variance_review ?? {}) };
  if (fd.get("flag_pct")) vr.flag_if_change_over_percent = Number(fd.get("flag_pct"));
  if (fd.get("flag_amt")) vr.and_over_amount = Number(fd.get("flag_amt"));
  data.variance_review = vr;
  if (fd.get("partner_threshold")) data.partner_threshold = Number(fd.get("partner_threshold"));
  if (fd.get("new_rule")) data.rules = [...(data.rules ?? []), String(fd.get("new_rule"))];
  if (fd.get("new_verification_type")) data.verification_types = [...(data.verification_types ?? []), String(fd.get("new_verification_type"))];
  await db.update(s.standards).set({ data, updatedBy: actor.id, updatedAt: new Date() }).where(eq(s.standards.id, "current"));
  await emit("standard_change", "firm", { data });
  back(fd);
}

/* ---------- cursor: mark everything as seen ---------- */
export async function markSeen() {
  const actor = await getActor();
  const [last] = await db.select().from(s.events).orderBy(desc(s.events.id)).limit(1);
  await db.insert(s.cursors).values({ actorId: actor.id, lastSeenEventId: last?.id ?? 0 }).onConflictDoUpdate({ target: s.cursors.actorId, set: { lastSeenEventId: last?.id ?? 0, at: new Date() } });
  revalidatePath("/activity");
}

/* ---------- carry-forward ---------- */
export async function carryForward(fd: FormData) {
  const actor = await getActor();
  if (!can(actor, "note")) throw new Error("Not permitted for your role");
  const items = fd.getAll("item").map(String);
  await emit("note", "carryforward", { text: `Carried to 2026: ${items.join("; ")}`, items, by: actor.id });
  back(fd);
}
