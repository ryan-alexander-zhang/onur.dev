# Obsidian + Contentful

这个目录补齐了两部分：

- `templates/`
  - 给 QuickAdd `Capture` 用的模板
- `quickadd/`
  - 给 QuickAdd `User Script` 用的 Contentful 同步脚本

## 目录

- `templates/writing.md`
  - 对应 Contentful `post`
- `templates/journal.md`
  - 对应 Contentful `logbook`
- `templates/page.md`
  - 对应 Contentful `page`
- `quickadd/contentful-sync-preview-current-note.js`
  - 把当前笔记同步到 Contentful Draft / Preview
- `quickadd/contentful-publish-current-note.js`
  - 把当前笔记同步并正式 Publish
- `quickadd/contentful-sync-lib.js`
  - 两个脚本共享的底层实现

## 1. 用模板创建笔记

这些模板使用的是 QuickAdd `Capture` 占位符，不是 Obsidian Core Templates 语法。

推荐在 QuickAdd 里创建 3 个 `Capture` Choice：

1. `New Writing`
2. `New Journal`
3. `New Page`

推荐配置：

| Choice        | Template Path                           | 建议文件名                            |
| ------------- | --------------------------------------- | ------------------------------------- |
| `New Writing` | `scripts/obsidian/templates/writing.md` | `{{VALUE:slug}}`                      |
| `New Journal` | `scripts/obsidian/templates/journal.md` | `{{DATE:YYYY-MM-DD}}-{{VALUE:title}}` |
| `New Page`    | `scripts/obsidian/templates/page.md`    | `{{VALUE:slug}}`                      |

建议目录：

- Writing: `Writing/`
- Journal: `Journal/{{DATE:YYYY}}/`
- Page: `Pages/`

## 2. 用 QuickAdd 发布到 Contentful

创建两个 `Macro` Choice：

1. `Contentful Preview Current Note`
2. `Contentful Publish Current Note`

分别挂载：

- `scripts/obsidian/quickadd/contentful-sync-preview-current-note.js`
- `scripts/obsidian/quickadd/contentful-publish-current-note.js`

注意：

- QuickAdd 这里要直接选上面两个单文件脚本，不要自己改成引用别的共享库
- 如果你之前已经把旧版脚本挂到 Choice 上，脚本报错后 QuickAdd 可能会缓存失败状态
- 这种情况下，最稳妥的做法是删除原来的 Choice，再新建一次并重新选择脚本文件

### 脚本参数

| 参数                | 必填 | 说明                                 |
| ------------------- | ---- | ------------------------------------ |
| `CMA Base URL`      | 否   | 默认 `https://api.contentful.com`    |
| `Upload Base URL`   | 否   | 默认 `https://upload.contentful.com` |
| `Space ID`          | 是   | Contentful Space ID                  |
| `Environment ID`    | 是   | 默认 `master`                        |
| `Management Token`  | 是   | Contentful Management Token          |
| `Locale`            | 否   | 默认 `en-US`                         |
| `Revalidate URL`    | 否   | 站点的 `/api/revalidate` 地址        |
| `Revalidate Secret` | 否   | 请求头 `x-revalidate-secret`         |
| `Show Notice`       | 否   | 是否显示执行结果                     |

如果 `Revalidate URL` 和 `Revalidate Secret` 都配置了，正式发布后会顺带调用站点的按需刷新接口。

如果 `Revalidate URL` 指向本地地址，例如
`http://localhost:3000/api/revalidate`，那发布时需要对应站点正在运行；否则会出现 revalidation 的网络错误。

这些文本参数支持两种来源：

- 直接填值
- 填 `env:ENV_KEY`

例如：

- `Management Token` 填 `env:CONTENTFUL_MANAGEMENT_TOKEN`
- `Space ID` 填 `env:CONTENTFUL_SPACE_ID`
- `Revalidate Secret` 填 `env:NEXT_REVALIDATE_SECRET`

另外，即使字段留空，脚本也会尝试读取这些默认环境变量：

- `CONTENTFUL_CMA_BASE_URL`
- `CONTENTFUL_UPLOAD_BASE_URL`
- `CONTENTFUL_SPACE_ID`
- `CONTENTFUL_ENVIRONMENT_ID`
- `CONTENTFUL_MANAGEMENT_TOKEN`
- `NEXT_REVALIDATE_URL`
- `NEXT_REVALIDATE_SECRET`

注意：

- 这依赖 `process.env`，只在 Obsidian Desktop 有意义
- 如果你在 macOS 上是从 Finder / Dock 启动 Obsidian，GUI 进程通常拿不到你 shell 里的 `~/.zshrc` / `~/.zprofile` 环境变量
- 更稳的做法是从 terminal 启动 Obsidian，或者用 `launchctl setenv KEY value` 给 GUI 进程注入环境变量

### 常见 401 排查

