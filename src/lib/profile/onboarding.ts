/**
 * 新人建档（Onboarding）与个人名片完整度纯工具函数
 *
 * 年级按本科入学年份计算（如 2026 = 2026级）。
 * 9 月（含）之后当届新生为今年；7 月之前最新在读届为去年。
 */

export const ONBOARDING_SKILL_PRESETS = [
  "程序",
  "策划",
  "美术",
  "音效",
  "音乐",
  "测试",
  "宣发",
  "全栈",
] as const;

/**
 * 计算当前最新本科在读入学年份。
 * 7 月起（含暑期招新预热与秋季入学）视作当年新生已开始注册，1–6 月则以去年为最新在读届。
 */
export function getLatestUndergradYear(now: Date = new Date()): number {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12
  return month >= 7 ? year : year - 1;
}

/**
 * 返回一键点选的本科入学年份预设列表（降序，默认 6 个年份：4 个在读年级 + 2 个往届）
 */
export function getUndergradGradePresets(now: Date = new Date(), count = 6): number[] {
  const latest = getLatestUndergradYear(now);
  return Array.from({ length: count }, (_, idx) => latest - idx);
}

/**
 * 根据本科 4 年学制估算该入学年份是否大概率已毕业（仅供默认值建议，用户可手动切换）
 */
export function isLikelyGraduated(grade: number, now: Date = new Date()): boolean {
  const latest = getLatestUndergradYear(now);
  return grade <= latest - 4;
}

export interface ProfileCompletionInput {
  isMember: boolean;
  grade?: number | null;
  image?: string | null;
  skills?: string[] | null;
  bio?: string | null;
}

export interface MissingProfileItem {
  key: "grade" | "avatar" | "skills" | "bio";
  label: string;
}

export interface ProfileCompletionResult {
  missing: MissingProfileItem[];
  completedCount: number;
  totalCount: number;
  percent: number;
}

/**
 * 计算个人名片完整度与缺失项（用于 /profile 顶部轻量补全提示）
 */
export function getProfileMissingItems(input: ProfileCompletionInput): ProfileCompletionResult {
  const checks: Array<{ key: MissingProfileItem["key"]; label: string; done: boolean }> = [];

  if (input.isMember) {
    checks.push({
      key: "grade",
      label: "本科入学年份",
      done: typeof input.grade === "number" && input.grade >= 2000 && input.grade <= 2100,
    });
  }

  checks.push({
    key: "avatar",
    label: "个人头像",
    done: Boolean(input.image && input.image.trim()),
  });

  if (input.isMember) {
    checks.push({
      key: "skills",
      label: "职能方向",
      done: Array.isArray(input.skills) && input.skills.length > 0,
    });
  }

  checks.push({
    key: "bio",
    label: "一句话简介",
    done: Boolean(input.bio && input.bio.trim()),
  });

  const missing = checks.filter((c) => !c.done).map(({ key, label }) => ({ key, label }));
  const totalCount = checks.length;
  const completedCount = totalCount - missing.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  return { missing, completedCount, totalCount, percent };
}
