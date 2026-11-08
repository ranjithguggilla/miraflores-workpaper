import Link from "next/link";
import { Shell } from "@/components/shell";
import { PageHeader, Section } from "@/components/ui";
import { Explainer } from "@/components/explainer";
import { FileText, Hash, GitBranch, MessageSquare, Cpu, User } from "lucide-react";

export default function About() {
  const ents = [
    { k: "ent-doc", icon: <FileText />, name: "Documents and pages", ex: "D28 · page 3" },
    { k: "ent-value", icon: <Hash />, name: "Extracted values", ex: "Lot N1 proceeds = 19,240.00" },
    { k: "ent-line", icon: <GitBranch />, name: "Return lines", ex: "F8949.B.N1" },
    { k: "ent-client", icon: <MessageSquare />, name: "Client answers and messages", ex: "Questionnaire 25" },
    { k: "ent-person", icon: <User />, name: "People", ex: "Priya Raman · Preparer" },
    { k: "ent-engine", icon: <Cpu />, name: "Engine and parameters", ex: "fx › SEK › 2025 average" },
  ];
  return (
    <Shell path="/about">
      <PageHeader crumbs={[{ href: "/", label: "Inbox" }, { label: "About this workpaper" }]} title="A return is a graph of claims. The workpaper is the audit trail of each one." meta="Twenty seconds on the one design decision everything else falls out of." />
      <Section title="The idea, animated"><Explainer /></Section>
      <Section title="Colour is a vocabulary" aside={<span>Same six colours on chips, graph nodes, timeline and badges — learn it once</span>}>
        <div className="grid grid-cols-3 gap-3">{ents.map((e) => <div key={e.k} className="card p-3 flex items-center gap-3"><span className={`badge ${e.k}`} style={{ height: 28 }}>{e.icon}</span><div><div className="text-sm font-medium">{e.name}</div><div className="text-xs text-fg-3 mono">{e.ex}</div></div></div>)}</div>
      </Section>
      <Section title="What a reviewer can do from any number">
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[["Trace", "Down to the field on the page it came from; up to every line it feeds. Open the trace on any line.", "/lines/F8949.B.N1"], ["Adjust without losing the original", "Who, why, authority, tax effect. Over the firm threshold it waits for a partner.", "/lines/Sch1.17"], ["See what changed since you last looked", "Events by others after your cursor; the whole log is append-only and undoable.", "/activity"], ["Compare versions", "Three engine runs, the current state, and sealed snapshots — any two.", "/versions"], ["Try a what-if", "A scratch branch of the log; promote it as one batch or discard it.", "/whatif"], ["Answer a notice", "Everything under the examined lines, exported as a self-contained record.", "/notice"]].map(([t, b, h]) => (
            <Link key={t} href={h} className="card p-4 hover:border-line-strong transition-colors block"><div className="font-medium">{t}</div><div className="text-fg-2 mt-1 prose-max">{b}</div></Link>
          ))}
        </div>
      </Section>
    </Shell>
  );
}
