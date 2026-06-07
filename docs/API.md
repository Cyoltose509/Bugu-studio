# API 设计文档

**基础路径**: `/api/v1`  
**格式**: JSON  
**认证**: Bearer Token (Auth.js Session) via Cookie  
**版本策略**: URL 路径版本化

---

## 通用约定

### 响应格式

```typescript
// 成功
{
  "success": true,
  "data": { ... },
  "meta": {          // 分页时存在
    "total": 100,
    "page": 1,
    "pageSize": 12,
    "totalPages": 9
  }
}

// 错误
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "字段验证失败",
    "details": [
      { "field": "title", "message": "标题不能为空" }
    ]
  }
}
```

### 错误码

| Code | HTTP 状态 | 含义 |
|------|-----------|------|
| UNAUTHORIZED | 401 | 未登录 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| VALIDATION_ERROR | 422 | 输入验证失败 |
| RATE_LIMITED | 429 | 请求过频 |
| INTERNAL_ERROR | 500 | 服务内部错误 |

---

## 认证 API

### POST /api/auth/register
**权限**: Public  
**限流**: 5次/小时/IP

**请求体**:
```json
{
  "email": "user@example.com",
  "username": "player_one",
  "password": "StrongPass123!"
}
```

**响应**: `201 Created`
```json
{
  "success": true,
  "data": {
    "message": "注册成功，请查收验证邮件"
  }
}
```

**逻辑**:
1. 校验邮箱格式、用户名规则（3-30字符，字母数字下划线）
2. 密码强度校验（最少8位，含大小写+数字）
3. 检查邮箱/用户名唯一性
4. Argon2id 哈希密码
5. 创建用户（`emailVerified: false`）
6. 发送验证邮件（含 token，24h 有效）
7. 默认赋予 `user` 角色

---

### POST /api/auth/verify-email
**权限**: Public

**请求体**:
```json
{ "token": "eyJ..." }
```

---

### POST /api/auth/login
**权限**: Public  
**限流**: 10次/15分钟/IP，5次/15分钟/账号

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "StrongPass123!"
}
```

**逻辑**:
1. 记录 `login_attempts`
2. 检查 IP + 账号失败次数，超限返回 429 + lockout 剩余时间
3. 查询用户，验证密码（Argon2id.verify）
4. 更新 `lastLoginAt`
5. 创建 Auth.js Session

---

### POST /api/auth/logout
**权限**: 已登录  
销毁 Session，清除 Cookie

---

## 作品 API

### GET /api/v1/projects
**权限**: Public（只返回 `published` 状态）  
**限流**: 60次/分钟/IP

**查询参数**:
```
page         Int     default: 1
pageSize     Int     default: 12, max: 50
search       String  全文搜索（title + description）
type         Enum    STEAM_PUBLISHED|INDIE_GAME|GAME_JAM|DEMO|GRADUATION_PROJECT|PROTOTYPE
tags         String  逗号分隔的 tag id 列表
year         Int     开发年份
yearFrom     Int     年份范围起
yearTo       Int     年份范围止
sort         Enum    newest|oldest|title  default: newest
```

**响应**: `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Project Name",
      "description": "...",
      "coverImageUrl": "https://...",
      "projectType": "GAME_JAM",
      "developmentYear": 2024,
      "releaseDate": "2024-03-15",
      "tags": [{ "id": 1, "name": "Puzzle", "color": "#6366f1" }],
      "teamSize": 3,
      "hasSteam": true
    }
  ],
  "meta": { "total": 42, "page": 1, "pageSize": 12, "totalPages": 4 }
}
```

---

### GET /api/v1/projects/:id
**权限**: Public

**响应**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "...",
    "description": "...",
    "coverImageUrl": "...",
    "images": [{ "id": "uuid", "imageUrl": "...", "sortOrder": 0 }],
    "projectType": "STEAM_PUBLISHED",
    "status": "published",
    "developmentYear": 2023,
    "releaseDate": "2023-11-01",
    "steamUrl": "https://store.steampowered.com/app/...",
    "githubUrl": "https://github.com/...",
    "itchioUrl": null,
    "netdiskUrl": null,
    "videoUrl": "https://www.youtube.com/watch?v=...",
    "devLog": "## 开发日志\n...",
    "tags": [...],
    "members": [
      { "memberId": "uuid", "nickname": "dev_hero", "role": "主程序", "sortOrder": 0 }
    ],
    "publishedAt": "2023-11-01T00:00:00Z",
    "createdAt": "..."
  }
}
```

