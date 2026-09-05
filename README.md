# AI Radar — AI 资讯聚合平台

面向个人使用的 AI 资讯、论文、模型与产品聚合网站。默认仅监听本机，SQLite 保存数据，没有多用户账户系统。

## 功能

- 首页展示当天最新五条资讯，按浏览器时区统计；当天无内容时可以查看最近资讯。
- 资讯流支持搜索、分类、来源、收藏组合筛选和分页，筛选状态保存在 URL 中，详情返回时恢复位置。
- 全站搜索覆盖资讯、论文、模型和产品；各目录支持搜索、分页及错误重试。
- arXiv 论文独立抓取，模型从 OpenRouter 同步目录与价格，保留来源链接和更新时间。
- AI 总结是可选功能，基于已收录摘要生成，提供来源编号、缓存和请求频率限制。
- 支持系统主题、手动暗色切换、移动端导航和键盘操作。

## 快速开始

需要 Node.js 22.13+（推荐 Node.js 24 LTS）和 npm 10+。不支持 Edge Runtime；需要可持久化的本机磁盘。

```bash
npm ci
npm run seed
npm run dev
```

打开 [本机网站](http://127.0.0.1:3000)。Windows 也可运行 `start.bat`。

首次打开数据库会补齐默认来源。`seed` 幂等更新产品目录，不重置收藏、阅读状态、来源开关或在线模型；不再写入没有来源的模型价格和跑分。既有历史条目保留并标注待核验。

## 环境配置

复制 `.env.example` 为 `.env.local`。Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
```

| 环境变量           | 用途                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| `CRON_SECRET`      | 管理密钥，生产环境写操作必须配置；浏览器手动操作时按需输入，仅用于本次请求 |
| `DEEPSEEK_API_KEY` | 可选，启用 AI 总结；未配置时资讯与目录照常工作                             |
| `DEEPSEEK_MODEL`   | 可选，默认 `deepseek-chat`                                                 |
| `AI_RADAR_DB_PATH` | 可选，数据库路径；默认 `data/ai-news.db`，测试使用独立数据库               |

开发环境未配置管理密钥时，只放行本机非跨站写请求。配置后所有写接口都必须校验密钥，同源标头不能绕过。API Key 不放进 `NEXT_PUBLIC_*`、客户端包或浏览器持久存储。

这是单用户应用，收藏与阅读状态在实例内共享。需要多人公开使用时，应先接入账户、会话和按用户隔离的数据模型。

## 更新资讯

- **刷新列表**：只读取数据库，不访问外部来源。
- **自动刷新**：每十分钟更新可见页面的列表，可关闭，偏好保存在浏览器。
- **抓取最新**：用户主动触发 RSS、网页、社区、论文及模型抓取。
- **抓取 arXiv**：只更新论文，不触发其他来源。
- **后台抓取**：运行 `npm run crawl`，或由外部调度器 POST `/api/cron`。浏览器关闭后不会定时抓取。

```bash
npm run crawl
```

外部调用携带 `x-api-key: <CRON_SECRET>` 或 `Authorization: Bearer <CRON_SECRET>`，可发送 JSON `{"scope":"papers"}` 只抓取论文。GET `/api/cron` 不执行写入。

抓取采用数据库租约锁，防止多个标签页、API 实例或命令行重复执行；任务完成后有 60 秒冷却。每个来源单独记录成功时间与失败原因。返回 `count` 是处理量，包含已有内容更新，不代表净新增数。连续失败来源会在资讯流中显示。

默认来源包括量子位、36氪、TechCrunch、VentureBeat、MIT Technology Review、RSSHub、Hacker News、GitHub Trending、arXiv 和 OpenRouter。无稳定解析方式的默认来源保持禁用。外部网站可能限流或调整接口，具体状态以抓取结果为准。

## 数据可信度

模型价格以 OpenRouter 来源页为准，保留原始精度，区分零价格和未知价格。API 未提供许可证时显示“未核验”，不按厂商推断开源。“收录时间”指聚合目录时间，不冒充厂商发布时间。

旧模型条目、产品套餐及所用模型属于历史目录资料，页面明确标注；未核验跑分不作为当前性能结论展示。AI 总结使用存储的标题和摘要，不下载全文，不接受客户端提交的任意 URL。

## 验证与维护

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
npm audit
```

首次运行浏览器测试可用 `npx playwright install chromium` 安装浏览器，或指定已安装的 Chrome：

```powershell
$env:PLAYWRIGHT_CHROME_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

E2E 测试使用 3100 端口、独立 `.e2e-work` 数据库和测试密钥，不修改 `data/ai-news.db`，也不调用付费 AI 服务。测试前需完成生产构建。

`npm run build` 后使用 `npm start` 启动生产版。生产写操作必须设置 `CRON_SECRET`。默认只监听 `127.0.0.1`；需要反向代理时由部署环境配置监听地址、HTTPS 和访问控制。

清理脚本默认只预览：`npx tsx scripts/cleanup.ts`。确认后传 `--apply` 才删除候选文章，并保护已读及收藏。修改或迁移数据前应备份数据库；运行中的 SQLite 应使用备份 API，或停止服务后同时保存数据库及 WAL 文件。

## 架构

```text
公开 RSS / API / 网页 → lib/crawler → SQLite → app/api → React 页面
```

- Next.js App Router + React + TypeScript
- SQLite / better-sqlite3，WAL、索引与幂等迁移
- Tailwind CSS + Base UI 组件，状态样式在本地维护
- RSS Parser + Cheerio XML/HTML 解析
- Node test runner + Playwright

全文索引随写入同步，一次性迁移时重建。当前中英文搜索使用转义后的 LIKE，列表和计数共用筛选逻辑。大数据量时可进一步引入中文分词与全文检索。

## 许可与内容来源

代码许可按仓库 [LICENSE](LICENSE) 中的 AGPL-3.0 原文执行。README 不另外附加“禁止商业使用”限制。网络服务及修改分发的具体义务以许可证原文为准。

新闻、论文和产品内容的权利归各来源；代码许可证不代替对第三方内容的授权。本站提供标题、摘要与原文链接，不再宣称获得了数据源的特定使用许可。

本次检查的修改和验证结果见 [项目审查报告](AUDIT_REPORT.md)。贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。
