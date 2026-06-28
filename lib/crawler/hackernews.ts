import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled } from '../db';

const HN_TOP_STORIES = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM = 'https://hacker-news.firebaseio.com/v0/item';

// AI 相关关键词
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'llm', 'gpt', 'claude', 'gemini', 'deepseek',
  'openai', 'anthropic', 'model', 'transformer', 'neural network', 'machine learning',
  'deep learning', 'nlp', 'computer vision', 'reinforcement learning', 'agent',
  'rag', 'fine-tuning', 'inference', 'gpu', 'cuda', 'token', 'embedding',
  'diffusion', 'stable diffusion', 'midjourney', 'sora', 'generative',
  'chatbot', 'copilot', 'langchain', 'vector database', 'prompt',
  'mcp', 'skill', 'agi', 'alignment', 'safety', 'hallucination',
];

function isAiRelated(title: string): boolean {
  const t = title.toLowerCase();
  return AI_KEYWORDS.some(kw => t.includes(kw));
}

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
          category: '综合',
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
