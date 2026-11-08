# Workpaper — Okafor-Lindqvist 2025

A web-native tax workpaper built for the Miraflores case study. Not a spreadsheet: a **trace graph of claims** with an **append-only event log** underneath.

- `docs/01-core-idea-and-data-model.md` — the core idea and data model (one page)
- `docs/02-errors-found.md` — the packet's errors and how the design surfaces them

## Run it

```bash
docker compose up -d                 # Postgres 16 on :5432 — if that port is taken, change it to 5433 in docker-compose.yml and .env
cp .env.example .env
npm install
npm run db:push                      # create the 13 tables
npm run db:import                    # load the packet as delivered + run the independent checks (prints the counts)
npm run db:seed                      # optional: a mid-season history (verifications, adjustments, sign-offs)
npm run dev                          # http://localhost:3000
```

Checks and tests:

```bash
npm run verify:packet                # 25 structural assertions on data/packet.json (counts, versions, staff, rules)
npm run verify:errors                # re-derives every figure in docs/02-errors-found.md from the packet
npm test                             # vitest: check rules, event-derived state, role matrix, masking
npm run test:e2e                     # playwright against an imported + seeded database (npx playwright install chromium once)
```

The role switcher is in the top bar; it stands in for sign-in in this prototype. Permissions are still enforced on the server from the staff table for every write (`src/lib/actions.ts` → `can()`), the client role is confined to the Client and Filing pages, and sensitive values are masked everywhere until a cleared user unmasks them on the Client or Documents page, which is logged.

## How it is built

**Immutable packet layer** (`documents`, `pages`, `extracted_values`, `return_lines` ×3 versions, `staff`, `packet_sections`). Loaded by `scripts/import.ts`, never edited by the app.

**Event log** (`events`). Every action — verify, adjust, note, question, answer, assign, sign_off, attach, link, resolve, time, view_sensitive, what-if, freeze, amend, undo — is one row. State is derived (`src/lib/state.ts`): current values = engine value + approved adjustments; sign-offs carry a hash of what they covered and show as reopened when anything in scope changes; "what changed since I last looked" = events after my cursor; undo = compensating event; bulk actions share a `batch_id` and undo together; what-ifs are events on a `scenario_id` branch and promote as one batch.

**Issues** (`issues`) are the one persisted derived table because they have identity (assignment, due date, thread). They come from (a) the independent check rules in `src/lib/checks/index.ts`, (b) engine diagnostics, (c) review notes and questions people create.

**Independent checks** read documents and third-party records, not the engine: duplicate pages and documents, same money on two documents, "includes" overlaps, broker summary vs lots and unread pages, zero-basis lots, payments vs IRS/FTB, 1098-C vs client estimate, SSN vs prior return and ID documents, questionnaire vs documents, ID strings not on the page, provider names, low-confidence reads, closing-statement prorations, repair vs improvement, personal-use percentages, gross-receipts reconciliation, wage sourcing vs residency, stale parameters, prior-year open items, variances over the firm threshold, unused documents, outside-scope filings.

**Tax effect** of an adjustment = Δ × `tax_effect_rates[category]` from the engine (the engine cannot be rerun). Adjustments whose effect exceeds the firm threshold stay *proposed* until a partner approves.

**Simulated source pages** render `printed_content` with the extracted `text_as_read` highlighted and the synthetic `position` box drawn. Replace the content with a page image and keep the boxes: the trace links don't change.

## Design

Geist Sans and Geist Mono, self-hosted from the `geist` npm package (no Google or Apple fonts). An 8-pt spacing scale, four surface levels, and semantic colours for verified / adjusted / awaiting-partner / blocker, in light and dark (toggle in the top bar, remembered per browser). Icons from `lucide-react`. Every internal code is mapped to a human label in `src/lib/labels.ts`; references render as "D28 · Northlake 1099 composite, page 3" via `src/lib/describe.ts`. Writes go through `ActionForm`, which disables the form while pending, shows a toast, and refreshes the page.

## Pages

| Route | What |
|---|---|
| `/` | Inbox: what needs me, blockers, adjustments awaiting partner, deadlines, area status and budget |
| `/areas/[area]` | Nine areas matching the firm's budget lines: open items, variances, lines with bulk verify, sign-offs, time, depreciation by asset (rentals) |
| `/lines/[key]` | Trace panel: where it came from (inputs, source pages with highlights, client answers), where it goes, versions, history; adjust / verify / note / question / attach / link |
| `/documents`, `/documents/[id]` | Index (used / superseded / duplicate / reference / unused) and viewer with every extracted value and where it landed; sensitive data masked by clearance, unmasking logged |
| `/client` | Household, questionnaire (with where each answer was used), messages, call notes, open client questions |
| `/prior-year` | Prior preparer's notes and open items, basis by year, carryovers agreed, 2024 vs 2025 lines |
| `/versions` | v1 / v2 / v3 / current / sealed snapshots, compare any two |
| `/whatif` | Scratch scenarios on the event log + the engine's precomputed alternatives and the extension |
| `/filing` | Required steps from firm standards, return-level sign-offs, client e-signature, freeze, amend, e-file results, agency records, client copy |
| `/notice` | Self-contained response for examined lines: the subgraph, decisions, source pages |
| `/carry-forward` | Carryovers, decisions with authority, open items, 2026 plan, hand-off |
| `/firm` | Standards as editable data, people/roles, time vs budget, sensitive-data view log, engine parameters |
| `/activity` | Since I last looked, full event log with undo, season timeline |
| `/search` | Lines, documents, values, issues |

## Deploy

`Dockerfile`, `docker-compose.prod.yml`, `.env.prod.example` and `deploy.sh` run the stack on one host behind Caddy; see `docs/` and the manual. `deploy.sh --reset` backs up the database before reloading the packet.

## Honest status

Working: everything in the table above, end to end on Postgres, with the packet loaded as delivered.

Thin or simplified:
- Tax effects are linear (rate × Δ); knock-ons such as SE tax, QBI and the SEP limit are not recomputed — the engine cannot be rerun, which the brief acknowledges.
- Notifications are the inbox and the "since I last looked" cursor; there is no email/push.
- Concurrency is last-write-wins on the issues table; the event log itself is append-only so nothing is lost.
- The check rules are written against document types and structural patterns; a few (wage sourcing, repair vs improvement) lean on this packet's document mix and would need generalising for other households.
- No file upload for attachments; an attachment is a ref or a file name recorded as evidence.
- E2E tests need a browser (`npx playwright install chromium`); the unit tests and the two verify scripts run anywhere.
