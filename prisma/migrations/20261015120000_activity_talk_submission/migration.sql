ALTER TABLE "Activity" ADD COLUMN "talkSubmissionOpen" BOOLEAN NOT NULL DEFAULT false;

-- Existing open meetings already accept talk proposals; retain that behavior.
UPDATE "Activity"
SET "talkSubmissionOpen" = true
WHERE "type" = 'MEETING' AND "registrationOpen" = true;
