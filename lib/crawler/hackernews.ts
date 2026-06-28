import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled } from '../db';
import { isAiRelated } from './keywords';

const HN_TOP_STORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item';

export async function crawlHackerNews(maxStories = 50): Promise<number> {
  try {
    // 获取热门故事 ID 列表
    const response = await fetch(HN_TOP_STORIES, {
      signal: AbortSignal.timeout(10000),
    });
    const ids: number[] = await response.json();

    // 只处理前 N 个
    const topIds = ids.slice(0, maxStories);
    let count = 0;

    for (const id of topIds) {
      try {
        const itemRes = await fetch(`${HN_ITEM}/${id}.json`, {
          signal: AbortSignal.timeout(5000),
        });
        const item = await itemRes.json();

        if (!item || !item.title) continue;
        if (item.type !== 'story') continue;
        if (!isAiRelated(item.title)) continue;

        const articleId = uuidv4();
        upsertArticle({
          id: articleId,
          source_id: 'hackernews',
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${id}`,
          summary: item.text?.substring(0, 500) || '',
          author: item.by || '',
          published_at: new Date(item.time * 1000).toISOString(),
          category: 'AI综合',
          language: 'en',
        });
        count++;
      } catch {
        // 跳过单条失败
      }
    }

    updateSourceLastCrawled('hackernews');
    console.log(`[HackerNews] AI相关: ${count} 篇文章`);
    return count;
  } catch (err: any) {
    console.error(`[HackerNews Error] ${err.message}`);
    return 0;
  }
}
