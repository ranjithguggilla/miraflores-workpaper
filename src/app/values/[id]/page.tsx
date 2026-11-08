import { redirect, notFound } from "next/navigation";
import { db, schema as s } from "@/db";
import { eq } from "drizzle-orm";
export default async function Value({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [e] = await db.select().from(s.extractedValues).where(eq(s.extractedValues.id, id));
  if (!e) notFound();
  redirect(`/documents/${e.docId}#${e.id}`);
}
