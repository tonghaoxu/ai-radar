# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 项目概述

AI Radar — 个人使用的AI资讯聚合平台。本地运行，SQLite存储，无用户系统。

## 常用命令

```bash
npm run dev           # 启动开发服务器 (localhost:3000, Turbopack)
npm run build         # 生产构建
npm run seed          # 初始化/重置种子数据（数据源、模型、产品）
npm run seed:products # 仅重置产品种子数据
npm run crawl         # 命令行手动触发抓取
npm run lint          # ESLint
```

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack HMR)
- **数据库**: SQLite via `better-sqlite3`，文件位于 `data/ai-news.db`
- **样式**: TailwindCSS 4 + shadcn/ui
- **爬虫**: `rss-parser` (RSS) + 手写 XML 解析 (arXiv) + `fetch` (HackerNews API, GitHub Trending, 网页抓取)
- **暗色模式**: `next-themes`
- **图表**: recharts (模型追踪页)

## 架构

### 数据层 (`lib/db.ts`)

SQLite 单例，WAL模式。7张核心表 + 2张FTS5虚拟表：

| 表 | 用途 | 关键字段 |
|---|------|---------|
| `sources` | 数据源配置 | `rss_url`, `last_crawled_at`, `fail_count`, `last_error` |
| `articles` | 聚合文章（统一信息流） | `url` UNIQUE, `category`, `is_starred` |
| `models` | AI模型信息 | `provider`, `params_b`, `context_window` |
| `model_benchmarks` | 基准测试分数 | UNIQUE(model_id, benchmark_name) |
| `model_prices` | API定价 | `input/output_price_per_1m` |
| `papers` | arXiv论文 | `arxiv_id`, `primary_category` |
| `products` | AI产品目录 | `category`, `is_hot` |

全文搜索使用 `articles_fts` 和 `papers_fts` 两张 FTS5 content-sync 虚拟表，配有完整的 AFTER INSERT/UPDATE/DELETE 触发器维护反向索引。但实际搜索**不走 FTS MATCH**——因为 unicode61 tokenizer 无法处理中文分词，改用 `LIKE '%keyword%'` 实现中英文通用搜索。FTS 表保留作为未来升级到 jieba/tantivy 分词的基础。

所有 CRUD 函数直接从 `lib/db.ts` 导出，API routes 直调，无 ORM 层。

**数据源健康度**：`sources` 表有三个字段用来暴露静默失效的源——`last_crawled_at`（最后一次**成功**）、`last_attempt_at`（最后一次**尝试**）、`fail_count` + `last_error`。抓取成功走 `updateSourceLastCrawled()`（清零失败计数），失败走 `markSourceFailure()`（只推进尝试时间、累加计数、记下错误，**不动** `last_crawled_at`）。两个时间戳拉开差距 = 这个源在持续重试但一直失败。资讯流页面据此显示警告横幅和 ⚠ 标记。

这三列通过 `initTables()` 里的 `PRAGMA table_info` + `ALTER TABLE` 做幂等迁移（`CREATE TABLE IF NOT EXISTS` 不会给已存在的表加列）。

**重要**：`upsertArticle` 的 `ON CONFLICT(url)` 子句**不更新 `published_at`**（仅更新 title/summary 等），以保留文章原始发布时间，防止 GitHub Trending 等无时间字段的数据源每次抓取时时间被重置。

### 爬虫模块 (`lib/crawler/`)

- `rss.ts` — 通用RSS抓取，自动推断分类（正则匹配标题关键词）和语言（检测中文字符）
- `arxiv.ts` — arXiv API抓取（`export.arxiv.org/api/query`），轻量XML解析。论文同时写入 `papers` 和 `articles` 表
- `hackernews.ts` — HN热门故事过滤，AI关键词匹配
- `github.ts` — GitHub Trending 仓库抓取，按AI相关关键词过滤
- `web.ts` — 网页内容抓取
- `models.ts` — OpenRouter API 模型数据拉取
- `index.ts` — `crawlAll()` 并行调度以上六个，返回 `CrawlResult[]`

### arXiv 分类映射 (`lib/arxiv-categories.ts`)

`ARXIV_CATEGORY_NAMES` 字典：arXiv 分类缩写 → 英文全称，覆盖 CS / Stat / Math / EESS / Q-bio / Physics 六个大类约80+条目。论文页面用 `getCategoryFullName()` 生成 tooltip。

### 自动刷新 (`hooks/useAutoRefresh.ts`)

共享 hook，用于资讯流页面。核心常量：`CRAWL_INTERVAL = 10 * 60 * 1000`（10分钟）。

- **页面加载时**：通过 sessionStorage (`ai-radar-last-crawl-check`) 跨页面去重，10分钟内不重复检查
- **长周期轮询**：`setInterval` 每10分钟自动全量抓取（可通过开关关闭）
- 返回 `{ lastCrawlTime, autoCrawl, crawling, setAutoCrawl, manualCrawl, getTimeAgo }`

### API Routes

全部在 `app/api/` 下，Next.js Route Handlers：

