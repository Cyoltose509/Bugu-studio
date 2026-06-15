/**
 * 🔴 前端错误报告真实模拟测试 — 实际触发通知 + 数据库写入
 *
 * 本脚本模拟真实用户在前端遇到错误时的自动上报流程：
 *   1. 模拟 3 个不同类型的前端错误
 *   2. 验证数据是否正确写入 ErrorReport 表（含递增编号 #N）
 *   3. 验证通知是否已创建给管理员
 *   4. 验证去重逻辑：同一 URL + 同一错误 10 分钟内去重
 *
 * 运行方式：npx tsx scripts/test-error-real.ts
 * 前提：npm run dev 必须在 localhost:3000 运行
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  🔴 前端错误报告真实模拟（含通知+DB）  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  let passed = 0;
  let failed = 0;
  const results: { label: string; ok: boolean; detail: string }[] = [];

  function record(label: string, ok: boolean, detail: string) {
    results.push({ label, ok, detail });
    const icon = ok ? "✅" : "❌";
    console.log(`  ${icon} ${label}`);
    if (!ok) console.log(`     ↳ ${detail}`);
    if (ok) passed++;
    else failed++;
  }

  try {
    // ─── 基线 ───
    const errBefore = await prisma.errorReport.count();
    const notifBefore = await prisma.notification.count({ where: { type: "ERROR_REPORT" } });
    const lastReport = await prisma.errorReport.findFirst({
      orderBy: { reportId: "desc" },
      select: { reportId: true },
    });
    const startId = lastReport?.reportId ?? 0;
    console.log(`📊 测试前基线：${errBefore} 条错误报告，#${startId} 是当前最大编号`);
    console.log(`                    ${notifBefore} 条错误通知\n`);

    // ============================================================
    // 场景 1：组件渲染错误（带堆栈）
    // ============================================================
    console.log("📋 场景 1：React 组件渲染错误（带完整堆栈）\n");

    const res1 = await fetch(`${BASE}/api/errors/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0",
      },
      body: JSON.stringify({
        message: "TypeError: Cannot read properties of undefined (reading 'map')",
        stack: `TypeError: Cannot read properties of undefined (reading 'map')
    at ProjectCard (https://bugu.studio/_next/static/chunks/app/page.js:235:42)
    at renderWithHooks (https://bugu.studio/_next/static/chunks/main.js:1234:17)
    at updateFunctionComponent (https://bugu.studio/_next/static/chunks/main.js:892:12)
    at beginWork (https://bugu.studio/_next/static/chunks/main.js:667:9)
    at workLoop (https://bugu.studio/_next/static/chunks/main.js:456:4)`,
        url: `${BASE}/works`,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0",
        errorType: "TypeError",
      }),
    });

    const body1 = await res1.json().catch(() => ({}));
    record("POST 返回 200 + success", res1.status === 200 && body1.success === true, `status=${res1.status}, body=${JSON.stringify(body1).slice(0, 100)}`);
    const reportId1 = body1?.data?.reportId as number;
    record("返回递增编号 #N", reportId1 > startId, `编号: #${reportId1}（上次最大 #${startId}）`);

    // ============================================================
    // 场景 2：API 调用失败（不带堆栈）
    // ============================================================
    console.log("\n📋 场景 2：fetch API 调用失败（无堆栈）\n");

    const res2 = await fetch(`${BASE}/api/errors/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/17.0",
      },
      body: JSON.stringify({
        message: "NetworkError: Failed to fetch /api/works?page=2",
        url: `${BASE}/works`,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/17.0",
      }),
    });

    const body2 = await res2.json().catch(() => ({}));
    record("POST 返回 200 + success", res2.status === 200 && body2.success === true, `status=${res2.status}`);
    const reportId2 = body2?.data?.reportId as number;
    record("返回递增编号 #N", reportId2 > reportId1, `编号: #${reportId2}（上次 #${reportId1}）`);

    // ============================================================
    // 场景 3：404 资源加载（不同 URL）
    // ============================================================
    console.log("\n📋 场景 3：生产环境 — Chunk加载失败\n");

    const res3 = await fetch(`${BASE}/api/errors/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/125.0",
      },
      body: JSON.stringify({
        message: "ChunkLoadError: Loading chunk 847 failed.",
        stack: `ChunkLoadError: Loading chunk 847 failed.
    at __webpack_require__.f.j (https://bugu.studio/_next/static/chunks/main.js:3456:28)
    at https://bugu.studio/_next/static/chunks/main.js:1234:17`,
        url: `${BASE}/admin/members`,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/125.0",
        errorType: "ChunkLoadError",
      }),
    });

    const body3 = await res3.json().catch(() => ({}));
    record("POST 返回 200 + success", res3.status === 200 && body3.success === true, `status=${res3.status}`);
    const reportId3 = body3?.data?.reportId as number;
    record("返回递增编号 #N", reportId3 > reportId2, `编号: #${reportId3}（上次 #${reportId2}）`);

    // ============================================================
    // 等待 DB
    // ============================================================
    await new Promise((r) => setTimeout(r, 1000));

    // ============================================================
    // 验证数据库写入
    // ============================================================
    console.log("\n📊 验证数据库写入\n");

    const errAfter = await prisma.errorReport.count();
    const errNew = errAfter - errBefore;
    record("ErrorReport 记录已写入", errNew >= 3, `新增 ${errNew} 条（预期 ≥ 3）`);

    // 验证第1条
    const record1 = await prisma.errorReport.findFirst({
      where: { reportId: reportId1 },
    });
    record(
      `#${reportId1} 记录完整`,
      !!record1 && record1.message.includes("Cannot read properties") && record1.url?.includes("/works"),
      record1
        ? `message: "${record1.message.slice(0, 50)}", url: ${record1.url}, count: ${record1.count}`
        : "未找到"
    );
    record(`#${reportId1} 包含堆栈`, !!record1?.stack && record1.stack.length > 50, record1?.stack ? `${record1.stack.length} 字符` : "无堆栈");

    // 验证第2条
    const record2 = await prisma.errorReport.findFirst({
      where: { reportId: reportId2 },
    });
    record(
      `#${reportId2} 记录存在`,
      !!record2,
      record2 ? `message: "${record2.message.slice(0, 50)}"` : "未找到"
    );
    record(`#${reportId2} 无堆栈（符合预期）`, !record2?.stack || record2.stack.length === 0, record2?.stack ? `有 ${record2.stack.length} 字符堆栈` : "无堆栈");

    // 验证第3条
    const record3 = await prisma.errorReport.findFirst({
      where: { reportId: reportId3 },
    });
    record(
      `#${reportId3} 记录存在`,
      !!record3,
      record3 ? `message: "${record3.message.slice(0, 50)}"` : "未找到"
    );

    // ============================================================
    // 验证通知
    // ============================================================
    console.log("\n📊 验证通知\n");

    const notifAfter = await prisma.notification.count({ where: { type: "ERROR_REPORT" } });
    const notifNew = notifAfter - notifBefore;
    record("错误通知已创建", notifNew >= 1, `新增 ${notifNew} 条通知（预期 ≥ 1，三个不同 URL 去重后至少 1 条）`);

    const latestNotifs = await prisma.notification.findMany({
      where: { type: "ERROR_REPORT" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, content: true, relatedId: true, createdAt: true },
    });
    if (latestNotifs.length > 0) {
      console.log("\n  📬 最新错误通知：");
      for (const n of latestNotifs) {
        console.log(`     🔥 [${n.id.slice(0, 8)}] ${n.title}`);
        console.log(`        内容: ${n.content?.slice(0, 80)}`);
        console.log(`        创建: ${n.createdAt.toISOString()}`);
      }
    }

    // ============================================================
    // 场景 4：去重验证
    // ============================================================
    console.log("\n📋 场景 4：去重验证 — 再次发送相同的 /works TypeError\n");

    const res4 = await fetch(`${BASE}/api/errors/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "TestAgent/2.0",
      },
      body: JSON.stringify({
        message: "TypeError: Cannot read properties of undefined (reading 'map')",
        url: `${BASE}/works`,
        userAgent: "TestAgent/2.0",
      }),
    });

    const body4 = await res4.json().catch(() => ({}));
    record("去重 POST 返回 200", res4.status === 200 && body4.success === true, `status=${res4.status}`);

    await new Promise((r) => setTimeout(r, 500));

    const dedupedRecord = await prisma.errorReport.findFirst({
      where: { reportId: reportId1 },
    });
    record(
      "去重：计数递增（未创建新编号）",
      (dedupedRecord?.count ?? 0) >= 2,
      `count: ${dedupedRecord?.count}（预期 ≥ 2）`
    );

  } catch (err) {
    console.error("\n💥 测试执行异常:", err);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  // ============================================================
  // 汇总
  // ============================================================
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║   测试结果: ${passed} ✅ 通过 / ${failed} ❌ 失败 / ${passed + failed} 总计  ║`);
  console.log("╚══════════════════════════════════════════╝");

  if (failed > 0) {
    console.log("\n失败详情：");
    for (const r of results) {
      if (!r.ok) console.log(`  ❌ ${r.label}: ${r.detail}`);
    }
  }

  console.log("\n💡 提示：可在以下位置查看结果：");
  console.log("   - 管理通知：/admin（右上角铃铛 🔔 → 🔥 图标）");
  console.log("   - 错误报告：/admin/monitoring/error-reports");
  console.log("   - 数据库：  npx prisma studio\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
