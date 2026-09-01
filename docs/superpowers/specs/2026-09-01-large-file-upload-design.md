# negative25 大文件与批量照片上传设计

日期：2026-09-01

状态：已确认，待实现

## 1. 背景与目标

negative25 的正式照片文件保存在 S3 兼容对象存储中，PostgreSQL 只保存照片元数据和对象路径。当前上传链路是单对象、单次 PUT，并且正式环境生成的 URL 使用 Docker 内部主机名 `minio:9000`，浏览器无法访问。

本次升级目标：

- 支持几十 MB 到 TB 级对象的 Multipart 分片上传。
- 支持批量照片的并发控制、暂停、续传、失败分片重试和取消。
- 浏览器直接上传对象存储，不让照片二进制经过 API 服务器。
- MinIO 和 Cloudflare R2 共用同一套 S3 适配器，未来更换存储供应商不修改照片和用户数据。
- 保持现有 EXIF 解析、地点获取、Worker 变体生成、审核和发布流程。

非目标：

- 本次不改变照片、相册、用户和公开状态的数据模型。
- 本次不迁移现有对象，也不切换到 Cloudflare R2。

## 2. 总体架构

上传分为两条路径：

1. 小于 32MB 的文件使用单对象直传。
2. 32MB 及以上的文件使用 S3 Multipart Upload；批量任务沿用同一分片路径，并由前端限制并发。

两条路径都由 API 负责鉴权、工作区权限、对象 key 和元数据校验。照片二进制直接从浏览器传到对象存储。上传完成后，API 才创建导入批次，Worker 再从对象存储读取原图并生成 thumbnail、preview、large 等变体。

存储访问分为两个 endpoint：

- `S3_ENDPOINT`：API 和 Worker 在服务器内部使用，例如 `http://minio:9000`。
- `S3_PUBLIC_ENDPOINT`：API 生成浏览器预签名 URL 时使用，例如 `https://storage.n25.world`。

MinIO 通过独立对象存储域名和反向代理对外提供 S3 API，不向浏览器返回 `minio:9000`。R2 迁移后只替换 endpoint、Bucket、密钥和公网域名映射。

## 3. API 设计

现有单文件接口继续保留，用于兼容旧客户端；新增 Multipart 接口。

### 3.1 初始化

`POST /api/v1/media/multipart/initiate`

请求包含：`spaceSlug`、`filename`、`contentType`、`byteSize`，可选 SHA-256 校验和。

响应包含：

- `id`：negative25 上传会话 ID。
- `key`：对象存储 key，保持工作区前缀，例如 `workspaces/{workspaceId}/uploads/{id}/{filename}`。
- `storageUploadId`：S3 Multipart Upload ID，不直接作为前端路由 ID 使用。
- `partSize`：服务端根据文件大小计算的分片大小。
- `partCount`：总分片数。
- `expiresAt`：上传会话过期时间。

分片大小默认约 16MB；当文件过大时按 `ceil(byteSize / 9000)` 增大并按 8MB 对齐，保证总分片数不超过 S3 的 10,000 限制。最后一个分片可以小于默认大小。

### 3.2 签发分片 URL

`POST /api/v1/media/multipart/{id}/part-url`

请求包含 `partNumber`。API 校验会话属于当前工作区和用户、分片编号在合法范围内，然后使用公网 endpoint 签发短时 `UploadPart` URL。URL 不携带长期凭证，默认有效期 15 分钟。

### 3.3 查询已完成分片

`GET /api/v1/media/multipart/{id}/status`

API 从对象存储读取 Multipart 已上传分片，返回分片编号、大小和 ETag。前端据此跳过已经完成的分片，实现网络中断或页面重新选择同一文件后的续传。

### 3.4 完成与取消

`POST /api/v1/media/multipart/{id}/complete` 请求提交分片编号和 ETag 列表。API 校验分片顺序、数量、大小和会话元数据，然后调用 `CompleteMultipartUpload`，确认最终对象存在后将会话标记为 `completed`，返回 source key。

`POST /api/v1/media/multipart/{id}/abort` 只允许会话创建者或工作区管理员调用，调用 `AbortMultipartUpload` 并标记会话为 `aborted`。

所有接口都拒绝跨工作区 key、路径穿越、非法 MIME、非法扩展名和超出大小限制的请求。过期会话不能继续签发 URL。

## 4. 数据模型

