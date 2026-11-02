/**
 * dev 启动包装：确保 Turbopack 的 PostCSS 工作进程池能找到真实的 node 可执行文件。
 *
 * 背景：部分宿主环境（如 Kimi Work 预览通道）的 PATH 里没有真实的 node.exe
 * （只有 shell 垫片，或 node 是 Electron 宿主进程），Turbopack 处理 CSS 时
 * spawn("node") 会 ENOENT（program not found），导致 dev 下所有页面 500：
 *   "Failed to write app endpoint … spawning node pooled process … program not found"
 *
 * 策略：
 * 1) 在 PATH 与常见安装位置中找真实 node 可执行文件；找到则把其目录前置到 PATH，
 *    并用该真实 node 二进制启动 next（不能用 process.execPath —— 宿主通道下它可能
 *    是 Kimi.exe 等 Electron 宿主，作为子进程直起的可靠性无法保证）。
 * 2) 找不到则回退 webpack 模式（next dev，PostCSS 在进程内执行，无需 spawn 工作进程）。
 * CLI 参数（如 -p 端口）原样透传给 next。
 *
 * 排障：每次启动把关键上下文追加写入 <项目根>/.dev-boot.log（时间、execPath、
 * PATH 开头、选用的 node、子进程退出码），用于诊断宿主预览通道的启动失败。
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bootLog = path.join(root, ".dev-boot.log");

function logBoot(msg) {
  try {
    fs.appendFileSync(bootLog, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {
    /* 日志失败不影响启动 */
  }
}

const exe = process.platform === "win32" ? "node.exe" : "node";

/** PATH 中是否能直接 spawn node */
function nodeSpawnWorks() {
  const r = spawnSync("node", ["-v"], { stdio: "ignore" });
  return !r.error;
}

/** 在 PATH 与常见安装位置找真实 node 可执行文件，返回其所在目录 */
function findRealNodeDir() {
  const dirs = [];
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (dir) dirs.push(dir);
  }
  if (process.platform === "win32") {
    // 覆盖本机与常规安装位置；排在前面的优先
    dirs.push("D:\\NodeJS");
    if (process.env.ProgramFiles) dirs.push(path.join(process.env.ProgramFiles, "nodejs"));
    if (process.env["ProgramFiles(x86)"]) dirs.push(path.join(process.env["ProgramFiles(x86)"], "nodejs"));
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, "Programs", "nodejs"));
    if (process.env.NVM_SYMLINK) dirs.push(process.env.NVM_SYMLINK);
    if (process.env.NVM_HOME) dirs.push(process.env.NVM_HOME);
    if (process.env.VOLTA_HOME) dirs.push(path.join(process.env.VOLTA_HOME, "bin"));
    if (process.env.FNM_DIR) dirs.push(process.env.FNM_DIR);
  } else {
    dirs.push("/usr/local/bin", "/usr/bin", "/opt/homebrew/bin");
  }
  for (const dir of dirs) {
    try {
      fs.accessSync(path.join(dir, exe), fs.constants.X_OK);
      return dir;
    } catch {
      /* 继续找 */
    }
  }
  return null;
}

logBoot(
  `boot execPath=${process.execPath} argv=${JSON.stringify(process.argv.slice(2))} ` +
    `PATH头=${(process.env.PATH ?? "").split(path.delimiter).slice(0, 3).join(" | ")}`,
);

let useTurbo = true;
let nodeBin;
const spawnOk = nodeSpawnWorks();
const realDir = findRealNodeDir();
if (realDir) {
  // 前置真实 node 目录（供 Turbopack 工作进程池 spawn("node")），并用真实二进制起 next
  process.env.PATH = realDir + path.delimiter + (process.env.PATH ?? "");
  nodeBin = path.join(realDir, exe);
  if (!spawnOk) console.log(`[dev] PATH 中找不到可用的 node，已前置真实 node 目录：${realDir}`);
} else if (spawnOk) {
  // PATH 里的 node 可 spawn 但不是常规文件布局（罕见），直接用
  nodeBin = "node";
} else {
  useTurbo = false;
  nodeBin = process.execPath; // 最后手段：至少当前进程能跑 JS
  console.warn("[dev] 未找到真实 node 可执行文件，回退 webpack 模式启动（略慢，但无需 PostCSS 工作进程）");
}
logBoot(`nodeBin=${nodeBin} useTurbo=${useTurbo} spawnOk=${spawnOk} realDir=${realDir}`);

/**
 * 宿主预览通道会传 `--host <值>`，而 Next CLI 只认 `--hostname`（不认 --host，
 * 会直接 "unknown option '--host'" 退出码 1 秒退）。这里把两种写法都翻译成
 * Next 的参数名；其余参数（如 --port）原样透传。
 */
function translateArgs(argv) {
  return argv.map((a) => {
    if (a === "--host") return "--hostname";
    if (a.startsWith("--host=")) return "--hostname=" + a.slice("--host=".length);
    return a;
  });
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const args = [nextBin, "dev", ...(useTurbo ? ["--turbo"] : []), ...translateArgs(process.argv.slice(2))];
logBoot(`next args=${JSON.stringify(args.slice(2))}`);
const child = spawn(nodeBin, args, { stdio: "inherit", env: process.env });

child.on("error", (err) => {
  logBoot(`child spawn error: ${String(err)}`);
  console.error(`[dev] 启动 next 失败：${err.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  logBoot(`child exit code=${code} signal=${signal}`);
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
