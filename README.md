# negative25

`negative25` 是一个面向摄影作品的个人影册与公开浏览平台，线上品牌为 [n25.world](https://n25.world/)。项目支持多用户账号、照片导入与 EXIF 读取、相册管理、公开主页、位置筛选、发现地图和照片详细参数展示。

口号：**Don't just dream it, live it. Find your negative 25.**

## 技术结构

- `apps/web`：Vue 3 + Vite 前端，包含公开图库、发现地图、用户主页和管理界面
- `apps/api`：Fastify API、认证、照片/相册/位置及导入接口
- `apps/worker`：异步导入任务、EXIF 解析、图片变体生成和对象存储持久化
- `packages/contracts`：前后端共享的数据契约
- `packages/config`、`packages/utils`：环境配置与通用工具

## 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

需要完整导入链路时，启动 PostgreSQL、Redis 和 MinIO：

```bash
docker compose up -d
pnpm db:migrate
pnpm dev
```

## 校验命令

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

生产部署说明见 [`infra/README.md`](infra/README.md)。敏感配置只应放在本地 `.env` 或部署平台的密钥管理中，不要提交真实密钥。

生产镜像使用根目录的 `Dockerfile` 和 `docker-compose.production.yml`。部署前准备 `.env.production`，然后执行：

```bash
docker compose -f docker-compose.production.yml --env-file .env.production up -d --build
```
