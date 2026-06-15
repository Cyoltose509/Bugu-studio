/**
 * 🏋️ Bugu-Studio 性能基准测试工具
 *
 * 用法:
 *   npx tsx scripts/benchmark.ts                          # 默认: 50并发, 100请求, 全端点
 *   npx tsx scripts/benchmark.ts --url /api/works         # 单端点
 *   npx tsx scripts/benchmark.ts --concurrency 100 --requests 500
 *   npx tsx scripts/benchmark.ts --mode spike             # 突发峰值模式
 *   npx tsx scripts/benchmark.ts --mode stress            # 压力测试(逐渐增加并发)
 *
 * 指标:
 *   - 吞吐量 (req/s)
 *   - 延迟 (min/p50/p95/p99/max)
 *   - 错误率
 *   - 首字节时间 (TTFB)
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// ======== 配置 ========
const DEFAULT_CONCURRENCY = 50;
const DEFAULT_REQUESTS = 100;
const TIMEOUT_MS = 30_000;

interface BenchmarkConfig {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
}

interface RequestResult {
  status: number;
  duration: number;
  ttfb: number;
  size: number;
  error?: string;
}

interface BenchmarkReport {
  url: string;
  method: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  durations: number[];
  ttfbValues: number[];
  sizes: number[];
  totalBytes: number;
  totalTimeMs: number;
}

// ======== 发送单个请求 ========
async function sendRequest(config: BenchmarkConfig): Promise<RequestResult> {
  const start = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${config.url}`, {
      method: config.method || "GET",
      headers: {
        "User-Agent": "BuguBench/1.0",
        "Accept": "text/html,application/json",
        ...config.headers,
      },
      body: config.body ? JSON.stringify(config.body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });

    const ttfb = performance.now() - start;
    const text = await res.text();
    const end = performance.now();

    clearTimeout(timeout);
    return {
      status: res.status,
      duration: end - start,
      ttfb,
      size: Buffer.byteLength(text, "utf8"),
    };
  } catch (err) {
    clearTimeout(timeout);
    const end = performance.now();
    return {
      status: 0,
      duration: end - start,
      ttfb: end - start,
      size: 0,
      error: String(err),
    };
  }
}

// ======== 并发执行 ========
async function runConcurrent(config: BenchmarkConfig, concurrency: number, total: number): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  let completed = 0;
  let index = 0;

  const worker = async () => {
    while (index < total) {
      const i = index++;
      const result = await sendRequest(config);
      results[i] = result;
      completed++;
      if (completed % 10 === 0 || completed === total) {
        process.stdout.write(`\r  ⏳ ${completed}/${total} 完成...`);
      }
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(workers);

  return results;
}

// ======== 统计分析 ========
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function analyzeResults(results: RequestResult[], report: BenchmarkReport): void {
  const { durations, ttfbValues, sizes, totalTimeMs } = report;
  const sorted = [...durations].sort((a, b) => a - b);
  const sortedTtfb = [...ttfbValues].sort((a, b) => a - b);

  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;
  const avg = durations.reduce((a, b) => a + b, 0) / (durations.length || 1);
  const avgTtfb = ttfbValues.reduce((a, b) => a + b, 0) / (ttfbValues.length || 1);
  const totalSize = sizes.reduce((a, b) => a + b, 0);
  const throughput = (report.totalRequests / totalTimeMs) * 1000;

  console.log(`\n  📊 ${report.method} ${report.url}`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  请求总数:     ${report.totalRequests}`);
  console.log(`  成功:         ${report.successCount}  (${((report.successCount / report.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  失败:         ${report.errorCount}  (${((report.errorCount / report.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`  总耗时:       ${(totalTimeMs / 1000).toFixed(2)}s`);
  console.log(`  吞吐量:       ${throughput.toFixed(1)} req/s`);
  console.log(`  总传输:       ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  延迟 (ms):`);
  console.log(`    Min:        ${min.toFixed(1)}`);
  console.log(`    Avg:        ${avg.toFixed(1)}`);
  console.log(`    P50:        ${percentile(sorted, 50).toFixed(1)}`);
  console.log(`    P95:        ${percentile(sorted, 95).toFixed(1)}`);
  console.log(`    P99:        ${percentile(sorted, 99).toFixed(1)}`);
  console.log(`    Max:        ${max.toFixed(1)}`);
  console.log(`  TTFB (ms):`);
  console.log(`    Avg:        ${avgTtfb.toFixed(1)}`);
  console.log(`    P95:        ${percentile(sortedTtfb, 95).toFixed(1)}`);
  console.log(`  ─────────────────────────────────────────────`);

  // 状态码分布
  const statusMap = new Map<number, number>();
  for (const r of results) {
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
  }
  if (statusMap.size > 1) {
    console.log(`  状态码分布:`);
    for (const [code, count] of [...statusMap.entries()].sort()) {
      const emoji = code < 300 ? "✅" : code < 400 ? "↪️" : code < 500 ? "⚠️" : "❌";
      console.log(`    ${emoji} ${code}: ${count} (${((count / report.totalRequests) * 100).toFixed(1)}%)`);
    }
  }

  // 评级
  const errorRate = report.errorCount / report.totalRequests;
  let grade: string;
  if (errorRate === 0 && avg < 200 && percentile(sorted, 95) < 500) {
    grade = "🏆 A — 优秀";
  } else if (errorRate < 0.01 && avg < 500 && percentile(sorted, 95) < 1000) {
    grade = "👍 B — 良好";
  } else if (errorRate < 0.05 && avg < 1000) {
    grade = "⚠️ C — 一般";
  } else if (errorRate < 0.1) {
    grade = "🔴 D — 需优化";
  } else {
    grade = "💀 F — 严重问题";
  }
  console.log(`  评级:         ${grade}\n`);
}

// ======== 默认测试端点 ========
const DEFAULT_ENDPOINTS: BenchmarkConfig[] = [
  { url: "/" },
  { url: "/works" },
  { url: "/members" },
  { url: "/api/works" },
  { url: "/api/members/search?q=a" },
  { url: "/api/activities" },
];

// ======== 压测模式: 逐渐增加并发 ========
async function stressMode(concurrencyStep: number, steps: number, requestsPerStep: number) {
  console.log(`\n🔥 压力测试模式 — 并发从 ${concurrencyStep} 逐步增加到 ${concurrencyStep * steps}\n`);

  const config: BenchmarkConfig = { url: "/api/works" };
  const allResults: { concurrency: number; results: RequestResult[]; duration: number }[] = [];

  for (let i = 1; i <= steps; i++) {
    const c = concurrencyStep * i;
    console.log(`\n📈 并发 = ${c}:`);
    const start = performance.now();
    const results = await runConcurrent(config, c, requestsPerStep);
    const duration = performance.now() - start;
    allResults.push({ concurrency: c, results, duration });

    const report = buildReport(config, results, duration);
    analyzeResults(results, report);
  }

  // 总结表格
  console.log(`\n📋 压力测试总结:`);
  console.log(`  ${"并发".padEnd(8)}${"吞吐量".padEnd(12)}${"Avg延迟".padEnd(12)}${"P95延迟".padEnd(12)}${"错误率"}`);
  console.log(`  ${"─".repeat(60)}`);
  for (const { concurrency, results, duration } of allResults) {
    const report = buildReport(config, results, duration);
    const sorted = [...report.durations].sort((a, b) => a - b);
    const avg = report.durations.reduce((a, b) => a + b, 0) / (report.durations.length || 1);
    const throughput = (report.totalRequests / duration) * 1000;
    const errRate = (report.errorCount / report.totalRequests * 100).toFixed(1);
    console.log(
      `  ${String(concurrency).padEnd(8)}${throughput.toFixed(1).padEnd(12)}${avg.toFixed(1).padEnd(12)}${percentile(sorted, 95).toFixed(1).padEnd(12)}${errRate}%`
    );
  }

  return allResults;
}

// ======== 突发峰值模式 ========
async function spikeMode(burstSize: number, quietSize: number, rounds: number) {
  console.log(`\n⚡ 突发峰值测试模式 — ${rounds} 轮，每轮 ${burstSize} 并发 burst\n`);

  const config: BenchmarkConfig = { url: "/api/works" };
  const allRoundResults: RequestResult[][] = [];

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n💥 第 ${round}/${rounds} 轮 — 突发 ${burstSize} 并发:`);
    const start = performance.now();
    const results = await runConcurrent(config, burstSize, burstSize);
    const duration = performance.now() - start;
    allRoundResults.push(results);

    const report = buildReport(config, results, duration);
    analyzeResults(results, report);

    // 休息一下
    if (round < rounds) {
      process.stdout.write(`  😴 冷却 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      process.stdout.write(`\r${" ".repeat(20)}\r`);
    }
  }

  // 峰值后验证
  console.log(`\n🔍 峰值后验证 (${quietSize} 普通请求):`);
  const postResults = await runConcurrent(config, 5, quietSize);
  const postReport = buildReport(config, postResults, performance.now() - performance.now());
  const postErrors = postResults.filter((r) => r.status >= 500 || r.error).length;
  if (postErrors === 0) {
    console.log(`  ✅ 峰值后服务恢复正常，${quietSize} 请求全部成功`);
  } else {
    console.log(`  ⚠️ 峰值后 ${postErrors}/${quietSize} 请求失败 — 服务可能未完全恢复`);
  }
}

function buildReport(config: BenchmarkConfig, results: RequestResult[], totalTimeMs: number): BenchmarkReport {
  const success = results.filter((r) => !r.error && r.status < 500);
  const errors = results.filter((r) => !!r.error || r.status >= 500);
  return {
    url: config.url,
    method: config.method || "GET",
    totalRequests: results.length,
    successCount: success.length,
    errorCount: errors.length,
    durations: results.map((r) => r.duration),
    ttfbValues: success.map((r) => r.ttfb),
    sizes: results.map((r) => r.size),
    totalBytes: results.reduce((a, r) => a + r.size, 0),
    totalTimeMs,
  };
}

// ======== 主入口 ========
async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : null;
  };

  const mode = getArg("--mode") || "load";
  const customUrl = getArg("--url");
  const concurrency = parseInt(getArg("--concurrency") || String(DEFAULT_CONCURRENCY));
  const totalRequests = parseInt(getArg("--requests") || String(DEFAULT_REQUESTS));

  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║     🏋️  Bugu-Studio 性能基准测试工具         ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  目标: ${BASE.padEnd(35)}║`);
  console.log(`║  模式: ${mode.padEnd(35)}║`);
  if (mode === "load") {
    console.log(`║  并发: ${concurrency}${" ".repeat(32 - String(concurrency).length)}║`);
    console.log(`║  请求: ${totalRequests}${" ".repeat(32 - String(totalRequests).length)}║`);
  }
  console.log(`╚══════════════════════════════════════════════╝\n`);

  const totalStart = performance.now();

  if (mode === "stress") {
    await stressMode(concurrency, 5, totalRequests);
  } else if (mode === "spike") {
    await spikeMode(concurrency, 20, 5);
  } else {
    // 默认: 负载测试
    const endpoints = customUrl
      ? [{ url: customUrl }]
      : DEFAULT_ENDPOINTS;

    for (const config of endpoints) {
      process.stdout.write(`🚀 测试 ${config.url}...`);
      const start = performance.now();
      const results = await runConcurrent(config, concurrency, totalRequests);
      const duration = performance.now() - start;

      const report = buildReport(config, results, duration);
      analyzeResults(results, report);
    }
  }

  const totalDuration = performance.now() - totalStart;
  console.log(`✅ 全部测试完成，总耗时 ${(totalDuration / 1000).toFixed(1)}s\n`);
}

main().catch((err) => {
  console.error("❌ 基准测试异常:", err);
  process.exit(1);
});
