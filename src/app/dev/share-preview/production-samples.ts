// Public production activity pages, captured 2026-10-15 for the development preview.
// 时间字段直接抄自生产库的原始 UTC 值（站点按服务器时区原样渲染，不做额外偏移）。
// https://www.bugoostudio.com/activities/cmv423lyw00003yx9rry5h3t7
// https://www.bugoostudio.com/activities/cmv2e6kqc0001ndyk4w07o6uv
export const productionMeeting = {
  id: "cmv423lyw00003yx9rry5h3t7",
  title: "【百团招新后首次】2026/10/18 例会",
  type: "MEETING",
  status: "PUBLISHED",
  startTime: "2026-10-18T14:30:00.000Z",
  endTime: "2026-10-18T16:30:00.000Z",
  location: "总图书馆未来学习中心",
  summary: "欢迎新人来线下体验工作室最日常活动之双周例会~",
  description: "【百团招新特别辑】社团介绍、游戏制作工具、职能、流程科普；【专题展示】正在成员群募集中。",
  registrationOpen: true,
  talkSubmissionOpen: true,
  talks: [{ title: "了解游戏的制作与上线", speaker: "吃药图书" }],
};

export const productionRecruitment = {
  id: "cmv2e6kqc0001ndyk4w07o6uv",
  title: "2026 百团大战 · 珞珈技术俱乐部招新",
  type: "GENERAL",
  status: "PUBLISHED",
  startTime: "2026-10-11T01:00:00.000Z",
  endTime: "2026-10-11T09:00:00.000Z",
  location: "桂园操场 · 拓新14摊位",
  summary: "游戏 × 创作，一起玩出更多可能！来拓新14摊位体验社团原创游戏，和创作者面对面交流。",
  registrationOpen: false,
  talkSubmissionOpen: false,
  talks: [],
};
