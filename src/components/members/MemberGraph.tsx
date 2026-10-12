"use client";

/**
 * 成员关系图谱（仿 Obsidian graph view）
 *
 * 三类节点：成员 / 作品 / 入社年份
 *   - 成员 — 作品：作品里登记的社团内开发者
 *   - 成员 — 入社年份：该成员的入社年份
 *
 * 物理是自己写的简化力导向（斥力 + 弹簧 + 向心力 + 碰撞），
 * 规模只有几十个节点，O(n²) 直接算比引一个 d3-force 更省事。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "member" | "project" | "year";

interface RawNode {
    id: string;
    kind: Kind;
    label: string;
    degree: number;
    graduated?: boolean;
    position?: string;
    slug?: string;
    count?: number;
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
    r: number;
    idx: number;
}
interface SimLink {
    a: SimNode;
    b: SimNode;
    kind: "develop" | "join";
    roles: string[];
}

// ── 物理参数 ──
const REPULSE = 1100; // 库仑斥力系数（除以距离平方）
const REPULSE_MIN = 6; // 距离下限，防止两点重合时力爆炸
const SPRING_DEV = 0.028;
const SPRING_JOIN = 0.045;
const LEN_DEV = 82;
const LEN_JOIN = 56;
const CENTER = 0.016; // 向画布中心的弱引力，防止整图飘走
const DAMP = 0.84; // 速度衰减
const ALPHA_DECAY = 0.988;
const ALPHA_MIN = 0.02;
const COLLIDE_PAD = 2;

const KIND_LABEL: Record<Kind, string> = {
    member: "成员",
    project: "作品",
    year: "入社年份",
};

function nodeRadius(n: RawNode): number {
    if (n.kind === "year") return 6 + Math.sqrt(n.count ?? 1) * 3.2;
    return 4 + Math.sqrt(n.degree) * 2.7;
}

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
        edge: dark ? "rgba(170,195,225,0.22)" : "rgba(90,110,135,0.22)",
        edgeHot: dark ? "rgba(190,215,240,0.85)" : "rgba(60,85,115,0.7)",
        text: dark ? "#c8d4e4" : "#41505f",
        textDim: dark ? "rgba(200,212,228,0.35)" : "rgba(65,80,95,0.4)",
        halo: dark ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.08)",
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
    const sizeRef = useRef({ w: 0, h: 0 });
    const aspectRef = useRef(1); // 画布宽高比，用于让布局跟着画布形状摊开
    const fittedRef = useRef(false); // 视图是否已完成首次自适应
    const settleFitRef = useRef(false); // 收敛后是否已重新自适应过
    const touchedRef = useRef(false); // 用户是否手动缩放/平移过
    const colorsRef = useRef(readColors());
    const queryRef = useRef(query);
    const hiddenRef = useRef(hidden);
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
            alphaRef.current = Math.max(alphaRef.current, 0.05);
            draw();
        });
        mo.observe(el, { attributes: true, attributeFilter: ["class"] });
        return () => mo.disconnect();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ── 初始化模拟 ──
    useEffect(() => {
        if (!data) return;
        const nodes: SimNode[] = data.nodes.map((n, i) => ({
            ...n,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            r: nodeRadius(n),
            idx: i,
        }));
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const links: SimLink[] = [];
        for (const l of data.links) {
            const a = byId.get(l.source);
            const b = byId.get(l.target);
            if (!a || !b) continue;
            links.push({ a, b, kind: l.kind, roles: l.roles ?? [] });
        }

        // 初始布局：年份节点落在内环，成员挨着自己的年份节点，作品在外环
        const years = nodes.filter((n) => n.kind === "year");
        years.forEach((y, i) => {
            const ang = (i / Math.max(years.length, 1)) * Math.PI * 2;
            y.x = Math.cos(ang) * 70;
            y.y = Math.sin(ang) * 70;
        });
        const yearOfMember = new Map<string, SimNode>();
        for (const l of links) {
            if (l.kind !== "join") continue;
            yearOfMember.set(l.a.id, l.b);
        }
        let seed = 20261012;
        const rnd = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        for (const n of nodes) {
            if (n.kind === "year") continue;
            if (n.kind === "member") {
                const y = yearOfMember.get(n.id);
                const ang = rnd() * Math.PI * 2;
                const rad = 70 + rnd() * 60;
                n.x = (y?.x ?? 0) + Math.cos(ang) * rad;
                n.y = (y?.y ?? 0) + Math.sin(ang) * rad;
            } else {
                const ang = rnd() * Math.PI * 2;
                const rad = 250 + rnd() * 140;
                n.x = Math.cos(ang) * rad;
                n.y = Math.sin(ang) * rad;
            }
        }

        simRef.current = { nodes, links };
        alphaRef.current = 1;
        fittedRef.current = false;
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
            aspectRef.current = Math.max(0.5, Math.min(w / h, 4));
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;
            const ctx = canvas.getContext("2d");
            ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
            // 第一次拿到真实尺寸时做视图自适应；此时坐标还是围绕原点的初始值，
            // 不 fit 的话整张图会被画在画布左上角
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
            minX = Math.min(minX, n.x - n.r);
            minY = Math.min(minY, n.y - n.r);
            maxX = Math.max(maxX, n.x + n.r);
            maxY = Math.max(maxY, n.y + n.r);
        }
        const bw = Math.max(maxX - minX, 1);
        const bh = Math.max(maxY - minY, 1);
        const k = Math.min((w - 56) / bw, (h - 56) / bh);
        const view = viewRef.current;
        view.k = Math.max(0.3, Math.min(k, 2.2));
        view.x = w / 2 - ((minX + maxX) / 2) * view.k;
        view.y = h / 2 - ((minY + maxY) / 2) * view.k;
    }, [visible]);

    const tick = useCallback(() => {
        const sim = simRef.current;
        if (!sim) return;
        const { nodes, links } = sim;
        const alpha = alphaRef.current;
        const live = nodes.filter(visible);

        // 斥力（O(n²)，节点规模小，直接算）
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
                const d = Math.max(Math.sqrt(d2), REPULSE_MIN);
                const f = (REPULSE * alpha) / (d * d);
                const fx = (dx / d) * f;
                const fy = (dy / d) * f;
                a.vx -= fx;
                a.vy -= fy;
                b.vx += fx;
                b.vy += fy;
            }
        }

        // 弹簧
        for (const l of links) {
            if (!visible(l.a) || !visible(l.b)) continue;
            const dx = l.b.x - l.a.x;
            const dy = l.b.y - l.a.y;
            const d = Math.max(Math.hypot(dx, dy), 0.5);
            const rest = l.kind === "develop" ? LEN_DEV : LEN_JOIN;
            const k = l.kind === "develop" ? SPRING_DEV : SPRING_JOIN;
            const f = ((d - rest) / d) * k * alpha;
            // 度数大的一端少动一点，图更稳
            const wa = 1 / (1 + Math.min(l.a.degree, 8) * 0.12);
            const wb = 1 / (1 + Math.min(l.b.degree, 8) * 0.12);
            l.a.vx += dx * f * wa;
            l.a.vy += dy * f * wa;
            l.b.vx -= dx * f * wb;
            l.b.vy -= dy * f * wb;
        }

        // 向心 + 积分
        // 容器通常是宽扁的，纯 radial 向心力会把图挤成一个圆、横向留大片空白。
        // 这里按画布宽高比做成各向异性：横向拉得松、纵向拉得紧，图自然摊开成横扁形
        const asp = Math.sqrt(aspectRef.current);
        const cx = (CENTER / asp) * alpha * 4;
        const cy = CENTER * asp * alpha * 4;
        for (const n of live) {
            n.vx -= n.x * cx;
            n.vy -= n.y * cy;
            if (dragRef.current?.node === n) {
                n.vx = 0;
                n.vy = 0;
                continue;
            }
            n.vx *= DAMP;
            n.vy *= DAMP;
            n.x += n.vx;
            n.y += n.vy;
        }

        // 碰撞分离（直接改位置，避免抖动）
        for (let i = 0; i < live.length; i++) {
            const a = live[i];
            for (let j = i + 1; j < live.length; j++) {
                const b = live[j];
                const min = a.r + b.r + COLLIDE_PAD;
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                const d2 = dx * dx + dy * dy;
                if (d2 >= min * min || d2 < 0.0001) continue;
                const d = Math.sqrt(d2);
                const push = (min - d) / 2;
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

        alphaRef.current = alpha * ALPHA_DECAY;
    }, [visible]);

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

        const sx = (n: SimNode) => n.x * k + ox;
        const sy = (n: SimNode) => n.y * k + oy;

        // 邻接表（用于 hover 高亮）
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
        // 节点半径温和地跟随缩放：适配宽画布时布局会放大，
        // 若半径同步线性放大，度数高的节点会糊成一团
        const radScale = Math.pow(k, 0.6);

        const alphaOf = (n: SimNode) => {
            if (!visible(n)) return 0;
            if (hover) return nb.has(n.id) ? 1 : 0.14;
            if (q) return matchIds.has(n.id) ? 1 : 0.16;
            return 1;
        };

        // ── 边 ──
        ctx.lineWidth = 1;
        for (const l of sim.links) {
            if (!visible(l.a) || !visible(l.b)) continue;
            const related = !hover || (nb.has(l.a.id) && nb.has(l.b.id));
            const lit = hover
                ? related
                : q
                  ? matchIds.has(l.a.id) || matchIds.has(l.b.id)
                  : true;
            ctx.globalAlpha = lit ? 1 : 0.1;
            ctx.strokeStyle = lit ? c.edgeHot : c.edge;
            ctx.lineWidth = lit ? 1.5 : 1;
            ctx.beginPath();
            ctx.moveTo(sx(l.a), sy(l.a));
            ctx.lineTo(sx(l.b), sy(l.b));
            ctx.stroke();
        }

        // ── 节点 ──
        for (const n of sim.nodes) {
            const a = alphaOf(n);
            if (a <= 0) continue;
            ctx.globalAlpha = a;
            const px = sx(n);
            const py = sy(n);
            const rad = Math.max(n.r * radScale, 1.5);
            const color =
                n.kind === "member" ? c.member : n.kind === "project" ? c.project : c.year;

            if (n.kind === "year") {
                // 年份是聚合节点：空心环 + 中心点
                ctx.beginPath();
                ctx.arc(px, py, rad, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.globalAlpha = a * 0.18;
                ctx.fill();
                ctx.globalAlpha = a;
                ctx.lineWidth = 1.4;
                ctx.strokeStyle = color;
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(px, py, Math.max(rad * 0.3, 1), 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(px, py, rad, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                if (n.kind === "member" && n.graduated) {
                    // 已毕业：外圈留白，视觉上和在校成员区分
                    ctx.lineWidth = 1.2;
                    ctx.strokeStyle = c.halo;
                    ctx.stroke();
                }
            }

            // 搜索命中：加一圈高亮环
            if (q && matchIds.has(n.id)) {
                ctx.globalAlpha = a;
                ctx.beginPath();
                ctx.arc(px, py, rad + 3, 0, Math.PI * 2);
                ctx.lineWidth = 1.6;
                ctx.strokeStyle = c.edgeHot;
                ctx.stroke();
            }
        }

        // ── 标签：hover 及其邻居、搜索命中、以及度数较高的常驻节点 ──
        ctx.font =
            '11px system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (const n of sim.nodes) {
            const a = alphaOf(n);
            if (a <= 0) continue;
            const isHot = hover && nb.has(n.id);
            const always = n.degree >= 5 || (n.kind === "year" && (n.count ?? 0) >= 5);
            if (!isHot && !(q && matchIds.has(n.id)) && !always) continue;
            if (a < 0.5) continue;
            ctx.globalAlpha = 1;
            const px = sx(n);
            const py = sy(n) + Math.max(n.r * k, 1.5) + 3;
            ctx.fillStyle = isHot || (q && matchIds.has(n.id)) ? c.text : c.textDim;
            ctx.fillText(n.label, px, py);
        }
        ctx.globalAlpha = 1;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

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
    }, [draw, tick]);

    const start = useCallback(() => {
        if (rafRef.current != null) return;
        rafRef.current = requestAnimationFrame(frame);
    }, [frame]);

    const stop = useCallback(() => {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
    }, []);

    useEffect(() => () => stop(), [stop]);

    // 搜索词变化时重绘（用于高亮）
    useEffect(() => {
        draw();
    }, [query, draw]);

    // 隐藏类型变化时重绘
    useEffect(() => {
        draw();
    }, [hidden, draw]);

    // ── 交互 ──
    const pick = useCallback((clientX: number, clientY: number): SimNode | null => {
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
            const d = Math.hypot(px - mx, py - my);
            const hit = Math.max(n.r * k, 4) + 6;
            if (d < hit && d < bestD) {
                bestD = d;
                best = n;
            }
        }
        return best;
    }, [visible]);

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
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
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
        const drag = dragRef.current;
        const pan = panRef.current;
        if (drag) {
            // 位移很小当成点击
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

    const { stats } = data;

    return (
        <div className="rounded-xl border border-brand-border-subtle bg-card overflow-hidden">
            <div
                ref={wrapRef}
                className="relative w-full h-[58vh] min-h-[420px] max-h-[680px] cursor-grab active:cursor-grabbing"
            >
                <canvas
                    ref={canvasRef}
                    className="block w-full h-full touch-none"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onLeave}
                    onWheel={onWheel}
                />
                {hoverLabel && (
                    <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/70 px-2 py-1 text-xs text-white">
                        {hoverLabel}
                    </div>
                )}
                <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            touchedRef.current = false;
                            fitView();
                            draw();
                        }}
                        className="text-xs px-2 py-1 rounded-md border border-brand-border-subtle bg-card/90 text-brand-text-muted hover:text-brand-text transition-colors"
                    >
                        重置视图
                    </button>
                </div>
            </div>

            {/* 图例 + 统计 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 border-t border-brand-border-subtle text-xs">
                {(["member", "project", "year"] as Kind[]).map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        onClick={() =>
                            setHidden((h) => ({ ...h, [kind]: !h[kind] }))
                        }
                        className={`flex items-center gap-1.5 transition-opacity ${
                            hidden[kind] ? "opacity-35" : "opacity-100"
                        }`}
                        aria-pressed={!hidden[kind]}
                    >
                        <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{
                                background:
                                    kind === "member"
                                        ? "var(--color-brand-blue)"
                                        : kind === "project"
                                          ? "var(--color-brand-orange)"
                                          : "#78849a",
                            }}
                        />
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
            <p className="px-4 pb-3 text-[11px] text-brand-text-muted">
                拖动节点可调整位置，拖拽空白处平移，滚轮缩放；点击成员或作品节点进入详情页。
            </p>
        </div>
    );
}
