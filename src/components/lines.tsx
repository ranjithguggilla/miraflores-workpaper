import Link from "next/link";
import { CheckCheck } from "lucide-react";
import type { Line, Claim, Event } from "@/lib/state";
import { Money, StatusBadge } from "./ui";
import { bulkVerify } from "@/lib/actions";
import { ActionForm } from "./client";
import { verificationLabel } from "@/lib/labels";

export function LineTable({ lines, claims, verifications, priorLines, path, standards, selectable = true }: {
  lines: Line[]; claims: Map<string, Claim>; verifications: Map<string, Event[]>; priorLines?: Record<string, number>; path: string; standards: any; selectable?: boolean;
}) {
  const vtypes: string[] = standards?.verification_types ?? [];
  return (
    <ActionForm action={bulkVerify} toast="Verified selected lines">
      <input type="hidden" name="_return" value={path} />
      <div className="card overflow-hidden">
        <table className="ledger">
          <thead><tr>{selectable && <th className="w-8"></th>}<th>Line</th><th>Label</th><th className="r">2024</th><th className="r">Engine</th><th className="r">Current</th><th>Status</th><th className="r">Sources</th></tr></thead>
          <tbody>
            {lines.map((l) => {
              const c = claims.get(l.key);
              const v = (verifications.get(`line:${l.key}`) ?? []).map((e) => String((e.payload as any).type));
              const py = priorLines?.[l.key];
              return (
                <tr key={l.key}>
                  {selectable && <td><input type="checkbox" name="keys" value={l.key} className="h-4 w-4 p-0" /></td>}
                  <td><Link href={`/lines/${encodeURIComponent(l.key)}`} className="link mono">{l.key}</Link></td>
                  <td className="max-w-lg"><span className="block">{l.label}</span>{l.note && <span className="block text-fg-3 text-xs">{l.note}</span>}</td>
                  <td className="r text-fg-3"><Money v={py} /></td>
                  <td className="r"><Money v={l.value} /></td>
                  <td className="r">{c?.origin !== "engine" ? <strong><Money v={c?.current} /></strong> : <span className="text-fg-4">=</span>}</td>
                  <td><StatusBadge origin={c?.origin ?? "engine"} verified={v} /></td>
                  <td className="r text-fg-3 text-xs whitespace-nowrap">{l.sources.length ? `${l.sources.length} source${l.sources.length > 1 ? "s" : ""}` : l.inputs.length ? `${l.inputs.length} input${l.inputs.length > 1 ? "s" : ""}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selectable && (
        <div className="flex gap-2 items-center mt-2 text-xs text-fg-3">
          <span>With selected lines:</span>
          <select name="type" className="h-7 text-xs">{vtypes.map((t) => <option key={t} value={t}>{verificationLabel(t)}</option>)}</select>
          <input name="note" placeholder="Note (optional)" className="h-7 text-xs" />
          <button className="btn sm"><CheckCheck /> Verify selected</button>
          <span>Recorded as one batch; undo together from Activity.</span>
        </div>
      )}
    </ActionForm>
  );
}
