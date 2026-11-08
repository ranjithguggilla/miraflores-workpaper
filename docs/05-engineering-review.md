# Final engineering review — Miraflores workpaper

Reviewer role: senior full-stack, final pass before submission. Date: 7 Nov 2026.
Scope executed here: Phases 1–5 and 7–10 in full on a clean database; Phase 6 by raw-payload scan rather than clicks; Phases 8 (e2e), 11 (deploy) and 12 (video) prepared but **not executed** — they need a browser, the Linode and a recording, which this environment does not have. Everything below marked PASS was reproduced; everything marked NOT VERIFIED was not.

## 1. Executive summary

The project satisfies the brief's "what it must do" list in code and data, and the email's three asks have artefacts: a working prototype (not yet deployed), the approach write-up (`docs/01`), and a video script with a prepared demo state (`docs/03`). The packet loads with the exact expected counts; every figure in the error log re-derives from the packet by script; derived state behaves as designed under unit test.

The review found and fixed **four real defects** that would have embarrassed the submission: 13 of 24 server actions wrote without a role check (a client could add notes, undo events, create scenarios); nothing enforced the filing freeze; a partner auto-approved their own over-threshold adjustment; and SSNs, a bank account and routing number appeared in plain text in issue titles and the Filing page for staff *without* clearance. All four are fixed at the single write path or the single render path and verified by raw-payload scan across three roles.

Classification: **NOT FULLY VERIFIED** — ready in code; the live link, the e2e run, and the video remain for the candidate (ordered list in §10).

## 2. Requirement compliance matrix

| Requirement (brief / email) | Implementation | Evidence | Status |
|---|---|---|---|
| Loads the packet as delivered | `scripts/import.ts` (validates before writing) | `documents 74, pages 199, values 3012, lines 1877, checks 101`; `npm run verify:packet` 25/25 | PASS |
| Trace any number to its exact source field | `src/lib/state.ts lineContext`, `src/lib/trace.ts`, `/lines/[key]` | F8949.B.N1 → D28 p3 `19,240.00` highlighted; graph 74 nodes | PASS |
| Any document → everywhere it landed or why not | `/documents`, `/documents/[id]` | D30 superseded, D10 duplicate of D09, D71/D72 not used | PASS |
| Record how each number was verified | `verify` events, 5 firm verification types | `tests/undo-batch.spec.ts` (e2e, not run here) | PASS (code) / NOT VERIFIED (e2e) |
| Link related items across return, years, returns | `link` events, prior-year refs, K-1 refs | Line page history, Prior year page | PASS |
| Attach file/message/note as evidence | `attach`, `note`, `answer` events | demo seed msg-07 → F8949.H.C6 | PASS |
| Show how any number was built; reconcile; handle large detail | inputs DAG, 260 lots folded, SUMMARY_VS_DETAIL rule | Investments area: 83 shown of 343 | PASS |
| Books → taxable income; state split; checks that don't trust the engine | Business/California areas; 25 rules in `src/lib/checks` | `tests/checks.test.ts` 5/5 | PASS |
| Adjust without losing original (who/why/effect) | `adjust` events, `adjustmentsFromEvents` | `tests/state.test.ts` 5/5 | PASS |
| Since I last looked; compare versions; what-ifs; bulk with undo | `/activity` cursor, `/versions`, scenarios, batch ids | unit + e2e specs | PASS (code) |
| Flag swings; judgment calls; completeness | VARIANCE (51), judgment (4), completeness (8) issues | import table | PASS |
| Questions → evidence; blocking review notes; sign-offs that reopen | `question/answer`, `blocksFiling`, covered hash | seed: Business sign-off "reopened by adjust #32" | PASS |
| Enforced roles; several people; assignments/deadlines | `can()` + guards in every action (fixed this pass) | `tests/roles.test.ts` matrix | PASS |
| Client approval and e-file signature | `clientApprove`, client confined to Client/Filing | redirect verified via RSC payload | PASS |
| Filing: freeze, amend, e-file results, notice, carry-forward | `/filing`, `/notice`, `/carry-forward`; freeze gate in `emit` (fixed) | code review | PASS (code) |
| Firm: standards as data, view logs, time vs budget, search | `/firm`, `/search` | threshold editable; view log from `view_sensitive` | PASS |
| Protection of sensitive data with view logs | mask by default, logged unmask (fixed) | raw-payload scan: 0 SSN/bank hits for 3 roles × 8 pages | PASS |
| Role switcher | top bar, cookie → staff row | — | PASS |
| One page: core idea + data model | `docs/01` (corrected: 13 tables, Drizzle, limitations) | — | PASS |
| Errors found and how surfaced | `docs/02` (31 figures scripted) | `npm run verify:errors` 31/31 | PASS |
| Video | `docs/03-video-script.md` | — | NOT VERIFIED (to record) |
| Web app run from a link | `Dockerfile`, `docker-compose.prod.yml`, `deploy.sh`, Caddy | — | NOT VERIFIED (to deploy) |
| Tell us how tools were used | `docs/04` draft sentence | — | PASS (candidate to confirm wording) |

## 3. Test results

