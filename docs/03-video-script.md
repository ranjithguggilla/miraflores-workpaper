# Video walkthrough — script (8–12 min, live link, browser at 125 %)

Demo state: fresh `deploy.sh --reset` on the server (packet + demo seed). Open as Priya Raman.

| Time | Screen | Say |
|---|---|---|
| 0:00 | `/about` (paused on beat 1) | Every number on a return is a claim. This workpaper keeps the chain under each claim — document, extracted field, line — and writes every human action to an append-only event log. Everything else falls out of that one decision. |
| 0:40 | `/` inbox | What needs me, not a checklist. Balance due engine 4,220 → current (6,305) because of approved adjustments. Nine areas mirror the firm's budget lines; red means a blocker. |
| 1:30 | `/lines/F8949.B.N1` | The trace graph: page 3 of the Northlake 1099 → ten extracted values → this lot → everything downstream to line 37. Hover a node to light its path. Below, the page itself with 19,240.00 highlighted — the field, not "see PBC-12". |
| 2:40 | same, History | The engine took basis 0 on a noncovered RSU lot. The supplement D11 says 19,100 — and that 19,100 is already in W-2 box 14. Double tax, about 15.5k. Priya adjusted to 140; the original stays; Helen approved; effect −6,647. A *rule* caught this (zero basis + supplement present), not a person. |
| 4:00 | `/lines/Sch1.17` as Priya | Live adjustment: 14,400 → 0, authority IRC §162(l)(2)(B). Effect 4,464 is over the firm threshold, so it waits for a partner. Switch to Helen, approve, back to inbox — the tile ticks. The threshold is data on the Firm page, not code. |
| 5:30 | `/areas/business` | Daniel signed this area on March 30. Priya's later Spotify adjustment reopened it — the sign-off covers a hash of what he saw. Nobody remembers to re-review; the system does. |
| 6:30 | `/documents/D23`, `/documents/D62`, `/documents/D31` | Checks that don't trust the engine: page 3 is a rescan of page 2 (mileage doubled); EIN read with 0.97 confidence isn't on the page; page 32 was never read and names lot M18 — the broker mismatch the engine flagged but couldn't close. |
| 8:00 | `/versions`, `/whatif`, `/filing`, `/notice`, `/carry-forward` | 30 s each: compare v2/v3/current; a what-if is a branch of the log; filing is gated by the firm's required steps; a notice response is the subgraph under the examined lines; carry-forward keeps decisions with their authority. |
| 9:30 | `/firm` | Trade-offs: tax effects are linear because the engine can't rerun; issues are the one persisted derived table; server actions over a SPA; role switcher is a demo device with server-side enforcement; masking is default and unmasks are logged. Next: season replay, knock-on recompute, real sign-in. |
| 10:30 | — | How I worked, including tools (the disclosure sentence). Thanks. |

Record in light mode. Watch back at 1.5×. Upload unlisted; test the link in a private window.
