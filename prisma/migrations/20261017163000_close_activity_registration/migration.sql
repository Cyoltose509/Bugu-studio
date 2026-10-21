-- 在线不再提供「开放报名」，只保留「报名分享」(talkSubmissionOpen)。
UPDATE "Activity"
SET "registrationOpen" = false
WHERE "registrationOpen" = true;
