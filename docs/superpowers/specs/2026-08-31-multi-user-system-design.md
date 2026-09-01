# negative25 多用户系统开发设计

## 状态

已确认设计。用户已确认采用自建认证、自动个人空间、可邀请协作空间、公开主页精选内容和平台总管理员的多用户方案。

## 目标

在保留现有照片、相册、导入、Workspace 隔离和未来 iPhone API 兼容性的前提下，增加完整的多用户能力：

- 使用自定义用户名和密码注册、登录。
- 注册时二次确认密码，并通过邮箱验证账号。
- 每个新用户自动拥有独立摄影空间。
- 用户可以加入多个协作空间并按角色协作。
- 将 Studio 更名为个人中心，并提供个人资料、安全、空间和内容管理。
- 通过 `n25.world/@用户名` 提供可控的公开摄影主页。
- 提供平台总管理员处理账号状态、安全和注销任务。

## 已确认的产品决策

### 账号与身份

- 用户名是唯一公开标识，也是新账号的主要登录方式。
- 用户名大小写不敏感，服务端以小写规范化保存。
- 公开主页格式为 `n25.world/@{username}`。
- 昵称与用户名分离，昵称可随时修改。
- 邮箱用于验证、找回密码和安全通知，默认不公开。
- 注册验证同时发送一次性链接和 6 位验证码，链接是默认方式，验证码是备用方式。
- 旧账号保留邮箱登录兼容性，同时补充用户名 `negative25`。

### 个人空间与协作空间

- 注册事务自动创建 `User`、个人资料、Personal Workspace 和 `owner` 成员关系。
- 每个用户可以加入多个协作 Workspace。
- 个人主页默认只展示个人空间。
- 用户可以手动选择要公开的协作空间或协作相册。
- 照片始终归属于原 Workspace，公开主页只是读取授权后的内容，不复制照片数据。

### 邀请与注销

- 可通过邮箱或已注册用户名邀请成员。
- 邀请链接一次性使用，默认 7 天有效，可撤销。
- 邀请时选择 `admin`、`editor` 或 `viewer` 角色。
- 只有 `owner` 和 `admin` 可以邀请、撤销邀请和调整角色。
- `owner` 不能被普通管理员降级或移除。
- 用户注销前需要输入密码并完成邮箱确认。
- 注销进入 30 天待删除期，期间可恢复。
- 个人空间、照片、相册和资料进入软删除状态；30 天后永久清理。
- 用户在其他 Workspace 中的成员关系同时退出，但他人拥有的协作内容保留。
- 注销前提供个人资料、照片元数据和相册结构导出。

### 安全规则

- 用户名长度 3–24 位，只允许英文字母、数字、下划线和连字符。
- `admin`、`discover`、`albums`、`about`、`api`、`photo` 等系统路径为保留词。
- 密码至少 8 位，并要求同时包含字母和数字。
- 密码使用 Argon2id 哈希，服务端不保存明文。
- 注册、登录、验证码、找回密码和上传签名接口执行限流。
- 连续登录失败后进行短暂锁定，错误消息不泄露账号是否存在。
- 验证链接、验证码和找回密码令牌只保存哈希值，且只能使用一次。
- 修改密码或重置密码后撤销用户全部刷新令牌。
- 生产日志不得记录密码、令牌、验证码、原始 GPS 或图片字节。

## 现有系统兼容范围

项目已经具备：

- Fastify + TypeScript API。
- PostgreSQL/MemoryRepository 和迁移机制。
- Argon2id、JWT access token、轮换 refresh token。
- Workspace、membership 和 `owner/admin/editor/viewer` 角色。
- 照片、相册、导入、媒体存储、审计日志和未来 iPhone 可复用的 `/api/v1`。

多用户开发采用渐进扩展，不重建现有照片和 Workspace 模型。现有 `/api/v1/admin/...` API 可以继续作为后端兼容路径，前端展示名称和用户入口统一改为“个人中心”。

## 数据模型

### `users`

保留身份和认证字段，新增：

- `username`：唯一规范化用户名。
- `email_verified_at`：邮箱验证时间。
- `deletion_requested_at`：注销申请时间。
- `deleted_at`：软删除时间。
- `disabled`：平台禁用状态。
- `updated_at`：资料和安全设置变更时间。

`email` 继续唯一保存，`password_hash` 继续使用 Argon2id。公开资料不与认证字段混在一起。

### `user_profiles`

