import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { ensureDefaultTags } from "@/lib/db/tags";
import SubmitForm from "@/components/forms/SubmitForm";

export const metadata: Metadata = {
  title: "提交作品",
  description: "向作品库提交你的游戏作品",
};

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  await ensureDefaultTags();
  const tags = await prisma.tag.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-brand-navy">
          提交作品
        </h1>
        <p className="mt-2 text-brand-text-secondary">
          将你的游戏作品提交到作品库。提交后将由管理员审核，通过后即可公开展示。
        </p>
      </div>

      <div
        className="bg-card rounded-xl border shadow-sm p-6 border-brand-border-subtle"
      >
        <SubmitForm tags={tags} />
      </div>
    </div>
  );
}
