"use client";

/**
 * 成员关系图谱
 *
 * 三类节点：成员（头像）/ 作品（封面）/ 入社年份（2×2 数字格）
 *   - 成员 — 作品：作品里登记的社团内开发者
 *   - 成员 — 入社年份：该成员的入社年份
 *
 * 分层渲染：连线画在 canvas 上，节点是 DOM 层。
 * 头像和封面交给 next/image 自己加载，圆形裁切和圆角交给 CSS，
 * 缩放只改 transform；如果也在 canvas 里 drawImage，八十来张图每帧重绘
 * 既糊又难对齐，且跨域图片会污染画布。
 *
 * 物理仿 d3-force / Obsidian 图谱：所有力先累计到缓冲区、再统一积分；
 * 斥力带距离上限（远处不互斥，自然形成聚簇而不是均匀摊开）；
 * 弹簧长度按节点尺寸自适应、强度按 1/min(度) 衰减（hub 不勒死布局）；
 * 碰撞是松弛迭代而不是直接改位置，收敛过程不抖。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

type Kind = "member" | "project" | "year";

interface RawNode {
    id: string;
    kind: Kind;
    label: string;
    degree: number;
    graduated?: boolean;
    position?: string;
    avatar?: string | null;
    slug?: string;
    cover?: string | null;
    count?: number;
    year?: number | null;
}
interface RawLink {
    source: string;
    target: string;
    kind: "develop" | "join";
    roles?: string[];
}
interface GraphPayload {
    nodes: RawNode[];
    links: RawLink[];
    stats: {
        memberCount: number;
        projectCount: number;
        yearCount: number;
        developCount: number;
        activeDevCount: number;
    };
}

interface SimNode extends RawNode {
    x: number;
    y: number;
    vx: number;
    vy: number;
    /** 节点世界尺寸（px，视图缩放前） */
    w: number;
    h: number;
    /** 碰撞用的外接圆半径 */
    r: number;
    /** 斥力系数：节点越大，把别人推得越远 */
    charge: number;
    idx: number;
    /** 当前 tick 在 live 数组里的下标（力累计用） */
    ti: number;
}
interface SimLink {
    a: SimNode;
    b: SimNode;
    kind: "develop" | "join";
    roles: string[];
    /** 弹簧原长：两节点视觉半径之和 + 目标间隙 */
    rest: number;
    /** 弹簧强度：1/min(两端度数)，hub 一侧被弱约束，布局不被大叶节点勒死 */
    k: number;
}

// ── 物理参数（d3-force 语义：力 × alpha 累计，积分时统一衰减速度）──
const CHARGE = 3200; // 斥力基准（除以距离平方），节点越大斥力越强
const CHARGE_MAX_D = 460; // 斥力距离上限：之外不互斥，聚簇才能成形
const GAP_DEV = 60; // develop 边：两节点边框之间的目标间隙
const GAP_JOIN = 42; // join 边（成员—年份）的目标间隙，更短、聚得更紧
const LINK_K = 0.55; // 弹簧强度基准，实际值 = LINK_K / min(两端度数)
const CENTER = 0.016; // 向画布中心的弱引力，防止整图飘走
const VELOCITY_KEEP = 0.6; // 每 tick 速度保留率（d3 默认 0.6），越小越稳
const ALPHA_DECAY = 0.976; // ≈ d3 默认，约 300 tick 收敛
const ALPHA_MIN = 0.001;
const COLLIDE_PAD = 5;
const COLLIDE_STRENGTH = 0.65; // 每轮碰撞只推开一部分，两轮迭代收敛

const KIND_LABEL: Record<Kind, string> = {
    member: "成员",
    project: "作品",
    year: "入社年份",
};

/** 节点尺寸：年份按人数、其余按度数略微放大 */
function nodeBox(n: RawNode): { w: number; h: number } {
    if (n.kind === "year") {
        const s = 34 + Math.sqrt(n.count ?? 1) * 5.5;
        return { w: s, h: s };
    }
    if (n.kind === "project") {
        const w = 48 + Math.sqrt(n.degree) * 11;
        return { w, h: Math.round(w * 0.66) };
    }
    const d = 30 + Math.sqrt(n.degree) * 7;
    return { w: d, h: d };
}

/** 年份四宫格：2024 → ["2","0","2","4"] */
function yearDigits(n: RawNode): string[] {
    if (!n.year) return ["—", "—", "—", "—"];
    return String(n.year).padStart(4, "0").slice(-4).split("");
}