新增一对一公开资料表：

- `user_id`。
- `avatar_media_id`：头像媒体引用，响应时生成受控的公开预览地址。
- `display_name`。
- `bio`。
- `location`。
- `website_url`。
- `instagram_url`。
- `weibo_url`。
- `profile_public`。
- `created_at`。
- `updated_at`。

邮箱、密码和平台状态不放入公开资料响应。

### `username_history`

记录改名后的旧地址：

- `user_id`。
- `username`。
- `normalized_username`。
- `created_at`。

旧用户名在保留期内跳转到新公开主页，避免分享链接立即失效。用户名修改必须单独执行频率限制。

### `workspaces` 扩展

增加个人空间所需字段：

- `kind`：`personal` 或 `collaborative`。
- `owner_user_id`：个人空间所有者；协作空间用于标识所有权。
- `is_public`：Workspace 层面的公开开关。
- `allow_member_showcase`：是否允许成员将该空间或相册加入个人公开主页。

个人 Workspace 的 `allow_member_showcase` 默认开启，协作 Workspace 默认关闭；协作空间的 owner/admin 可以显式开启。

现有 `primary` Workspace 保留，旧账号继续作为 `owner`。新用户的个人 Workspace 使用不可变内部 slug，公开地址由用户名路由解析，不把用户名直接作为 Workspace 主键。

### `memberships`

继续使用现有角色：

```text
owner | admin | editor | viewer
```

增加必要的时间和状态字段时保持现有唯一约束 `(workspace_id, user_id)`。

### `email_challenges`

统一保存邮箱验证、验证码和找回密码挑战：

- `id`。
- `user_id`。
- `purpose`：`verify_email`、`reset_password`、`change_email`。
- `token_hash`。
- `code_hash` 可空。
- `expires_at`。
- `attempts`。
- `consumed_at`。
- `created_at`。

链接和验证码分别校验，任意一种成功后使同一挑战失效。

### `refresh_tokens` 扩展

增加 `revoked_at` 和必要的设备元数据，支持退出当前设备、退出全部设备和改密后全量撤销。令牌本身仍只保存哈希。

### `workspace_invitations`

- `id`。
- `workspace_id`。
- `inviter_id`。
- `invitee_email` 可空。
- `invitee_username` 可空。
- `role`。
- `token_hash`。
- `expires_at`。
- `accepted_at`。
- `revoked_at`。
- `created_at`。

邮箱和用户名至少有一个目标字段。接受邀请时再次检查账号状态、目标用户和 Workspace 角色规则。

### `profile_publications`

记录用户明确授权展示的内容：

- `user_id`。
- `workspace_id`。
- `album_id` 可空。
- `sort_order`。
- `created_at`。

查询时必须同时满足：用户主页公开、Workspace 的 `allow_member_showcase` 已由 owner/admin 开启、照片已发布且未隐藏、用户具有有效展示授权。

### `platform_audit_logs`

现有 Workspace 审计日志继续记录导入、发布、权限和敏感元数据修改。新增独立的 `platform_audit_logs` 表，不要求绑定 Workspace，用于：

- `id`、`actor_id`、`action`、`entity_type`、`entity_id`。
- `before`、`after` 摘要 JSON。
- `request_id`、`created_at`。

- 封禁和解封账号。
- 处理注销和恢复。
- 平台管理员辅助找回。
- 修改平台角色。
- 处理异常登录和安全事件。

## 角色模型

Workspace 角色和平台角色分离。平台角色使用独立的 `platform_roles` 表，不把 `platform_admin` 混入 Workspace 枚举。

### Workspace 角色

| 能力 | Owner | Admin | Editor | Viewer |
|---|---:|---:|---:|---:|
| 查看空间内容 | 是 | 是 | 是 | 是 |
| 导入照片 | 是 | 是 | 是 | 否 |
| 编辑照片和相册 | 是 | 是 | 是 | 否 |
| 发布和隐藏照片 | 是 | 是 | 是 | 否 |
| 邀请和撤销成员 | 是 | 是 | 否 | 否 |
| 调整成员角色 | 是 | 是 | 否 | 否 |
| 删除 Workspace | 是 | 否 | 否 | 否 |
| 转移所有权 | 是 | 否 | 否 | 否 |

### `platform_roles`

新增独立平台角色表：

- `user_id`。
- `role`：当前仅支持 `platform_admin`。
- `created_at`。
- `updated_at`。

