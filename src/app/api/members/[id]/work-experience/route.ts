/**
 * 工作经历 CRUD
 * GET    /api/members/[id]/work-experience — 获取工作经历列表
 * POST   /api/members/[id]/work-experience — 新增工作经历
 * PATCH  /api/members/[id]/work-experience — 更新工作经历 (body 含 experienceId)
 * DELETE /api/members/[id]/work-experience — 删除工作经历 (body 含 experienceId)
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// GET: 获取工作经历
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const experiences = await prisma.workExperience.findMany({
    where: { memberId: id },
    orderBy: { sortOrder: "asc" },
  });

  return Response.json(experiences);
}

// POST: 新增工作经历
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  // 权限：本人或管理员
  const isOwner = session?.user?.id
    ? !!(await prisma.clubMember.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      }))
    : false;
  const isAdminUser = session?.user?.role === "ADMIN";
  if (!isOwner && !isAdminUser) {
    return Response.json({ error: "权限不足" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "请求体格式错误" }, { status: 400 });

  const { company, position, startDate, endDate, type } = body;
  if (!company || !position || !startDate) {
    return Response.json({ error: "名称、详情、起始时间为必填项" }, { status: 400 });
  }

  const maxSort = await prisma.workExperience.findFirst({
    where: { memberId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const exp = await prisma.workExperience.create({
    data: {
      memberId: id,
      type: type || "工作",
      company,
      position,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      sortOrder: (maxSort?.sortOrder ?? -1) + 1,
    },
  });

  return Response.json(exp, { status: 201 });
}

// PATCH: 更新工作经历
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  const isOwner = session?.user?.id
    ? !!(await prisma.clubMember.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      }))
    : false;
  const isAdminUser = session?.user?.role === "ADMIN";
  if (!isOwner && !isAdminUser) {
    return Response.json({ error: "权限不足" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: "请求体格式错误" }, { status: 400 });

  const { experienceId, company, position, startDate, endDate, type } = body;
  if (!experienceId) return Response.json({ error: "缺少 experienceId" }, { status: 400 });

  const existing = await prisma.workExperience.findUnique({ where: { id: experienceId } });
  if (!existing || existing.memberId !== id) {
    return Response.json({ error: "工作经历不存在" }, { status: 404 });
  }

  const updated = await prisma.workExperience.update({
    where: { id: experienceId },
    data: {
      ...(type !== undefined && { type }),
      ...(company !== undefined && { company }),
      ...(position !== undefined && { position }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
    },
  });

  return Response.json(updated);
}

// DELETE: 删除工作经历
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await auth();

  const isOwner = session?.user?.id
    ? !!(await prisma.clubMember.findFirst({
        where: { id, userId: session.user.id },
        select: { id: true },
      }))
    : false;
  const isAdminUser = session?.user?.role === "ADMIN";
  if (!isOwner && !isAdminUser) {
    return Response.json({ error: "权限不足" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.experienceId) {
    return Response.json({ error: "缺少 experienceId" }, { status: 400 });
  }

  const existing = await prisma.workExperience.findUnique({ where: { id: body.experienceId } });
  if (!existing || existing.memberId !== id) {
    return Response.json({ error: "工作经历不存在" }, { status: 404 });
  }

  await prisma.workExperience.delete({ where: { id: body.experienceId } });

  return Response.json({ deleted: true });
}
