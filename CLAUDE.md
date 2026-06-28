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
npm run dev      # 启动开发服务器 (localhost:3000)
npm run build    # 生产构建
npm run seed     # 初始化/重置种子数据（数据源、模型、产品）
npm run crawl    # 手动触发数据抓取
npm run lint     # ESLint
```

## 技术栈

- **框架**: Next.js 16 (App Router, Turbopack)
- **数据库**: SQLite via `better-sqlite3`，文件位于 `data/ai-news.db`
- **样式**: TailwindCSS 4 + shadcn/ui
- **爬虫**: `rss-parser` (RSS) + 手写 XML 解析 (arXiv) + `fetch` (HackerNews API)
- **暗色模式**: `next-themes`

## 架构

### 数据层 (`lib/db.ts`)

SQLite 单例，WAL模式。7张核心表：

| 表 | 用途 | 关键字段 |
|---|------|---------|
| `sources` | 数据源配置 | `rss_url`, `last_crawled_at` |
| `articles` | 聚合文章（统一信息流） | `url` UNIQUE, `category`, `is_starred` |
| `models` | AI模型信息 | `provider`, `params_b`, `context_window` |
| `model_benchmarks` | 基准测试分数 | UNIQUE(model_id, benchmark_name) |
| `model_prices` | API定价 | `input/output_price_per_1m` |
| `papers` | arXiv论文 | `arxiv_id`, `primary_category` |
| `products` | AI产品目录 | `category`, `is_hot` |

全文搜索：`articles_fts` 和 `papers_fts` 两张 FTS5 虚拟表。

所有 CRUD 函数在 `lib/db.ts` 中直接导出，API routes 直接调用，无 ORM 层。

### 爬虫模块 (`lib/crawler/`)

- `rss.ts` — 通用RSS抓取，自动推断分类（正则匹配标题关键词）和语言（检测中文字符）
- `arxiv.ts` — arXiv API抓取（`export.arxiv.org/api/query`），轻量XML解析（无额外依赖）。论文同时写入 `papers` 和 `articles` 表
- `hackernews.ts` — HN热门故事过滤，AI关键词匹配
- `index.ts` — `crawlAll()` 并行调度以上三个

### API Routes

全部在 `app/api/` 下，Next.js Route Handlers：

- `articles/route.ts` — GET（列表/单篇/搜索/筛选），POST（crawl/markRead/markStarred）
- `models/route.ts` — GET，附带 benchmarks 嵌套数据
- `papers/route.ts` — GET，支持分类筛选
- `products/route.ts` — GET，支持分类和热门筛选
- `search/route.ts` — GET，FTS5搜索，同时返回文章和论文
- `cron/route.ts` — GET/POST，触发全量抓取

### 前端页面

- `/` — 资讯流主页：分类筛选 + 来源筛选 + 收藏切换 + 刷新按钮
- `/models` — 模型追踪：厂商/开源筛选，卡片含价格和基准
- `/papers` — 论文追踪：arXiv分类筛
- `/products` — AI产品库：分类 + 热门筛选
- `/article/[id]` — 文章详情：摘要 + 内容片段 + 原文链接

关键组件：`ArticleCard`（收藏星标）、`ModelCard`（价格+基准展示）、`PaperCard`（arxiv链接）

### 数据流

```
RSS/arXiv API/HN API
    ↓ (lib/crawler/)
upsert 到 articles / papers / models 表
    ↓ (lib/db.ts)
API Routes (app/api/)
    ↓ (fetch)
React Pages (app/*/page.tsx)
```

去重策略：articles 表 `url` UNIQUE 约束，ON CONFLICT 时更新内容而非插入。

## 关键设计决策

- **本地优先**：SQLite文件存储，无外部数据库依赖。`data/` 已加入 `.gitignore`
- **无认证**：个人使用，无需登录/权限系统
- **爬虫手动触发**：不设定时任务，用户点「刷新」按钮或访问 `/api/cron` 触发
- **种子数据与抓取分离**：`npm run seed` 只写静态配置（数据源、模型信息），动态资讯由爬虫获取
- **同时写入 articles 和 papers**：arXiv论文既在论文页展示，也混入资讯流