如果你看到 `Contentful API error 401: Access token invalid`，优先检查这几项：

- `Management Token` 必须是 `CONTENTFUL_MANAGEMENT_TOKEN`
- 不要把 `CONTENTFUL_ACCESS_TOKEN` 或 `CONTENTFUL_PREVIEW_ACCESS_TOKEN` 填到 QuickAdd 的 `Management Token`
- 推荐把 `Management Token` 填成 `env:CONTENTFUL_MANAGEMENT_TOKEN`
- 新版脚本也兼容 `$CONTENTFUL_MANAGEMENT_TOKEN` 和 `${CONTENTFUL_MANAGEMENT_TOKEN}`
- 如果你填的是环境变量名，但 Obsidian 进程里没有这个变量，脚本会直接报环境变量未设置
- `.env` 文件本身不会被 Obsidian 自动读取；脚本读的是 Obsidian 进程里的 `process.env`

## 3. Frontmatter 约定

### Writing / Post

```yaml
---
contentful_content_type: post
title: My Post
slug: my-post
date: 2026-06-09
seo_title: My Post
seo_description: Short summary
seo_og_image_title: My Post
seo_og_image_subtitle: Optional subtitle
seo_keywords:
  - contentful
  - obsidian
contentful_entry_id: ''
contentful_seo_entry_id: ''
contentful_locale: en-US
---
```

`slug` 必须是小写 kebab-case ASCII，例如 `my-post-title`。标题可以是中文，但不要把纯中文直接填进 `slug`。

### Journal / Logbook

```yaml
---
contentful_content_type: logbook
title: Settled in Shanghai
date: 2026-06-09
description: Short journey card description
images: []
contentful_entry_id: ''
contentful_locale: en-US
---
```

### Page

```yaml
---
contentful_content_type: page
title: Stack
slug: stack
hasCustomPage: false
seo_title: Stack
seo_description: Tooling and setup
seo_og_image_title: Stack
seo_og_image_subtitle: Optional subtitle
seo_keywords:
  - stack
contentful_entry_id: ''
contentful_seo_entry_id: ''
contentful_locale: en-US
---
```

## 4. 脚本支持的内容

### Writing / Page

支持：

- 段落
- `##` / `###` 标题
- 引用
- 有序/无序列表
- 分隔线
- 行内 `bold` / `italic` / `code`
- Markdown 链接
- Markdown 表格
- fenced code block
- Markdown 图片
- Obsidian 图片 `![[image.png]]`

脚本会自动：

- 创建或更新 `seo` entry
- 创建或更新正文里的 `codeBlock`
- 上传正文里的本地图片或远程图片
- 正式发布时一并 publish 关联 entry / asset
- 回写 `contentful_entry_id`、`contentful_seo_entry_id`、最后同步时间

补充说明：

- 正文里的本地图片会继续上传到 Contentful Asset
- 正文里的远程 Markdown 图片会保留原始 URL，不再导入为 Contentful Asset
- `journal/logbook` 的 `images` 字段和 `contentful-carousel` 里的图片仍然会同步成 Contentful Asset

### Journal / Logbook

脚本会同步：

- `title`
- `date`
- `description`
- `images`

其中图片来源有两种：

- frontmatter 的 `images`
- 正文里单独占一行的图片

## 5. 可选 directive

为了对齐 repo 里的其他 Contentful 类型，正文还支持这几种单行指令：

### Tweet

```text
{{contentful-tweet id="1900000000000000000"}}
```

### Embed

```text
{{contentful-embed type="Video" url="https://www.youtube.com/embed/VIDEO_ID" title="Demo"}}
{{contentful-embed type="SoundCloud" url="https://w.soundcloud.com/player/..." title="Track"}}
```

### Carousel

```text
{{contentful-carousel title="Desk Setup" images="assets/desk-1.jpg|assets/desk-2.jpg"}}
```

`images` 里可以混用 vault 相对路径和远程 URL。

## 6. 注意点

- `contentful_content_type` 必须是 `post`、`page`、`logbook`，也兼容别名 `writing`、`journal`、`journey`
- `title` 必填
- `slug` 对 `post` / `page` 会自动按 kebab-case 兜底生成
- 如果正文第一行是和 `title` 一样的 `# Heading`，脚本会自动剥掉，避免页面标题重复
- 当前脚本没有做“删除 Contentful 中旧的嵌入资源”这一步，所以大改结构后可能会留下未引用的旧嵌入 entry / asset
- 如果你已经手工建过 Contentful entry，建议把 `contentful_entry_id` 填回笔记，避免第一次同步时生成新的 entry

## 7. 推荐工作流

1. 用 `Capture` 创建 `writing` / `journal` / `page`
2. 在笔记里继续写正文，按需插入图片、代码块、directive
3. 先执行 `Contentful Preview Current Note`
4. 在 Contentful 里确认 Draft 内容正常
5. 再执行 `Contentful Publish Current Note`
