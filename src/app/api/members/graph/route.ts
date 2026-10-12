/**
 * 成员关系图谱 API
 * GET /api/members/graph - 成员 / 作品 / 入社年份三类节点与它们之间的边
 *
 * 边的来源：
 *   - develop：作品里登记的社团内开发者（ProjectMember.memberId 非空）
 *   - join：成员的入社年份
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { cachedQuery } from "@/lib/db/cache";
import { apiResponse, apiError } from "@/lib/utils";
import { isMockDataEnabled, getMockSnapshot } from "@/lib/mock/frontend-data";

export const dynamic = "force-dynamic";

export type GraphNodeKind = "member" | "project" | "year";

export interface GraphNode {
    id: string;
    kind: GraphNodeKind;
    label: string;
    /** 关联的边数，决定节点半径 */
    degree: number;
    /** 成员：是否已毕业 */
    graduated?: boolean;
    /** 成员：社团职务 */
    position?: string;
    /** 作品：详情页 slug */
    slug?: string;
    /** 年份：该年入社人数 */
    count?: number;
}

export interface GraphLink {
    source: string;
    target: string;
    kind: "develop" | "join";
    /** 参与该作品时的职能，如 ["程序","美术"] */
    roles?: string[];
}

interface GraphPayload {
    nodes: GraphNode[];
    links: GraphLink[];
    stats: {
        memberCount: number;
        projectCount: number;
        yearCount: number;
        developCount: number;
        /** 至少参与过一部作品的成员数 */
        activeDevCount: number;
    };
}

/** 成员原始数据的最小形状（DB 查询与 mock fixture 共用） */
interface RawMember {
    id: string;
    displayName: string;
    joinYear: number | null;
    graduated: boolean;
    position: string;
}
interface RawProject {
    id: string;
    title: string;
    slug: string;
    members: { memberId: string | null; roles: string[] }[];
}

/** 由「成员 + 作品」原始数据拼三类节点和两类边 */
function assemble(members: RawMember[], projects: RawProject[]): GraphPayload {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const degree = new Map<string, number>();
    const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

    // ── 成员节点 ──
    for (const m of members) {
        nodes.push({
            id: `m:${m.id}`,
            kind: "member",
            label: m.displayName,
            degree: 0,
            graduated: m.graduated,
            position: m.position,
        });
    }

    // ── 入社年份节点（先建，成员连过来时累加人数）──
    const yearCount = new Map<string, number>();
    const yearNodeId = (year: number) => `y:${year}`;
    for (const m of members) {
        const yid = yearNodeId(m.joinYear ?? 0);
        yearCount.set(yid, (yearCount.get(yid) ?? 0) + 1);
    }
    const yearIds = [...yearCount.keys()].sort((a, b) => {
        const na = parseInt(a.slice(2)) || 0;
        const nb = parseInt(b.slice(2)) || 0;
        return na - nb;
    });
    for (const yid of yearIds) {
        const y = parseInt(yid.slice(2));
        nodes.push({
            id: yid,
            kind: "year",
            label: y === 0 ? "入社年份未登记" : `${y} 年入社`,
            degree: 0,
            count: yearCount.get(yid) ?? 0,
        });
    }

    // ── 成员 → 入社年份 ──
    for (const m of members) {
        const sid = `m:${m.id}`;
        const tid = yearNodeId(m.joinYear ?? 0);
        links.push({ source: sid, target: tid, kind: "join" });
        bump(sid);
        bump(tid);
    }

    // ── 作品节点 + 成员 → 作品 ──
    const involved = new Set<string>();
    let developCount = 0;
    for (const p of projects) {
        const devs = p.members.filter((pm) => pm.memberId);
        if (devs.length === 0) continue; // 没登记社内开发者的作品不进图
        const pid = `p:${p.id}`;
        nodes.push({
            id: pid,
            kind: "project",
            label: p.title,
            degree: 0,
            slug: p.slug,
        });
        for (const d of devs) {
            links.push({
                source: `m:${d.memberId}`,
                target: pid,
                kind: "develop",
                roles: d.roles ?? [],
            });
            bump(`m:${d.memberId}`);
            bump(pid);
            involved.add(d.memberId!);
            developCount++;
        }
    }

    for (const n of nodes) n.degree = degree.get(n.id) ?? 0;

    return {
        nodes,
        links,
        stats: {
            memberCount: members.length,
            projectCount: nodes.filter((n) => n.kind === "project").length,
            yearCount: yearIds.length,
            developCount,
            activeDevCount: involved.size,
        },
    };
}

async function buildFromDb(): Promise<GraphPayload> {
    const [members, projects] = await Promise.all([
        prisma.clubMember.findMany({
            orderBy: { sortOrder: "asc" },
            select: {
                id: true,
                displayName: true,
                joinYear: true,
                graduated: true,
                position: true,
            },
        }),
        prisma.project.findMany({
            where: { status: "PUBLISHED" },
            select: {
                id: true,
                title: true,
                slug: true,
                members: { select: { memberId: true, roles: true } },
            },
        }),
    ]);
    return assemble(members, projects);
}

/**
 * 数据库不可达时退回 fixtures/frontend-mock.json。
 * 成员列表本身也有同样的降级，两边都用同一份数据才不会「列表 35 人、图谱报 500」。
 */
async function buildFromMock(): Promise<GraphPayload> {
    const snap = getMockSnapshot();
    const members: RawMember[] = (snap.members ?? []).map((m: any) => ({
        id: m.id,
        displayName: m.displayName,
        joinYear: m.joinYear ?? null,
        graduated: !!m.graduated,
        position: m.position ?? "MEMBER",
    }));
    const projects: RawProject[] = (snap.projects ?? []).map((p: any) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        members: (p.members ?? []).map((pm: any) => ({
            memberId: pm.memberId ?? null,
            roles: pm.roles ?? [],
        })),
    }));
    return assemble(members, projects);
}

export async function GET(_request: NextRequest) {
    try {
        if (isMockDataEnabled()) return apiResponse(await buildFromMock());
        try {
            return apiResponse(await cachedQuery("members:graph", buildFromDb, 600));
        } catch (dbErr) {
            console.warn("[api/members/graph] 数据库不可达，降级到 mock：", dbErr);
            try {
                return apiResponse(await buildFromMock());
            } catch {
                throw dbErr; // fixture 也没有，只能报错
            }
        }
    } catch (err) {
        console.error("[api/members/graph]", err);
        return apiError("关系图谱数据加载失败", 500);
    }
}
