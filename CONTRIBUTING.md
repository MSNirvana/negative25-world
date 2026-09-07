# Contributing to negative25

感谢你愿意帮助 negative25 变得更好。请先阅读 CODE_OF_CONDUCT.md 和 SECURITY.md。

## 开始之前

1. 搜索现有 Issue，避免重复提交。
2. 小范围改动优先提交一个清晰的 PR；认证、公开主页、存储和数据库迁移请先开 Issue 讨论。
3. 不要提交真实账号、Token、地图 Key、对象存储密钥、线上照片或 .env 文件。

## 本地开发

    pnpm install
    cp .env.example .env
    docker compose up -d
    pnpm db:migrate
    pnpm dev

## 提交要求

- 使用 TypeScript 严格类型，保持现有 Vue/Fastify 目录边界。
- 用户可见行为需要补充单元测试或 Playwright 测试。
- 影响布局的改动需要补充移动端检查；地图改动需要说明无 Key/Key 错误时的降级行为。
- 提交前运行 pnpm lint && pnpm typecheck && pnpm test && pnpm build。
- Commit message 建议使用 feat:、fix:、docs:、test:、refactor:、chore: 前缀。

## Pull Request

请说明：

- 改动解决了什么问题；
- 影响哪些用户流程和 API；
- 如何验证；
- 是否包含数据库迁移、环境变量或部署变更；
- 如果是 UI 改动，请附桌面端和移动端截图。

维护者会优先处理可复现、边界清楚、测试完整的 PR。
