/** Prepare only this event as a draft; never publish or overwrite existing data. */
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { prepareBaituanDraft } from "../src/lib/activities/baituan";
import { BAITUAN_PROJECT_SLUGS, BAITUAN_SLUG } from "../src/lib/activities/showcase";

loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  if (!process.argv.includes("--apply")) {
    const projects = await prisma.project.findMany({
      where: { slug: { in: BAITUAN_PROJECT_SLUGS }, status: "PUBLISHED" },
      select: { id: true, slug: true, title: true },
    });
    const existing = await prisma.activity.findUnique({ where: { slug: BAITUAN_SLUG }, select: { id: true, status: true } });
    console.log(JSON.stringify({ mode: "read-only", existing, projects, ready: projects.length === 5 }, null, 2));
    return;
  }
  const activity = await prisma.$transaction(prepareBaituanDraft, { timeout: 20000 });
  console.log(JSON.stringify({ id: activity.id, slug: activity.slug, status: activity.status, preview: `/activities/${activity.slug}`, edit: `/admin/activities/${activity.id}/edit` }, null, 2));
}
main().catch((error) => { console.error("准备活动失败，请检查数据库连接与五款已发布作品。", error.code || error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