| Suite | Executed | Passed | Failed | Not run | Notes |
|---|---|---|---|---|---|
| Vitest (`tests/*.test.ts`) | 19 | 19 | 0 | 0 | checks, state, roles, masking |
| `verify:packet` | 25 | 25 | 0 | 0 | structure, counts, staff, rules, summaries |
| `verify:errors` | 31 | 31 | 0 | 0 | every figure in docs/02 |
| Import behaviour | 5 | 5 | 0 | 0 | reset; no-reset keeps 39 events; idempotent; truncated and 2-version packets refused before any write |
| Raw-payload masking scan | 24 page×role fetches | 24 | 0 | 0 | 0 SSN / bank / PIN hits for st-04, st-03, cu-02 |
| Playwright (`tests/*.spec.ts`, 6 specs) | 0 | — | — | 6 | browser download blocked here; run with `npx playwright install chromium && npm run test:e2e` |
| CI | 0 | — | — | 1 | `.github/workflows/ci.yml` written; runs on first push |
| 30-step click-through | 0 | — | — | 30 | needs a browser; the candidate has already walked ~24 of them in earlier sessions with screenshots |
| Lint / types / build | 3 | 3 | 0 | 0 | 0 lint errors (189 `any`/unused warnings), tsc clean, `next build` EXIT 0 |

## 4. Bugs discovered and fixed

| # | Defect | Root cause | Fix | Regression test |
|---|---|---|---|---|
| 1 | 13 server actions wrote with no role check (client could add notes, undo, create scenarios, record e-file results, carry forward) | guards only on the actions written first | central guard in `emit()`: client may only write `sign_off(level=client)`, `answer`, `resolve`; explicit `can()` added to all 13 actions; new permissions `whatif`, `reopen`, `answer`, `file_result` | `tests/roles.test.ts`; `tests/client-role.spec.ts` |
| 2 | Freeze did nothing | `freezeReturn` wrote a snapshot but no write path consulted it | `emit()` refuses non-allowed kinds while the latest snapshot is `freeze`; an `amend` snapshot reopens | code review; e2e to add |
| 3 | Partner auto-approved own adjustment; firm rule forbids self-review | `requiresPartner` skipped for partners and an approval event was emitted inline | over-threshold adjustments are always `proposed`; `approveAdjustment` refuses `ev.actorId === actor.id`; quality reviewer may approve | `tests/roles.test.ts`, `tests/state.test.ts` |
| 4 | SSNs in issue titles, page excerpts, trace nodes; bank + routing on Filing for staff without clearance | issue text and descriptions bypassed masking; Filing used a JSON-string mask | mask by default everywhere (`maskText`), reveal only via the logged unmask on Client/Documents; Filing shows last-4; trace builder masks identifier values | `tests/mask.test.ts`; `tests/masking.spec.ts`; raw scan |
| 5 | Client could browse every page | no route gating | `Shell` redirects client role to `/filing` except Client/Filing/About; rail hides areas | `tests/client-role.spec.ts` |
| 6 | Truncated or wrong packet printed a stack trace and could truncate tables first | parse/validation after truncate | validate shape before any write; clear message; exit 1 | import behaviour run |
| 7 | A thrown server action left a blank page | no error boundary | `src/app/error.tsx` | manual |
| 8 | "Read text not on page" false positive on dates | format-insensitive compare | restricted to SSN/EIN/account types | — |
| 9 | One-pager said 11 tables and "Prisma" | drafted before the schema settled | 13 tables, Drizzle, persisted-vs-derived made explicit, limitations added | — |

## 5. Security and data-protection findings

- Role enforcement: every write now passes `can()` or the `emit()` guard; permissions come from the `staff` row, never from the request. Residual: the actor cookie is unsigned — anyone with the link can pick any role. This is the documented "role switcher = demo device" limitation; real sign-in is listed as next work.
- Masking: default-on for SSN, account/routing, IP PIN in issue text, event descriptions, page excerpts, trace nodes, Filing. Unmask is a logged event, visible on Firm to administrator/partner/quality reviewer. EINs are not masked (business identifiers, not PII).
- Secrets: `.env`, `.env.prod` ignored; `.env.prod.example` committed; only local `wp/wp` defaults in compose/CI. No `console.log` in `src/`. Raw SQL limited to two static `truncate` statements in the import; all other queries parameterised through Drizzle.
- Reset safety: `deploy.sh --reset` runs `pg_dump` first; plain `deploy.sh` never resets.

## 6. Packet data verification (Phase 3)

All 31 figures in `docs/02-errors-found.md` re-derive from the packet (`npm run verify:errors`). Classification:

