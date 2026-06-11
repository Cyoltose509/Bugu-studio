-- 1. 添加新字段
ALTER TABLE "ClubMember" ADD COLUMN "realName" TEXT;
ALTER TABLE "ClubMember" ADD COLUMN "graduated" BOOLEAN NOT NULL DEFAULT false;

-- 2. grade 从 String 转为 Int
-- 先添加临时列
ALTER TABLE "ClubMember" ADD COLUMN "grade_int" INTEGER;
-- 迁移数据：从 "20XX级" 等格式中提取年份数字
UPDATE "ClubMember" SET "grade_int" = CAST(NULLIF(REGEXP_REPLACE("grade", '[^0-9]', '', 'g'), '') AS INTEGER) WHERE "grade" IS NOT NULL;
-- 删除旧列
ALTER TABLE "ClubMember" DROP COLUMN "grade";
-- 重命名新列
ALTER TABLE "ClubMember" RENAME COLUMN "grade_int" TO "grade";

-- 3. 删除 graduateYear 列
ALTER TABLE "ClubMember" DROP COLUMN IF EXISTS "graduateYear";

-- 4. joinYear 现在重新被使用，添加索引
CREATE INDEX IF NOT EXISTS "ClubMember_grade_idx" ON "ClubMember"("grade");
