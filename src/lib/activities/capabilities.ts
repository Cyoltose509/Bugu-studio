/** Activity type chooses presentation; capabilities decide which actions are available. */
export function canSubmitActivityTalk(activity: {
  talkSubmissionOpen?: boolean | null;
  status: string;
  endTime?: Date | string | null;
  timePending?: boolean | null;
}, now = new Date()): boolean {
  if (!activity.talkSubmissionOpen || activity.status !== "PUBLISHED") return false;
  // 待定视为未来活动，分享报名不因缺少结束时间而关闭。
  if (activity.timePending || !activity.endTime) return true;
  return new Date(activity.endTime).getTime() >= now.getTime();
}

export function hasActivityTalkSection(activity: {
  type?: string;
  talkSubmissionOpen?: boolean | null;
  talks?: unknown[];
  proposals?: unknown[];
}): boolean {
  return activity.type === "MEETING"
    || !!activity.talkSubmissionOpen
    || !!activity.talks?.length
    || !!activity.proposals?.length;
}
