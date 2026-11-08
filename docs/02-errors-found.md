# Errors found in the Okafor-Lindqvist 2025 packet

Ranjith Guggilla · November 2026 · packet SHA-256 `ee01f850…c412ad19` · every figure below is re-derived by `npm run verify:errors`

Method: (1) re-derived every engine line from `printed_content` instead of `extracted_values`; (2) cross-checked each third-party record against the client's answers; (3) checked every document that could describe the same money twice; (4) walked the lot-level detail (260 Brightpath + 17 Meridian + 5 Northlake + 12 crypto) against broker summaries.

Tax effects are estimates using `return_versions[v3].tax_effect_rates` (fed / CA per dollar), rounded. "Surfaced by" names the workpaper check that catches it.

## A. Engine errors with material tax effect

| # | What's wrong | Evidence | Approx. effect | Surfaced by |
|---|---|---|---|---|
| A1 | **RSU shares sold with zero basis.** F8949.B.N1, B.N3, E.N4 report gain = full proceeds (37,720 ST + 15,300 LT). Supplement D11 gives adjusted basis 19,100 / 19,100 / 9,420. The 38,200 of RSU income is already in W-2 box 14 → taxed twice. True result: ST −480, LT +5,880. | D11 p2, D28 p3, D08 box 14 | Fed tax overstated ≈ **15,500** | *Noncovered lot with basis 0* rule; cross-doc link W-2 box 14 ↔ 1099-B ↔ supplement |
| A2 | **Self-employed health insurance 14,400 deducted (Sch1.17).** Erik was eligible for Ngozi's employer family plan all year (qa-25); same conclusion in 2024 return notes. Not deductible. | qa-25, D25, 2024 notes | Fed tax understated ≈ **4,460**; CA ≈ 600 | Prior-year note carried forward + questionnaire→line rule |
| A3 | **Sch C gross receipts 163,700 double-counts the 1099-K.** Paywell 12,400 is inside Atlas's 41,200 (D15 p3). Books total 151,300 = 1099-NECs 142,000 + 9,300 non-1099. The 2028 Letter 566 asks for exactly this reconciliation. | D15 p3, D17, D21, D14 | Fed ≈ **4,400** + SE tax; QBI/SEP knock-ons | *Reconciliation: books ↔ 1099-NEC ↔ 1099-K*; the design keeps that reconciliation as the notice response |
| A4 | **CA-source wages = 218,400 (100%).** Halvorsen's W-2 box 16 (111,300) is wrong because payroll kept CA as work state until 9/30 (qa-45, D09 note). Paystub D73 shows CA wages through 7/15 = 22,469. Corvane (107,100) is legitimately CA. | D73, D09, qa-45, residency | CA tax overstated ≈ **5,700–8,800** | State-split view compares W-2 box 16 to residency timeline + paystub |
| A5 | **HVAC 11,000 expensed as a repair (SchE.14A).** Invoice D47 and call-01: whole system replaced with a heat pump → capital improvement, 27.5-yr. Engine's own `what_if.hvac_improvement` exists but wasn't applied. | D47, call-01 | Fed ≈ **3,300** (losses are fully allowed this year via the 4797 gain) | Repair > threshold triggers *repair vs. improvement* judgment call |
| A6 | **Real estate tax on the Austin home 13,420 (SchA.5b).** Seller credited the buyers 6,912 for 1/1–7/7 at closing (D54). Deductible ≈ 6,508. With this fix SALT falls below the 40,000 cap, so it's no longer absorbed by the cap. | D54, D57 box 10, D58 | Fed ≈ **1,460** | Closing-statement proration rule; SALT cap sensitivity shown live |
| A7 | **Mileage 11,800 (SchC.44a) counts a duplicate scan.** Page 3 of D23 is a rescan of page 2 (same coffee stain). True total 8,100 (2,600 + 3,700 + 1,800). | D23 p2 = p3 | Fed ≈ **920** | Duplicate-page detector (identical page content hash) |
| A8 | **Mortgage payoff interest counted twice (SchA.8a).** 1098 D55 box 1 (13,900) says it *includes* payoff interest; engine added D56's 2,150 again. | D55, D56 | Fed ≈ **560** | Same-money link between 1098 and payoff statement |
| A9 | **Northlake sweep interest 1,840 counted twice (SchB.1.1 + SchB.1.2).** D28 composite and D29 standalone 1099-INT are the same bank-sweep program (same account 7731). | D28 p1, D29 | Fed ≈ **640**; CA ≈ 70 | Same payer + same account + same amount = *possible duplicate* |
| A10 | **Crypto lot C6 taxed at zero basis, short-term.** Client gave basis 3,050 and acquisition 3/15/2021 with bank-statement evidence (msg-07). Should be LT gain 2,275. | msg-07, D35 | Fed ≈ **1,300** | Client message auto-linked to the open diagnostic; message becomes evidence |
| A11 | **Personal expenses in Sch C.** Utilities 3,480 at 100% (call-01: phone 70%, internet 50% → 2,172). Software includes Spotify 216 (personal). | call-01, D15 | Fed ≈ **540** | Call notes attached to lines; percent-use judgment calls |
| A12 | **Donated car valued at 6,000 (F8283).** 1098-C box 4c: sold at auction for 2,900 → deduction limited to 2,900. Engine used the questionnaire over the form. | D66, qa-39 | Fed ≈ **810** | *Third-party record beats client estimate* conflict rule |
| A13 | **Federal Q4 estimate 4,000 (F1040.26).** IRS transcript shows 3,000 on 1/15/2026; client said "4,000 I think". | D69, qa-41 | Balance due understated **1,000** + penalty | Payments-vs-transcript reconciliation (a required step in firm standards) |
| A14 | **CA estimates 14,000 (F540NR.72).** The 9/15/2025 Web Pay of 3,500 was designated tax year **2024**; FTB holds it as a 2024 credit. Only 10,500 applies to 2025 unless moved. | D68, FTB account | CA refund overstated **3,500** | Payments-vs-FTB reconciliation; opens a client/FTB action item |
| A15 | **Sparbanken interest converted at the 2024 average (10.56).** 2025 average is 9.86 → 1,871, not 1,747. | fx_rates, D36 | Fed ≈ 40 (small, but a wrong-parameter class of error) | Parameter provenance shown on the line |

