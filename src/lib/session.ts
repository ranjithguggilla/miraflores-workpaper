import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";

export type Actor = typeof s.staff.$inferSelect;

/** The role switcher sets a cookie with the acting staff id. Server code always re-reads the staff row, so permissions come from the database, not the client. */
export async function getActor(): Promise<Actor> {
  const c = await cookies();
  const id = c.get("actor")?.value ?? "st-01";
  const [row] = await db.select().from(s.staff).where(eq(s.staff.id, id));
  if (row) return row;
  const [fallback] = await db.select().from(s.staff).where(eq(s.staff.id, "st-01"));
  return fallback;
}

export const STAFF_ROLES = ["preparer", "reviewer", "partner", "quality_reviewer", "firm_administrator"] as const;

export function can(actor: Actor, action: string): boolean {
  const r = actor.role;
  switch (action) {
    // Preparers, reviewers, partners and the quality reviewer do the work. The firm administrator manages standards, assignments and logs but does not touch return values.
    case "verify": case "adjust": case "attach":
      return r === "preparer" || r === "reviewer" || r === "partner" || r === "quality_reviewer";
    case "note": case "question": case "time":
      return r !== "client";
    case "resolve": case "assign": case "whatif": case "reopen":
      return r !== "client";
    case "answer": return true;                      // the client answers questions; staff may record an answer given by phone
    case "file_result": return r === "partner" || r === "firm_administrator" || r === "preparer";
    case "sign_off_preparer": return r === "preparer" || r === "partner";
    case "sign_off_reviewer": return r === "reviewer" || r === "partner" || r === "quality_reviewer";
    case "sign_off_partner": return r === "partner";
    case "approve_adjustment": return r === "partner" || r === "quality_reviewer";
    case "client_approve": return r === "client";
    case "freeze": case "amend": case "file": return r === "partner";
    case "standards": return r === "firm_administrator";
    case "view_logs": return r === "firm_administrator" || r === "partner" || r === "quality_reviewer";
    case "unmask": return actor.sensitiveClearance;
    default: return false;
  }
}
