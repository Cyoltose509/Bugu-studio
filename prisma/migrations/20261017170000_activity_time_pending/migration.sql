-- 活动可以不填具体时间，标记为待定。待定没有开始/结束时间。
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "timePending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Activity" ALTER COLUMN "startTime" DROP NOT NULL;
ALTER TABLE "Activity" ALTER COLUMN "endTime" DROP NOT NULL;