Net of A1–A15 the federal balance moves materially *down* (A1, A3, A4-CA, A5, A6, A7, A8, A9, A10, A11, A12 lower tax; A2, A13 raise it). The 36,000 extension payment was sized from v2, which carried A1–A3 — worth stating in the walkthrough.

## B. Extraction errors (high confidence, wrong)

| # | Field | Extracted | Printed | Consequence | Surfaced by |
|---|---|---|---|---|---|
| B1 | D62 Little Sprouts tax ID (ev-1045, conf 0.97) | 74-38295**16** | 74-38291**56** | F2441 provider EIN wrong → IRS mismatch | Format-aware re-read of ID fields; EIN shown next to page text |
| B2 | F2441.1a provider name | "Bright Oak Preschool" | "Bright Oak Kids Club" | Wrong provider name on 2441 | Line label vs document title check |
| B3 | D30/D31 page 32 ("Additional transactions") not read | — | M18 Ironwood REIT, proceeds 250, basis 310 | Explains the 71,965 vs 71,715 summary mismatch the engine flagged but never resolved; −60 ST loss missing | *Summary ≠ sum of lots* stays open until a lot accounts for the difference; unread pages listed per document |
| B4 | D64 St. Brigid amount (ev-1049, conf 0.41) | 1,500 | "$?,500" (1 or 7) | Right by luck; needs verification record | Low-confidence queue; msg-08 (phone confirmation + check #2207) attaches as *confirmed_with_client* |
| B5 | D35 C6 basis (conf 0.6, empty) | null | "cost basis unknown" | See A10 | Low-confidence queue → client question → answer becomes evidence |

## C. Data-entry and identity errors

| # | Issue | Evidence | Surfaced by |
|---|---|---|---|
| C1 | **Theo's SSN** entered as 666-74-**3309**; 2024 return and SS card say 666-74-**3390**. Caused the 7/13 e-file rejection R0000-504-02. | household, D06 p1, D71 | *Identity verified* step compares organizer SSNs to prior return + ID docs before e-file |
| C2 | Questionnaire says no investments sold (qa-14); 282 broker sales + 12 crypto. | qa-14 | Already an engine diagnostic; design turns it into a client question with the sale count attached |
| C3 | Client says no prior IRA basis (qa-31); 2024 Form 8606 shows 7,000. Engine correctly used 7,000; the conflict should still be recorded. | qa-31, D06 p10, D42 | Conflict log (client answer vs prior return) |

## D. Judgment calls the engine made silently (each needs a recorded decision + authority)

| # | Item | Options / note |
|---|---|---|
| D1 | Home office: engine averaged 240 sq ft. Actual: 220 sq ft Jan–mid-Jul (Sacramento), 260 from 7/16 (Austin). Prior preparer used 300 ("2 rooms combined?") – client never confirmed. | Compute by months per home; note 2024 may be overstated |
| D2 | Equipment 38,000: 100% bonus vs §179 vs MACRS. Fed: no difference bonus/§179; CA §179 cap 25,000 → `what_if` shows CA −1,050 under §179. | Election with tax effect both jurisdictions |
| D3 | S-corp basis: D40 (2023 K-1) closes the gap. Roll-forward 21,300 → 15,400 (2023) → 2,300 (2024) → 0 with 21,215 excess distributions = LT capital gain. Verify the 2022 "client worksheet" starting point. | Basis by year schedule with sources |
| D4 | ISO exercise 7/30/2025 (TX resident; granted 3/1/2022 as CA resident). Fed AMT spread 40,000. CA AMT not computed; CA-source share ≈ workdays CA / grant-to-exercise ≈ 98%. | Open item: CA Schedule P; outside engine |
| D5 | Wash sale M6: corrected 1099 says 512 disallowed; 735 × 25/30 replacement shares = 612.50. Broker figure stands unless substantiated otherwise. | Record reliance on broker |
| D6 | SEP: 18,000 contributed; deductible limit 20% × (profit − ½ SE) = 15,214 on v3 numbers. Limit changes with every Sch C fix; excess may be subject to 6% excise unless withdrawn. | Live recompute via rate; client action |
| D7 | Refi points 3,200 amortized 1/360 (9). Loan started 11/20 → 2 months (18). Trivial, but wrong. | — |
| D8 | Oregon composite tax 1,580 paid 4/2026 on Erik's behalf: 2026 SALT item; CA Schedule S credit 844 (resident-period share) is a judgment. | Record authority |
| D9 | Penalty: regular = annualized = 164; after A13 (Q4 is 3,000) the penalty rises. | Recompute |

## E. Completeness / outside-scope items that must be *identified*

- Form 8867 due diligence not completed (CTC/ODC) – blocks filing under firm rules.
- Forms 1099-NEC for Mara Quintero (4,800) and Dev Patel (2,600) never filed; due 2/2/2026 – outside engagement, client must be told.
- FBAR (FinCEN 114): max balance SEK 1,452,300 ≈ 149,600 USD – outside engagement; Form 8938 required.
- 2023 Form 3520 (foreign inheritance > 100,000) – prior preparer's open item, never resolved.
- Ridgeline K-1 was late; v1/v2 omitted it; the extension was sized without it.
- D10 is a duplicate of D09 (engine handled it; the workpaper must show it as "duplicate of D09", not "unused").
- Marcus Bell (st-04) has no sensitive-data clearance – SSNs/bank/IP PIN masked for him; unmasked views logged.

## F. How the design surfaces these (summary)

1. **Every line carries its sources; every source carries its page text.** Trace opens the simulated page with the field highlighted and the `text_as_read` beside the parsed value – B1/B2 are visible on sight.
2. **Checks that don't trust the engine** run as independent rules over documents: duplicate pages (A7), same-money detection across documents (A8, A9, D10), summary-vs-detail (B3), noncovered lots with zero basis (A1), third-party record vs client answer (A12, A13, A14, C1, C3), proration from closing statements (A6), personal-use percentages (A11).
3. **Prior-year memory**: notes and open items from D07 and the 2024 return attach to this year's lines (A2, D1, D3, E-3520).
4. **Client communications are evidence**: messages and call notes link to the line they resolve (A5, A10, A11, B4).
5. **Judgment calls are first-class records** with authority and tax effect, and require partner sign-off above 1,000 (D-series).
6. **Payments reconcile to agency records** as a required step (A13, A14).
