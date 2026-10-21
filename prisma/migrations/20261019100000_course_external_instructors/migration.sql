-- 社外讲师以姓名记录；学员仍必须关联社团成员。
ALTER TABLE "CourseParticipant" ALTER COLUMN "memberId" DROP NOT NULL;
ALTER TABLE "CourseParticipant" ADD COLUMN "externalName" TEXT;

ALTER TABLE "CourseParticipant" ADD CONSTRAINT "CourseParticipant_identity_check"
CHECK (
  ("memberId" IS NOT NULL AND "externalName" IS NULL)
  OR (
    "memberId" IS NULL
    AND "role" = 'INSTRUCTOR'
    AND "externalName" IS NOT NULL
    AND length(btrim("externalName")) BETWEEN 1 AND 80
  )
);

CREATE UNIQUE INDEX "CourseParticipant_external_name_key"
ON "CourseParticipant" ("activityId", lower(btrim("externalName")))
WHERE "externalName" IS NOT NULL;
