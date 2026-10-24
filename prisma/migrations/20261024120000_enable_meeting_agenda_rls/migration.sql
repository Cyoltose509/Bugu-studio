-- These tables are accessed through the server-side Prisma connection only.
-- Keep them protected if the public schema is exposed through Supabase Data API.
ALTER TABLE "MeetingProposal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingTalk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MeetingTalkSpeaker" ENABLE ROW LEVEL SECURITY;
