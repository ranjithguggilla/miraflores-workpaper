import { Shell } from "@/components/shell";
import { Money, Ref, Section } from "@/components/ui";
import { db, schema as s } from "@/db";
import { ilike, or, sql } from "drizzle-orm";
import { versionLines } from "@/lib/state";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const like = `%${q}%`;
  const [lines, docs, values, issues] = q ? await Promise.all([
    versionLines().then((ls) => ls.filter((l) => l.key.toLowerCase().includes(q.toLowerCase()) || l.label.toLowerCase().includes(q.toLowerCase()) || String(l.value).includes(q)).slice(0, 100)),
    db.select().from(s.documents).where(or(ilike(s.documents.title, like), ilike(s.documents.documentType, like), ilike(s.documents.id, like))),
    db.select().from(s.extractedValues).where(or(ilike(s.extractedValues.label, like), ilike(s.extractedValues.textAsRead, like), sql`${s.extractedValues.value}::text ilike ${like}`)).limit(50),
    db.select().from(s.issues).where(or(ilike(s.issues.title, like), ilike(s.issues.detail, like))),
  ]) : [[], [], [], []];
  return (
    <Shell path="/search">
      <h1 className="mb-3">Search: “{q}”</h1>
      <Section title={`Lines (${lines.length})`}><ul className="text-sm">{lines.map((l) => <li key={l.key} className="py-1 border-b border-line"><Ref r={`line:${l.key}`} /> {l.label} <Money v={l.value} /></li>)}</ul></Section>
      <Section title={`Documents (${docs.length})`}><ul className="text-sm">{docs.map((d) => <li key={d.id} className="py-1 border-b border-line"><Ref r={`doc:${d.id}`} /> {d.title}</li>)}</ul></Section>
      <Section title={`Values (${values.length})`}><ul className="text-sm">{values.map((v) => <li key={v.id} className="py-1 border-b border-line"><Ref r={`ev:${v.id.slice(3)}`} /> {v.docId} {v.label}: {v.textAsRead}</li>)}</ul></Section>
      <Section title={`Issues (${issues.length})`}><ul className="text-sm">{issues.map((i) => <li key={i.id} className="py-1 border-b border-line"><Ref r={`issue:${i.id}`} /> {i.title}</li>)}</ul></Section>
    </Shell>
  );
}
