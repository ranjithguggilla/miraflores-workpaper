import { db, schema as s } from "@/db";
import type { Issue } from "@/lib/state";
import { describeRefs } from "@/lib/describe";
import { checkLabel, kindLabel } from "@/lib/labels";
import { areaName } from "@/lib/areas";
import { IssueList, type IssueView } from "./issue-list";
import { getActor } from "@/lib/session";
import { maskText } from "@/lib/mask";

/** Server side: turns issues into view models with human refs, then hands to the client list. */
export async function Issues({ issues, path, showArea = false, pageSize = 20, filters = true, compact = false }: { issues: Issue[]; path: string; showArea?: boolean; pageSize?: number; filters?: boolean; compact?: boolean }) {
  const [staff, actor] = await Promise.all([db.select().from(s.staff), getActor()]);
  const m = (t: string) => maskText(t); // SSNs, bank and PINs are revealed only through the logged unmask on the Client and Documents pages
  void actor;
  const allRefs = [...new Set(issues.flatMap((i) => i.refs))];
  const described = await describeRefs(allRefs);
  const dmap = new Map(described.map((d) => [d.ref, { ...d, label: m(d.label), sub: d.sub ? m(d.sub) : d.sub }]));
  const views: IssueView[] = issues.map((i) => ({
    id: i.id, kind: i.kind, kindLabel: kindLabel(i.kind), code: i.code, codeLabel: checkLabel(i.code), severity: i.severity, blocksFiling: i.blocksFiling,
    area: i.area, areaName: areaName(i.area), title: m(i.title), detail: m(i.detail), refs: i.refs.map((r) => dmap.get(r)!).filter(Boolean),
    assignedTo: i.assignedTo, assignedName: staff.find((m) => m.id === i.assignedTo)?.name ?? null, due: i.due, status: i.status,
    resolvedBy: staff.find((m) => m.id === i.resolvedBy)?.name ?? i.resolvedBy, resolvedAt: i.resolvedAt?.toISOString() ?? null, resolution: i.resolution,
    isQuestion: i.kind === "client_question" && i.code === "QUESTION",
  }));
  return <IssueList issues={views} staff={staff.map((m) => ({ id: m.id, name: m.name }))} path={path} showArea={showArea} pageSize={pageSize} filters={filters} compact={compact} />;
}

/** Compatibility wrapper for pages that render one issue at a time. */
export async function IssueCard({ issue, path, showArea = false }: { issue: Issue; path: string; showArea?: boolean }) {
  return <Issues issues={[issue]} path={path} showArea={showArea} filters={false} />;
}
