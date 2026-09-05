import { errorMessage } from '../errors';
import { randomUUID as uuidv4 } from 'node:crypto';
import * as cheerio from 'cheerio';
import { upsertPaper, upsertArticle, updateSourceLastCrawled, markSourceFailure } from '../db';

const ARXIV_API = 'https://export.arxiv.org/api/query';

interface ArxivEntry {
  id: string;
  title: string;
  summary: string;
  author: { name: string }[];
  published: string;
  link: string;
  category: { term: string }[];
  primary_category?: { term: string };
}

export async function fetchArxivPapers(
  options: {
    category?: string;
    searchQuery?: string;
    maxResults?: number;
    sortBy?: 'submittedDate' | 'relevance' | 'lastUpdatedDate';
  } = {},
): Promise<number> {
  const { category = 'cs.AI', maxResults = 30, sortBy = 'submittedDate' } = options;

  const params = new URLSearchParams({
    search_query: options.searchQuery ?? `cat:${category}`,
    sortBy,
    sortOrder: 'descending',
    max_results: maxResults.toString(),
  });

  const url = `${ARXIV_API}?${params}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-News-Hub/1.0' },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`arXiv HTTP ${response.status}`);
    }

    const xml = await response.text();
    console.log(`[arXiv] ${category}: 收到响应 ${xml.length} 字节`);

    // 简单 XML 解析（避免额外依赖）
    const entries = parseArxivXml(xml);
    if (!entries.length) throw new Error('arXiv 返回了空或无效的论文列表');
    let count = 0;

    for (const entry of entries) {
      try {
        const paperId = uuidv4();
        const arxivId = entry.id
          .replace(/^https?:\/\/arxiv\.org\/abs\//, '')
          .replace(/v\d+$/, '')
          .trim();
        if (!arxivId) continue;

        // 存为 paper 记录
        upsertPaper({
          id: paperId,
          arxiv_id: arxivId,
          title: entry.title,
          authors: entry.author?.map((a) => a.name).join(', ') || '',
          abstract: entry.summary?.substring(0, 2000) || '',
          categories: entry.category?.map((c) => c.term).join(',') || '',
          primary_category: entry.primary_category?.term || category,
          published_at: entry.published,
          pdf_url: `https://arxiv.org/pdf/${arxivId}`,
        });

        // 同时存为 article（统一信息流）
        upsertArticle({
          id: uuidv4(),
          source_id: 'arxiv',
          title: `[论文] ${entry.title}`,
          url: `https://arxiv.org/abs/${arxivId}`,
          summary: entry.summary?.substring(0, 500) || '',
          author:
            entry.author
              ?.map((a) => a.name)
              .slice(0, 3)
              .join(', ') || '',
          published_at: entry.published,
          category: '学术研究',
          language: 'en',
        });

        count++;
      } catch (error) {
        console.error('[arXiv] 论文写入失败', error);
      }
    }

    console.log(`[arXiv] ${category}: ${count} 篇论文`);
    return count;
  } catch (err) {
    console.error(`[arXiv Error] ${category}: ${errorMessage(err)}`);
    throw err;
  }
}

export async function crawlAllArxiv(): Promise<number> {
  // 一次 OR 查询替代四路并发，减少 arXiv 限流及跨分类重复处理。
  try {
    const count = await fetchArxivPapers({
      searchQuery: 'cat:cs.AI OR cat:cs.CL OR cat:cs.CV OR cat:cs.LG',
      maxResults: 60,
    });
    updateSourceLastCrawled('arxiv');
    return count;
  } catch (error) {
    markSourceFailure('arxiv', errorMessage(error));
    throw error;
  }
}

export function parseArxivXml(xml: string): ArxivEntry[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const tag = (name: string) => (index: number, el: unknown) =>
    !!el &&
    typeof el === 'object' &&
    'name' in el &&
    typeof el.name === 'string' &&
    el.name.split(':').pop() === name;
  return $('*')
    .filter(tag('entry'))
    .toArray()
    .map((el) => {
      const entry = $(el);
      const text = (name: string) =>
        entry.children().filter(tag(name)).first().text().replace(/\s+/g, ' ').trim();
      return {
        id: text('id'),
        title: text('title'),
        summary: text('summary'),
        published: text('published'),
        author: entry
          .children()
          .filter(tag('author'))
          .toArray()
          .map((a) => ({ name: $(a).children().filter(tag('name')).text().trim() })),
        category: entry
          .children()
          .filter(tag('category'))
          .toArray()
          .map((c) => ({ term: $(c).attr('term') || '' })),
        primary_category: {
          term: entry.children().filter(tag('primary_category')).attr('term') || '',
        },
        link:
          entry.children().filter(tag('link')).filter('[rel="alternate"]').attr('href') ||
          text('id'),
      };
    })
    .filter((entry) => entry.id && entry.title);
}
