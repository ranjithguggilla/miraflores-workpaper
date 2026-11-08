"use client";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Moon, Sun, PanelLeftClose, PanelLeftOpen } from "lucide-react";

/** A form that runs a server action, shows a toast, and refreshes. Works with any action(formData). */
export function ActionForm({ action, toast: msg = "Saved", className, children, confirm }: { action: (fd: FormData) => Promise<void>; toast?: string; className?: string; children: ReactNode; confirm?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <form className={className} data-pending={pending || undefined} onSubmit={(e) => {
      e.preventDefault();
      if (confirm && !window.confirm(confirm)) return;
      const fd = new FormData(e.currentTarget);
      const form = e.currentTarget;
      start(async () => {
        try { await action(fd); toast.success(msg); form.reset?.(); router.refresh(); }
        catch (err: any) { if (String(err?.digest ?? err?.message ?? err).includes("NEXT_REDIRECT")) { router.refresh(); return; } toast.error(String(err?.message ?? "Something went wrong")); }
      });
    }}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
    </form>
  );
}

export function Submit({ children, className = "btn", icon }: { children: ReactNode; className?: string; icon?: ReactNode }) {
  // pending state is inherited from the disabled fieldset; show a spinner via CSS attribute on the form
  return <button type="submit" className={`${className} submit`}>{icon}<span>{children}</span><Loader2 className="spin hidden" /></button>;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.getAttribute("data-theme") === "dark"); }, []);
  return <button className="btn ghost icon" title="Toggle theme" onClick={() => { const next = dark ? "light" : "dark"; document.documentElement.setAttribute("data-theme", next); localStorage.setItem("theme", next); setDark(!dark); }}>{dark ? <Sun /> : <Moon />}</button>;
}

export function RailToggle() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { const c = localStorage.getItem("rail") === "collapsed"; setCollapsed(c); document.documentElement.classList.toggle("rail-collapsed", c); }, []);
  return <button className="btn ghost icon" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => { const n = !collapsed; setCollapsed(n); localStorage.setItem("rail", n ? "collapsed" : "open"); document.documentElement.classList.toggle("rail-collapsed", n); }}>{collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}</button>;
}

export function SearchBox() {
  const router = useRouter();
  const [q, setQ] = useState("");
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); document.getElementById("global-search")?.focus(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
  return (
    <form className="relative" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }}>
      <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lines, documents, values…" className="w-72 pr-14" />
      <span className="kbd absolute right-2 top-1/2 -translate-y-1/2">⌘K</span>
    </form>
  );
}

/** Expand/collapse with a chevron, no layout shift. */
export function Disclosure({ summary, children, defaultOpen = false, className = "" }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return <details className={`disclosure ${className}`} open={defaultOpen}><summary>{summary}</summary>{children}</details>;
}

export function ShowMore({ total, step = 20, children }: { total: number; step?: number; children: (n: number) => ReactNode }) {
  const [n, setN] = useState(step);
  return <>{children(n)}{n < total && <button className="btn ghost mt-2" onClick={() => setN(n + step)}>Show {Math.min(step, total - n)} more of {total - n}</button>}</>;
}

/** Table-body pagination for server-rendered rows: shows the first `step`, then a "show more" row. Rows are ReactNodes, so this works from server components. */
export function PagedRows({ rows, step = 60, colSpan }: { rows: ReactNode[]; step?: number; colSpan: number }) {
  const [n, setN] = useState(step);
  return <>{rows.slice(0, n)}{n < rows.length && <tr><td colSpan={colSpan} className="text-center py-2"><button type="button" className="btn ghost sm" onClick={() => setN(n + step)}>Show {Math.min(step, rows.length - n)} more of {rows.length - n} lines</button></td></tr>}</>;
}
