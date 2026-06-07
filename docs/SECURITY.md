# 安全设计方案

**标准**: OWASP Top 10 2021  
**适用版本**: V1+

---

## 1. 认证安全

### 1.1 密码存储

使用 **Argon2id**（OWASP 推荐）：

```typescript
// lib/security/password.ts
import argon2 from 'argon2';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64MB
  timeCost: 3,         // 3 次迭代
  parallelism: 4,      // 并行度
};

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
```

### 1.2 邮箱验证

```typescript
// lib/security/email-verification.ts
import { randomBytes } from 'crypto';

export function generateVerificationToken(): string {
  // 32字节随机 token，hex 编码 = 64字符
  return randomBytes(32).toString('hex');
}

// token 存储：存入 DB，24h 后过期
// 验证后立即删除 token（防重放）
```

### 1.3 登录限流（防暴力破解）

```typescript
// middleware/loginRateLimit.ts
// 策略：账号 + IP 双维度限制

async function checkLoginLimit(email: string, ip: string): Promise<void> {
  const windowMs = 15 * 60 * 1000; // 15分钟
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // 检查该邮箱在窗口期内的失败次数
  const emailFailures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (emailFailures >= 5) {
    throw new AppError('RATE_LIMITED', '账号已被临时锁定，请15分钟后重试', 429);
  }

  // 检查 IP
  const ipFailures = await prisma.loginAttempt.count({
    where: {
      ipAddress: ip,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (ipFailures >= 10) {
    throw new AppError('RATE_LIMITED', '请求过于频繁，请稍后重试', 429);
  }
}
```

### 1.4 Session 安全（Auth.js 配置）

```typescript
// auth.config.ts
export const authConfig = {
  session: {
    strategy: 'database',
    maxAge: 7 * 24 * 60 * 60,     // 7天
    updateAge: 24 * 60 * 60,       // 每天刷新
  },
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',          // CSRF 防护
        path: '/',
        secure: true,             // 强制 HTTPS
      },
    },
  },
};
```

---

## 2. 权限控制（RBAC）

### 2.1 权限矩阵

| 操作 | Guest | User | Member | Reviewer | Admin |
|------|-------|------|--------|----------|-------|
| 浏览已发布作品 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 浏览成员页 | ✓ | ✓ | ✓ | ✓ | ✓ |
| 完善个人资料 | ✗ | ✓ | ✓ | ✓ | ✓ |
| 提交作品 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 编辑自己的作品 | ✗ | ✗ | ✓ | ✓ | ✓ |
| 审核作品 | ✗ | ✗ | ✗ | ✓ | ✓ |
| 编辑任意作品 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 用户管理 | ✗ | ✗ | ✗ | ✗ | ✓ |
| 权限管理 | ✗ | ✗ | ✗ | ✗ | ✓ |

### 2.2 RBAC 中间件实现

```typescript
// middleware/rbac.ts
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

type Permission = string;

export function requirePermission(permission: Permission) {
  return async function (req: NextApiRequest, res: NextApiResponse, next: Function) {
    const session = await getServerSession(req, res, authOptions);

    if (!session?.user?.id) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    }

    const hasPermission = await checkUserPermission(session.user.id, permission);

    if (!hasPermission) {
      // 记录越权尝试
      await auditLog({
        userId: session.user.id,
        action: 'PERMISSION_DENIED',
        resourceType: 'permission',
        ipAddress: getClientIP(req),
      });
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN' } });
    }

    next();
  };
}

async function checkUserPermission(userId: string, permission: string): Promise<boolean> {
  const result = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  return result.some(ur =>
    ur.role.rolePermissions.some(rp => rp.permission.name === permission)
  );
}
```

### 2.3 资源所有权校验

```typescript
// 防止 Member 编辑他人的作品
export async function requireProjectOwnership(
  userId: string,
  projectId: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { submittedById: true },
  });

  if (!project) throw new AppError('NOT_FOUND', '作品不存在', 404);

  if (project.submittedById !== userId) {
    throw new AppError('FORBIDDEN', '无权操作他人的作品', 403);
  }
}
```

---

## 3. SQL 注入防护

**原则**: 使用 Prisma ORM + 参数化查询，**严禁**字符串拼接 SQL。

```typescript
// ✅ 正确：使用 Prisma 参数化查询
const projects = await prisma.project.findMany({
  where: {
    title: { contains: searchQuery, mode: 'insensitive' },
    status: 'PUBLISHED',
  },
});

// ✅ 正确：使用 Prisma.$queryRaw（必须用 Prisma.sql 模板字符串）
const result = await prisma.$queryRaw`
  SELECT * FROM projects WHERE id = ${projectId}
`;

// ❌ 禁止：字符串拼接（即使用了 $queryRaw）
// await prisma.$queryRawUnsafe(`SELECT * FROM projects WHERE id = '${projectId}'`);
```

**ESLint 规则**：配置 `eslint-plugin-security` 检测 `$queryRawUnsafe` 使用。

---

## 4. XSS 防护

### 4.1 用户生成内容（UGC）处理

