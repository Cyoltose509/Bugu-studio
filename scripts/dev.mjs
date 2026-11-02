/**
 * dev 启动包装：确保 Turbopack 的 PostCSS 工作进程池能找到真实的 node 可执行文件。
 *
 * 背景：部分宿主环境（如 Kimi Work 预览通道）的 PATH 里没有真实的 node.exe
 * （只有 shell 垫片，或 node 是 Electron 宿主进程），Turbopack 处理 CSS 时
 * spawn("node") 会 ENOENT（program not found），导致 dev 下所有页面 500：
 *   "Failed to write app endpoint … spawning node pooled process … program not found"
 *
 * 策略：
 * 1) 在 PATH 与常见安装位置中找真实 node 可执行文件，找到则把其目录前置到 PATH（保持 --turbo）。
 * 2) 找不到则回退 webpack 模式（next dev，PostCSS 在进程内执行，无需 spawn 工作进程）。
 * CLI 参数（如 -p 端口）原样透传给 next。
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** PATH 中是否能直接 spawn node */
function nodeSpawnWorks() {
  const r = spawnSync("node", ["-v"], { stdio: "ignore" });
  return !r.error;
}

/** 在常见位置找真实 node 可执行文件，返回其所在目录 */
function findRealNodeDir() {
  const exe = process.platform === "win32" ? "node.exe" : "node";
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
      const p = path.join(dir, exe);
      fs.accessSync(p, fs.constants.X_OK);
      return dir;
    } catch {
      /* 继续找 */
    }
  }
  return null;
}

let useTurbo = true;
if (!nodeSpawnWorks()) {
  const dir = findRealNodeDir();
  if (dir) {
    process.env.PATH = dir + path.delimiter + (process.env.PATH ?? "");
    console.log(`[dev] PATH 中找不到可用的 node，已前置真实 node 目录：${dir}`);
  } else {
    useTurbo = false;
    console.warn("[dev] 未找到真实 node 可执行文件，回退 webpack 模式启动（略慢，但无需 PostCSS 工作进程）");
  }
}

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const args = [nextBin, "dev", ...(useTurbo ? ["--turbo"] : []), ...process.argv.slice(2)];
const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