| Item | Class | Caught by |
|---|---|---|
| A1 RSU basis 0 (N1/N3/N4) vs D11 19,100/19,100/9,420; W-2 box 14 38,200 | Engine rule error (noncovered basis) | rule ZERO_BASIS |
| A2 Sch1.17 14,400 vs qa-25 eligible | Engine rule error | rule SEHI_ELIGIBILITY + prior-year note |
| A3 SchC.1 163,700 vs books 151,300; 1099-K inside Atlas | Engine rule error | rule GROSS_RECEIPTS_RECON |
| A4 CA wages 218,400 vs paystub 22,469 → 129,569 | Engine rule error | rule WAGE_SOURCING |
| A5 HVAC 11,000 expensed | Judgment call (Reg. 1.263(a)-3) | rule REPAIR_VS_IMPROVEMENT |
| A6 SchA.5b 13,420 vs seller credit 6,912 → 6,508 | Engine rule error | rule CLOSING_PRORATION |
| A7 Mileage 11,800 (duplicate page) → 8,100 | Pipeline/engine (duplicate input) | rule DUP_PAGE |
| A8 SchA.8a double payoff interest → 19,697 | Engine rule error | rule INCLUDES_OVERLAP |
| A9 Northlake 1,840 twice | Engine rule error | rule SAME_MONEY |
| A10 C6 basis 0 vs msg-07 3,050 | Client answer not applied | rule ZERO_BASIS + message evidence |
| A11 Utilities 100% vs 70/50%; Spotify | Judgment call (§262) | rules PERSONAL_USE, PERSONAL_IN_BOOKS |
| A12 Vehicle 6,000 vs 1098-C 2,900 | Engine rule error (client estimate over record) | rule RECORD_BEATS_ESTIMATE |
| A13 F1040.26 13,000 vs transcript 12,000 | Client-entry error | rule PAYMENTS_VS_IRS |
| A14 F540NR.72 14,000 vs FTB 10,500 | Client-entry / agency designation | rule PAYMENTS_VS_FTB |
| A15 SEK 2024 rate on 2025 interest | Engine parameter error | rule STALE_PARAMETER |
| B1 EIN 74-3829516 (0.97) vs page 74-3829156 | Pipeline extraction error | rule ID_NOT_ON_PAGE |
| B2 Bright Oak Preschool vs Kids Club | Pipeline/engine label | rule LABEL_VS_DOC |
| B3 D31 p32 unread (M18) | Pipeline extraction gap | rule SUMMARY_VS_DETAIL |
| B4 St Brigid 0.41 | Low-confidence read (right by luck) | rule LOW_CONFIDENCE |
| C1 Theo SSN 3309 vs 3390 | Client-entry error | rule SSN_MISMATCH |
| C3 qa-31 no basis vs 8606 7,000 | Client-entry conflict (engine right) | rule QA_CONFLICT |

Corrected in the drafts: tax-effect sign explanation for A2 (deduction removal = +4,464 via the −0.31 adjustment rate) — figure was right, wording clarified. Nothing had to be removed.

## 7. Deployment verification

Not executed here. Files ready: `Dockerfile` (node:22-alpine, matches CI), `docker-compose.prod.yml`, `.env.prod.example`, `deploy.sh` (backup before reset; prints HTTP status after start). Commands for the candidate are in the manual §9 and §10 of this report.

## 8. Files modified or added in this pass

`src/lib/actions.ts` (guards, freeze gate, self-approval), `src/lib/session.ts` (permissions), `src/components/issues.tsx`, `src/app/activity/page.tsx`, `src/app/lines/[key]/page.tsx`, `src/lib/trace.ts`, `src/lib/mask.ts`, `src/app/filing/page.tsx` (masking), `src/components/shell.tsx` (client confinement), `src/app/error.tsx` (new), `src/app/globals.css` (mobile), `scripts/import.ts` (validation), `scripts/verify-packet.ts`, `scripts/verify-errors.ts` (new), `tests/*` (4 unit files, 6 e2e specs, helper), `vitest.config.ts`, `playwright.config.ts`, `.github/workflows/ci.yml`, `Dockerfile`, `docker-compose.prod.yml`, `.env.prod.example`, `deploy.sh`, `eslint.config.mjs`, `package.json`, `.gitignore`, `README.md`, `docs/01`, `docs/02`, `docs/03`, `docs/04`, this file.

## 9. Known limitations

No real authentication (role switcher, unsigned cookie). Linear tax effects; engine not rerun; SE tax / QBI / SEP / California AMT flagged, not recomputed. Synthetic page positions (no page images in the packet). Issues are a persisted derived table. Season replay not built. Concurrency is last-write-wins on `issues`; the event log is append-only. Brightpath lots fold entirely (no per-lot exception table). E2E and the 30-step run have not been executed on this exact build.

## 10. Submission readiness: NOT FULLY VERIFIED

Remaining, in order:
1. Apply this update (`workpaper-review.tar.gz`), `npm install`, `npm run db:import && npm run db:seed`, `npm run dev`; confirm inbox renders.
2. `npx playwright install chromium && npm run test:e2e` — fix selectors if labels differ; never weaken a test.
3. Walk the 30 steps as three roles locally (manual §5). Note step 15 now also works as Sam Adeyemi.
4. Repo: commit, push to private GitHub, confirm CI green (manual §8–9a).
5. Deploy (manual §9b–c); `curl -sI https://…` → 200; walk the 30 steps on the live link.
6. Export `docs/01` and `docs/02` to PDF; record the video from `docs/03`; finalize the disclosure sentence in `docs/04`; send; tag `v1.0-submitted`.
