# AI Radar — AI 资讯聚合平台

> **使用声明**
>
> 本项目仅供个人学习、研究使用。未经授权不得用于商业用途。
> 所有资讯内容版权归各信息源所有，本平台仅做聚合索引与链接，不存储完整文章内容。

一站式 AI 资讯聚合，多源新闻抓取、arXiv 论文追踪、AI 模型数据库、AI 产品目录。支持中英文搜索和暗色模式，内置 AI 每日资讯总结。

## 设计理念

大多数新闻聚合网站信息过载，用户打开后不知道该看什么。AI Radar 遵循 **less is more**：
首页只展示当天最新 5 条资讯，视觉聚焦，一目了然。有需要再看完整资讯流。

## 截图

| 亮色模式 | 暗色模式 |
|---------|---------|
| [![首页亮色](public/screenshots/home-light.png)](public/screenshots/home-light.png) | [![首页暗色](public/screenshots/home-dark.png)](public/screenshots/home-dark.png) |

<details>
<summary>更多页面截图</summary>

| 资讯流 | 论文追踪 |
|-------|---------|
| [![资讯流](public/screenshots/news-feed.png)](public/screenshots/news-feed.png) | [![论文](public/screenshots/papers.png)](public/screenshots/papers.png) |

| 模型追踪 | 产品目录 |
|---------|---------|
| [![模型](public/screenshots/models.png)](public/screenshots/models.png) | [![产品](public/screenshots/products.png)](public/screenshots/products.png) |

</details>

## 功能

- **多源 AI 资讯聚合** — RSS + API + 网页抓取，自动分类和去重
- **arXiv 论文追踪** — cs.AI / cs.CL / cs.CV / cs.LG 等分类浏览
- **AI 模型数据库** — API 定价对比与参数信息
- **AI 产品目录** — 热门 AI 产品，按分类筛选
- **全站搜索** — 中英文通用搜索
- **暗色模式** — next-themes 实现，跟随系统
- **AI 每日总结** — 调用 DeepSeek API 自动提炼当日核心要点（可选功能）
- **自动刷新** — 每 10 分钟自动抓取最新资讯（可开关）

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 语言 | TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 样式 | TailwindCSS 4 + shadcn/ui |
| 爬虫 | rss-parser + cheerio + fetch |
| AI | DeepSeek API (chat completions) |
| 图表 | recharts |

## 快速开始

### 前置条件

- Node.js 18+
- npm 9+

### 安装

```bash
# 克隆仓库
git clone https://github.com/tonghaoxu/ai-radar.git
cd ai-radar

# 安装依赖
npm install

# 初始化种子数据（数据源、模型、产品）
npm run seed
```

### 配置 AI 总结（可选）

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local，填入 DeepSeek API Key
# 获取地址: https://platform.deepseek.com/api_keys
```

### 启动

```bash
npm run dev
# 打开 http://localhost:3000
```

### 其他命令

```bash
npm run build        # 生产构建
npm run seed         # 重置种子数据
npm run seed:products # 仅重置产品数据
npm run crawl        # 手动触发抓取
npm run lint         # ESLint 检查
```

## 数据源

| 来源 | 方式 | 内容 | 语言 |
|------|------|------|------|
| TechCrunch | RSS | AI 科技新闻 | EN |
| VentureBeat | RSS | AI 商业动态 | EN |
| MIT Technology Review | RSS | AI 前沿科技 | EN |
| 量子位 (QbitAI) | RSS | 中文 AI 资讯 | ZH |
| 36氪 (via RSSHub) | RSS | 中文科技资讯 | ZH |
| arXiv | API | CS/AI 学术论文 | EN |
| HackerNews | Firebase API | 社区 AI 热帖 | EN |
| GitHub Trending | 网页抓取 | 开源 AI 项目 | EN |
| OpenRouter | API | 模型信息与定价 | EN |

> 所有内容版权归原作者/来源所有。本平台仅抓取标题、摘要和链接，
> 用户点击后跳转至原始网站阅读完整内容。arXiv 论文存储摘要用于检索，
> 符合 arXiv 非商业使用许可。

## 架构

```
RSS / API / 网页抓取
    ↓ (lib/crawler/)
数据 upsert 到 SQLite
    ↓ (lib/db.ts)
API Routes (app/api/)
    ↓ (fetch)
React Pages (app/*/page.tsx)
```

- 去重策略：`articles` 表 `url` UNIQUE 约束
- 中文搜索：`LIKE '%keyword%'` 模式（FTS5 不支持中文分词）
- 自动刷新：10 分钟间隔，`sessionStorage` 跨页面去重

## 许可

本项目采用 [GNU Affero General Public License v3 (AGPL-3.0)](LICENSE)。

**核心条款：**
- 个人学习、研究、修改自由使用
- 可以分发和修改，但必须保持开源
- 如果用此代码提供网络服务（SaaS），必须公开全部源代码
- 未经授权不得用于商业用途

## 贡献

欢迎提交 Issue 和 Pull Request。贡献前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 免责声明

本项目为个人学习研究工具。使用者应自行遵守各数据源的服务条款，
本项目的抓取行为不应被视为对任何网站服务条款的认可或违反建议。
作者不对使用本项目产生的任何法律后果承担责任。
