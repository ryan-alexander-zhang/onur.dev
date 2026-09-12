# Permanent Note publishing

这是独立的永久笔记发布流程。专用模型 ID 是
`permanentNote`；实现、模型设置和 QuickAdd 入口位于本目录，不加载博客发布代码。网站现有 `/cards` 页面读取该模型。

## Obsidian 中使用

安装后打开 `02-Zettelkasten/Permanent/` 下的一篇笔记，运行：

| QuickAdd 命令                      | 行为                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------- |
| Permanent Check Current + Linked   | 只读校验当前卡片及递归关联卡片，显示数量、标题和警告；不调用 Contentful |
| Permanent Preview Current + Linked | 同步整个关联集合到草稿，不发布、不刷新网站；已发布版本仍在线            |
| Permanent Publish Current + Linked | 更新并发布当前卡片及递归关联卡片，回写同步信息，刷新网站                |
| Permanent Publish All              | 更新并发布 Permanent 目录中的全部卡片，适合首次导入                     |

发布当前卡片会同步关联卡片的最新本地内容。检查命令会显示涉及的卡片。发布全部是显式命令，不在启动时执行。

## 笔记与模型

| 本地内容                        | Contentful 字段                                              |
| ------------------------------- | ------------------------------------------------------------ |
| `id`（14 位时间戳）             | `noteId`，唯一、稳定；Entry ID 为 `permanentNote_{id}`       |
| `title` 或首个 H1               | `title`                                                      |
| `english_title`                 | `titleEn`；缺失时警告，网站使用中文标题回退，不从 alias 猜译 |
| `tags`、`aliases`               | 同名字符串数组                                               |
| 中文正文                        | `bodyZh`（Markdown）                                         |
| `## English` 后的正文           | `bodyEn`（Markdown）                                         |
| `## 来源` / `## Sources` 后内容 | `sources`（Markdown）                                        |
| 中英文正文明确引用的永久笔记 ID | `linkedNoteIds`（去重、自引用除外）                          |

所有字段写入命令配置中的同一个 locale（默认
`en-US`）。两种语言使用不同字段；保留远端其他 locale。模板不要求手填 Contentful ID、SEO 或 slug。成功同步通过 Obsidian
`processFrontMatter` 回写状态；保留正文、原始 `id`、`created`，不手动改 `updated`。

## 链接、顺序和失败

支持
`[[完整文件名|显示文字]]`、唯一 alias、内联 Markdown 链接和引用式链接；目标通过 Obsidian 路径解析与当前磁盘笔记索引确认，转换为
`/cards/{id}`。已转换的卡片链接也检查本地目标并纳入依赖。代码块、行内代码、注释、普通文本和外部链接不产生卡片边。

正文中缺失或非 Permanent 的目标阻止发布；本地文献来源转为可读文字并提示，不上传 Literature 或参考资料。来源中的永久笔记也纳入发布依赖，但不产生图谱边。本地图片和嵌入需要先上传为 HTTPS 图片；远程 Markdown 图片保持不变。Obsidian 标题/块锚点转为整张卡片链接并提示，因为网站未实现这些锚点。

先读取 Permanent 目录原文，校验类型、ID、重复 ID，再收集关联集合。读取整目录保证全局 ID 唯一，只有被选中的关联集合写入远端。先检查模型、locale 和全部远端身份，再写入所有草稿，最后依依赖顺序发布，当前卡片最后。循环引用通过访问集合去重；`linkedNoteIds`
使用稳定 ID 数组，因此不依赖 Contentful Entry 引用解析。

跨卡片发布不具备原子性。环中卡片按顺序发布，期间可能暂时有目标尚未上线；失败时明确报告已同步和已发布数量，并刷新成功发布的部分。重跑可继续完成，不重复创建记录。已发布且内容未变的条目跳过远端修改。HTTP
429 有限重试；版本冲突停止并提示重跑，不盲目覆盖并发编辑。网页刷新失败单独报告，不把已发布内容误报为未发布。

## 开发与安装

```sh
node scripts/permanent-notes/generate.cjs
node scripts/permanent-notes/generate.cjs --check
node --test scripts/permanent-notes/tests/*.test.cjs
node scripts/permanent-notes/check-vault.cjs /Users/erpang/GitHubProjects/zettelkasten
node scripts/permanent-notes/setup.cjs
node scripts/permanent-notes/install.cjs /Users/erpang/GitHubProjects/zettelkasten
```

`setup.cjs` 默认仅输出 [schema.json](schema.json)，加 `--apply` 才创建/更新并激活
`permanentNote`，不会操作其他模型或发布笔记。需要环境变量 `CONTENTFUL_SPACE_ID`、`CONTENTFUL_MANAGEMENT_TOKEN`，可选
`CONTENTFUL_ENVIRONMENT_ID`、`CONTENTFUL_LOCALE`。遇到现有模型未知字段或字段类型不兼容时停止，保留数据。

`install.cjs` 默认只显示将修改的文件，加 `--apply`
安装四个自包含脚本、模板及 QuickAdd 命令，并备份被覆盖文件。只复用旧命令的连接设置；脚本实现和发布命令独立。安装后运行
`obsidian plugin:reload id=quickadd`。同步密钥仅留在本机配置或 `env:VARIABLE_NAME` 中，不写入仓库。

可选网站刷新设置：`revalidateUrl`（HTTPS `/api/revalidate`）与 `revalidateSecret` 一起配置。发布后发送
`contentTypeId: permanentNote`，网站刷新卡片列表、详情布局和 sitemap。

API 依据：[QuickAdd 脚本设置](https://quickadd.obsidian.guide/docs/Advanced/scriptsWithSettings/)、[Contentful 管理 API 版本与限流](https://www.contentful.com/developers/docs/references/content-management-api/overview/)、[发布 Entry](https://www.contentful.com/developers/docs/references/content-management-api/entries/publish-an-entry/)。
