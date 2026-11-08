import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

export const dynamic = "force-dynamic";

// Computed once per process: the packet does not change while the app runs.
let packetSha: string | null = null;
function sha(): string {
  if (!packetSha) { try { packetSha = createHash("sha256").update(readFileSync("data/packet.json")).digest("hex"); } catch { packetSha = "unavailable"; } }
  return packetSha;
}

/** Liveness for uptime monitors and reviewers: database reachable, packet identity, size of the event log. */
export async function GET() {
  try {
    const [{ events }] = await db.select({ events: sql<number>`count(*)::int` }).from(s.events);
    const [{ docs }] = await db.select({ docs: sql<number>`count(*)::int` }).from(s.documents);
    return Response.json({ ok: true, db: "up", documents: docs, eventCount: events, packetSha: sha(), at: new Date().toISOString() });
  } catch (e) {
    return Response.json({ ok: false, db: "down", error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
