import { crawlAllRss } from './rss';
import { crawlAllArxiv } from './arxiv';
import { crawlHackerNews } from './hackernews';

export interface CrawlResult {
  source: string;
  type: string;
  count: number;
  error?: string;
}

export async function crawlAll(): Promise<CrawlResult[]> {
  const results: CrawlResult[] = [];
  const startTime = Date.now();

  console.log('🚀 开始全量数据抓取...\n');

  // 并行抓取
  const [rssResults, arxivCount, hnCount] = await Promise.all([
    crawlAllRss(),
    crawlAllArxiv(),
    crawlHackerNews(50),
  ]);

  // RSS 结果
  for (const r of rssResults) {
    results.push({ source: r.source, type: 'rss', count: r.count });
  }

  // arXiv 结果
  results.push({ source: 'arXiv', type: 'paper', count: arxivCount });

  // HackerNews 结果
  results.push({ source: 'HackerNews', type: 'community', count: hnCount });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalArticles = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`\n✅ 抓取完成: ${totalArticles} 条内容, 耗时 ${elapsed}s`);

  return results;
}