/** 四宫格品牌配色：按品牌色卡 蓝/橙/绿/藏青 顺时针填入（暗色用亮变体保证对比度） */
const YEAR_QUAD: { cell: string; text: string }[] = [
    { cell: "bg-[#3388BB] dark:bg-[#5BA8D8]", text: "text-white dark:text-[#12283D]" },
    { cell: "bg-[#E38043] dark:bg-[#F09055]", text: "text-[#14304A]" },
    { cell: "bg-[#88C232] dark:bg-[#9ED44A]", text: "text-[#14304A]" },
    { cell: "bg-[#25547A] dark:bg-[#3D74A8]", text: "text-white" },
];

/** 读取当前主题下的配色（昼夜切换后要重读） */
function readColors() {
    const s = getComputedStyle(document.documentElement);
    const v = (name: string, fallback: string) =>
        (s.getPropertyValue(name) || fallback).trim() || fallback;
    const dark = document.documentElement.classList.contains("dark");
    return {
        member: v("--color-brand-blue", "#3388BB"),
        project: v("--color-brand-orange", "#E38043"),
        year: dark ? "#93a1b5" : "#78849a",
        edge: dark ? "rgba(170,195,225,0.26)" : "rgba(90,110,135,0.26)",
        edgeHot: dark ? "rgba(190,215,240,0.9)" : "rgba(60,85,115,0.75)",
        text: dark ? "#c8d4e4" : "#41505f",
        textDim: dark ? "rgba(200,212,228,0.4)" : "rgba(65,80,95,0.45)",
        ringHot: dark ? "rgba(225,238,255,0.7)" : "rgba(28,45,68,0.5)",
        ringMatch: v("--color-brand-blue", "#3388BB"),
    };
}

