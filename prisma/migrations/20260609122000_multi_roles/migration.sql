-- Add roles column as text[] (PostgreSQL array)
ALTER TABLE "ProjectMember" ADD COLUMN "roles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Migrate existing data: convert single role string to array
UPDATE "ProjectMember" SET "roles" = ARRAY["role"] WHERE "role" IS NOT NULL AND "role" != '';

-- Drop old role column
ALTER TABLE "ProjectMember" DROP COLUMN "role";
