/** Typed references used everywhere: in line sources, issue refs, event targets, links. */
export type ParsedRef = { type: string; id: string; frag?: string; raw: string };

export function parseRef(raw: string): ParsedRef {
  const [type, rest = ""] = raw.split(/:(.+)/);
  const [id, frag] = rest.split("#");
  return { type, id, frag, raw };
}

/** Where a ref navigates to in the UI. */
export function refHref(raw: string): string | null {
  const r = parseRef(raw);
  switch (r.type) {
    case "line": return `/lines/${encodeURIComponent(r.id)}`;
    case "ev": return `/values/ev-${r.id}`;
    case "doc": return `/documents/${r.id}${r.frag ? `#${r.frag}` : ""}`;
    case "qa": return `/client#qa-${r.id}`;
    case "msg": return `/client#msg-${r.id}`;
    case "call": return `/client#call-${r.id}`;
    case "issue": return `/issues/${r.id}`;
    case "py": return `/prior-year#${r.id.replace(/[^A-Za-z0-9]/g, "_")}`;
    case "household": return `/client#household`;
    case "whatif": return `/whatif`;
    case "asset": return `/areas/rentals_and_sale#assets`;
    case "ref": return `/firm#parameters`;
    case "area": return `/areas/${r.id}`;
    case "timeline": return `/activity`;
    case "agency": return `/filing`;
    default: return null;
  }
}

export function refLabel(raw: string): string {
  const r = parseRef(raw);
  switch (r.type) {
    case "line": return r.id;
    case "ev": return `ev-${r.id}`;
    case "doc": return r.id + (r.frag ? ` ${r.frag}` : "");
    case "qa": return `question ${r.id}`;
    case "msg": return `message ${r.id}`;
    case "call": return `call ${r.id}`;
    case "py": return `2024 ${r.id.split("/").pop()}`;
    case "household": return `household: ${r.id}`;
    case "ref": return `parameter ${r.id}`;
    default: return raw;
  }
}

/** Engine sources use ev-0001 / qa-14 / py:/… ; normalise to typed refs. */
export function normalizeSource(s: string): string {
  if (s.startsWith("ev-")) return `ev:${s.slice(3)}`;
  if (s.startsWith("qa-")) return `qa:${s.slice(3)}`;
  if (s.startsWith("py:/")) return `py:2024${s.slice(3)}`;
  return s;
}
