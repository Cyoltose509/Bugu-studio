import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * GET /api/admin/db/orphan-tables
 * 对比数据库实际表 vs Prisma schema 模型，返回"野表"列表
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. 从 schema.prisma 解析所有模型名
    const schemaPath = resolve(process.cwd(), "prisma/schema.prisma");
    const schemaContent = readFileSync(schemaPath, "utf-8");
    const modelNames = [...schemaContent.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]);

    // 2. 查询数据库里所有用户表（排除系统表）
    const dbTables = (await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT tablename AS table_name
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `).map((r) => r.table_name);

    // 3. 需要排除的 Supabase / 系统表（不是野表）
    const SYSTEM_TABLES = new Set([
      "_prisma_migrations",
      "schema_migrations", // Supabase 有时建这个表
    ]);

    // 4. 找出"数据库有但 schema 没有"的表 = 野表
    const orphans = dbTables.filter(
      (t) => !modelNames.includes(t) && !SYSTEM_TABLES.has(t)
    );

    // 5. 找出"schema 有但数据库没有"的表 = 缺失表（理论上不应出现）
    const missing = modelNames.filter((m) => !dbTables.includes(m));

    return NextResponse.json({
      dbTables,       // 数据库里所有 public 表
      modelNames,     // schema 里所有模型名
      orphans,        // 野表（DB 有，schema 无）
      missing,        // 缺失表（schema 有，DB 无）— 仅供诊断
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
