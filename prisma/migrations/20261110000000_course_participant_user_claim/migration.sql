-- 注册用户可以认领此前以姓名记录的社外讲师，展示名继续保留。
ALTER TABLE "CourseParticipant" ADD COLUMN "userId" TEXT;
ALTER TABLE "CourseParticipant" DROP CONSTRAINT "CourseParticipant_identity_check";
ALTER TABLE "CourseParticipant" ADD CONSTRAINT "CourseParticipant_identity_check"
CHECK (
  ("memberId" IS NOT NULL AND "userId" IS NULL AND "externalName" IS NULL)
  OR ("memberId" IS NULL AND "userId" IS NOT NULL AND "role" = 'INSTRUCTOR'
      AND "externalName" IS NOT NULL AND length(btrim("externalName")) BETWEEN 1 AND 80)
  OR ("memberId" IS NULL AND "userId" IS NULL AND "role" = 'INSTRUCTOR'
      AND "externalName" IS NOT NULL AND length(btrim("externalName")) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX "CourseParticipant_activityId_userId_key" ON "CourseParticipant"("activityId", "userId");
CREATE INDEX "CourseParticipant_userId_idx" ON "CourseParticipant"("userId");
ALTER TABLE "CourseParticipant" ADD CONSTRAINT "CourseParticipant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
