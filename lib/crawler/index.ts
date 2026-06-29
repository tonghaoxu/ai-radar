import { crawlAllRss } from './rss';
import { crawlAllArxiv } from './arxiv';
import { crawlHackerNews } from './hackernews';
import { crawlAllWeb } from './web';
import { crawlGitHubTrending } from './github';
import { fetchOpenRouterModels } from './models';

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

  // 并行抓取：RSS + 网页 + arXiv + HN + GitHub + 模型
  const [rssResults, webResults, arxivCount, hnCount, githubCount, modelCount] = await Promise.all([
    crawlAllRss(),
    crawlAllWeb(),
    crawlAllArxiv(),
    crawlHackerNews(50),
    crawlGitHubTrending(),
    fetchOpenRouterModels(),
  ]);

  // RSS 结果
  for (const r of rssResults) {
    results.push({ source: r.source, type: 'rss', count: r.count });
  }

  // 网页抓取结果
  for (const r of webResults) {
    results.push({ source: r.source, type: 'web', count: r.count });
  }

  // arXiv 结果
  results.push({ source: 'arXiv', type: 'paper', count: arxivCount });

  // HackerNews 结果
  results.push({ source: 'HackerNews', type: 'community', count: hnCount });

  // GitHub Trending 结果
  results.push({ source: 'GitHub Trending', type: 'opensource', count: githubCount });

  // OpenRouter 模型数据
  results.push({ source: 'OpenRouter', type: 'model', count: modelCount });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalArticles = results.reduce((sum, r) => sum + r.count, 0);
  console.log(`\n✅ 抓取完成: ${totalArticles} 条内容, 耗时 ${elapsed}s`);

  return results;
}
