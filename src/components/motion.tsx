"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "motion/react";
import { ShieldCheck, RotateCcw } from "lucide-react";

/** Counts from the previous value to the new one when the number changes (400 ms). Shows parentheses for negatives like the rest of the app. */
export function Ticker({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  const mv = useMotionValue(typeof value === "number" ? value : 0);
  const prev = useRef<number | null>(null);
  const text = useTransform(mv, (v) => { const r = Math.round(v); const abs = Math.abs(r).toLocaleString(); return r < 0 ? `(${abs})` : abs; });
  const [display, setDisplay] = useState(text.get());
  useEffect(() => text.on("change", (t) => setDisplay(t)), [text]);
  useEffect(() => {
    if (typeof value !== "number") return;
    const from = prev.current ?? value; prev.current = value;
    const c = animate(mv, value, { duration: from === value ? 0 : 0.45, ease: "easeOut" });
    return () => c.stop();
  }, [value, mv]);
  if (typeof value !== "number") return <span className={`num ${className}`}>—</span>;
  return <span className={`num ${value < 0 ? "text-bad" : ""} ${className}`}>{display}</span>;
}

/** Sign-off badge that flips from a green shield to a red reopen mark. */
export function SignOffBadge({ valid, children }: { valid: boolean; children: ReactNode }) {
  return (
    <motion.span key={String(valid)} initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ duration: 0.35, ease: "easeOut" }} className={`badge ${valid ? "ok" : "bad"}`} style={{ transformOrigin: "center", display: "inline-flex" }}>
      {valid ? <ShieldCheck /> : <RotateCcw />}{children}
    </motion.span>
  );
}

/** Height-animated expand/collapse. */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && <motion.div key="c" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} style={{ overflow: "hidden" }}>{children}</motion.div>}
    </AnimatePresence>
  );
}

/** The seal that lands when a return is frozen. */
export function Seal({ label, hash, when }: { label: string; hash: string; when: string }) {
  return (
    <motion.div initial={{ scale: 1.6, opacity: 0, rotate: -14 }} animate={{ scale: 1, opacity: 1, rotate: -6 }} transition={{ type: "spring", stiffness: 420, damping: 22 }} className="stamp">
      <span>{label}</span><span style={{ fontSize: 9, letterSpacing: ".08em" }}>{hash} · {when}</span>
    </motion.div>
  );
}

/** Staggered appearance for lists of cards. */
export function Stagger({ children, className = "" }: { children: ReactNode[]; className?: string }) {
  return <div className={className}>{children.map((c, i) => <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.25 }}>{c}</motion.div>)}</div>;
}
