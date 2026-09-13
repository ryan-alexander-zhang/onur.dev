# Journal → Journey

独立模型 `journalEntry`、独立 QuickAdd 脚本，发布源是 `05-Areas/Journal/Entries/` 中 `type: journal`
的笔记。Journey 使用 timDeHof/shadcn-timeline 的原版组件源码，按日期倒序、按年份分组显示。

## 发布范围

**只上传 `## Log`、`## Thoughts`、`## Review`。**
Review 包含其下三级及更深的标题。其他正文分区、标题前后未归属内容、Knowledge to
Develop、Inbox 和 Reviews 目录不会上传。YAML 仅同步稳定 ID、标题、日期、tags。代码块中的标题是代码，不是分区边界。

HTML / Obsidian 注释、模板 `Writing prompt`
提示、空列表和空子标题过滤。三个分区都为空时跳过，不创建 Entry。若旧笔记已经发布，清空三个分区后跳过意味着线上旧内容仍在；需要下架时在 Contentful 明确取消发布。部分分区清空、其他分区仍有正文时，重新发布会清空对应的远端字段。

## 命令

| QuickAdd                | 行为                                                |
| ----------------------- | --------------------------------------------------- |
| Journal Check Current   | 只读解析当前笔记，显示是否可发布；不访问 Contentful |
| Journal Preview Current | 同步当前笔记的草稿，线上仍保留旧版本                |
| Journal Publish Current | 更新并发布当前笔记，刷新 Journey                    |
| Journal Publish All     | 发布 Entries 目录中所有非空笔记，跳过空条目         |

修改正文、标题、date、tags 后重新运行 Publish 即可。Entry ID 固定为
`journalEntry_{id}`，改文件名不会创建副本。无变化且已发布的条目跳过远端修改。保留原始 `id` / `created`，不手写
`updated`；同步信息通过 Obsidian `processFrontMatter` 回写。

正文中指向 Permanent 的 wiki / 内联 Markdown 链接转为
`/cards/{id}`，写入前检查目标是否已发布。未发布则停止，提示先用 Permanent 命令发布；Journal 不会自动发布关联卡片的本地修改。其他本地链接降为可读文字并警告。外部链接、远程图片和代码保留。本地图片/嵌入需先上传；本地引用式链接需改成内联链接。Obsidian 标题、块锚点转为整张卡片链接并提示。

## 模型

| 笔记                        | Contentful                    |
| --------------------------- | ----------------------------- |
| `id`                        | `noteId`，唯一 14 位时间戳    |
| `title` / H1 / 文件名       | `title`                       |
| `date`（实际记录日期）      | `date`，不使用上传日期排序    |
| `tags`                      | `tags` 字符串数组，覆盖更新   |
| 三个允许分区的 Markdown     | `log` / `thoughts` / `review` |
| 发布正文中的 Permanent 链接 | `linkedNoteIds`               |

模型使用单一默认 locale（通常 `en-US`）；日期作为 UTC 日历日期处理，避免时区导致日期错一天。完整定义见
[schema.json](schema.json)。不复用博客的 `logbook` 模型。Journey 只读取新的 Journal 记录；旧模型与条目保留。

## 开发及安装

在网站仓库根目录执行：

```sh
node scripts/journal/generate.cjs
node scripts/journal/generate.cjs --check
node --test scripts/journal/tests/*.test.cjs tests/journal-data.test.mjs
node scripts/journal/check-vault.cjs /Users/erpang/GitHubProjects/zettelkasten
node scripts/journal/setup.cjs
node scripts/journal/install.cjs /Users/erpang/GitHubProjects/zettelkasten
```

`setup.cjs` 默认只显示模型，`--apply` 才创建/更新并激活 `journalEntry`，不发布笔记。使用
`CONTENTFUL_SPACE_ID`、`CONTENTFUL_MANAGEMENT_TOKEN`，可选 `CONTENTFUL_ENVIRONMENT_ID` 和
`CONTENTFUL_LOCALE`。遇到不兼容模型停止，不删除字段。

`install.cjs` 默认预览，`--apply` 安装独立脚本、Journal
Entry 模板和四个命令；复用已有发布器的连接设置，备份被替换的本地文件。安装后执行 `obsidian plugin:reload id=quickadd`。

配置 `revalidateUrl` 与 `revalidateSecret` 后，发布会发送 `contentTypeId: journalEntry`
刷新 Journey 缓存。网站需要先部署本分支才能识别新的刷新类型。刷新失败单独报告，发布成功的内容不会回滚。批量发布部分失败时报告进度，重跑即可继续。

界面验证：`npx playwright test -c tests/journal-ui.config.cjs`。使用本地测试数据和模拟 Contentful 响应，不向线上发布测试笔记。

参考：[Timeline 来源及修改记录](../../src/components/timeline/README.md)、[Contentful Entries API](https://www.contentful.com/developers/docs/references/content-management-api/entries/)。
