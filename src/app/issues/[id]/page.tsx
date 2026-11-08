import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { IssueCard } from "@/components/issues";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
import { eventsFor } from "@/lib/state";
import { Tag, When } from "@/components/ui";
export default async function IssuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [issue] = await db.select().from(s.issues).where(eq(s.issues.id, Number(id)));
  if (!issue) notFound();
  const evs = await eventsFor(`issue:${id}`);
  return <Shell path={`/issues/${id}`}><h1 className="mb-3">Issue #{id}</h1><IssueCard issue={issue} path={`/issues/${id}`} showArea /><h2 className="mt-4 mb-2">Thread</h2>{evs.map((e) => <div key={e.id} className="text-sm py-1 border-b border-line"><Tag>{e.kind}</Tag> {e.actorId} <When d={e.at} /> {JSON.stringify(e.payload)}</div>)}</Shell>;
}
