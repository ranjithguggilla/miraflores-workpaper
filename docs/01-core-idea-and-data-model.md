# Core idea and data model

Ranjith Guggilla · Miraflores AI case study · November 2026

## The idea: a return is a graph of claims, and the workpaper is the audit trail of each claim

Every number on the return is a **claim**: "line F1040.1a is 212,400." A claim is only as good as the chain beneath it — which document, which field, who read it, who verified it, what was changed and why, and who signed off. A spreadsheet stores the number and loses the chain. The workpaper stores the chain and derives the number.

So the product is not pages of schedules; it is one **trace graph**:

- **Down**: any line → its inputs → the extracted values → the exact field on a rendered source page.
- **Up**: any document or field → every line it landed on (or why it didn't: duplicate, superseded, out of scope).
- **Sideways**: related items across the return (W-2 box 14 ↔ 1099-B RSU lots ↔ stock supplement), across years (basis roll-forward, carryovers, prior preparer notes), and across related returns (K-1 ↔ the S-corp's composite filing).

Everything a person does — verify, adjust, question, note, sign, view sensitive data — is an **append-only event** on a node of that graph. State is derived from events, never overwritten. That one decision gives, for free: "what changed since I last looked" (events after my cursor), undo (compensating event), version compare (replay to two points), what-ifs (events on a scratch branch), sign-offs that reopen (a sign-off records the hash of what it covered; a later event on that scope invalidates it), filing freeze (a sealed snapshot) and amendment (events on top of the seal), and a self-contained notice response (export the subgraph under the examined lines).

The surface is built around **work, not forms**: an inbox of what needs me (open items, variances, low-confidence reads, unresolved checks, blocked sign-offs), eight areas that match the firm's budget lines, and a trace panel that opens from any number. Large detail (260 lots) is summarized by reconciliation status — only the lots that fail a check are expanded. Forms exist as one view of the graph, for the CPA who wants them.

**Checks that don't trust the engine** are independent rules that read documents and third-party records, not the engine's lines: duplicate pages, same-money-twice across documents, summary-vs-detail, noncovered lots with zero basis, client answer vs third-party record, closing-statement prorations, payments vs IRS/FTB transcripts. They produced the error list in `02-errors-found.md`.

## Data model (Postgres; Drizzle ORM — 13 tables)

**Immutable packet layer** (loaded as delivered; never edited)
- `Document(id, type, title, belongs_to, received_at, status, superseded_by)` · `Page(doc_id, n, printed_content, content_hash)`
- `ExtractedValue(id, doc_id, page, field, label, value, text_as_read, position, confidence)`
- `ReturnLine(version, key, jurisdiction, form, line, label, value, rule, inputs[], sources[])` — the engine DAG, three versions
- `ReturnVersion(version, computed_at, summary, tax_effect_rates, diagnostics, changes_from_previous)` · `Staff` · `PacketSection(key, json)` for household, client answers, prior years, agency records, timeline, engine reference, what-ifs, fx rates

**Workpaper layer** (append-only)
- `Event(id, at, actor_id, role, kind, target_type, target_id, payload jsonb, batch_id, reverses_event_id)` — the single write path. Kinds: `verify`, `adjust`, `note`, `question`, `answer`, `assign`, `sign_off`, `attach`, `resolve`, `view_sensitive`, `time`, `whatif_*`, `freeze`, `amend`, `file`, `efile_result`.
- **Persisted** (because they carry identity or a seal): `Issue(kind, code, severity, blocks_filing, area, assigned_to, due, status, thread)`, `Scenario`, `Snapshot(kind: freeze|amendment, lines, summary, hash)`, `Standards(json)` (firm rules as data: thresholds, verification types, required steps), `Cursor(actor, last_seen_event)`.
- **Derived at read time** from events, never stored:
  - `Claim(key, current_value, origin: engine|adjusted|client, version, adjusted_by_event)`
  - `Verification(claim_key, type ∈ firm.verification_types, evidence_ref, by, at)`
  - `Adjustment(line_key, old, new, reason, authority, tax_effect_fed, tax_effect_ca, status: proposed|approved, requires_partner)` — tax effect = Δ × `tax_effect_rates[category]`
  - `Link(from_ref, to_ref, relation: same_money|supersedes|duplicate_of|supports|related_year|related_return)` — refs are typed URIs: `ev:0493`, `doc:D11#p2`, `line:v3/F8949.B.N1`, `msg:07`, `qa:41`, `py:2024/F8606.14`
  - `SignOff(scope, level: preparer|reviewer|partner|client, by, at, covered_hash, invalidated_by_event)`
  - `ViewLog` = `view_sensitive` events · `TimeEntry` = `time` events · what-if changes = events on a `scenario_id` branch
- **Roles**: enforced server-side from `Staff.role` + `sensitive_data_clearance`; the role switcher sets the acting staff id. Rules from `firm.starter_standards` are data, editable by the administrator role.

**Why this scales past the demo**: real source documents replace simulated pages by swapping `Page.printed_content` for an image + the same `position` boxes; a real engine replaces `ReturnLine` by writing new versions with the same `inputs/sources` contract; every workpaper record points at refs, not rows, so nothing in the event log changes.

**Stack**: Next.js 16 (App Router, server components, server actions — no client-side state store), Postgres 16 + Drizzle, a packet import that validates before it writes, 25 independent check rules, a simulated page renderer with highlight overlay, React Flow for the trace graph. One Docker host behind Caddy.

**Limitations, stated plainly**: tax effects are linear (Δ × the engine's per-dollar rate by category); the engine cannot be rerun, so knock-ons (SE tax, QBI, SEP limit, California AMT) are flagged, not recomputed. The role switcher is a demo device, not authentication; permissions are still enforced server-side per role. Page positions are synthetic because the packet has no page images. Issues are the one derived table that is persisted, because assignment and threads need identity.

**What I would build next**: season replay (scrub the event log and watch the balance move), knock-on recompute for Schedule C, real sign-in, file attachments.
