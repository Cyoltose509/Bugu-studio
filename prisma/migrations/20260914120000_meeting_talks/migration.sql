-- 例会结构化分享条目（主讲 + 标题 + BV；可选关联站内用户）
CREATE TABLE IF NOT EXISTS "MeetingTalk" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "bvId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MeetingTalk_pkey" PRIMARY KEY ("id")
);

-- 兼容：若表已按旧版迁移创建（无 userId），补列
DO $$ BEGIN
  ALTER TABLE "MeetingTalk" ADD COLUMN "userId" TEXT;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "MeetingTalk_activityId_idx" ON "MeetingTalk"("activityId");
CREATE INDEX IF NOT EXISTS "MeetingTalk_activityId_sortOrder_idx" ON "MeetingTalk"("activityId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MeetingTalk_userId_idx" ON "MeetingTalk"("userId");

DO $$ BEGIN
  ALTER TABLE "MeetingTalk"
    ADD CONSTRAINT "MeetingTalk_activityId_fkey"
    FOREIGN KEY ("activityId") REFERENCES "Activity"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MeetingTalk"
    ADD CONSTRAINT "MeetingTalk_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