- `articles/route.ts` — GET（列表/单篇/搜索/筛选，搜索走 LIKE），POST（crawl/markRead/markStarred）
- `models/route.ts` — GET，嵌套 benchmarks 和价格数据
- `papers/route.ts` — GET，搜索同样走 LIKE
- `products/route.ts` — GET，支持分类和热门筛选
- `search/route.ts` — GET，全局搜索（同时返回 articles 和 papers，LIKE 匹配）
- `cron/route.ts` — GET/POST，外部触发全量抓取

### 前端页面

导航栏顺序：**首页 → 资讯流 → 论文 → AI产品 → 模型追踪**

- `/` — **首页（着陆页）**：展示当天最新5条资讯卡片，底部按钮可切换显示6-10条。点击卡片直接跳转原文。页面加载时自动检查是否需要抓取
- `/news` — **资讯流（完整列表）**：分类筛选 + 来源筛选 + 搜索（URL参数 `?search=`）+ 收藏切换 + 刷新按钮（手动抓取时显示 loading）。导航栏搜索框提交后跳转至此页。失效数据源会显示警告横幅 + 来源标签加 ⚠
- `/papers` — 论文追踪：arXiv 分类筛选（cs.AI / cs.CL / cs.CV / cs.LG），分类标签悬停显示全称 tooltip
- `/products` — AI产品库：分类 + 🔥热门筛选。产品卡片仅保留🔥图标，无💰🧠等装饰图标
- `/models` — 模型追踪：厂商/开源筛选，卡片含价格和基准
- `/article/[id]` — 文章详情页

关键组件：
- `ArticleCard`（收藏星标切换）
- `PaperCard`（arxiv链接 + 分类tooltip）
- `ModelCard`（价格+基准展示）
- `CategoryFilter`（分类标签筛选栏）
- `Navbar`（含搜索框，提交跳转 `/news?search=xxx`）

### 数据流

```
RSS / arXiv API / HN API / GitHub Trending / 网页 / OpenRouter
    ↓ (lib/crawler/)
upsert 到 articles / papers / models 表
    ↓ (lib/db.ts)
API Routes (app/api/)
    ↓ (fetch)
React Pages (app/*/page.tsx)
```

去重策略：articles 表 `url` UNIQUE 约束，ON CONFLICT 时更新内容而非插入（但不更新 `published_at`）。

### 资讯流的返回定位（`app/news/page.tsx`）

从 `/article/[id]` 返回 `/news` 时不再弹回顶部。原理是**只解决「首帧要有内容」，滚动恢复交还给平台**：

- 列表 + 筛选条件快照进 sessionStorage 的 `ai-radar-news-cache`
- 返回时用 `useState` 的**惰性初始化**把缓存同步塞进首帧（放进 `useEffect` 就晚了——那一刻页面还是空的，浏览器想恢复滚动也无处可滚，这正是原来跳顶部的根因）
- 缓存 5 分钟内不请求，5–30 分钟内后台 `silent` 刷新（不切 `loading`，列表不会被转圈替换掉），超 30 分钟丢弃
- URL 的 `?search=` 与缓存里的搜索词不一致时拒绝缓存，避免新搜索命中旧结果
- 详情页的「返回资讯流」用 `router.back()` 而非 `<Link href="/news">`，这样 URL（含 `?search=`）原样回去，也不会多压一条历史

**不要**再自己存取 `window.scrollY`：写过一版，卸载时补写会把好值擦成 0（那一刻详情页 DOM 已挂上，页面高度骤降导致 scrollY 被浏览器钳位到 0），而且会跟框架自带的历史滚动恢复互相打架。

### 本地启动（`start.bat` + `launcher.html`）

桌面快捷方式指向 `start.bat`。它先用默认浏览器打开 `launcher.html`（一个零依赖的本地等待页），再执行 `npm run dev`——因为 Next dev 冷启动要十几秒，直接开 `localhost:3000` 会撞上浏览器的「无法访问」错误页，只能手动刷新。

等待页的探测打的是 `/` 而不是测端口通不通：Next dev 会**先监听端口、再编译页面**，只看端口会在编译完成前就跳转，结果还是白屏；打 `/` 的请求会一直挂到编译结束，顺带预热了首页编译。探测走 fetch(no-cors) → img 两级，另有 40 秒无条件跳转兜底（防止 `file://` 的网络权限被浏览器策略挡掉）。

## 关键设计决策

- **本地优先**：SQLite文件存储，无外部数据库依赖。`data/` 已加入 `.gitignore`
- **无认证**：个人使用，无需登录/权限系统
- **10分钟自动刷新**：资讯流页面支持开关式自动全量抓取，间隔10分钟
- **sessionStorage 跨页去重**：首页和资讯流共享 `ai-radar-last-crawl-check` 键，10分钟内不会重复触发爬虫
- **种子数据与抓取分离**：`npm run seed` 只写静态配置（数据源、模型信息），动态资讯由爬虫获取
- **中文搜索用 LIKE**：因 FTS5 unicode61 tokenizer 无法处理无空格的中文分词，全局搜索改用 `LIKE '%keyword%'` 模式，中英文通吃
- **arXiv 论文双写**：既写入 `papers` 表供论文页展示，也写入 `articles` 表混入资讯流
- **源失效要可见**：抓取失败只记录不静默——`last_crawled_at` 只在成功时推进，前端据此显示警告。曾经 36氪 挂了三周才被发现
- **GitHub 提交需用户指令**：不自动提交，需用户明确指示后才 `git commit`
