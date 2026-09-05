import { errorDetail } from '../errors';
import { randomUUID as uuidv4 } from 'node:crypto';
import { upsertArticle, updateSourceLastCrawled, markSourceFailure } from '../db';
import { isAiRelated } from './keywords';

const HN_TOP_STORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item';

export async function crawlHackerNews(maxStories = 50): Promise<number> {
  try {
    // 获取热门故事 ID 列表
    const response = await fetch(HN_TOP_STORIES, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Hacker News HTTP ${response.status}`);
    const ids: number[] = await response.json();
    if (!Array.isArray(ids)) throw new Error('Hacker News 返回了无效数据');

    // 只处理前 N 个，分批并发（每批 5 个）
    const topIds = ids.slice(0, maxStories);
    const CONCURRENCY = 5;
    let count = 0;

    for (let i = 0; i < topIds.length; i += CONCURRENCY) {
      const batch = topIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (id) => {
          try {
            const itemRes = await fetch(`${HN_ITEM}/${id}.json`, {
              signal: AbortSignal.timeout(5000),
            });
            if (!itemRes.ok) return null;
            const item = await itemRes.json();

            if (!item || !item.title) return null;
            if (item.type !== 'story') return null;
            if (!isAiRelated(item.title)) return null;

            return item;
          } catch {
            return null;
          }
        }),
      );

      for (const item of results) {
        if (!item) continue;
        const articleId = uuidv4();
        upsertArticle({
          id: articleId,
          source_id: 'hackernews',
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          summary: item.text?.substring(0, 500) || '',
          author: item.by || '',
          published_at: new Date(item.time * 1000).toISOString(),
          category: 'AI综合',
          language: 'en',
        });
        count++;
      }
    }

    updateSourceLastCrawled('hackernews');
    console.log(`[HackerNews] AI相关: ${count} 篇文章`);
    return count;
  } catch (err) {
    const detail = errorDetail(err);
    console.error(`[HackerNews Error] ${detail}`);
    markSourceFailure('hackernews', detail);
    throw err;
  }
}
