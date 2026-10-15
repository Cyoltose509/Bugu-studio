/** Activity type chooses presentation; capabilities decide which actions are available. */
export function canSubmitActivityTalk(activity: {
  talkSubmissionOpen?: boolean | null;
  status: string;
  endTime: Date | string;
}, now = new Date()): boolean {
  return !!activity.talkSubmissionOpen
    && activity.status === "PUBLISHED"
    && new Date(activity.endTime).getTime() >= now.getTime();
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
