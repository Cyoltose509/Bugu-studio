-- Allow one agenda item to credit multiple speakers while retaining the legacy
-- MeetingTalk.speaker/userId pair for backwards compatibility.
CREATE TABLE "MeetingTalkSpeaker" (
  "id" TEXT NOT NULL,
  "talkId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "userId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MeetingTalkSpeaker_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MeetingTalk"
  ADD COLUMN "sourceProposalId" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "imageUrl" TEXT;
CREATE UNIQUE INDEX "MeetingTalk_sourceProposalId_key"
  ON "MeetingTalk"("sourceProposalId");
ALTER TABLE "MeetingTalk"
  ADD CONSTRAINT "MeetingTalk_sourceProposalId_fkey"
  FOREIGN KEY ("sourceProposalId") REFERENCES "MeetingProposal"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "MeetingTalkSpeaker_talkId_sortOrder_key"
  ON "MeetingTalkSpeaker"("talkId", "sortOrder");
CREATE INDEX "MeetingTalkSpeaker_userId_idx"
  ON "MeetingTalkSpeaker"("userId");

ALTER TABLE "MeetingTalkSpeaker"
  ADD CONSTRAINT "MeetingTalkSpeaker_talkId_fkey"
  FOREIGN KEY ("talkId") REFERENCES "MeetingTalk"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingTalkSpeaker"
  ADD CONSTRAINT "MeetingTalkSpeaker_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Every existing agenda item becomes a one-speaker item.
INSERT INTO "MeetingTalkSpeaker" ("id", "talkId", "name", "userId", "sortOrder", "createdAt")
SELECT 'mts_' || "id", "id", "speaker", "userId", 0, CURRENT_TIMESTAMP
FROM "MeetingTalk"
WHERE BTRIM("speaker") <> ''
ON CONFLICT ("talkId", "sortOrder") DO NOTHING;

-- Repair legacy approved proposals. Attach an exact existing agenda row where
-- possible, then create a row for every still-unattached approval.
WITH candidates AS (
  SELECT
    p."id" AS proposal_id,
    t."id" AS talk_id,
    ROW_NUMBER() OVER (PARTITION BY t."id" ORDER BY p."createdAt", p."id") AS talk_rank,
    ROW_NUMBER() OVER (PARTITION BY p."id" ORDER BY t."sortOrder", t."createdAt", t."id") AS proposal_rank
  FROM "MeetingProposal" p
  JOIN "MeetingTalk" t
    ON t."activityId" = p."activityId"
   AND LOWER(BTRIM(t."title")) = LOWER(BTRIM(p."title"))
   AND t."userId" IS NOT DISTINCT FROM p."userId"
  WHERE p."status" = 'APPROVED'
    AND t."sourceProposalId" IS NULL
), chosen AS (
  SELECT proposal_id, talk_id FROM candidates WHERE talk_rank = 1 AND proposal_rank = 1
)
UPDATE "MeetingTalk" t
SET
  "sourceProposalId" = chosen.proposal_id,
  "description" = COALESCE(t."description", p."description"),
  "imageUrl" = COALESCE(t."imageUrl", p."imageUrl")
FROM chosen
JOIN "MeetingProposal" p ON p."id" = chosen.proposal_id
WHERE t."id" = chosen.talk_id;

INSERT INTO "MeetingTalk" (
  "id", "activityId", "speaker", "userId", "sourceProposalId", "title", "description", "imageUrl",
  "talkType", "bvId", "sortOrder", "createdAt", "updatedAt"
)
SELECT
  'mtp_' || MD5(p."id"),
  p."activityId",
  COALESCE(NULLIF(BTRIM(cm."displayName"), ''), NULLIF(BTRIM(u."name"), ''), '主讲'),
  p."userId",
  p."id",
  p."title",
  p."description",
  p."imageUrl",
  p."proposalType",
  NULL,
  COALESCE((SELECT MAX(t."sortOrder") + 1 FROM "MeetingTalk" t WHERE t."activityId" = p."activityId"), 0)
    + ROW_NUMBER() OVER (PARTITION BY p."activityId" ORDER BY p."createdAt", p."id") - 1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MeetingProposal" p
JOIN "User" u ON u."id" = p."userId"
LEFT JOIN "ClubMember" cm ON cm."userId" = u."id"
LEFT JOIN "MeetingTalk" linked ON linked."sourceProposalId" = p."id"
WHERE p."status" = 'APPROVED' AND linked."id" IS NULL;

INSERT INTO "MeetingTalkSpeaker" ("id", "talkId", "name", "userId", "sortOrder", "createdAt")
SELECT 'mts_' || t."id", t."id", t."speaker", t."userId", 0, CURRENT_TIMESTAMP
FROM "MeetingTalk" t
LEFT JOIN "MeetingTalkSpeaker" s ON s."talkId" = t."id"
WHERE s."id" IS NULL AND BTRIM(t."speaker") <> ''
ON CONFLICT ("talkId", "sortOrder") DO NOTHING;
