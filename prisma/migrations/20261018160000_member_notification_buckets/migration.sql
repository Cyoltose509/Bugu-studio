-- 成员收到的作品关注、重新提交通知不再占用管理员审核类型。
UPDATE "Notification" AS n
SET type = 'PROJECT_PUBLISHED'
FROM "User" AS u
WHERE n."userId" = u.id
  AND u.role <> 'ADMIN'
  AND n.type = 'NEW_PROJECT';

UPDATE "Notification" AS n
SET type = 'PROJECT_RESUBMIT'
FROM "User" AS u
WHERE n."userId" = u.id
  AND u.role <> 'ADMIN'
  AND n.type = 'PROJECT_UPDATE';

-- 历史上误发给成员的审核和 bug 通知不再保留。
DELETE FROM "Notification" AS n
USING "User" AS u
WHERE n."userId" = u.id
  AND u.role <> 'ADMIN'
  AND n.type IN ('NEW_PROJECT', 'PROJECT_UPDATE', 'ACTIVITY_PROPOSAL', 'NEW_USER', 'ERROR_REPORT', 'CSP_VIOLATION');
