/**
 * 年报「荣誉殿堂」奖项归属逻辑。
 *
 * 规则：奖项优先归属到奖项文本里出现的年份（如
 * 「2021 朝夕光年高校游戏开发挑战赛 三等奖」→ 2021）；
 * 如果奖项文本里找不到 4 位年份，再回落到作品发布年份（developYear）。
 */

/** 一条已按获奖年份归位的奖项记录 */
export interface AwardEntry {
  projectId: string;
  slug: string;
  title: string;
  award: string;
}

/** 从奖项文本里提取 4 位年份（1900–2099），找不到返回 null */
export function extractAwardYear(award: string): number | null {
  const m = award.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

/**
 * 奖项归属年份：优先取奖项文本中的年份，
 * 找不到年份时回落到作品发布年份（developYear）。
 */
export function resolveAwardYear(
  award: string,
  developYear: number | null | undefined,
): number | null {
  return extractAwardYear(award) ?? (developYear ?? null);
}

interface AwardSourceProject {
  id: string;
  slug: string;
  title: string;
  developYear: number | null;
  awards?: string[] | null;
}

/** 把所有作品的奖项按「获奖年份」分组 */
export function groupAwardsByYear(
  projects: AwardSourceProject[],
): Map<number, AwardEntry[]> {
  const byYear = new Map<number, AwardEntry[]>();
  for (const p of projects) {
    for (const award of p.awards ?? []) {
      const y = resolveAwardYear(award, p.developYear);
      if (y == null) continue;
      const list = byYear.get(y);
      if (list) list.push({ projectId: p.id, slug: p.slug, title: p.title, award });
      else byYear.set(y, [{ projectId: p.id, slug: p.slug, title: p.title, award }]);
    }
  }
  return byYear;
}
