-- Each column already has an equivalent btree index supplied by @unique or @id.
-- Keep the unique/primary indexes and remove only their duplicate nonunique copies.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';

DROP INDEX IF EXISTS public."ErrorReport_reportId_idx";
DROP INDEX IF EXISTS public."InviteCode_code_idx";
DROP INDEX IF EXISTS public."Project_slug_idx";
DROP INDEX IF EXISTS public."RateLimit_key_idx";
DROP INDEX IF EXISTS public."SiteSetting_key_idx";
DROP INDEX IF EXISTS public."Tag_slug_idx";
DROP INDEX IF EXISTS public."User_email_idx";

COMMIT;
