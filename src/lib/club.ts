/**
 * 社团成立信息（与 Footer / 首页统计共用）
 * 完整日期优先读 NEXT_PUBLIC_CLUB_FOUNDED_DATE（YYYY-MM-DD）
 * 未配置时：用 FOUNDED_YEAR + 9 月 1 日（学年开学季常见建社时间）
 */
export function getClubFoundedYear(): number {
  const fromDate = getClubFoundedDate();
  return fromDate.getFullYear();
}

export function getClubFoundedDate(): Date {
  const raw = process.env.NEXT_PUBLIC_CLUB_FOUNDED_DATE?.trim();
  if (raw) {
    const d = new Date(`${raw}T00:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const year = parseInt(process.env.NEXT_PUBLIC_CLUB_FOUNDED_YEAR || "2019", 10);
  return new Date(year, 8, 1); // 月 0-based：9 月 1 日
}

/** 至今完整年数（与原先「今年 − 成立年」一致） */
export function getClubAgeYears(now = new Date()): number {
  return now.getFullYear() - getClubFoundedYear();
}

/** 自成立日起算的天数（含成立当天为第 1 天则 +1；此处用经过整天数） */
export function getClubAgeDays(now = new Date()): number {
  const founded = getClubFoundedDate();
  const start = new Date(founded.getFullYear(), founded.getMonth(), founded.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}
