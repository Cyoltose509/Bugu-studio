import { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "提交作品",
  description: "向作品库提交你的游戏作品",
};

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const tags = await prisma.tag.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  });

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold" style={{ color: "#25547A" }}>
          提交作品
        </h1>
        <p className="mt-2" style={{ color: "#777" }}>
          将你的游戏作品提交到作品库。提交后将由管理员审核，通过后即可公开展示。
        </p>
      </div>

      <div
        className="bg-white rounded-xl border shadow-sm p-6"
        style={{ borderColor: "#D0DEE8" }}
      >
        <SubmitForm tags={tags} />
      </div>
    </div>
  );
}
