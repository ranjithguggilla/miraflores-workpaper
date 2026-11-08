/**
 * Simulated source page. Renders printed_content as a page and highlights the field.
 * Swap `content` for a page image and keep the same `position` boxes and this works unchanged with real documents.
 */
export function PageSheet({ content, highlight, highlights, position, compact = false, id }: {
  content: string; highlight?: string | null; highlights?: { text: string; id: string; position?: any }[];
  position?: { x0: number; y0: number; x1: number; y1: number } | null; compact?: boolean; id?: string;
}) {
  const hls = [...(highlights ?? []), ...(highlight ? [{ text: highlight, id: "hl" }] : [])].filter((h) => h.text);
  // split content on every highlight occurrence (first occurrence per text)
  const parts: { text: string; hl?: string }[] = [];
  let rest = content;
  const found = hls.map((h) => ({ ...h, idx: content.indexOf(h.text) })).filter((h) => h.idx >= 0).sort((a, b) => a.idx - b.idx);
  let cursor = 0;
  for (const h of found) {
    if (h.idx < cursor) continue;
    parts.push({ text: content.slice(cursor, h.idx) });
    parts.push({ text: h.text, hl: h.id });
    cursor = h.idx + h.text.length;
  }
  parts.push({ text: content.slice(cursor) });
  rest = "";
  const boxes = [...(highlights ?? []).map((h) => h.position).filter(Boolean), position].filter(Boolean) as any[];
  return (
    <div id={id} className={`page-sheet mt-2 ${compact ? "max-h-56 overflow-auto" : ""}`}>
      {parts.map((p, i) => p.hl ? <mark key={i} className="hl" title={p.hl}>{p.text}</mark> : <span key={i}>{p.text}</span>)}
      {!compact && boxes.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {boxes.map((b, i) => <div key={i} className="absolute border-2 border-amber-400/70 rounded-sm" style={{ left: `${b.x0 * 100}%`, top: `${b.y0 * 100}%`, width: `${(b.x1 - b.x0) * 100}%`, height: `${(b.y1 - b.y0) * 100}%` }} />)}
        </div>
      )}
      {rest}
    </div>
  );
}