---

### POST /api/v1/projects
**权限**: Member  
**限流**: 10次/小时/用户

**请求体**:
```json
{
  "title": "My Game",
  "description": "游戏简介...",
  "coverImageUrl": "https://r2.../cover.webp",
  "projectType": "GAME_JAM",
  "developmentYear": 2025,
  "releaseDate": "2025-03-01",
  "steamUrl": null,
  "githubUrl": "https://github.com/...",
  "itchioUrl": "https://itch.io/...",
  "netdiskUrl": null,
  "videoUrl": null,
  "devLog": "## 开发日志\n...",
  "tags": [1, 3, 7],
  "memberIds": [
    { "memberId": "uuid", "role": "主程序", "sortOrder": 0 }
  ]
}
```

**响应**: `201 Created`  
**逻辑**: 创建 `status: DRAFT`，提交后变为 `PENDING_REVIEW`

---

### PATCH /api/v1/projects/:id
**权限**: Member（自己提交的）/ Reviewer / Admin

---

### POST /api/v1/projects/:id/submit
**权限**: Member（自己提交的）  
将草稿提交审核，状态变为 `PENDING_REVIEW`

---

### POST /api/v1/projects/:id/review
**权限**: Reviewer / Admin

**请求体**:
```json
{
  "action": "approve",    // approve | reject
  "comment": "内容质量良好，建议补充截图"
}
```

---

### DELETE /api/v1/projects/:id
**权限**: Admin  
软删除，不物理删除数据

---

## 成员 API

### GET /api/v1/members
**权限**: Public

**查询参数**:
```
year       Int     入社年份
graduated  Boolean true|false
page       Int
pageSize   Int
```

---

### GET /api/v1/members/:id
**权限**: Public  
返回成员信息 + 参与的已发布作品列表

---

### PATCH /api/v1/members/me
**权限**: Member（修改自己的资料）

---

## 文件上传 API

### POST /api/v1/upload/presign
**权限**: Member / Admin  
**限流**: 20次/分钟/用户

**请求体**:
```json
{
  "fileType": "image/webp",    // image/jpeg | image/png | image/webp
  "fileSize": 2097152,         // bytes，最大 5MB
  "purpose": "project_cover"   // project_cover | project_screenshot | avatar
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://r2.../presigned-url",
    "publicUrl": "https://cdn.example.com/...",
    "expiresIn": 300
  }
}
```

**逻辑**:
1. 校验 MIME 类型（只允许 image/jpeg, image/png, image/webp）
2. 校验文件大小（≤ 5MB）
3. 生成随机文件名（UUID + 扩展名），防止路径猜测
4. 生成 R2 预签名 URL（5 分钟有效）
5. 记录审计日志

**安全说明**: 客户端直接上传到 R2，不经过应用服务器，避免服务器处理大文件。

---

## 用户管理 API（Admin）

### GET /api/v1/admin/users
### PATCH /api/v1/admin/users/:id/roles
### POST /api/v1/admin/member-requests/:id/review

### GET /api/v1/admin/audit-logs
**权限**: Admin  
**查询参数**: userId, action, resourceType, startDate, endDate, page

---

## 公告 API

### GET /api/v1/announcements
**权限**: Public（只返回已发布）

### POST /api/v1/announcements
### PATCH /api/v1/announcements/:id
### DELETE /api/v1/announcements/:id
**权限**: Admin

---

## Rate Limit 策略汇总

| 端点 | 窗口 | 限制 | 维度 |
|------|------|------|------|
| POST /auth/register | 1h | 5次 | IP |
| POST /auth/login | 15min | 10次 | IP，5次/账号 |
| GET /projects | 1min | 60次 | IP |
| POST /projects | 1h | 10次 | 用户 |
| POST /upload/presign | 1min | 20次 | 用户 |
| 所有 Admin API | 1min | 30次 | 用户 |
| 全局 Fallback | 1min | 100次 | IP |

实现方案：使用 Redis（或内存 Map fallback）+ `@upstash/ratelimit` 或自实现 sliding window 算法。
