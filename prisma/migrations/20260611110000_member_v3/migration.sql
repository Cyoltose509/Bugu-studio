-- Add fields for graduated/realName/college/major/work
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "realName" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "college" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "major" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "workLocation" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "workPosition" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN IF NOT EXISTS "graduated" BOOLEAN NOT NULL DEFAULT false;
