"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Hash, GitBranch, Sliders, ShieldCheck, RotateCcw, Lock, Play, Pause } from "lucide-react";

/**
 * Animated explainer of the core idea. Six beats, ~20 s, loops.
 * 1 a number appears · 2 its chain draws beneath it · 3 someone adjusts it, the original stays ·
 * 4 the event stacks on the log · 5 a reviewer signs off · 6 a later change reopens the sign-off.
 */
const BEATS = [
  { t: 0, title: "Every number is a claim.", body: "F8949 line B.N1 says the gain on 400 Corvane RSU shares is 19,240." },
  { t: 3.2, title: "A claim is only as good as the chain beneath it.", body: "Line ← extracted value ← the exact field on page 3 of the Northlake 1099. Click any of them." },
  { t: 7.0, title: "Nothing is overwritten.", body: "Priya records basis 19,100 from the stock plan supplement. The engine's 19,240 stays; the adjustment is an event on top." },
  { t: 10.6, title: "The workpaper is an append-only event log.", body: "Verify, adjust, note, question, sign off — each is one row. Versions, undo, “since I last looked” and what-ifs all read from it." },
  { t: 14.0, title: "Sign-offs cover a hash of what they signed.", body: "Daniel signs the area. The badge records the exact state he looked at." },
  { t: 17.2, title: "Change what was signed, and the sign-off reopens.", body: "A later adjustment inside the area flips it red. Nobody has to remember to re-review." },
];
const TOTAL = 21;

export function Explainer() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => { if (!playing) return; const id = setInterval(() => setT((x) => (x + 0.1) % TOTAL), 100); return () => clearInterval(id); }, [playing]);
  const beat = BEATS.reduce((acc, b, i) => (t >= b.t ? i : acc), 0);
  const show = (i: number) => beat >= i;
  return (
    <div className="card p-6">
      <div className="grid grid-cols-[1fr_360px] gap-8 items-start">
        <div className="relative h-[360px]">
          {/* the number */}
          <motion.div className="absolute left-0 top-0 rounded-md border border-ent-line bg-ent-line-soft/40 px-4 py-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ent-line)" }}><GitBranch className="w-3 h-3" /> F8949.B.N1 · Return line</div>
            <div className="text-fg-3 text-xs">Corvane Systems Inc (RSU) · gain</div>
            <div className="flex items-baseline gap-3 mt-1">
              <AnimatePresence mode="popLayout">{show(2) ? <motion.span key="new" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="num text-2xl text-adj">140</motion.span> : <motion.span key="old" className="num text-2xl">19,240</motion.span>}</AnimatePresence>
              {show(2) && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="num text-sm text-fg-4 line-through">19,240</motion.span>}
              {show(2) && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="badge adj"><Sliders /> Adjusted</motion.span>}
            </div>
          </motion.div>
          {/* the chain */}
          <AnimatePresence>{show(1) && (
            <>
              <motion.svg key="edges" className="absolute left-0 top-0 pointer-events-none" width="520" height="220" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <motion.path d="M 120 72 C 120 110, 150 110, 150 130" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
                <motion.path d="M 180 180 C 180 210, 230 200, 240 212" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 0.5 }} />
              </motion.svg>
              <motion.div key="val" className="absolute left-[150px] top-[128px] rounded-md border bg-s1 px-3 py-2" style={{ borderColor: "var(--ent-value)" }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ent-value)" }}><Hash className="w-3 h-3" /> Extracted value</div>
                <div className="text-xs">Lot N1 proceeds · read as <span className="hl">19,240.00</span></div>
              </motion.div>
              <motion.div key="doc" className="absolute left-[240px] top-[210px] rounded-md border bg-s1 px-3 py-2" style={{ borderColor: "var(--ent-doc)" }} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 }}>
                <div className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--ent-doc)" }}><FileText className="w-3 h-3" /> Source page</div>
                <div className="text-xs">D28 · Northlake 1099 composite, page 3</div>
                <div className="page-sheet mt-1 !p-2 !text-[10px] !leading-snug max-w-[260px]">1099-B detail: N1 Corvane Systems Inc (RSU) 400 sh acquired 2025-02-15 sold 2025-02-18 proceeds <span className="hl">19,240.00</span> basis (not reported)…</div>
              </motion.div>
            </>
          )}</AnimatePresence>
          {/* sign-off */}
          <AnimatePresence>{show(4) && (
            <motion.div key="so" className="absolute right-0 top-0" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <motion.span key={String(show(5))} initial={{ rotateX: 90 }} animate={{ rotateX: 0 }} transition={{ duration: 0.35 }} className={`badge ${show(5) ? "bad" : "ok"}`} style={{ display: "inline-flex" }}>{show(5) ? <RotateCcw /> : <ShieldCheck />} Reviewer · Daniel Ortiz{show(5) ? " · reopened by adjust #32" : ""}</motion.span>
            </motion.div>
          )}</AnimatePresence>
        </div>
        {/* the log */}
        <div>
          <div className="text-xs text-fg-3 mb-2 flex items-center gap-1.5"><Lock className="w-3 h-3" /> Event log · append-only</div>
          <div className="card divide-y divide-line overflow-hidden text-xs">
            {[
              { i: 0, k: "import", who: "engine", what: "F8949.B.N1 = 19,240 (v3)", tone: "ent-engine" },
              { i: 1, k: "trace", who: "Priya", what: "opened source D28 p3 · lot N1", tone: "ent-doc" },
              { i: 2, k: "adjust", who: "Priya", what: "19,240 → 140 · basis per D11 · IRC §83", tone: "adj" },
              { i: 3, k: "approve", who: "Helen", what: "approved adjustment · fed −6,647", tone: "ok" },
              { i: 4, k: "sign_off", who: "Daniel", what: "reviewer sign-off · hash 3f9a…", tone: "ok" },
              { i: 5, k: "adjust", who: "Priya", what: "SchC.27a.1 6,850 → 6,634 · reopens sign-off", tone: "bad" },
            ].map((r) => (
              <AnimatePresence key={r.i}>{show(r.i) && <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 px-3 py-2"><span className="num text-fg-4 w-5">#{r.i + 1}</span><span className={`badge ${r.tone}`}>{r.k.replace("_", " ")}</span><span className="text-fg-2 truncate">{r.who} · {r.what}</span></motion.div>}</AnimatePresence>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex items-start gap-4">
        <button className="btn icon shrink-0" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"}>{playing ? <Pause /> : <Play />}</button>
        <div className="flex-1">
          <AnimatePresence mode="wait"><motion.div key={beat} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
            <div className="font-semibold">{BEATS[beat].title}</div><div className="text-fg-2 text-sm prose-max">{BEATS[beat].body}</div>
          </motion.div></AnimatePresence>
          <div className="mt-3 h-1 rounded bg-s3 overflow-hidden"><div className="h-full bg-accent transition-[width] duration-100" style={{ width: `${(t / TOTAL) * 100}%` }} /></div>
          <div className="mt-2 flex gap-1">{BEATS.map((b, i) => <button key={i} onClick={() => { setT(b.t); }} className={`h-1.5 flex-1 rounded ${i <= beat ? "bg-accent" : "bg-s3"}`} aria-label={b.title} />)}</div>
        </div>
      </div>
    </div>
  );
}
