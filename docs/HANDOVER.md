# 交接维护文档模板

**文档版本**: 1.0  
**最后更新**: [填写日期]  
**当前负责人**: [填写姓名]  
**接手人**: [填写姓名]

---

## 一、交接概览

本文档用于大学游戏开发社团官方网站的运维交接。每届社长/技术负责人换届时必须完成本文档的更新和移交。

**交接内容清单**:

- [ ] 服务器访问权限（SSH Key / 面板账号）
- [ ] 域名管理权限（DNS 服务商账号）
- [ ] 数据库访问权限
- [ ] Cloudflare 账号权限
- [ ] GitHub 仓库 Owner 权限
- [ ] 邮件服务账号
- [ ] 管理员账号（网站后台）
- [ ] 本文档已更新至最新状态

---

## 二、系统账号信息

> **安全提示**: 此处不填写明文密码。密码通过线下面对面方式或加密渠道传递。

| 系统 | 账号 | 备注 |
|------|------|------|
| 服务器 SSH | root / deploy 用户 | IP: `xxx.xxx.xxx.xxx` |
| 域名服务商 | [账号] | [服务商名称] |
| Cloudflare | [邮箱] | 管理 CDN 和 R2 |
| GitHub 组织 | [账号] | 仓库：`your-org/game-dev-club` |
| 邮件服务 | [账号] | 用于系统发送验证邮件 |
| 网站后台 | admin@your-domain.com | 超级管理员账号 |

---

## 三、服务器信息

```
服务器 IP:      xxx.xxx.xxx.xxx
操作系统:       Ubuntu 22.04 LTS
CPU / 内存:     [规格]
硬盘:           [规格] - 当前使用 [X]GB
月费:           [金额] - 付款方式: [方式] - 到期: [日期]
```

**SSH 登录**:
```bash
ssh -i ~/.ssh/gameclub_rsa deploy@xxx.xxx.xxx.xxx
# SSH Key 在交接时面对面移交
```

---

## 四、项目部署位置

```
项目根目录:    /opt/game-dev-club/
备份目录:      /opt/game-dev-club/backups/
Nginx 日志:   /var/log/nginx/
Docker 日志:  docker compose logs [service]
```

---

## 五、日常运维操作

### 5.1 查看运行状态

```bash
cd /opt/game-dev-club
docker compose ps                  # 查看所有容器状态
docker compose logs app --tail=100 # 查看应用日志
docker compose logs nginx --tail=50
```

### 5.2 重启服务

```bash
# 重启单个服务
docker compose restart app

# 重启所有服务
docker compose restart

# 停机重启（慎用）
docker compose down && docker compose up -d
```

### 5.3 部署新版本

```bash
cd /opt/game-dev-club
git pull origin main
docker compose build app
docker compose up -d --no-deps app
docker compose logs app --tail=50  # 确认启动正常
```

### 5.4 查看备份状态

```bash
# 列出所有备份
ls -lh /opt/game-dev-club/backups/daily/

# 手动触发备份
docker compose exec backup /backup.sh
```

### 5.5 SSL 证书续期

Let's Encrypt 证书 90 天过期，自动续期：
```bash
# 查看证书状态
certbot certificates

# 手动续期（通常由 cron 自动执行）
certbot renew --dry-run   # 先测试
certbot renew
docker compose restart nginx
```

---

## 六、常见问题处理 (Runbook)

### 问题 1：网站无法访问

```bash
# 检查步骤
1. ping your-domain.com           # DNS 是否解析
2. curl http://xxx.xxx.xxx.xxx    # 服务器是否响应
3. docker compose ps              # 容器是否全部运行
4. docker compose logs nginx      # Nginx 有无报错
5. docker compose logs app        # 应用有无崩溃
```

**常见原因**:
- 内存不足导致容器 OOM Kill → `free -h` 查看，重启容器
- SSL 证书过期 → 执行证书续期
- 磁盘空间不足 → `df -h`，清理旧日志/备份

### 问题 2：数据库连接失败

```bash
docker compose ps postgres         # 确认 postgres 容器运行
docker compose logs postgres       # 查看数据库日志
docker compose exec postgres psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "\l"
```

### 问题 3：备份未执行

```bash
# 查看 cron 日志
docker compose logs backup
# 手动执行备份
docker compose exec backup /backup.sh
```

### 问题 4：磁盘空间不足

```bash
df -h
docker system prune -f             # 清理未使用的 Docker 资源（镜像/容器）
# 清理超出保留期的备份（脚本自动执行，手动可强制）
find /opt/game-dev-club/backups/daily -mtime +30 -delete
```

---

## 七、定期维护清单

### 每月

- [ ] 检查服务器磁盘使用率 < 70%
- [ ] 检查 SSL 证书到期时间 > 30 天
- [ ] 检查备份文件是否正常生成
- [ ] 检查 `npm audit` 无高危漏洞

### 每学期

- [ ] 更新 Node.js 版本（如有重要安全更新）
- [ ] 更新 PostgreSQL 小版本
- [ ] 更新 Nginx 镜像版本
- [ ] 轮换 `NEXTAUTH_SECRET`（须同时重新登录所有用户）
- [ ] 检查并更新 `npm` 依赖
- [ ] 恢复演练：从备份恢复到测试环境，验证完整性

### 换届时

- [ ] 更新本文档（账号信息、负责人）
- [ ] 新任负责人创建独立管理员账号
- [ ] 完成 SSH Key 移交
- [ ] 完成所有密码轮换
- [ ] 旧任负责人账号降级或删除
- [ ] 在历史页新增当届成员和项目信息

---

## 八、技术栈说明

| 组件 | 版本 | 用途 | 文档链接 |
|------|------|------|----------|
| Next.js | 14.x | 全栈框架 | https://nextjs.org/docs |
| PostgreSQL | 15.x | 关系型数据库 | https://www.postgresql.org/docs/ |
| Prisma | 5.x | ORM | https://www.prisma.io/docs |
| Auth.js | 5.x | 认证框架 | https://authjs.dev |
| Cloudflare R2 | - | 图片存储 | https://developers.cloudflare.com/r2 |
| Docker | 24.x | 容器化 | https://docs.docker.com |
| Nginx | 1.25 | 反向代理 | https://nginx.org/en/docs/ |

---

## 九、变更记录

| 日期 | 负责人 | 变更内容 |
|------|--------|----------|
| 2026-XX-XX | [姓名] | 初始版本建立 |
| [日期] | [姓名] | [内容] |

---

## 十、紧急联系

| 角色 | 姓名 | 联系方式 |
|------|------|----------|
| 上届技术负责人 | [姓名] | [微信/邮箱] |
| 当届社长 | [姓名] | [联系方式] |
| 服务器紧急工单 | - | [服务商工单地址] |

---

*本文档应与代码仓库同步维护，每次重要变更后及时更新。*
