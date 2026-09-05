import { randomUUID } from 'node:crypto';
import { crawlAllRss } from './rss';
import { crawlAllArxiv } from './arxiv';
import { crawlHackerNews } from './hackernews';
import { crawlAllWeb } from './web';
import { crawlGitHubTrending } from './github';
import { fetchOpenRouterModels } from './models';
import { getDb, getSources } from '../db';
import { errorMessage, CrawlBusyError } from '../errors';

export interface CrawlResult {
  source: string;
  type: string;
  count: number;
  error?: string;
}

// SQLite 锁跨 API bundle、进程和标签页有效；到期租约允许崩溃后恢复。
export async function crawlAll(scope: 'all' | 'papers' = 'all'): Promise<CrawlResult[]> {
  const db = getDb(),
    owner = randomUUID(),
    now = Date.now();
  const lock = db
    .prepare(
      `INSERT INTO crawl_locks(name, owner, expires_at) VALUES ('crawl', ?, ?)
    ON CONFLICT(name) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
    WHERE crawl_locks.expires_at < ?`,
    )
    .run(owner, now + 600_000, now);
  if (!lock.changes) throw new CrawlBusyError('已有抓取任务正在执行或刚完成，请稍后刷新列表');
  try {
    const enabled = new Set(getSources().map((s) => s.id));
    const tasks: { name: string; type: string; run: () => Promise<CrawlResult[]> }[] = [];
    if (enabled.has('arxiv'))
      tasks.push({
        name: 'arXiv',
        type: 'paper',
        run: async () => [{ source: 'arXiv', type: 'paper', count: await crawlAllArxiv() }],
      });
    if (scope === 'all') {
      tasks.push({
        name: 'RSS',
        type: 'rss',
        run: async () => (await crawlAllRss()).map((r) => ({ ...r, type: 'rss' })),
      });
      tasks.push({
        name: '网页',
        type: 'web',
        run: async () => (await crawlAllWeb()).map((r) => ({ ...r, type: 'web' })),
      });
      for (const [id, name, type, run] of [
        ['hackernews', 'Hacker News', 'community', () => crawlHackerNews(50)],
        ['github-trending', 'GitHub Trending', 'opensource', crawlGitHubTrending],
        ['openrouter', 'OpenRouter', 'model', fetchOpenRouterModels],
      ] as const) {
        if (enabled.has(id))
          tasks.push({ name, type, run: async () => [{ source: name, type, count: await run() }] });
      }
    }
    const results = await Promise.all(
      tasks.map(async (task) => {
        try {
          return await task.run();
        } catch (error) {
          return [{ source: task.name, type: task.type, count: 0, error: errorMessage(error) }];
        }
      }),
    );
    return results.flat();
  } finally {
    db.prepare("UPDATE crawl_locks SET expires_at = ? WHERE name = 'crawl' AND owner = ?").run(
      Date.now() + 60_000,
      owner,
    );
  }
}
