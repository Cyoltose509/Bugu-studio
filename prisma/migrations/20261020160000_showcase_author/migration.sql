ALTER TABLE "CourseShowcaseItem" ADD COLUMN "authorName" TEXT NOT NULL DEFAULT '', ADD COLUMN "authorUserId" TEXT;
CREATE INDEX "CourseShowcaseItem_authorUserId_idx" ON "CourseShowcaseItem"("authorUserId");
ALTER TABLE "CourseShowcaseItem" ADD CONSTRAINT "CourseShowcaseItem_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
