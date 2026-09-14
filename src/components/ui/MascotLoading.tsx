"use client";

import { useEffect } from "react";
import {
  LOADING_SCREEN_CLASS,
  isMascotLoadingActive,
  releaseLoadingScreen,
  retainLoadingScreen,
} from "@/components/ui/loading-screen";

/** 原地遁地（兔子洞） */
const HOLE_MS = 780;
/** 与 globals.css `.mascot-run` 周期一致；≥74% 视为完成一次屏宽冲刺 */
const RUN_CYCLE_MS = 1700;
const SPRINT_DONE_AT = 0.74;
const STRICT_GUARD_MS = 50;
const CD_SRC = "/images/bugoos-best-vol2-cd.jpg";
/** PVZ 式掉落：弹出 → 落地弹跳 → 悬停发光 → 缩小收走 */
const CD_DROP_MS = 2800;
const CD_DROP_COOLDOWN_MS = 480;

type Layer = {
  root: HTMLDivElement;
  runner: HTMLDivElement;
  sprite: HTMLDivElement;
  hole: HTMLDivElement;
  textEl: HTMLParagraphElement;
  retainers: number;
  finishTimer: number | null;
  waitSprintTimer: number | null;
  finishing: boolean;
};

let layer: Layer | null = null;
let lastCdDropAt = 0;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureLayer(): Layer {
  if (layer) return layer;

  const root = document.createElement("div");
  root.className = LOADING_SCREEN_CLASS;
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("data-mascot-layer", "1");
  root.setAttribute("data-loading-screen", "mascot");
  root.innerHTML = `
    <div class="mascot-run-track" style="width:100%;max-width:100vw">
      <div class="mascot-run" data-mascot-runner style="transform:translate(72vw,0) scaleX(1)">
        <div class="mascot-rabbit-hole" data-mascot-hole aria-hidden="true"></div>
        <div class="mascot-sprite" data-mascot-sprite role="button" tabindex="-1" aria-label="抛出光盘" title="点我掉光盘">
          <img
            src="/images/mascot-loading.png"
            alt=""
            width="140"
            height="140"
            class="mascot-knockout"
            draggable="false"
          />
        </div>
      </div>
    </div>
    <p class="loading-screen-text text-brand-text-muted" data-mascot-text>加载中...</p>
  `;
  document.body.appendChild(root);
  const runner = root.querySelector("[data-mascot-runner]") as HTMLDivElement;
  const sprite = root.querySelector("[data-mascot-sprite]") as HTMLDivElement;
  const hole = root.querySelector("[data-mascot-hole]") as HTMLDivElement;
  const textEl = root.querySelector("[data-mascot-text]") as HTMLParagraphElement;
  layer = {
    root,
    runner,
    sprite,
    hole,
    textEl,
    retainers: 0,
    finishTimer: null,
    waitSprintTimer: null,
    finishing: false,
  };

  sprite.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layer || layer.finishing) return;
    spawnCdDrop(sprite);
  });

  return layer;
}

