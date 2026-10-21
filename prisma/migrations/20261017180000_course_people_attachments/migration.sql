-- 公开课可关联讲师/学员，并挂资料附件。
CREATE TYPE "CourseParticipantRole" AS ENUM ('INSTRUCTOR', 'STUDENT');

CREATE TABLE "CourseParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "role" "CourseParticipantRole" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CourseAttachment" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CourseAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseParticipant_activityId_memberId_key" ON "CourseParticipant"("activityId", "memberId");
CREATE INDEX "CourseParticipant_activityId_role_sortOrder_idx" ON "CourseParticipant"("activityId", "role", "sortOrder");
CREATE INDEX "CourseParticipant_memberId_idx" ON "CourseParticipant"("memberId");
CREATE INDEX "CourseAttachment_activityId_sortOrder_idx" ON "CourseAttachment"("activityId", "sortOrder");

ALTER TABLE "CourseParticipant" ADD CONSTRAINT "CourseParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseParticipant" ADD CONSTRAINT "CourseParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "ClubMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseAttachment" ADD CONSTRAINT "CourseAttachment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
