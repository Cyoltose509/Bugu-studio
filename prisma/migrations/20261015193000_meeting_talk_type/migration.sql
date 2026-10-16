-- AlterTable
ALTER TABLE "MeetingTalk" ADD COLUMN IF NOT EXISTS "talkType" "ProposalType" NOT NULL DEFAULT 'SHARE';
