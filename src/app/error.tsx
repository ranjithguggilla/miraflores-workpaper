"use client";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** Visible error state instead of a blank page. Server actions that throw (permission refusals, frozen return) land here when not caught by a form. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card p-6 max-w-lg">
        <div className="flex items-center gap-2 text-bad"><AlertTriangle className="w-5 h-5" /><h2>Something went wrong</h2></div>
        <p className="text-fg-2 mt-2 text-sm">{error.message || "The server could not complete this request."}</p>
        {error.digest && <p className="text-fg-4 text-xs mt-1 mono">ref {error.digest}</p>}
        <div className="mt-4 flex gap-2"><button className="btn primary" onClick={reset}><RotateCcw /> Try again</button><Link href="/" className="btn">Back to inbox</Link></div>
      </div>
    </div>
  );
}
