-- 活动推荐：新类型 + 细分类字段
-- RECOMMENDATION：外部活动推荐（Global Game Jam / 黑客松 / 合作企业培训等）
-- 不进入活动档案，活动页在"正在进行"与"活动档案"之间单开横排一栏。
ALTER TYPE "ActivityType" ADD VALUE 'RECOMMENDATION';

-- 细分类：GAME_JAM / HACKATHON / TRAINING / OTHER（字符串而非枚举，扩类别免迁移）
ALTER TABLE "Activity" ADD COLUMN "recoTag" TEXT;
