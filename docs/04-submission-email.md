# Submission email (reply on Camila Ceal's thread) — draft

Subject: Re: MiraFlores AI | AI Engineer (Tax) Case Study — Ranjith Guggilla

Hi Camila,

Here is my case study.

- Live workpaper: https://workpaper.<domain> — the role switcher in the top bar stands in for sign-in; try Priya (preparer), Helen (partner), Marcus (no sensitive-data clearance) and Erik (client).
- Code: https://github.com/<user>/miraflores-workpaper (README has a one-line local run: `docker compose up -d && npm i && npm run db:push && npm run db:import && npm run db:seed && npm run dev`).
- Attached: the one-pager (core idea and data model) and the errors I found in the packet and how the design surfaced them.
- Video walkthrough: <unlisted link>

Core idea in a sentence: every number is a claim; the workpaper keeps the chain under it and writes every human action to an append-only event log, from which versions, undo, what-ifs, sign-offs that reopen, filing freeze and the notice response are all derived. Key decisions: server components and server actions over a client SPA; one persisted derived table (issues) because assignments need identity; independent check rules that read the documents rather than trusting the engine; tax effects as Δ × the engine's per-dollar rates, stated as a limitation.

Tools: I used an AI assistant for scaffolding, the first pass of the check rules and the error log, and iterating on the UI; I verified every finding against the packet, made the design decisions, set up the deployment, wrote the tests, and recorded the walkthrough myself. [Edit this sentence until it is exactly true of how you worked.]

Thank you for the brief — it was a genuinely good problem.

Ranjith Guggilla
