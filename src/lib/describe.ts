import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { parseRef, refHref } from "./refs";
import { docTypeLabel } from "./labels";
import { areaName } from "./areas";

export type Described = { ref: string; href: string | null; label: string; sub?: string; kind: string };

/** Turn typed refs into human descriptions in one batch: "D28 · Northlake 1099 composite, page 3". */
export async function describeRefs(refs: string[]): Promise<Described[]> {
  const parsed = refs.map(parseRef);
  const evIds = parsed.filter((p) => p.type === "ev").map((p) => `ev-${p.id}`);
  const evs = evIds.length ? await db.select().from(s.extractedValues).where(inArray(s.extractedValues.id, evIds)) : [];
  const docIds = [...new Set([...parsed.filter((p) => p.type === "doc").map((p) => p.id), ...evs.map((e) => e.docId)])];
  const docs = docIds.length ? await db.select().from(s.documents).where(inArray(s.documents.id, docIds)) : [];
  const lineKeys = parsed.filter((p) => p.type === "line").map((p) => p.id);
  const lines = lineKeys.length ? await db.select({ key: s.returnLines.key, label: s.returnLines.label }).from(s.returnLines).where(inArray(s.returnLines.key, lineKeys)) : [];
  const staffIds = parsed.filter((p) => p.type === "staff").map((p) => p.id);
  const staff = staffIds.length ? await db.select().from(s.staff).where(inArray(s.staff.id, staffIds)) : [];
  const dmap = new Map(docs.map((d) => [d.id, d]));
  const lmap = new Map(lines.filter((l) => true).map((l) => [l.key, l.label]));
  return parsed.map((p) => {
    const href = refHref(p.raw);
    switch (p.type) {
      case "doc": { const d = dmap.get(p.id); return { ref: p.raw, href, kind: "doc", label: d ? `${d.id} · ${d.title}` : p.id, sub: d ? `${docTypeLabel(d.documentType)}${p.frag ? `, page ${p.frag.slice(1)}` : ""}` : undefined }; }
      case "ev": { const e = evs.find((x) => x.id === `ev-${p.id}`); const d = e && dmap.get(e.docId); return { ref: p.raw, href, kind: "value", label: e ? `${e.label} = ${e.textAsRead ?? JSON.stringify(e.value)}` : `value ${p.id}`, sub: d ? `${d.id} · ${d.title}, page ${e!.page}` : undefined }; }
      case "line": return { ref: p.raw, href, kind: "line", label: p.id, sub: lmap.get(p.id) };
      case "qa": return { ref: p.raw, href, kind: "client", label: `Client questionnaire, question ${p.id}` };
      case "msg": return { ref: p.raw, href, kind: "client", label: `Client message ${p.id}` };
      case "call": return { ref: p.raw, href, kind: "client", label: `Call notes ${p.id}` };
      case "py": return { ref: p.raw, href, kind: "prior", label: `2024 return · ${p.id.split("/").pop()}` };
      case "household": return { ref: p.raw, href, kind: "client", label: `Household record (${p.id})` };
      case "staff": { const m = staff.find((x) => x.id === p.id); return { ref: p.raw, href: null, kind: "person", label: m?.name ?? p.id }; }
      case "ref": return { ref: p.raw, href, kind: "param", label: `Engine parameter ${p.id.replace(/\./g, " › ").replace(/_/g, " ")}` };
      case "whatif": return { ref: p.raw, href, kind: "whatif", label: `What-if: ${p.id.replace(/_/g, " ")}` };
      case "area": return { ref: p.raw, href, kind: "area", label: `Area · ${areaName(p.id)}` };
      case "issue": return { ref: p.raw, href, kind: "issue", label: `Issue #${p.id}` };
      case "scenario": return { ref: p.raw, href: "/whatif", kind: "whatif", label: `What-if scenario ${p.id}` };
      case "snapshot": return { ref: p.raw, href: "/filing", kind: "event", label: `Sealed snapshot ${p.id}` };
      case "return": return { ref: p.raw, href: "/filing", kind: "line", label: "The return" };
      case "firm": return { ref: p.raw, href: "/firm", kind: "area", label: "Firm standards" };
      case "carryforward": return { ref: p.raw, href: "/carry-forward", kind: "event", label: "Carry-forward note" };
      case "event": return { ref: p.raw, href: null, kind: "event", label: `Event #${p.id}` };
      default: return { ref: p.raw, href, kind: p.type, label: p.raw };
    }
  });
}
