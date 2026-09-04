# negative25 手机版适配实施计划

## 1. 建立移动端验证基线

- 启动 `apps/web` 开发服务器，确认本地首页、发现页和账户路由可访问。
- 使用 Playwright 在 `390x844`、`430x932`、`768x1024` 截取首页、发现、照片详情、相册、公开主页、认证和后台页面。
- 记录横向滚动、遮挡、异常留白、图片尺寸和浮层位置，作为后续修复对照。

## 2. 全局与公共组件

涉及：`base.css`、`App.vue`、`AppHeader.vue`、`CategoryNav.vue`、`ViewSelector.vue`、`ThemeSwitcher.vue`、`LanguageSwitcher.vue`。

- 统一手机端页面边距、动态视口高度和 `env(safe-area-inset-*)` 回退值。
- 检查导航 flex 子项的 `min-width: 0`、横向滚动边界和搜索结果浮层宽度。
- 为底部视图切换器预留内容空间，确保地图页和长列表页不被覆盖。
- 将关键图标按钮和输入控件的触控区域统一到约 `40px`，不改变桌面端尺寸。

## 3. 公共照片展示与图库

涉及：`GalleryView.vue`、`PhotoGrid.vue`、`PhotoCard.vue`、`PhotoMeta.vue`、`PhotoViewer.vue`、`PhotoDetailPanel.vue`、`AlbumStacks.vue`、`AlbumsView.vue`、`AlbumView.vue`。

- 在手机断点下采用稳定的两列图片网格和自适应比例，避免固定宽度造成空白或溢出。
- 调整精选、最近、随机和影册的卡片尺寸、占位和展开行布局，保持现有排序与随机逻辑。
- 缩小照片查看器图片的可用高度，处理标题、关闭、三点按钮和安全区之间的间距。
- 将参数浮层限制在可用宽度内，允许长相机型号合理截断或换行，评级和操作不溢出。
- 确认照片关闭及浏览器返回继续保持滚动位置和筛选上下文。

## 4. 发现地图

涉及：`DiscoverView.vue`、`DiscoverMap.vue`、`DiscoverPlacePanel.vue`、`DiscoverPlaceDetail.vue`、`DiscoverCircleResults.vue`。

- 统一地图容器使用 `100svh` 兜底和动态高度，隐藏页面级横向滚动。
- 调整手机底部抽屉的收起高度、展开高度、内部滚动和安全区底部间距。
- 调整地图控制按钮和地点照片卡片的触控尺寸，确保抽屉打开时仍能操作地图。
- 验证选定地区在关闭照片或重新打开地图后保持，不在未确认时刷新图片。

## 5. 公开主页、认证与账户

涉及：`PublicProfileView.vue`、`AuthRegisterView.vue`、`AdminLoginView.vue`、`AdminLayout.vue`、`AdminDashboardView.vue`、`AdminProfileView.vue`、`AdminSettingsView.vue`。

- 将公开主页栅格、头像、标题和链接调整为手机单列/两列自适应布局。
- 将登录注册表单改为单列全宽输入和可换行错误提示。
- 将账户侧栏导航改为横向滚动，内容和按钮按单列布局，兼容底部安全区。

## 6. 后台照片、导入与相册管理

涉及：`AdminPhotosView.vue`、`AdminImportsView.vue`、`AdminAlbumsView.vue`、`AdminLocationPicker.vue`、`ImportDropzone.vue`。

- 将后台筛选器改为单列堆叠，批量操作栏允许换行且不遮挡列表。
- 将照片管理表格在窄屏重排为缩略图、核心信息、状态和操作，保留多选、定位、复制、删除和放大预览。
- 调整导入预览、批次历史、位置选择和相册编辑表单的宽度、间距与按钮布局。
- 检查拖拽导入在触屏设备上的文件选择入口仍然可见。

## 7. 自动化回归测试

- 新增或扩展 Playwright 测试，覆盖目标视口下首页、发现页和照片详情的可见性、无横向滚动和关键点击流程。
- 对地区选择增加“打开选项 → 未确认不刷新 → 确认后更新”的移动端回归检查。
- 对查看器增加“打开 → 关闭 → 保持滚动位置”的移动端回归检查。
- 使用现有测试夹具和 API mock，不引入新的生产依赖。

## 8. 验证与交付

- 运行 `pnpm --filter @negative25/web test`、`pnpm --filter @negative25/web typecheck`、根目录 `pnpm test:e2e`、`pnpm build`。
- 对修复后的页面重新截取三个目标视口，确认无横向滚动、遮挡和异常留白。
- 汇总变更和测试结果，保持本地修改；只有收到明确部署指令后才更新服务器。
