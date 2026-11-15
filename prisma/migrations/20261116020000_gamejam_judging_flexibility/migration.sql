-- Game Jam 评委管理与评审灵活性增强
-- 1. Activity 增加评审模式、评委公开性、站外评审链接字段
ALTER TABLE "Activity" ADD COLUMN "judgesPublic" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Activity" ADD COLUMN "judgingMode" TEXT NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Activity" ADD COLUMN "externalJudgingUrl" TEXT;

-- 2. JamJudge 支持外部评委与头衔
ALTER TABLE "JamJudge" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "JamJudge" ADD COLUMN "externalName" TEXT;
ALTER TABLE "JamJudge" ADD COLUMN "title" TEXT;

-- 确保评委必须是站内用户或外部姓名之一
ALTER TABLE "JamJudge" ADD CONSTRAINT "JamJudge_identity_check"
CHECK (
  ("userId" IS NOT NULL AND "externalName" IS NULL)
  OR (
    "userId" IS NULL
    AND "externalName" IS NOT NULL
    AND length(btrim("externalName")) BETWEEN 1 AND 80
  )
);

CREATE UNIQUE INDEX "JamJudge_activity_external_name_key"
ON "JamJudge" ("activityId", lower(btrim("externalName")))
WHERE "externalName" IS NOT NULL;