```typescript
// lib/security/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

// 配置：只允许安全标签
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'blockquote', 'code', 'pre', 'a'],
  ALLOWED_ATTR: ['href', 'title', 'rel'],
  // 强制 rel="noopener noreferrer" 防止 target="_blank" 攻击
  FORCE_BODY: false,
};

// Markdown → 安全 HTML
export function renderMarkdown(raw: string): string {
  const html = marked(raw);
  return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

// 纯文本输入 → 转义
export function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
```

### 4.2 React 层防护

React 默认对 JSX 内容做转义，但注意：
```tsx
// ✅ 安全：React 自动转义
<p>{userInput}</p>

// ⚠️ 必须先 Sanitize：
<div dangerouslySetInnerHTML={{ __html: renderMarkdown(devLog) }} />
```

### 4.3 Content Security Policy（HTTP Header）

```typescript
// next.config.js
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://cdn.your-domain.com;
  media-src 'self' https://www.youtube.com https://player.bilibili.com;
  frame-src https://www.youtube.com https://player.bilibili.com;
  connect-src 'self';
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;
```

---

## 5. CSRF 防护

Auth.js 内置 CSRF 保护：
- 使用 `SameSite=Lax` Cookie（阻止跨站 POST 请求）
- Auth.js 的修改操作包含 CSRF Token 校验

自定义 API Route 的额外保护：
```typescript
// middleware/csrf.ts
export function validateCSRF(req: NextApiRequest): void {
  const origin = req.headers.origin;
  const host = req.headers.host;

  if (!origin) return; // 同源请求无 Origin header（正常浏览器行为）

  const originHost = new URL(origin).host;
  if (originHost !== host) {
    throw new AppError('FORBIDDEN', 'CSRF 校验失败', 403);
  }
}
```

---

## 6. 文件上传安全

```typescript
// lib/security/upload.ts

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateUploadRequest(fileType: string, fileSize: number): void {
  // 1. MIME 类型白名单校验
  if (!ALLOWED_MIME_TYPES.includes(fileType)) {
    throw new AppError('VALIDATION_ERROR', '只允许上传 JPG/PNG/WebP 格式', 422);
  }

  // 2. 文件大小限制
  if (fileSize > MAX_FILE_SIZE) {
    throw new AppError('VALIDATION_ERROR', '文件大小不能超过 5MB', 422);
  }
}

export function generateSafeFilename(originalExt: string, purpose: string): string {
  const uuid = crypto.randomUUID();
  const extMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const ext = extMap[originalExt] || '.bin';
  // 路径结构：{purpose}/{year}/{month}/{uuid}{ext}
  const now = new Date();
  return `${purpose}/${now.getFullYear()}/${now.getMonth() + 1}/${uuid}${ext}`;
}
```

**R2 Bucket 安全配置**:
- 禁用公开写入，所有上传通过预签名 URL
- 上传路径限制（通过 Bucket Policy）
- 禁止上传 `.html`, `.js`, `.php` 等可执行文件（通过 Content-Type 限制）
- 上传目录不允许目录列表（禁止 bucket listing）

---

## 7. API 安全

### 7.1 全局速率限制中间件

```typescript
// middleware/rateLimit.ts
import { LRUCache } from 'lru-cache';

type RateLimitStore = LRUCache<string, number[]>;

const store: RateLimitStore = new LRUCache({
  max: 10000,
  ttl: 60 * 1000, // 1分钟
});

export function rateLimit(options: { limit: number; windowMs: number }) {
  return function (identifier: string): void {
    const now = Date.now();
    const key = identifier;
    const timestamps = store.get(key) ?? [];

    // 清理过期时间戳
    const valid = timestamps.filter(t => now - t < options.windowMs);
    valid.push(now);
    store.set(key, valid);

    if (valid.length > options.limit) {
      throw new AppError('RATE_LIMITED', '请求过于频繁', 429);
    }
  };
}
```

### 7.2 审计日志

```typescript
// lib/audit.ts
export async function auditLog(params: {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  beforeState?: object;
  afterState?: object;
  req?: NextApiRequest;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      beforeState: params.beforeState ? JSON.stringify(params.beforeState) : undefined,
      afterState: params.afterState ? JSON.stringify(params.afterState) : undefined,
      ipAddress: params.req ? getClientIP(params.req) : undefined,
      userAgent: params.req?.headers['user-agent'],
    },
  });
}

function getClientIP(req: NextApiRequest): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown'
  );
}
```

### 7.3 安全 HTTP Headers

```typescript
// next.config.js headers
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];
```

---

## 8. 环境变量安全

```bash
# .env.production（不提交到 Git）
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="$(openssl rand -base64 32)"    # 强随机 secret
NEXTAUTH_URL="https://your-domain.com"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="..."
R2_PUBLIC_URL="https://cdn.your-domain.com"
SMTP_HOST="..."
SMTP_PORT="587"
SMTP_USER="..."
SMTP_PASS="..."
```

**规则**:
- `.env*` 文件全部加入 `.gitignore`
- 生产环境通过服务器环境变量或 Secret Manager 注入
- 不在代码中硬编码任何密钥
- 定期轮换 NEXTAUTH_SECRET（每学期）

---

## 9. 依赖安全

```bash
# 每周运行
npm audit

# 自动修复低风险漏洞
npm audit fix

# 锁定依赖版本
npm ci  # 而非 npm install（用于部署）
```

配置 GitHub Dependabot 或每月手动检查依赖更新。
