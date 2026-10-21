ALTER TYPE "ActivityType" ADD VALUE 'ENGINE_COURSE';
ALTER TABLE "Activity" ADD COLUMN "courseHasClock" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Activity" ADD COLUMN "courseCoverFocusX" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Activity" ADD COLUMN "courseCoverFocusY" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_course_cover_focus_check" CHECK ("courseCoverFocusX" BETWEEN 0 AND 100 AND "courseCoverFocusY" BETWEEN 0 AND 100);

CREATE TABLE "CourseClass" (
  "id" TEXT NOT NULL,
  "activityId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "coverImage" TEXT,
  "coverFocusX" INTEGER NOT NULL DEFAULT 50,
  "coverFocusY" INTEGER NOT NULL DEFAULT 50,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseClass_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "CourseClass" ADD CONSTRAINT "CourseClass_cover_focus_check" CHECK ("coverFocusX" BETWEEN 0 AND 100 AND "coverFocusY" BETWEEN 0 AND 100);
CREATE UNIQUE INDEX "CourseClass_activityId_sortOrder_key" ON "CourseClass"("activityId", "sortOrder");
ALTER TABLE "CourseClass" ADD CONSTRAINT "CourseClass_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseClassTag" (
  "classId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  CONSTRAINT "CourseClassTag_pkey" PRIMARY KEY ("classId", "tagId")
);
CREATE INDEX "CourseClassTag_tagId_idx" ON "CourseClassTag"("tagId");
ALTER TABLE "CourseClassTag" ADD CONSTRAINT "CourseClassTag_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CourseClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseClassTag" ADD CONSTRAINT "CourseClassTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseLesson" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "instructorName" TEXT NOT NULL,
  "topic" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startMinute" INTEGER,
  "endMinute" INTEGER,
  "meetingUrl" TEXT,
  "videoUrl" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseLesson_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CourseLesson_time_check" CHECK (
    ("startMinute" IS NULL AND "endMinute" IS NULL) OR
    ("startMinute" BETWEEN 0 AND 1439 AND ("endMinute" IS NULL OR "endMinute" BETWEEN "startMinute" + 1 AND 1440))
  )
);
CREATE UNIQUE INDEX "CourseLesson_classId_sortOrder_key" ON "CourseLesson"("classId", "sortOrder");
ALTER TABLE "CourseLesson" ADD CONSTRAINT "CourseLesson_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CourseClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CourseShowcaseItem" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "projectId" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CourseShowcaseItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CourseShowcaseItem_classId_sortOrder_key" ON "CourseShowcaseItem"("classId", "sortOrder");
CREATE INDEX "CourseShowcaseItem_projectId_idx" ON "CourseShowcaseItem"("projectId");
ALTER TABLE "CourseShowcaseItem" ADD CONSTRAINT "CourseShowcaseItem_classId_fkey" FOREIGN KEY ("classId") REFERENCES "CourseClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseShowcaseItem" ADD CONSTRAINT "CourseShowcaseItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CourseClass" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseClassTag" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseLesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CourseShowcaseItem" ENABLE ROW LEVEL SECURITY;
