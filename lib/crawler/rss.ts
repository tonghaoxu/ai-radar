import RssParser from 'rss-parser';
import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled, markSourceFailure, getSources } from '../db';
import { isAiRelated } from './keywords';

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
  return 'AI综合';
}

// 安全解析日期字符串为 ISO 8601，rss-parser 的 isoDate 可能为 null
function safeParseDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
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

    let filteredCount = 0;

    for (const item of feed.items || []) {
      const title = item.title?.trim() || '无标题';
      const url = item.link?.trim();
      const publishedAt = item.isoDate
        || (item.pubDate ? safeParseDate(item.pubDate) : null)
        || new Date().toISOString();

      if (!url) continue;

      // 所有源均过 AI 关键词（中英文），避免财经/股票等无关内容混入
      if (!isAiRelated(title)) {
        filteredCount++;
        continue;
      }

      const articleId = uuidv4();
      upsertArticle({
        id: articleId,
        source_id: source.id,
        title,
        url,
        summary: item.contentSnippet?.substring(0, 500) || stripHtml(item.content)?.substring(0, 500) || '',
        content_snippet: stripHtml(item.content)?.substring(0, 1000) || '',
        author: item.creator || '',
        published_at: publishedAt,
        category: inferCategory(title, source.name),
        language: inferLanguage(title),
      });
      count++;
    }

    updateSourceLastCrawled(source.id);
    const filterMsg = filteredCount > 0 ? ` (过滤掉 ${filteredCount} 篇非AI)` : '';
    console.log(`[RSS] ${source.name}: ${count} 篇文章${filterMsg}`);
    return count;
  } catch (err: any) {
    // 记录失败原因（含底层 cause，TLS/DNS 类错误的 message 往往只有 'fetch failed'）
    const detail = err.cause?.code ? `${err.message} (${err.cause.code})` : err.message;
    console.error(`[RSS Error] ${source.name}: ${detail}`);
    markSourceFailure(source.id, detail);
    return 0;
  }
}

/** 去除 HTML 标签并解码常见 HTML 实体 */
function stripHtml(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#x27;/g, "'");
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
