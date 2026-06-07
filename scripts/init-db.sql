-- 数据库初始化脚本
-- 在 PostgreSQL 容器首次启动时执行

-- 设置时区
SET timezone = 'Asia/Shanghai';

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 支持全文搜索

-- 创建性能优化索引（补充 Prisma 自动创建的索引）
-- 注意：这些需要在 prisma migrate 之后手动执行，或通过 prisma migration 管理