export default function MemberGraph({ query = "" }: { query?: string }) {
    const router = useRouter();
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [data, setData] = useState<GraphPayload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [nonce, setNonce] = useState(0);
    const [hoverLabel, setHoverLabel] = useState<string | null>(null);
    const [broken, setBroken] = useState<Set<string>>(() => new Set());
    const [hidden, setHidden] = useState<Record<Kind, boolean>>({
        member: false,
        project: false,
        year: false,
    });

    // 模拟与视图状态放在 ref 里，避免每帧 setState
    const simRef = useRef<{ nodes: SimNode[]; links: SimLink[] } | null>(null);
    const viewRef = useRef({ k: 1, x: 0, y: 0 });
    const alphaRef = useRef(1);
    const rafRef = useRef<number | null>(null);
    const hoverRef = useRef<SimNode | null>(null);
    const dragRef = useRef<{ node: SimNode; moved: boolean } | null>(null);
    const panRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
    // 触摸端没有滚轮，双指捏合是唯一能缩放的方式
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = useRef<{
        dist: number;
        mx: number;
        my: number;
    } | null>(null);
    const sizeRef = useRef({ w: 0, h: 0 });
    const aspectRef = useRef(1); // 画布宽高比，用于让布局跟着画布形状摊开
    const fittedRef = useRef(false); // 视图是否已完成首次自适应
    const settleFitRef = useRef(false); // 收敛后是否已重新自适应过
    const touchedRef = useRef(false); // 用户是否手动缩放/平移过
    const colorsRef = useRef(readColors());
    const queryRef = useRef(query);
    const hiddenRef = useRef(hidden);

    // 节点层 DOM：外层定位、本体缩放、标签。模拟运行时直接改 style，不走 React
    const wrapEls = useRef(new Map<string, HTMLDivElement>());
    const bodyEls = useRef(new Map<string, HTMLDivElement>());
    const labelEls = useRef(new Map<string, HTMLDivElement>());

    queryRef.current = query;
    hiddenRef.current = hidden;

    // ── 拉数据 ──
    useEffect(() => {
        let alive = true;
        setError(null);
        setData(null);
        (async () => {
            try {
                const res = await fetch("/api/members/graph", {
                    headers: { Accept: "application/json" },
                });
                const json = await res.json();
                if (!res.ok || !json?.success) {
                    throw new Error(json?.error || "加载失败");
                }
                if (alive) setData(json.data as GraphPayload);
            } catch (e) {
                if (alive) setError(e instanceof Error ? e.message : "加载失败");
            }
        })();
        return () => {
            alive = false;
        };
    }, [nonce]);

    // ── 主题变化时重读配色 ──
    useEffect(() => {
        const el = document.documentElement;
        const mo = new MutationObserver(() => {
            colorsRef.current = readColors();
            draw();
        });
        mo.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => mo.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ── 初始化模拟 ──
    useEffect(() => {
        if (!data) return;
        // 初始布局用叶序螺旋（d3-force 同款）：均匀无缠绕，收敛形态稳定
        const PHI = Math.PI * (3 - Math.sqrt(5)); // 黄金角
        const nodes: SimNode[] = data.nodes.map((n, i) => {
            const { w, h } = nodeBox(n);
            const r = Math.hypot(w, h) / 2;
            const rad = 44 * Math.sqrt(i + 0.5);
            const ang = i * PHI;
            return {
                ...n,
                x: Math.cos(ang) * rad,
                y: Math.sin(ang) * rad,
                vx: 0,
                vy: 0,
                w,
                h,
                r,
                charge: 0.5 + r / 60,
                idx: i,
                ti: i,
            };
        });
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const links: SimLink[] = [];
        for (const l of data.links) {
            const a = byId.get(l.source);
            const b = byId.get(l.target);
            if (!a || !b) continue;
            // 视觉半径取均值半径（比外接圆小，方形节点的角不会把间隙撑大）
            const rest =
                (a.w + a.h) / 4 + (b.w + b.h) / 4 + (l.kind === "develop" ? GAP_DEV : GAP_JOIN);
            const k = Math.max(
                0.12,
                Math.min(
                    0.55,
                    LINK_K / Math.min(Math.max(a.degree, 1), Math.max(b.degree, 1)),
                ),
            );
            links.push({ a, b, kind: l.kind, roles: l.roles ?? [], rest, k });
        }

        simRef.current = { nodes, links };
        alphaRef.current = 1;
        settleFitRef.current = false;
        fitView();
        start();
        return () => stop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ── 尺寸自适应 ──
    useEffect(() => {
        const wrap = wrapRef.current;
        const canvas = canvasRef.current;
        if (!wrap || !canvas) return;
        const ro = new ResizeObserver(() => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = wrap.clientWidth;
            const h = wrap.clientHeight;
            if (!w || !h) return;
            sizeRef.current = { w, h };
            aspectRef.current = Math.max(0.6, Math.min(w / h, 2.6));
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            const ctx = canvas.getContext("2d");
            ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
            // 第一次拿到真实尺寸时做视图自适应；此时坐标还是围绕原点的初始值，
            // 不 fit 的话整张图会被堆在画布左上角
            if (!fittedRef.current) {
                fittedRef.current = true;
                fitView();
            }
            draw();
        });
        ro.observe(wrap);
        return () => ro.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // 隐藏某类节点后重新给一点能量，让剩下的节点重排
    useEffect(() => {
        alphaRef.current = Math.max(alphaRef.current, 0.25);
        start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hidden]);

    const visible = useCallback((n: SimNode) => !hiddenRef.current[n.kind], []);

    const fitView = useCallback(() => {
        const sim = simRef.current;
        const { w, h } = sizeRef.current;
        if (!sim || !w || !h) return;
        const pts = sim.nodes.filter(visible);
        if (pts.length === 0) return;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const n of pts) {
            minX = Math.min(minX, n.x - n.w / 2);
            minY = Math.min(minY, n.y - n.h / 2);
            maxX = Math.max(maxX, n.x + n.w / 2);
            maxY = Math.max(maxY, n.y + n.h / 2);
        }
        const bw = Math.max(maxX - minX, 1);
        const bh = Math.max(maxY - minY, 1);
        const k = Math.min((w - 40) / bw, (h - 40) / bh);
        const view = viewRef.current;
        view.k = Math.max(0.3, Math.min(k, 1.6));
        view.x = w / 2 - ((minX + maxX) / 2) * view.k;
        view.y = h / 2 - ((minY + maxY) / 2) * view.k;
    }, [visible]);

    const tick = useCallback(() => {
        const sim = simRef.current;
        if (!sim) return;
        const { nodes, links } = sim;
        const alpha = alphaRef.current;
        const live = nodes.filter(visible);
        for (let i = 0; i < live.length; i++) live[i].ti = i;

        // 力累计缓冲区：所有力先算完再统一积分，顺序不影响结果
        const fx = new Float64Array(live.length);
        const fy = new Float64Array(live.length);

        // 斥力（O(n²)，节点规模小，直接算）
        // 带距离上限：超过 CHARGE_MAX_D 不互斥，聚簇自然成形而不是全图均匀摊开；
        // 接近上限时线性淡出，力不跳变
        for (let i = 0; i < live.length; i++) {
            const a = live[i];
            for (let j = i + 1; j < live.length; j++) {
                const b = live[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let d2 = dx * dx + dy * dy;
                if (d2 < 0.01) {
                    // 完全重合时给个确定性的小偏移，避免除零
                    dx = (a.idx % 7) * 0.1 + 0.1;
                    dy = (b.idx % 5) * 0.1 + 0.1;
                    d2 = dx * dx + dy * dy;
                }
                const d = Math.max(Math.sqrt(d2), 16);
                if (d > CHARGE_MAX_D) continue;
                let f = (CHARGE * a.charge * b.charge * alpha) / (d * d);
                if (d > CHARGE_MAX_D * 0.72) {
                    f *= (CHARGE_MAX_D - d) / (CHARGE_MAX_D * 0.28);
                }
                const ux = dx / d;
                const uy = dy / d;
                fx[i] -= ux * f;
                fy[i] -= uy * f;
                fx[j] += ux * f;
                fy[j] += uy * f;
            }
        }

        // 弹簧：原长按节点尺寸预计算，强度按 1/min(度) 预计算
        for (const l of links) {
            if (!visible(l.a) || !visible(l.b)) continue;
            const dx = l.b.x - l.a.x;
            const dy = l.b.y - l.a.y;
            const d = Math.max(Math.hypot(dx, dy), 0.5);
            const f = ((d - l.rest) / d) * l.k * alpha;
            // 度数大的一端少动一点，图更稳
            const wa = 1 / (1 + Math.min(l.a.degree, 8) * 0.12);
            const wb = 1 / (1 + Math.min(l.b.degree, 8) * 0.12);
            fx[l.a.ti] += dx * f * wa;
            fy[l.a.ti] += dy * f * wa;
            fx[l.b.ti] -= dx * f * wb;
            fy[l.b.ti] -= dy * f * wb;
        }

        // 向心（各向异性）：容器通常是宽扁的，纯 radial 向心力会把图挤成一个圆。
        // 平衡点距离与 sqrt(力系数) 成反比，要让图形横向铺开的比例等于画布宽高比，
        // 两个方向的力系数之比就得是宽高比的平方，即 asp 直接用宽高比
        const asp = aspectRef.current;
        const cx = (CENTER / asp) * alpha * 4;
        const cy = CENTER * asp * alpha * 4;
        for (let i = 0; i < live.length; i++) {
            fx[i] -= live[i].x * cx;
            fy[i] -= live[i].y * cy;
        }

        // 统一积分：v = (v + F) * 速度保留率
        for (let i = 0; i < live.length; i++) {
            const n = live[i];
            if (dragRef.current?.node === n) {
                n.vx = 0;
                n.vy = 0;
                continue;
            }
            n.vx = (n.vx + fx[i]) * VELOCITY_KEEP;
            n.vy = (n.vy + fy[i]) * VELOCITY_KEEP;
            n.x += n.vx;
            n.y += n.vy;
        }

        // 碰撞：两轮松弛迭代，每轮只推开一部分，不和速度打架，收敛不抖
        for (let round = 0; round < 2; round++) {
            for (let i = 0; i < live.length; i++) {
                const a = live[i];
                for (let j = i + 1; j < live.length; j++) {
                    const b = live[j];
                    const min = a.r + b.r + COLLIDE_PAD;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 >= min * min || d2 < 0.0001) continue;
                    const d = Math.sqrt(d2);
                    const push = ((min - d) / 2) * COLLIDE_STRENGTH;
                    const ux = dx / d;
                    const uy = dy / d;
                    if (dragRef.current?.node !== a) {
                        a.x -= ux * push;
                        a.y -= uy * push;
                    }
                    if (dragRef.current?.node !== b) {
                        b.x += ux * push;
                        b.y += uy * push;
                    }
                }
            }
        }

        alphaRef.current = alpha * ALPHA_DECAY;
    }, [visible]);

    /** 从 a 的中心朝 b 走，返回射线与 a 边框的交点，连线才不会压在头像上 */
    const borderPoint = useCallback(
        (a: SimNode, b: SimNode) => {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 1;
            const ux = dx / d;
            const uy = dy / d;
            let t: number;
            if (a.kind === "member") {
                // 成员渲染成圆形头像，按圆裁；按方裁会在斜角方向把线头留在图里
                t = a.w / 2 + 3;
            } else {
                const hw = a.w / 2 + 3;
                const hh = a.h / 2 + 3;
                const tx = Math.abs(ux) < 1e-6 ? Infinity : hw / Math.abs(ux);
                const ty = Math.abs(uy) < 1e-6 ? Infinity : hh / Math.abs(uy);
                t = Math.min(tx, ty);
            }
            t = Math.min(t, d / 2);
            return { x: a.x + ux * t, y: a.y + uy * t };
        },
        [],
    );

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const sim = simRef.current;
        if (!canvas || !sim) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const { w, h } = sizeRef.current;
        if (!w || !h) return;
        const { k, x: ox, y: oy } = viewRef.current;
        const c = colorsRef.current;
        const hover = hoverRef.current;
        const q = queryRef.current.trim().toLowerCase();

        ctx.clearRect(0, 0, w, h);

        // 邻接表（hover 高亮）
        const nb = new Set<string>();
        if (hover) {
            nb.add(hover.id);
            for (const l of sim.links) {
                if (l.a === hover) nb.add(l.b.id);
                else if (l.b === hover) nb.add(l.a.id);
            }
        }
        const matchIds = new Set<string>();
        if (q) {
            for (const n of sim.nodes) {
                if (n.label.toLowerCase().includes(q)) matchIds.add(n.id);
            }
        }
        const alphaOf = (n: SimNode) => {
            if (!visible(n)) return 0;
            if (hover) return nb.has(n.id) ? 1 : 0.1;
            if (q) return matchIds.has(n.id) ? 1 : 0.14;
            return 1;
        };

        // ── 边：两遍绘制。常态全是统一细线（Obsidian 风格）；
        // hover / 搜索时先画淡出层，再把高亮边画在最上层
        const focusing = !!hover || !!q;
        ctx.lineCap = "round";
        for (const pass of ["dim", "lit"] as const) {
            for (const l of sim.links) {
                if (!visible(l.a) || !visible(l.b)) continue;
                const related = !hover || (nb.has(l.a.id) && nb.has(l.b.id));
                const lit = hover
                    ? related
                    : q
                      ? matchIds.has(l.a.id) || matchIds.has(l.b.id)
                      : true;
                if ((pass === "lit") !== lit) continue;
                if (lit && !focusing) {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = c.edge;
                    ctx.lineWidth = 1;
                } else if (lit) {
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = c.edgeHot;
                    ctx.lineWidth = 1.6;
                } else {
                    ctx.globalAlpha = 0.06;
                    ctx.strokeStyle = c.edge;
                    ctx.lineWidth = 1;
                }
                const p1 = borderPoint(l.a, l.b);
                const p2 = borderPoint(l.b, l.a);
                ctx.beginPath();
                ctx.moveTo(p1.x * k + ox, p1.y * k + oy);
                ctx.lineTo(p2.x * k + ox, p2.y * k + oy);
                ctx.stroke();
            }
        }
        ctx.globalAlpha = 1;

        // ── 节点：只更新 DOM 的 transform / opacity / 高亮环 ──
        for (const n of sim.nodes) {
            const wrap = wrapEls.current.get(n.id);
            const body = bodyEls.current.get(n.id);
            const label = labelEls.current.get(n.id);
            if (!wrap || !body) continue;
            const a = alphaOf(n);
            if (a <= 0) {
                if (wrap.style.display !== "none") wrap.style.display = "none";
                continue;
            }
            if (wrap.style.display === "none") wrap.style.display = "block";

            const px = n.x * k + ox;
            const py = n.y * k + oy;
            const tf = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
            if (wrap.style.transform !== tf) wrap.style.transform = tf;
            const op = a.toFixed(2);
            if (wrap.style.opacity !== op) wrap.style.opacity = op;

            const bodyTf = `translate(-50%, -50%) scale(${k.toFixed(3)})`;
            if (body.style.transform !== bodyTf) body.style.transform = bodyTf;

            const hot = hover && nb.has(n.id);
            const ring = hot
                ? `0 0 0 2px ${c.ringHot}`
                : q && matchIds.has(n.id)
                  ? `0 0 0 2px ${c.ringMatch}`
                  : "";
            if (body.style.boxShadow !== ring) body.style.boxShadow = ring;
            const z = hot ? "30" : "10";
            if (wrap.style.zIndex !== z) wrap.style.zIndex = z;

            if (label) {
                const isHot = !!hot;
                const always =
                    n.degree >= 5 || (n.kind === "year" && (n.count ?? 0) >= 5);
                const show = (isHot || (!!q && matchIds.has(n.id)) || always) && a > 0.5;
                const lo = show ? "1" : "0";
                if (label.style.opacity !== lo) label.style.opacity = lo;
                if (show) {
                    const lt = `translate(-50%, ${((n.h * k) / 2 + 4).toFixed(1)}px)`;
                    if (label.style.transform !== lt)
                        label.style.transform = lt;
                    const lc = isHot || (!!q && matchIds.has(n.id)) ? c.text : c.textDim;
                    if (label.style.color !== lc) label.style.color = lc;
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, borderPoint]);

    const frame = useCallback(() => {
        const alpha = alphaRef.current;
        if (alpha > ALPHA_MIN) {
            tick();
        } else if (!dragRef.current && !panRef.current) {
            // 刚收敛：按最终布局重新适配一次（用户手动调过视图就不打扰）
            if (!settleFitRef.current && !touchedRef.current) {
                settleFitRef.current = true;
                fitView();
            }
            rafRef.current = null;
            draw();
            return;
        }
        draw();
        rafRef.current = requestAnimationFrame(frame);
    }, [draw, tick, fitView]);

    const start = useCallback(() => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(frame);
    }, [frame]);

    const stop = useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }, []);

    useEffect(() => () => stop(), [stop]);

    // 搜索词 / 隐藏类型 / 图片降级变化时重绘
    useEffect(() => {
        draw();
    }, [query, hidden, broken, draw]);

    // ── 交互 ──
    const pick = useCallback(
        (clientX: number, clientY: number): SimNode | null => {
            const canvas = canvasRef.current;
            const sim = simRef.current;
            if (!canvas || !sim) return null;
            const rect = canvas.getBoundingClientRect();
            const { k, x: ox, y: oy } = viewRef.current;
            const mx = clientX - rect.left;
            const my = clientY - rect.top;
            let best: SimNode | null = null;
            let bestD = Infinity;
            for (const n of sim.nodes) {
                if (!visible(n)) continue;
                const px = n.x * k + ox;
                const py = n.y * k + oy;
                const hw = (n.w * k) / 2 + 3;
                const hh = (n.h * k) / 2 + 3;
                if (Math.abs(px - mx) > hw || Math.abs(py - my) > hh) continue;
                const d = Math.hypot(px - mx, py - my);
                if (d < bestD) {
                    bestD = d;
                    best = n;
                }
            }
            return best;
        },
        [visible],
    );

    const toWorld = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const { k, x: ox, y: oy } = viewRef.current;
        return {
            x: (clientX - rect.left - ox) / k,
            y: (clientY - rect.top - oy) / k,
        };
    }, []);

    const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const canvas = e.target as HTMLCanvasElement;
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch {
            /* 指针不可捕获时忽略 */
        }
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointersRef.current.size === 2) {
            // 第二根手指落下：转为捏合，取消单指的拖拽 / 平移
            dragRef.current = null;
            panRef.current = null;
            hoverRef.current = null;
            setHoverLabel(null);
            const [a, b] = [...pointersRef.current.values()];
            pinchRef.current = {
                dist: Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1),
                mx: (a.x + b.x) / 2,
                my: (a.y + b.y) / 2,
            };
            touchedRef.current = true;
            return;
        }
        const hit = pick(e.clientX, e.clientY);
        if (hit) {
            dragRef.current = { node: hit, moved: false };
            alphaRef.current = Math.max(alphaRef.current, 0.35);
            start();
        } else {
            panRef.current = {
                sx: e.clientX,
                sy: e.clientY,
                ox: viewRef.current.x,
                oy: viewRef.current.y,
            };
        }
    };

    const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (pointersRef.current.has(e.pointerId)) {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }
        const pinch = pinchRef.current;
        if (pinch && pointersRef.current.size >= 2) {
            const [a, b] = [...pointersRef.current.values()];
            const dist = Math.max(Math.hypot(b.x - a.x, b.y - a.y), 1);
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const view = viewRef.current;
            const px = mx - rect.left;
            const py = my - rect.top;
            // 先跟手平移（两指中点位移），再以中点为锚点做增量缩放
            view.x += mx - pinch.mx;
            view.y += my - pinch.my;
            const next = Math.max(
                0.3,
                Math.min(2.6, view.k * (dist / pinch.dist)),
            );
            view.x = px - ((px - view.x) / view.k) * next;
            view.y = py - ((py - view.y) / view.k) * next;
            view.k = next;
            pinch.dist = dist;
            pinch.mx = mx;
            pinch.my = my;
            draw();
            return;
        }
        const drag = dragRef.current;
        if (drag) {
            const p = toWorld(e.clientX, e.clientY);
            drag.node.x = p.x;
            drag.node.y = p.y;
            drag.moved = true;
            draw();
            return;
        }
        const pan = panRef.current;
        if (pan) {
            touchedRef.current = true;
            viewRef.current.x = pan.ox + (e.clientX - pan.sx);
            viewRef.current.y = pan.oy + (e.clientY - pan.sy);
            draw();
            return;
        }
        const hit = pick(e.clientX, e.clientY);
        if (hit !== hoverRef.current) {
            hoverRef.current = hit;
            setHoverLabel(hit ? `${KIND_LABEL[hit.kind]} · ${hit.label}` : null);
            draw();
        }
    };

    const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) pinchRef.current = null;
        const drag = dragRef.current;
        const pan = panRef.current;
        if (drag) {
            // 位移很小当成点击；两指缩放过（drag 已被清掉）不会误触发跳转
            if (!drag.moved) {
                const n = drag.node;
                if (n.kind === "member") router.push(`/members/${n.id.slice(2)}`);
                else if (n.kind === "project" && n.slug) router.push(`/works/${n.slug}`);
            }
            dragRef.current = null;
        }
        panRef.current = null;
        try {
            (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
        } catch {
            /* 指针已释放 */
        }
    };

    const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        touchedRef.current = true;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const view = viewRef.current;
        const prev = view.k;
        const next = Math.max(0.3, Math.min(2.6, prev * (e.deltaY < 0 ? 1.12 : 0.89)));
        // 以光标为锚点缩放
        view.x = mx - ((mx - view.x) / prev) * next;
        view.y = my - ((my - view.y) / prev) * next;
        view.k = next;
        draw();
    };

    const onLeave = () => {
        if (hoverRef.current) {
            hoverRef.current = null;
            setHoverLabel(null);
            draw();
        }
    };

    const markBroken = useCallback((id: string) => {
        setBroken((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            return next;
        });
    }, []);

    const bindRef =
        (map: React.MutableRefObject<Map<string, HTMLDivElement>>, id: string) =>
        (el: HTMLDivElement | null) => {
            if (el) map.current.set(id, el);
            else map.current.delete(id);
        };

    // ── 渲染 ──
    if (error) {
        return (
            <div className="rounded-xl border border-brand-border-subtle bg-card p-8 text-center">
                <p className="text-sm mb-3 text-brand-text-muted">
                    关系图谱加载失败：{error}
                </p>
                <button
                    type="button"
                    onClick={() => setNonce((n) => n + 1)}
                    className="text-sm px-4 py-2 rounded-lg border border-brand-border-subtle text-brand-blue hover:bg-brand-surface transition-colors"
                >
                    重试
                </button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="rounded-xl border border-brand-border-subtle bg-card p-8 text-center text-sm text-brand-text-muted">
                正在计算关系图谱…
            </div>
        );
    }

    const nodes = data.nodes.map((n) => ({ ...n, ...nodeBox(n) }));
    const { stats } = data;

    return (
        <div>
            <div
                ref={wrapRef}
                className="relative w-full h-[62vh] min-h-[440px] max-h-[720px] cursor-grab active:cursor-grabbing overflow-hidden"
            >
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 block h-full w-full touch-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onLeave}
                    onWheel={onWheel}
                />

                {/* 节点层：不接收指针事件，命中判定全在 canvas 上 */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    {nodes.map((n) => {
                        const w = n.w;
                        const h = n.h;
                        const common = {
                            width: w,
                            height: h,
                            willChange: "transform" as const,
                            // 高亮环（box-shadow）画在这个外包 div 上，
                            // 圆角和内部视觉元素一致，环才贴着头像/封面/四宫格的真实边缘
                            borderRadius:
                                n.kind === "member" ? "50%" : n.kind === "project" ? 5 : 4,
                        };
                        return (
                            <div
                                key={n.id}
                                ref={bindRef(wrapEls, n.id)}
                                className="absolute left-0 top-0"
                                style={{ opacity: 0, willChange: "transform" }}
                            >
                                <div
                                    ref={bindRef(bodyEls, n.id)}
                                    className="absolute"
                                    style={common}
                                >
                                    {n.kind === "member" ? (
                                        n.avatar && !broken.has(n.id) ? (
                                            <Image
                                                src={n.avatar}
                                                alt={n.label}
                                                fill
                                                sizes="128px"
                                                referrerPolicy="no-referrer"
                                                className={`rounded-full object-cover ring-1 ring-black/10 dark:ring-white/20 ${
                                                    n.graduated
                                                        ? "saturate-[0.45]"
                                                        : ""
                                                }`}
                                                onError={() => markBroken(n.id)}
                                            />
                                        ) : (
                                            <div
                                                className="flex h-full w-full items-center justify-center rounded-full ring-1 ring-black/10 dark:ring-white/20 text-brand-text-secondary select-none"
                                                style={{
                                                    fontSize: Math.round(w * 0.42),
                                                    background:
                                                        "var(--color-brand-surface-page, rgba(125,140,160,0.14))",
                                                }}
                                            >
                                                {n.label.trim().charAt(0).toUpperCase()}
                                            </div>
                                        )
                                    ) : n.kind === "project" ? (
                                        n.cover && !broken.has(n.id) ? (
                                            <Image
                                                src={n.cover}
                                                alt={n.label}
                                                fill
                                                sizes="256px"
                                                referrerPolicy="no-referrer"
                                                className="rounded-[5px] object-cover ring-1 ring-black/10 dark:ring-white/20"
                                                onError={() => markBroken(n.id)}
                                            />
                                        ) : (
                                            <div
                                                className="flex h-full w-full items-center justify-center rounded-[5px] ring-1 ring-black/10 dark:ring-white/20 px-1 text-center text-brand-text-secondary leading-tight"
                                                style={{
                                                    fontSize: Math.round(w * 0.16),
                                                    background:
                                                        "var(--color-brand-surface-page, rgba(125,140,160,0.14))",
                                                }}
                                            >
                                                {n.label.slice(0, 6)}
                                            </div>
                                        )
                                    ) : (
                                        <div className="grid h-full w-full grid-cols-2 grid-rows-2 overflow-hidden rounded-[4px] ring-1 ring-black/15 dark:ring-white/25">
                                            {yearDigits(n).map((d, i) => (
                                                <span
                                                    key={i}
                                                    className={`flex items-center justify-center leading-none ${YEAR_QUAD[i].cell} ${YEAR_QUAD[i].text}`}
                                                    style={{
                                                        fontSize: Math.round(w * 0.36),
                                                        fontWeight: 900,
                                                        fontFamily:
                                                            '"SimHei", "Heiti SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                                                        borderRight:
                                                            i % 2 === 0
                                                                ? "1px solid rgba(255,255,255,0.35)"
                                                                : undefined,
                                                        borderBottom:
                                                            i < 2
                                                                ? "1px solid rgba(255,255,255,0.35)"
                                                                : undefined,
                                                    }}
                                                >
                                                    {d}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div
                                    ref={bindRef(labelEls, n.id)}
                                    className="absolute left-0 top-0 whitespace-nowrap text-[11px] leading-tight"
                                    style={{ opacity: 0, willChange: "transform, opacity" }}
                                >
                                    {n.label}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {hoverLabel && (
                    <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                        {hoverLabel}
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => {
                        touchedRef.current = false;
                        fitView();
                        draw();
                    }}
                    className="absolute right-3 bottom-3 text-xs px-2 py-1 rounded-md border border-brand-border-subtle bg-card/90 text-brand-text-muted hover:text-brand-text transition-colors"
                >
                    重置视图
                </button>
            </div>

            {/* 图例 + 统计 */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                {(["member", "project", "year"] as Kind[]).map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        onClick={() => setHidden((h) => ({ ...h, [kind]: !h[kind] }))}
                        className={`flex items-center gap-1.5 transition-opacity ${
                            hidden[kind] ? "opacity-35" : "opacity-100"
                        }`}
                        aria-pressed={!hidden[kind]}
                    >
                        <span
                            className={
                                kind === "member"
                                    ? "inline-block w-3 h-3 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/25 bg-brand-surface-page"
                                    : kind === "project"
                                      ? "inline-block w-4 h-[11px] rounded-[2px] ring-1 ring-inset ring-black/15 dark:ring-white/25 bg-brand-surface-page"
                                      : "inline-grid grid-cols-2 grid-rows-2 w-3 h-3 overflow-hidden rounded-[2px] ring-1 ring-inset ring-black/15 dark:ring-white/25"
                            }
                        >
                            {kind === "year" &&
                                YEAR_QUAD.map((q, i) => (
                                    <span key={i} className={q.cell} />
                                ))}
                        </span>
                        <span className="text-brand-text-secondary">
                            {KIND_LABEL[kind]}
                        </span>
                    </button>
                ))}
                <span className="ml-auto text-brand-text-muted">
                    {stats.memberCount} 位成员 · {stats.projectCount} 部作品 ·{" "}
                    {stats.yearCount} 个入社年份 · {stats.developCount} 条开发关系
                    {stats.activeDevCount < stats.memberCount &&
                        `（${stats.activeDevCount} 位成员登记了作品）`}
                </span>
            </div>
            <p className="mt-1 text-[11px] text-brand-text-muted">
                拖动节点可调整位置，拖拽空白处平移，滚轮缩放；点击成员或作品节点进入详情页。
            </p>
        </div>
    );
}