新增 `media_uploads` 表记录可恢复上传会话，字段包括：

- `id`、`workspace_id`、`created_by`
- `storage_key`、`storage_upload_id`
- `filename`、`content_type`、`byte_size`、`checksum`
- `part_size`、`part_count`
- `status`：`initiated`、`completed`、`aborted`、`expired`
- `expires_at`、`completed_at`、`created_at`、`updated_at`

数据库不保存分片二进制，也不强制保存每个分片的 ETag；恢复时以对象存储的 `ListParts` 结果为准。现有 `photo_files.storage_key` 继续只保存最终对象及各图片变体的 key。

定期清理任务查找过期的 `initiated` 会话，先终止对象存储 Multipart，再更新数据库状态，避免遗留未完成分片占用空间。

## 5. 存储适配器

扩展现有 `S3StorageAdapter` 和 Worker 对象存储接口，增加：

- 创建 Multipart Upload
- 生成 UploadPart 预签名 URL
- 查询已上传分片
- 完成 Multipart Upload
- 取消 Multipart Upload

内部 S3 客户端继续使用 `S3_ENDPOINT`。预签名客户端使用 `S3_PUBLIC_ENDPOINT`，并保持相同的 Bucket、Region 和凭证。Memory 适配器增加等价实现，供 API 单元测试使用。

正式环境对象存储配置需要：

- 公网域名的 DNS 和 TLS
- MinIO/R2 CORS：只允许 `https://n25.world`
- 允许 `PUT`、`GET`、`HEAD`、必要的 OPTIONS
- 暴露响应头 `ETag`
- 原图私有访问，预览变体按现有公开策略访问

未配置公网 endpoint 时，大文件上传应明确返回配置错误，不应把内部 hostname 返回给浏览器。小文件可以保留 API 二进制上传作为受控回退，但不用于大文件。

## 6. 前端上传体验

`AdminImportsView` 的导入队列改为受控并发：默认同时处理 3 个文件，每个文件同时上传 4 个分片。每个文件展示等待、上传中、暂停、重试、完成和失败状态，以及进度和已上传大小。

上传流程：

1. 计算文件指纹所需的轻量信息，初始化上传会话。
2. 查询服务端已有分片。
3. 为缺失分片申请 URL并直接 PUT 到对象存储。
4. 记录响应 ETag；网络错误只重试对应分片，采用有限次数和退避。
5. 所有分片完成后提交 complete。
6. 所有文件完成后创建一个导入批次，进入现有预览、确认、发布流程。

活动上传会话和已完成分片摘要保存在 IndexedDB。页面刷新后浏览器无法自动恢复原始 `File` 对象，用户重新选择同一文件后，通过工作区、文件名、大小和指纹匹配会话并继续。暂停不会取消会话，取消才会清理对象存储分片。

## 7. 错误处理与安全

- 预签名 URL 只允许目标分片和固定 Content-Type，且短时过期。
- API 在初始化、签发、完成和取消的每一步重新校验工作区角色。
- ETag 缺失、分片大小不符、分片编号重复或最终对象大小不符时拒绝完成。
- 401/403 触发登录或权限提示；网络错误自动重试；不可恢复错误保留“重试”操作。
- 并发上传数量可配置，避免浏览器、MinIO 和网络连接耗尽。
- 未完成会话默认 24 小时过期；清理操作可重复执行。
- API 日志只记录会话 ID、key、大小和结果，不记录访问密钥。

## 8. 测试与上线验证

单元测试覆盖：分片大小计算、key 和权限校验、上传状态转换、ETag 校验、过期会话和 Memory 存储适配器。

API 集成测试覆盖：初始化、签发 URL、状态查询、完成、取消、跨工作区拒绝和大小/MIME 校验。前端测试覆盖：并发队列、暂停恢复、失败分片重试和刷新后重新选择文件恢复。

上线前使用 MinIO 测试桶验证：

1. 小文件单次上传。
2. 多分片照片上传。
3. 中断网络后继续上传。
4. 取消上传后确认没有残留 Multipart。
5. 完成后确认原图对象、数据库导入记录和 Worker 生成的变体。
6. 首页、相册、照片详情和公开访问回归检查。

部署时只重建 negative25 的 API、Worker 和 Web 容器，不停止服务器上的其他项目。保留旧单次上传接口，确认新客户端稳定后再移除内部 URL 回退逻辑。

