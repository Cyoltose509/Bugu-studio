/**
 * 备份/恢复涉及的 Prisma 模型清单。
 *
 * 命名 = Prisma Client 属性名（camelCase），与 schema.prisma 中的 model 一一对应。
 * 顺序 = 外键依赖：父表在前（写入顺序）；清空时用 BACKUP_DELETE_ORDER 倒序。
 *
 * 维护约定：schema 新增业务表后，必须同步改这里，否则「全量恢复」会漏表。
 */
export const BACKUP_TABLES = [
  // 基础配置 / 认证
  "siteSetting",
  "tag",
  "user",
  "account",
  "session",
  "verificationToken",
  "passwordResetToken",
  "inviteCode",
  "loginAttempt",
  "rateLimit",
  // 成员
  "clubMember",
  "memberLink",
  "workExperience",
  // 监控报告
  "cspReport",
  "errorReport",
  // 作品（先于活动：JamSubmission 可能关联 project）
  "project",
  "projectImage",
  "projectMember",
  "projectLink",
  "projectTag",
  "review",
  "comment",
  "projectLike",
  "notification",
  // 历史
  "yearEvent",
  "eventImage",
  // 活动 / Game Jam
  "activity",
  "meetingProposal",
  "jamTeam",
  "jamTeamMember",
  "jamTeamApplication",
  "jamTeamInvitation",
  "jamSubmission",
  "jamJudge",
  "jamScore",
  "courseScore",
  // 运维元数据（最后写回）
  "auditLog",
  "backupVersion",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** 清空时从叶子表往根表删，降低外键冲突 */
export const BACKUP_DELETE_ORDER: BackupTable[] = [...BACKUP_TABLES].reverse();
