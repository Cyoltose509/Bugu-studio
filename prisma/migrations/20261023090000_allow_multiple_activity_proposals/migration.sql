-- Users may submit more than one share/showcase proposal for an activity.
ALTER TABLE "MeetingProposal"
  DROP CONSTRAINT IF EXISTS "MeetingProposal_activityId_userId_key";
