/** 首页「最新作品」栅格。CSS 断点必须与此文件数字一致。 */
export const HOME_WORKS_BREAKPOINTS = [
  { minWidth: 0, cols: 1, show: 2 },
  { minWidth: 520, cols: 2, show: 4 },
  { minWidth: 768, cols: 3, show: 6 },
  { minWidth: 1024, cols: 4, show: 8 },
] as const;

export const HOME_WORKS_MAX = HOME_WORKS_BREAKPOINTS[HOME_WORKS_BREAKPOINTS.length - 1].show;

export type HomeWorksShow = (typeof HOME_WORKS_BREAKPOINTS)[number]["show"];

export const HOME_WORKS_MQ = HOME_WORKS_BREAKPOINTS
  .filter((bp) => bp.minWidth > 0)
  .map((bp) => `(min-width: ${bp.minWidth}px)`);

export function homeWorksShowAt(width: number): HomeWorksShow {
  let show: HomeWorksShow = HOME_WORKS_BREAKPOINTS[0].show;
  for (const bp of HOME_WORKS_BREAKPOINTS) {
    if (width >= bp.minWidth) show = bp.show;
  }
  return show;
}
