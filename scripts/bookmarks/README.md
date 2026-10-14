# Bookmarks Base → Contentful

`Bookmarks.base` 的「网站」视图选中笔记；发布器通过 Obsidian
CLI 查询文件路径，再读取笔记原文，导出一份版本化 JSON。Contentful 仅保存一个 `bookmarkCatalog`
Entry（`bookmarkCatalog_main`），不会为各书签创建 Entry。

## 使用

- `Bookmarks Check Base`：只读查询和校验，不访问 Contentful。
- `Bookmarks Preview Base`：完整快照写入草稿，已有线上版本保留。
- `Bookmarks Publish Base`：发布整个快照并刷新网站缓存。

笔记必须位于 `06-Resources/Web/Bookmarks/`，`type: bookmark`。默认网站视图排除 `retired`
和非 HTTP(S) 链接。Inbox 不进入快照。不要给发布视图设置截断记录的 limit；如果筛选移除了书签，下一次发布也会将它从网站移除。空结果会阻止覆盖，避免误清空整个网站。

发布字段：`id`、`title`（缺失取 H1）、`source`、`description`、`cover`、`bookmark_group`、`bookmark_kind`、`tags`、`created`。缺少 description 时读取「内容摘要」作为兼容回退。其他正文、个人备注、关联笔记及本地文件路径不会上传。UTC 偏移未标注的日期按 vault 的 Asia/Shanghai 时间解释。

`cover` 可以使用公开 HTTP(S) 图片 URL，或 `99-Meta/Attachments/` 下的图片路径 /
wikilink。本地图片按内容哈希去重上传 Contentful
Assets，导出为 URL；为了让草稿快照可以显示图片，Preview 也会发布这些图片 Assets，但不会发布目录 Entry。远程封面保留 URL，失效时网站回退
`/assets/fallback.avif`。

Base 查询决定条目顺序，网站保留同组条目的查询顺序；分类导航按名称排序。网站支持 Base 导出的分组和条目，不实现完整的 Bases 公式或布局引擎。修改 Base 的外观不会自动改变网站 CSS。

JSON 使用固定 `version: 1`，发布前校验 URL、身份、目录边界、字段及 Contentful 请求体大小（预留余量限制为 900,000
bytes）。URL 规范化去重会报告被省略项；重复 ID、分组 slug 冲突、缺失字段、源文件在同步期间变化会中止。版本冲突不强行覆盖，重跑可重试；无变化的快照跳过远端更新。没有逐条笔记的 Contentful 同步字段。

## 安装与验证

```sh
node scripts/bookmarks/generate.cjs
node --test scripts/bookmarks/tests/*.test.cjs tests/bookmarks-data.test.mjs
node scripts/bookmarks/setup.cjs                    # 仅查看模型
node --env-file=.env.local scripts/bookmarks/setup.cjs --apply
node scripts/bookmarks/install.cjs /absolute/vault/path --apply
```

安装器备份并更新 QuickAdd 配置、书签模板和现有 Base；保留已有视图，增加 description /
cover 列和「网站」卡片视图。连接配置沿用已有 Permanent 发布命令。安装后需重新加载 QuickAdd。Obsidian
CLI 必须已启用，桌面应用正在运行；本机执行 `/usr/local/bin/obsidian` 时按 vault 约定提权。

发布设置包含
`spaceId`、`environmentId`、`managementToken`、`locale`、`revalidateUrl`、`revalidateSecret`。沿用权限为 600 的
`~/.config/obsidian/quickadd-credentials.json`，支持 `file:JSON_KEY` 及
`env:VARIABLE_NAME`，凭据不写入代码。CLI 以当前 vault 的唯一 ID 定位并校验路径，避免同名 vault 误选。网站通过既有
`/api/draft?secret=…&slug=/bookmarks/ai` 预览草稿，通过 `/api/disable-draft?secret=…` 退出。

首次切换：配置 Contentful 模型 → Preview 检查 →
Publish 快照 → 部署网站代码。当前运行的网站在部署前仍读取 Raindrop。投稿表单仍写入 Airtable。

实现依据：[Obsidian CLI](https://help.obsidian.md/cli)、[Bases](https://help.obsidian.md/bases)、[Contentful 技术限制](https://www.contentful.com/developers/docs/platform/technical-limits/)。
