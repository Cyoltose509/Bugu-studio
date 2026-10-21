import { prisma } from "@/lib/db/prisma";
import { REVIEW_TYPES } from "@/lib/notifications/buckets";

export type ReviewOutcomeResult = "approved" | "rejected" | "dismissed";

export interface ReviewHandler {
  name: string | null;
  image: string | null;
}

export interface ReviewOutcome {
  result: ReviewOutcomeResult;
  emoji: string;
  handler?: ReviewHandler;
}

const OUTCOME_TYPES = new Set<string>([...REVIEW_TYPES, "JAM_APPLICATION"]);

const EMOJI: Record<ReviewOutcomeResult, string> = {
  approved: "✅",
  rejected: "❌",
  dismissed: "🚫",
};

type NotifRow = {
  id: string;
  type: string;
  content: string;
  relatedId: string | null;
  createdAt: Date | string;
};

type UserLite = {
  name: string | null;
  image: string | null;
  member?: { displayName: string | null; avatar: string | null } | null;
};

function handlerFromUser(user?: UserLite | null): ReviewHandler | undefined {
  if (!user) return undefined;
  return {
    name: user.member?.displayName || user.name,
    image: user.image || user.member?.avatar || null,
  };
}

function outcome(result: ReviewOutcomeResult, handler?: ReviewHandler): ReviewOutcome {
  return { result, emoji: EMOJI[result], handler };
}

function extractQuotedTitle(content: string) {
  const match = content.match(/「([^」]+)」/);
  return match?.[1]?.trim() || "";
}

function pickLatestByTarget(logs: Array<{ targetId: string | null; user: UserLite | null }>) {
  const map = new Map<string, ReviewHandler>();
  for (const log of logs) {
    if (!log.targetId || map.has(log.targetId)) continue;
    const handler = handlerFromUser(log.user);
    if (handler) map.set(log.targetId, handler);
  }
  return map;
}

export async function attachReviewOutcomes(items: NotifRow[]): Promise<Map<string, ReviewOutcome>> {
  const result = new Map<string, ReviewOutcome>();
  const reviewItems = items.filter((item) => OUTCOME_TYPES.has(item.type) && item.relatedId);
  if (reviewItems.length === 0) return result;

  const projectIds = [
    ...new Set(
      reviewItems
        .filter((item) => item.type === "NEW_PROJECT" || item.type === "PROJECT_UPDATE")
        .map((item) => item.relatedId!)
    ),
  ];
  const userIds = [
    ...new Set(reviewItems.filter((item) => item.type === "NEW_USER").map((item) => item.relatedId!)),
  ];
  const activityIds = [
    ...new Set(
      reviewItems.filter((item) => item.type === "ACTIVITY_PROPOSAL").map((item) => item.relatedId!)
    ),
  ];
  const jamTeamIds = [
    ...new Set(
      reviewItems
        .filter((item) => item.type === "JAM_APPLICATION")
        .map((item) => item.relatedId!.split(":")[1])
        .filter(Boolean)
    ),
  ];

  const userSelect = {
    name: true,
    image: true,
    member: { select: { displayName: true, avatar: true } },
  } as const;

  const [projects, users, proposals, jamApps, userLogs] = await Promise.all([
    projectIds.length
      ? prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            status: true,
            reviews: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                approved: true,
                reviewer: { select: userSelect },
              },
            },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, role: true, confirmedNotMember: true },
        })
      : Promise.resolve([]),
    activityIds.length
      ? prisma.meetingProposal.findMany({
          where: { activityId: { in: activityIds } },
          select: { id: true, activityId: true, title: true, status: true },
        })
      : Promise.resolve([]),
    jamTeamIds.length
      ? prisma.jamTeamApplication.findMany({
          where: { teamId: { in: jamTeamIds } },
          select: {
            id: true,
            teamId: true,
            status: true,
            createdAt: true,
            team: { select: { leader: { select: userSelect } } },
          },
        })
      : Promise.resolve([]),
    userIds.length
      ? prisma.auditLog.findMany({
          where: {
            targetType: "User",
            targetId: { in: userIds },
            action: { in: ["USER_ROLE_CHANGE", "ADMIN_ACTION"] },
          },
          orderBy: { createdAt: "desc" },
          select: { targetId: true, user: { select: userSelect } },
        })
      : Promise.resolve([]),
  ]);

  const proposalIds = proposals.map((p) => p.id);
  const proposalAudits = proposalIds.length
    ? await prisma.auditLog.findMany({
        where: { targetType: "MeetingProposal", targetId: { in: proposalIds } },
        orderBy: { createdAt: "desc" },
        select: { targetId: true, user: { select: userSelect } },
      })
    : [];

  const projectMap = new Map(projects.map((p) => [p.id, p]));
  const userMap = new Map(users.map((u) => [u.id, u]));
  const userHandlerMap = pickLatestByTarget(userLogs);
  const proposalHandlerMap = pickLatestByTarget(proposalAudits);

  for (const item of reviewItems) {
    const relatedId = item.relatedId!;

    if (item.type === "NEW_PROJECT" || item.type === "PROJECT_UPDATE") {
      const project = projectMap.get(relatedId);
      if (!project || project.status === "PENDING" || project.status === "DRAFT") continue;
      if (project.status === "PUBLISHED") {
        result.set(item.id, outcome("approved", handlerFromUser(project.reviews[0]?.reviewer)));
      } else if (project.status === "REJECTED") {
        result.set(item.id, outcome("rejected", handlerFromUser(project.reviews[0]?.reviewer)));
      }
      continue;
    }

    if (item.type === "NEW_USER") {
      const user = userMap.get(relatedId);
      if (!user) continue;
      if (user.role === "MEMBER" || user.role === "ADMIN") {
        result.set(item.id, outcome("approved", userHandlerMap.get(relatedId)));
      } else if (user.confirmedNotMember) {
        result.set(item.id, outcome("dismissed", userHandlerMap.get(relatedId)));
      }
      continue;
    }

    if (item.type === "ACTIVITY_PROPOSAL") {
      const title = extractQuotedTitle(item.content);
      const matches = proposals.filter((p) => p.activityId === relatedId);
      const proposal =
        (title && matches.find((p) => p.title.trim() === title)) ||
        matches.find((p) => p.status !== "PENDING") ||
        matches[0];
      if (!proposal || proposal.status === "PENDING") continue;
      result.set(
        item.id,
        outcome(
          proposal.status === "APPROVED" ? "approved" : "rejected",
          proposalHandlerMap.get(proposal.id)
        )
      );
      continue;
    }

    if (item.type === "JAM_APPLICATION") {
      const teamId = relatedId.split(":")[1];
      if (!teamId) continue;
      const notifTime = new Date(item.createdAt).getTime();
      const apps = jamApps.filter((app) => app.teamId === teamId);
      const app = apps
        .slice()
        .sort(
          (a, b) =>
            Math.abs(a.createdAt.getTime() - notifTime) - Math.abs(b.createdAt.getTime() - notifTime)
        )[0];
      if (!app || app.status === "PENDING") continue;
      result.set(
        item.id,
        outcome(app.status === "APPROVED" ? "approved" : "rejected", handlerFromUser(app.team.leader))
      );
    }
  }

  return result;
}
