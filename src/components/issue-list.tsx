"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, AlertTriangle, Info, ChevronRight, Lock, CheckCheck, UserPlus, MessageSquareReply, RotateCcw, MoreHorizontal, Filter } from "lucide-react";
import type { Described } from "@/lib/describe";
import { resolveIssue, assignIssue, answerQuestion } from "@/lib/actions";
import { ActionForm } from "./client";
import { RefChip, Avatar } from "./ui";
import { Collapse } from "./motion";

export type IssueView = {
  id: number; kind: string; kindLabel: string; code: string | null; codeLabel: string; severity: string; blocksFiling: boolean; area: string; areaName: string;
  title: string; detail: string; refs: Described[]; assignedTo: string | null; assignedName: string | null; due: string | null; status: string;
  resolvedBy: string | null; resolvedAt: string | null; resolution: string | null; isQuestion: boolean;
};

const sevIcon = (s: string) => s === "blocker" ? <AlertOctagon className="text-bad" /> : s === "warning" ? <AlertTriangle className="text-adj" /> : <Info className="text-info" />;

export function IssueList({ issues, staff, path, showArea, pageSize, filters, compact }: { issues: IssueView[]; staff: { id: string; name: string }[]; path: string; showArea: boolean; pageSize: number; filters: boolean; compact: boolean }) {
  const [sev, setSev] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [open, setOpen] = useState<number | null>(null);
  const [n, setN] = useState(pageSize);
  const kinds = useMemo(() => [...new Set(issues.map((i) => i.kindLabel))], [issues]);
  const shown = issues.filter((i) => (sev === "all" || i.severity === sev) && (kind === "all" || i.kindLabel === kind));
  if (!issues.length) return null;
  return (
    <div>
      {filters && issues.length > 5 && (
        <div className="flex items-center gap-2 mb-2 text-xs text-fg-3">
          <Filter className="w-3.5 h-3.5" />
          <select value={sev} onChange={(e) => { setSev(e.target.value); setN(pageSize); }} className="h-7 text-xs"><option value="all">All severities</option><option value="blocker">Blockers</option><option value="warning">Warnings</option><option value="info">Info</option></select>
          <select value={kind} onChange={(e) => { setKind(e.target.value); setN(pageSize); }} className="h-7 text-xs"><option value="all">All kinds</option>{kinds.map((k) => <option key={k}>{k}</option>)}</select>
          <span>{shown.length} of {issues.length}</span>
        </div>
      )}
      <div className="card divide-y divide-line overflow-hidden">
        {shown.slice(0, n).map((i) => {
          const isOpen = open === i.id;
          return (
            <div key={i.id} id={`issue-${i.id}`} className={isOpen ? "bg-s2/40" : ""}>
              <button type="button" onClick={() => setOpen(isOpen ? null : i.id)} className="row-expand w-full text-left flex items-center gap-3 px-3 py-2.5">
                <ChevronRight className={`chev w-4 h-4 text-fg-4 shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                <span className="[&>svg]:w-4 [&>svg]:h-4 shrink-0">{sevIcon(i.severity)}</span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[13px]">{i.title}</span>
                  <span className="block text-[11.5px] text-fg-3 truncate">{i.codeLabel || i.kindLabel}{showArea ? ` · ${i.areaName}` : ""}{i.blocksFiling ? " · blocks filing" : ""}{i.due ? ` · due ${i.due}` : ""}</span>
                </span>
                {i.blocksFiling && <Lock className="w-3.5 h-3.5 text-bad shrink-0" />}
                {i.status !== "open" && <span className="badge ok">{i.status === "wont_fix" ? "Won't fix" : "Resolved"}</span>}
                {i.assignedName && <Avatar name={i.assignedName} size={22} />}
              </button>
              <Collapse open={isOpen}>
                <div className="px-10 pb-4 pt-1 text-[13px]">
                  <p className="text-fg-2 whitespace-pre-wrap leading-relaxed max-w-3xl">{i.detail}</p>
                  {i.refs.length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{i.refs.map((d) => <RefChip key={d.ref} d={d} />)}</div>}
                  {i.resolution && <p className="text-ok text-xs mt-3 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> {i.resolvedBy}: {i.resolution}</p>}
                  <div className="flex flex-wrap gap-2 mt-4 items-center">
                    {i.status === "open" ? (
                      i.isQuestion ? (
                        <ActionForm action={answerQuestion} toast="Answer recorded as evidence" className="flex gap-1.5"><input type="hidden" name="_return" value={path} /><input type="hidden" name="id" value={i.id} /><input name="text" placeholder="Answer (becomes evidence)" className="w-72" required /><button className="btn sm primary"><MessageSquareReply /> Answer</button></ActionForm>
                      ) : (
                        <ActionForm action={resolveIssue} toast="Issue closed" className="flex gap-1.5"><input type="hidden" name="_return" value={path} /><input type="hidden" name="id" value={i.id} /><input name="resolution" placeholder="How was it resolved?" className="w-64" /><select name="status" defaultValue="resolved" className="h-[26px] text-xs"><option value="resolved">Resolved</option><option value="wont_fix">Won't fix</option></select><button className="btn sm primary"><CheckCheck /> Close</button></ActionForm>
                      )
                    ) : (
                      <ActionForm action={resolveIssue} toast="Issue reopened"><input type="hidden" name="_return" value={path} /><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="open" /><button className="btn sm"><RotateCcw /> Reopen</button></ActionForm>
                    )}
                    <ActionForm action={assignIssue} toast="Assignment updated" className="flex gap-1.5 ml-auto"><input type="hidden" name="_return" value={path} /><input type="hidden" name="id" value={i.id} /><select name="to" defaultValue={i.assignedTo ?? ""} className="h-[26px] text-xs"><option value="">Unassigned</option>{staff.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select><input type="date" name="due" defaultValue={i.due ?? ""} className="h-[26px] text-xs" /><button className="btn sm"><UserPlus /> Assign</button></ActionForm>
                    <Link href={`/issues/${i.id}`} className="btn sm ghost" title="Open thread"><MoreHorizontal /></Link>
                  </div>
                </div>
              </Collapse>
            </div>
          );
        })}
      </div>
      {n < shown.length && <button className="btn ghost mt-2" onClick={() => setN(n + pageSize)}>Show {Math.min(pageSize, shown.length - n)} more · {shown.length - n} remaining</button>}
    </div>
  );
}
