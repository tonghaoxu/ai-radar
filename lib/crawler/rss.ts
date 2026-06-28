import RssParser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled, getSources } from '../db';

const parser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AI-News-Hub/1.0 (Personal Use)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
});

// 分类推断：根据标题和来源推断文章分类
function inferCategory(title: string, sourceName: string): string {
  const t = title.toLowerCase();
  if (/大模型|llm|gpt|claude|gemini|deepseek|通义|文心|豆包|模型|model/i.test(t)) return '大模型';
  if (/芯片|gpu|nvidia|amd|算力|h100|b200|huawei|昇腾/i.test(t)) return '算力芯片';
  if (/产品|发布|上线|推出|product|launch/i.test(t)) return '产品发布';
  if (/融资|估值|收购|ipo|上市|funding|invest/i.test(t)) return '投融资';
  if (/政策|监管|法规|合规|policy|regulation|act/i.test(t)) return '政策监管';
  if (/论文|paper|arxiv|研究|research/i.test(t)) return '学术研究';
  if (/开源|open.source|github|license/i.test(t)) return '开源生态';
  if (/agent|智能体|mcp|skill|rag/i.test(t)) return 'AI技术';
  return '综合';
}

// 推断语言
function inferLanguage(title: string): string {
  // 如果标题包含中文字符，判定为中文
  return /[一-鿿]/.test(title) ? 'zh' : 'en';
}

export async function crawlRssSource(source: {
  id: string;
  name: string;
  rss_url: string;
}): Promise<number> {
  let count = 0;
  try {
    const feed = await parser.parseURL(source.rss_url);

    for (const item of feed.items || []) {
      const title = item.title?.trim() || '无标题';
      const url = item.link?.trim();
      const publishedAt = item.pubDate || item.isoDate || new Date().toISOString();

      if (!url) continue;

      const articleId = uuidv4();
      upsertArticle({
        id: articleId,
        source_id: source.id,
        title,
        url,
        summary: item.contentSnippet?.substring(0, 500) || item.content?.replace(/<[^>]*>/g, '').substring(0, 500) || '',
        content_snippet: item.content?.replace(/<[^>]*>/g, '').substring(0, 1000) || '',
        author: item.creator || '',
        published_at: publishedAt,
        category: inferCategory(title, source.name),
        language: inferLanguage(title),
      });
      count++;
    }

    updateSourceLastCrawled(source.id);
    console.log(`[RSS] ${source.name}: ${count} 篇文章`);
  } catch (err: any) {
    console.error(`[RSS Error] ${source.name}: ${err.message}`);
  }
  return count;
}

export async function crawlAllRss(): Promise<{ source: string; count: number }[]> {
  const sources = getSources('news') as any[];
  const results = [];

  for (const source of sources) {
    if (!source.rss_url) continue;
    const count = await crawlRssSource(source);
    results.push({ source: source.name, count });
  }

  return results;
}