/** 游戏掉落感：PVZ 太阳/金币式弹出落地弹跳 + 翻转光盘光 */
function spawnCdDrop(fromEl: HTMLElement) {
  if (prefersReducedMotion()) return;
  const now = performance.now();
  if (now - lastCdDropAt < CD_DROP_COOLDOWN_MS) return;
  lastCdDropAt = now;

  const rect = fromEl.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.42;
  const drift = (Math.random() * 2 - 1) * 64;
  const peak = -(96 + Math.random() * 28);
  const ground = 52 + Math.random() * 22;
  const bounce1 = ground + peak * 0.38;
  const bounce2 = ground + peak * 0.14;

  const wrap = document.createElement("div");
  wrap.className = "mascot-cd-drop";
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.left = `${cx}px`;
  wrap.style.top = `${cy}px`;
  wrap.innerHTML = `
    <div class="mascot-cd-drop-aura" aria-hidden="true">
      <svg class="mascot-cd-drop-star" viewBox="0 0 100 100" width="100%" height="100%">
        <polygon
          points="50.00,2.00 57.81,33.78 87.53,20.07 67.55,45.99 96.80,60.68 64.07,61.22 70.83,93.25 50.00,68.00 29.17,93.25 35.93,61.22 3.20,60.68 32.45,45.99 12.47,20.07 42.19,33.78"
          fill="rgba(255, 232, 140, 0.9)"
        />
      </svg>
    </div>
    <div class="mascot-cd-drop-bob">
      <div class="mascot-cd-drop-spin">
        <div class="mascot-cd-drop-face mascot-cd-drop-front">
          <img src="${CD_SRC}" alt="" width="160" height="160" draggable="false" />
        </div>
        <div class="mascot-cd-drop-face mascot-cd-drop-back"></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  fromEl.animate(
    [
      { transform: "translateY(0) scale(1, 1)" },
      { transform: "translateY(6px) scale(1.12, 0.82)" },
      { transform: "translateY(-4px) scale(0.94, 1.08)" },
      { transform: "translateY(0) scale(1, 1)" },
    ],
    { duration: 280, easing: "cubic-bezier(0.34, 1.4, 0.4, 1)" },
  );

  const t = (x: number, y: number, sx = 1, sy = 1) =>
    `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${sx}, ${sy})`;

  const flight = wrap.animate(
    [
      // 从角色身上弹出
      { transform: t(0, 8, 0.2, 0.2), opacity: 0, offset: 0 },
      { transform: t(drift * 0.15, peak * 0.45, 0.85, 0.85), opacity: 1, offset: 0.06 },
      { transform: t(drift * 0.28, peak, 1.06, 1.06), opacity: 1, offset: 0.12 },
      // 落地
      { transform: t(drift * 0.55, ground, 1.12, 0.82), opacity: 1, offset: 0.26 },
      // 一弹
      { transform: t(drift * 0.68, bounce1, 0.96, 1.06), opacity: 1, offset: 0.36 },
      { transform: t(drift * 0.78, ground, 1.1, 0.86), opacity: 1, offset: 0.45 },
      // 二弹
      { transform: t(drift * 0.88, bounce2, 0.98, 1.03), opacity: 1, offset: 0.54 },
      { transform: t(drift * 0.94, ground, 1.04, 0.94), opacity: 1, offset: 0.6 },
      // 落地悬停（光继续转）
      { transform: t(drift, ground - 4, 1, 1), opacity: 1, offset: 0.72 },
      { transform: t(drift, ground - 10, 1, 1), opacity: 1, offset: 0.82 },
      // 像被捡走：缩小上飘消失
      { transform: t(drift, ground - 28, 0.55, 0.55), opacity: 0.85, offset: 0.9 },
      { transform: t(drift, ground - 48, 0, 0), opacity: 0, offset: 1 },
    ],
    {
      duration: CD_DROP_MS,
      fill: "forwards",
      easing: "linear",
    },
  );

  flight.finished
    .catch(() => undefined)
    .finally(() => wrap.remove());
}

function clearFinishTimer(L: Layer) {
  if (L.finishTimer != null) {
    window.clearTimeout(L.finishTimer);
    L.finishTimer = null;
  }
  if (L.waitSprintTimer != null) {
    window.clearTimeout(L.waitSprintTimer);
    L.waitSprintTimer = null;
  }
}

function destroyLayer() {
  if (!layer) return;
  clearFinishTimer(layer);
  layer.root.remove();
  layer = null;
}

function restartRunAnimation(L: Layer) {
  L.runner.getAnimations().forEach((a) => a.cancel());
  L.sprite.getAnimations().forEach((a) => a.cancel());
  L.hole.getAnimations().forEach((a) => a.cancel());

  L.runner.classList.remove("mascot-run");
  L.sprite.classList.remove("mascot-sprite");
  L.sprite.style.animation = "";
  L.sprite.style.transform = "";
  L.sprite.style.opacity = "";
  L.sprite.style.clipPath = "";
  L.hole.style.opacity = "";
  L.hole.style.transform = "";
  L.hole.classList.remove("is-open");
  L.runner.style.transform = "translate(72vw, 0) scaleX(1)";
  void L.runner.offsetWidth;

  L.runner.classList.add("mascot-run");
  L.sprite.classList.add("mascot-sprite");
  requestAnimationFrame(() => {
    if (layer === L && L.runner.classList.contains("mascot-run")) {
      L.runner.style.transform = "";
    }
  });
}

function fadeLoadingText(L: Layer) {
  L.textEl.getAnimations().forEach((a) => a.cancel());
  L.textEl.animate(
    [
      { opacity: 1, offset: 0 },
      { opacity: 0, offset: 1 },
    ],
    { duration: 180, fill: "forwards", easing: "ease-out" },
  );
}

function retainMascot(text: string) {
  if (typeof document === "undefined") return;
  retainLoadingScreen("mascot");
  if (prefersReducedMotion()) return;

  const L = ensureLayer();
  const alreadyPresent =
    L.retainers > 0 ||
    L.finishing ||
    L.runner.classList.contains("mascot-run");

  clearFinishTimer(L);

  // 收尾被打断：停在当前位置继续跑，不从右边重新入场
  if (L.finishing) {
    L.runner.getAnimations().forEach((a) => a.cancel());
    L.sprite.getAnimations().forEach((a) => a.cancel());
    L.hole.getAnimations().forEach((a) => a.cancel());
    L.textEl.getAnimations().forEach((a) => a.cancel());
    L.root.getAnimations().forEach((a) => a.cancel());
    L.finishing = false;
    const { x, facing, y } = readPose(L.runner);
    L.sprite.style.animation = "";
    L.sprite.style.transform = "";
    L.sprite.style.opacity = "";
    L.hole.style.opacity = "";
    L.hole.style.transform = "";
    L.hole.classList.remove("is-open");
    L.root.classList.remove("is-finishing");
    L.root.style.opacity = "";
    L.textEl.style.opacity = "";
    L.runner.style.transform = `translate(${x}px, ${y}px) scaleX(${facing})`;
    L.runner.classList.add("mascot-run");
    L.sprite.classList.add("mascot-sprite");
    requestAnimationFrame(() => {
      if (layer === L && L.runner.classList.contains("mascot-run")) {
        L.runner.style.transform = "";
      }
    });
  }

  L.retainers += 1;
  L.textEl.textContent = text;
  L.root.style.display = "";

  // 只有第一次出现才从右屏外入场
  if (!alreadyPresent) {
    restartRunAnimation(L);
  }

  document.querySelectorAll('[data-loading-screen="logo"]').forEach((el) => {
    (el as HTMLElement).style.display = "none";
  });
}

function readPose(el: HTMLElement) {
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") {
    return { x: window.innerWidth * 0.35, facing: 1, y: 0 };
  }
  const m = new DOMMatrixReadOnly(t);
  const facing = m.a < 0 ? -1 : 1;
  return { x: m.m41, facing, y: m.m42 };
}

function afterFinishCleanup(L: Layer) {
  if (layer === L && L.retainers === 0) {
    destroyLayer();
    if (!isMascotLoadingActive()) {
      document.querySelectorAll('[data-loading-screen="logo"]').forEach((el) => {
        (el as HTMLElement).style.display = "";
      });
    }
  }
}

/**
 * 遁地：PVZ 倭瓜式 — 一次深蹲蓄力 → 高抛 → 大 g 砸进洞（不降透明度）
 */
function finishRabbitHole(L: Layer) {
  const { x, facing, y } = readPose(L.runner);
  L.runner.classList.remove("mascot-run");
  L.sprite.classList.remove("mascot-sprite");
  L.runner.getAnimations().forEach((a) => a.cancel());
  L.sprite.getAnimations().forEach((a) => a.cancel());
  L.sprite.style.animation = "none";
  L.hole.classList.add("is-open");
  L.root.classList.add("is-finishing");

  L.runner.style.transform = `translate(${x}px, ${y}px) scaleX(${facing})`;

  const crouch = y + 18;
  const peak = y - 168;
  const into = y + 240;
  const fall = into - peak;

  const at = (u: number) => peak + fall * u * u * u;

  const pathAnim = L.runner.animate(
    [
      { transform: `translate(${x}px, ${y}px) scaleX(${facing})`, offset: 0 },
      { transform: `translate(${x}px, ${crouch}px) scaleX(${facing})`, offset: 0.16 },
      { transform: `translate(${x}px, ${peak}px) scaleX(${facing})`, offset: 0.36 },
      { transform: `translate(${x}px, ${at(0.4)}px) scaleX(${facing})`, offset: 0.52 },
      { transform: `translate(${x}px, ${at(0.7)}px) scaleX(${facing})`, offset: 0.72 },
      { transform: `translate(${x}px, ${into}px) scaleX(${facing})`, offset: 1 },
    ],
    {
      duration: HOLE_MS,
      fill: "forwards",
      easing: "linear",
    },
  );

  const spriteAnim = L.sprite.animate(
    [
      { transform: "scale(1, 1)", offset: 0 },
      { transform: "scale(1.42, 0.52)", offset: 0.16 },
      { transform: "scale(0.74, 1.32)", offset: 0.36 },
      { transform: "scale(0.92, 1.1)", offset: 0.52 },
      { transform: "scale(1.16, 0.84)", offset: 0.72 },
      { transform: "scale(1.05, 0.95)", offset: 1 },
    ],
    {
      duration: HOLE_MS,
      fill: "forwards",
      easing: "linear",
    },
  );

  const holeAnim = L.hole.animate(
    [
      {
        transform: "translateX(-50%) scaleX(0.05) scaleY(0.2)",
        opacity: 0,
        offset: 0,
      },
      {
        transform: "translateX(-50%) scaleX(1.08) scaleY(1)",
        opacity: 1,
        offset: 0.12,
      },
      {
        transform: "translateX(-50%) scaleX(1) scaleY(1)",
        opacity: 1,
        offset: 0.78,
      },
      {
        transform: "translateX(-50%) scaleX(0.05) scaleY(0.1)",
        opacity: 0,
        offset: 1,
      },
    ],
    {
      duration: HOLE_MS,
      fill: "forwards",
      easing: "linear",
    },
  );

  Promise.all([pathAnim.finished, spriteAnim.finished, holeAnim.finished])
    .catch(() => undefined)
    .finally(() => afterFinishCleanup(L));
}

function msUntilSprintDone(L: Layer): number {
  const anim = L.runner.getAnimations()[0];
  const t =
    anim && typeof anim.currentTime === "number" ? anim.currentTime : 0;
  const target = RUN_CYCLE_MS * SPRINT_DONE_AT;
  if (t >= target) return 0;
  return Math.max(0, target - t);
}

function finishThenDestroy(L: Layer) {
  if (L.finishing) return;
  L.finishing = true;
  fadeLoadingText(L);

  const wait = msUntilSprintDone(L);
  if (wait <= 0) {
    finishRabbitHole(L);
    return;
  }

  L.waitSprintTimer = window.setTimeout(() => {
    L.waitSprintTimer = null;
    if (!layer || layer !== L || L.retainers > 0) {
      L.finishing = false;
      return;
    }
    finishRabbitHole(L);
  }, wait);
}

function releaseMascot() {
  releaseLoadingScreen("mascot");
  if (!layer) return;
  const L = layer;
  L.retainers = Math.max(0, L.retainers - 1);
  if (L.retainers > 0) return;

  clearFinishTimer(L);
  L.finishTimer = window.setTimeout(() => {
    L.finishTimer = null;
    if (!layer || layer !== L || L.retainers > 0) return;
    if (prefersReducedMotion()) {
      destroyLayer();
      return;
    }
    finishThenDestroy(L);
  }, STRICT_GUARD_MS);
}

/**
 * 看板娘加载 — 全屏置顶居中单例
 * React 树内不占位，避免和 Logo 叠两层、位置错乱
 */
export default function MascotLoading({
  text = "加载中...",
}: {
  text?: string;
}) {
  useEffect(() => {
    retainMascot(text);
    return () => releaseMascot();
  }, [text]);

  // 占位标记给 Strict Mode / Logo 互斥探测；视觉全在 body 层
  return <div data-mascot-loading hidden aria-hidden />;
}
