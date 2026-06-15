/**
 * 🔴 CSP 真实模拟测试 — 实际触发通知 + 数据库写入
 *
 * 与 __tests__/ 中的测试不同，本脚本：
 *   1. 不使用 X-Bugu-Test: true 头 → 会真正通知管理员
 *   2. 验证数据是否正确写入数据库
 *   3. 验证通知是否已创建
 *
 * 运行方式：npx tsx scripts/test-csp-real.ts
 * 前提：npm run dev 必须在 localhost:3000 运行
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// 使用动态 import 以便在顶层 await
async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   🔴 CSP 真实模拟测试（含通知+DB写入）  ║");
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
    // ─── 测试前：记录已有数据基线 ───
    const cspBefore = await prisma.cspReport.count();
    const notifBefore = await prisma.notification.count({ where: { type: "CSP_VIOLATION" } });
    console.log(`📊 测试前基线：${cspBefore} 条 CSP 记录，${notifBefore} 条 CSP 通知\n`);

    // ============================================================
    // 场景 1：report-uri 旧格式 — XSS 脚本注入
    // ============================================================
    console.log("📋 场景 1：report-uri 旧格式 — 内联脚本违规\n");
    const test1Ts = Date.now();

    const res1 = await fetch(`${BASE}/api/admin/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": `${BASE}/test/csp-sim-1`,
          "referrer": `${BASE}/works`,
          "violated-directive": "script-src",
          "effective-directive": "script-src",
          "blocked-uri": "inline",
          "line-number": 42,
          "column-number": 15,
          "source-file": `${BASE}/test/csp-sim-1`,
          "original-policy":
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src * data:; font-src 'self';",
          "disposition": "enforce",
          "script-sample": "eval('alert(1)')",
        },
      }),
    });

    record("POST 返回 200", res1.status === 200, `状态码: ${res1.status}`);
    record("Content-Type JSON", res1.headers.get("content-type")?.includes("json") ?? false, "");

    // ============================================================
    // 场景 2：report-to 新格式 — 外部恶意图片
    // ============================================================
    console.log("\n📋 场景 2：report-to 新格式 — 外部恶意图片加载\n");

    const res2 = await fetch(`${BASE}/api/admin/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/reports+json" },
      body: JSON.stringify([
        {
          type: "csp-violation",
          body: {
            "document-uri": `${BASE}/test/csp-sim-2`,
            "referrer": `${BASE}/admin`,
            "violated-directive": "img-src",
            "effective-directive": "img-src",
            "blocked-uri": "https://evil-cdn.example.com/phishing.png",
            "line-number": 88,
            "source-file": "https://evil-cdn.example.com/phishing.png",
            "original-policy":
              "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;",
            "disposition": "enforce",
          },
        },
      ]),
    });

    record("POST 返回 200", res2.status === 200, `状态码: ${res2.status}`);

    // ============================================================
    // 场景 3：report-uri — 外部字体违规
    // ============================================================
    console.log("\n📋 场景 3：report-uri 旧格式 — 外部字体加载\n");

    const res3 = await fetch(`${BASE}/api/admin/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": `${BASE}/test/csp-sim-3`,
          "violated-directive": "font-src",
          "blocked-uri": "https://untrusted-cdn.example.com/custom-font.woff2",
          "disposition": "report",
          "original-policy": "default-src 'self'; font-src 'self';",
        },
      }),
    });

    record("POST 返回 200", res3.status === 200, `状态码: ${res3.status}`);

    // ============================================================
    // 等待 DB 写入完成（异步操作可能稍有延迟）
    // ============================================================
    await new Promise((r) => setTimeout(r, 1000));

    // ============================================================
    // 验证数据库写入
    // ============================================================
    console.log("\n📊 验证数据库写入\n");

    const cspAfter = await prisma.cspReport.count();
    const cspNew = cspAfter - cspBefore;
    record("CSP 记录已写入", cspNew >= 3, `新增 ${cspNew} 条（预期 ≥ 3）`);

    // 检查具体的记录
    const scriptSrcRecord = await prisma.cspReport.findFirst({
      where: { violatedDirective: "script-src" },
      orderBy: { lastSeenAt: "desc" },
    });
    record(
      "script-src 违规记录存在",
      !!scriptSrcRecord,
      scriptSrcRecord ? `blocked-uri: ${scriptSrcRecord.blockedUri}, count: ${scriptSrcRecord.count}` : "未找到"
    );

    const imgSrcRecord = await prisma.cspReport.findFirst({
      where: { violatedDirective: "img-src" },
      orderBy: { lastSeenAt: "desc" },
    });
    record(
      "img-src 违规记录存在",
      !!imgSrcRecord,
      imgSrcRecord ? `blocked-uri: ${imgSrcRecord.blockedUri}, count: ${imgSrcRecord.count}` : "未找到"
    );

    const fontSrcRecord = await prisma.cspReport.findFirst({
      where: { violatedDirective: "font-src" },
      orderBy: { lastSeenAt: "desc" },
    });
    record(
      "font-src 违规记录存在",
      !!fontSrcRecord,
      fontSrcRecord ? `blocked-uri: ${fontSrcRecord.blockedUri}, count: ${fontSrcRecord.count}` : "未找到"
    );

    // ============================================================
    // 验证通知
    // ============================================================
    console.log("\n📊 验证通知\n");

    const notifAfter = await prisma.notification.count({ where: { type: "CSP_VIOLATION" } });
    const notifNew = notifAfter - notifBefore;
    record("CSP 通知已创建", notifNew >= 1, `新增 ${notifNew} 条通知（预期 ≥ 1）`);

    // 显示最新通知详情
    const latestNotifs = await prisma.notification.findMany({
      where: { type: "CSP_VIOLATION" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, content: true, relatedId: true, createdAt: true },
    });
    if (latestNotifs.length > 0) {
      console.log("\n  📬 最新 CSP 通知：");
      for (const n of latestNotifs) {
        console.log(`     🛡️ [${n.id.slice(0, 8)}] ${n.title}`);
        console.log(`        内容: ${n.content?.slice(0, 80)}`);
      }
    }

    // ============================================================
    // 验证去重 — 再次发送相同违规
    // ============================================================
    console.log("\n📋 场景 4：去重验证 — 再次发送 script-src 违规\n");

    const cspCountBeforeDedup = scriptSrcRecord?.count ?? 0;

    const res4 = await fetch(`${BASE}/api/admin/csp-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": `${BASE}/test/csp-sim-1`,
          "violated-directive": "script-src",
          "blocked-uri": "inline",
          "disposition": "enforce",
        },
      }),
    });

    record("去重 POST 返回 200", res4.status === 200, `状态码: ${res4.status}`);

    await new Promise((r) => setTimeout(r, 500));

    const dedupedRecord = await prisma.cspReport.findFirst({
      where: { id: scriptSrcRecord?.id },
    });
    const countAfterDedup = dedupedRecord?.count ?? 0;
    record(
      "去重计数递增（未创建新记录）",
      countAfterDedup === cspCountBeforeDedup + 1,
      `count: ${cspCountBeforeDedup} → ${countAfterDedup}`
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
  console.log("   - 管理通知：/admin（右上角铃铛）");
  console.log("   - CSP 报告：/admin/monitoring/csp-reports");
  console.log("   - 数据库：npx prisma studio\n");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
