# 项目开发说明

修改前阅读 [AGENTS.md](AGENTS.md) 及已安装 Next.js 对应文档。运行与环境配置以 [README.md](README.md) 为准。

## 关键约定

- 个人单用户实例，SQLite 存储；测试使用内存或 `.e2e-work` 独立数据库。
- 写接口统一调用 `validateApiKey`；Origin 不作为身份验证依据。
- `getDb` 幂等初始化默认来源，不覆盖既有开关。不要重新导入未经核验的模型跑分与定价。
- 日期入库统一 ISO；每日统计接收浏览器时区偏移。抓取更新不刷新旧文章的首次发布时间。
- `getArticles` 与 `getArticleCount` 共用筛选；LIKE 关键字在数据库边界统一转义。
- 抓取经 `crawlAll` 的 SQLite 租约锁；每个来源独立返回失败，处理量包含更新。
- 浏览器自动刷新只拉列表，后台抓取需独立调度。摘要只接受已收录文章 ID。
- OpenRouter ID 完整保留厂商与模型变体。价格 0 与未知分开，许可证缺失不可按厂商推测开源。
- 前端异步读取用 `useCollection`，必须取消过期请求并显示失败；详情返回位置及 URL 筛选需保持可用。
- 类型定义集中在 `lib/types.ts`；不要关闭 lint 或 TypeScript 规则绕过检查。

## 检查

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

浏览器测试依赖已安装 Chromium 或 `PLAYWRIGHT_CHROME_PATH`。不要把真实数据库或密钥提交到版本库。