只有该表中的用户可以访问 `/platform/*` 接口。Workspace 成员角色永远不能自动获得平台权限。

### 平台总管理员

平台总管理员可以查看用户状态、封禁/解封账号、处理注销任务和审计日志，但默认不能查看私有原图、密码或完整令牌。所有支持操作必须写入平台审计日志。

## API 设计

所有接口继续位于 `/api/v1`，并通过共享 Zod Contracts 校验。

### 认证

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/logout-all
GET  /auth/me

POST /auth/email/verify
POST /auth/email/verify-code
POST /auth/email/resend

POST /auth/password/forgot
POST /auth/password/reset
POST /auth/password/change
```

登录请求支持 `{ identifier, password }`，`identifier` 可以是用户名或旧账号邮箱。

注册接口必须在一个事务中完成用户、资料、个人 Workspace、owner membership 和邮箱挑战创建。数据库唯一约束冲突统一转换为不泄露账号存在性的错误。

### 个人资料和公开主页

```text
GET   /me/profile
PATCH /me/profile
POST  /me/username/change
GET   /users/:username/profile
```

公开主页只返回用户主动公开的资料和精选内容，不返回邮箱、成员角色、草稿、隐藏照片和无授权协作内容。

### Workspace 和邀请

```text
GET    /workspaces
GET    /workspaces/:slug
POST   /workspaces/:slug/invitations
GET    /workspaces/:slug/invitations
POST   /invitations/:token/accept
POST   /invitations/:id/revoke
PATCH  /workspaces/:slug/members/:userId
DELETE /workspaces/:slug/members/:userId
```

服务端始终由 bearer token 解析用户，再检查 membership；不信任客户端提交的 `workspace_id`。

### 注销与导出

```text
POST /me/deletion-request
POST /me/deletion-cancel
POST /me/export
```

导出请求创建异步任务，客户端轮询任务状态；任务完成后返回短期签名下载地址，不直接暴露私有对象存储路径。

### 平台管理

```text
GET   /platform/users
PATCH /platform/users/:userId/status
GET   /platform/deletions
POST  /platform/deletions/:userId/restore
GET   /platform/audit
```

这些接口只允许平台总管理员访问，并使用独立的服务端 guard。

## 前端设计

### 路由

新增 canonical 路由：

```text
/auth/login
/auth/register
/auth/verify-email
/auth/forgot-password
/auth/reset-password

/account
/account/profile
/account/security
/account/workspaces
/account/imports
/account/photos
/account/albums
/account/members

