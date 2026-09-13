import { redirect, notFound } from "next/navigation";
import { resolveActivityId } from "@/lib/activities/resolve";

export default async function GameJamRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id: key } = await params;
  const id = await resolveActivityId(key);
  if (!id) notFound();
  redirect(`/activities/${id}#jam`);
}