/@:username
```

保留 `/admin` 作为兼容入口并重定向到 `/account`，后端 `/admin` API 路径不强制更名，以避免破坏已有客户端和测试。

### 个人中心导航

将 Studio 的可见文案、按钮、ARIA 标签、页面标题和入口统一改为“个人中心”。页面包含：

- 概览：照片、相册、公开主页和最近导入状态。
- 个人资料：头像、用户名、昵称、简介、所在地、社交链接和公开开关。
- 我的空间：个人空间和协作空间切换。
- 照片、相册、导入：复用现有管理功能并按当前 Workspace 隔离。
- 成员与邀请：仅对 owner/admin 显示。
- 安全设置：修改密码、验证邮箱、设备会话、退出全部设备和注销。

顶部导航规则：

- 未登录显示“登录”和“注册”。
- 已登录显示头像或昵称，点击进入个人中心。
- 登录成功后返回原始目标地址。
- 未验证邮箱仍可登录，但不能发布公开主页、邀请成员或执行高风险操作。

### 公开主页管理

资料页面提供精选内容管理：

- 开关个人主页公开状态。
- 添加或移除个人空间内容。
- 添加或移除允许展示的协作空间或相册。
- 调整排序。
- 预览 `n25.world/@用户名`。

## 邮件服务

后端定义 `EmailProvider` 接口，业务逻辑不绑定具体供应商：

- 开发/测试环境：记录脱敏的发送事件，测试可读取虚拟邮件。
- 生产环境：接入 SMTP、Resend 或等效服务。
- 邮件模板包含验证链接、备用验证码、找回密码、邀请和注销确认。
- 所有邮件发送操作记录 request ID，不记录完整令牌。

## 迁移方案

新增迁移：

```text
0005_multi_user_identity.sql
0006_user_profiles.sql
0007_email_challenges.sql
0008_workspace_invitations.sql
0009_profile_publications.sql
0010_platform_roles_and_audit.sql
```

迁移要求：

1. 为 `owner@n25.world` 补充用户名 `negative25`。
2. 保留旧密码和现有 `primary` Workspace。
3. 建立旧账号的初始资料记录。
4. 为已有用户和 Workspace 建立必要的默认关系。
5. 迁移脚本可重复执行，不产生重复记录。
6. 迁移前备份数据库，迁移后执行外键、唯一约束和照片数量一致性检查。

## 实施阶段

1. 扩展 Contracts、错误码、配置项和 API 文档。
2. 实现数据库迁移以及 MemoryRepository/PostgreSQL Repository。
3. 实现用户名登录、注册事务和旧账号兼容登录。
4. 实现邮箱链接、验证码、找回密码、改密和会话撤销。
5. 实现个人资料、用户名改名和公开主页 API。
6. 将 Studio 前端改为个人中心，增加资料和安全页面。
7. 实现 Workspace 邀请、接受邀请、撤销邀请和成员管理。
8. 实现精选公开空间/相册和公开主页预览。
9. 实现平台总管理员接口和内部页面。
10. 完成迁移、邮件配置、审计和部署文档。
11. 执行 API、Worker、E2E、视觉、跨租户和安全回归测试。

## 测试设计

### 单元测试

- 用户名规范化、保留词、长度和字符规则。
- 密码强度、二次确认和 Argon2id 验证。
- 邮箱挑战过期、错误次数、重复消费和重发。
- 注册事务回滚和唯一约束冲突。
- 用户名修改频率和旧地址跳转。
- 注销 30 天恢复和最终清理。
- Workspace 角色矩阵和 owner 保护。

### API/集成测试

- 注册自动创建个人 Workspace 和 owner membership。
- 重复用户名、邮箱和邀请返回正确错误码。
- 未验证邮箱限制高风险操作。
- 登录、刷新、退出、退出全部设备和改密后的令牌失效。
- 邀请已有用户和未注册用户。
- 邀请过期、撤销、重复接受和错误角色。
- 跨 Workspace 访问始终被拒绝。
- 个人主页只返回明确授权内容。
- 平台管理员与普通用户权限隔离。
- PostgreSQL 迁移可重复执行，MemoryRepository 与数据库行为一致。

### E2E 测试

- 注册、验证链接、验证码备用验证和登录。
- 登录后进入个人中心并保存资料。
- 公开主页开关、精选协作相册和预览。
- 邀请成员、接受邀请、切换 Workspace 和角色限制。
- 修改密码后旧会话失效。
- 注销、取消注销和导出入口。
- 平台管理员封禁、恢复和审计查看。

### 视觉测试

- 登录、注册、邮箱验证、找回密码页面。
- 个人中心桌面、平板和手机布局。
- 资料表单、头像、公开主页和精选内容编辑。
- Workspace 切换、邀请和成员列表。
- night、paper、mist 主题及中英文长文本。
- 长用户名、长邮箱、错误消息和空状态不溢出。

## 验收标准

- 新用户可以用自定义用户名和密码注册、登录。
- 注册时必须二次输入密码并校验一致。
- 邮箱验证支持链接和 6 位验证码。
- 新用户自动获得独立摄影空间和 owner 权限。
- 用户可以加入多个协作空间，并受角色矩阵限制。
- Studio 的可见名称和入口统一为个人中心。
- 用户可以维护基本资料、修改密码、退出设备和申请注销。
- 用户可以选择个人空间、协作空间或相册展示到公开主页。
- 所有照片、相册、导入和成员数据按 Workspace 隔离。
- 旧 `owner@n25.world` 账号、`negative25` 用户名和现有照片链接不受影响。
- 平台总管理员可以处理账号状态、注销任务和审计，但不能读取密码。
- Web 和未来 iPhone App 使用同一套版本化 API。
- 数据库迁移、邮件挑战、权限、跨租户和安全测试全部通过。

## iPhone App 兼容性

- 认证响应继续使用 access token、refresh token 和 `expiresIn`。
- 用户名、资料、Workspace、邀请和公开主页接口均为 JSON API。
- 所有公开主页和照片链接保持稳定，可映射到 Universal Links。
- 邮箱验证和找回密码通过 Web 链接完成，App 可通过 deep link 返回。
- 上传、导入、进度查询和照片管理不依赖浏览器 DOM，可由 SwiftUI 直接调用。
