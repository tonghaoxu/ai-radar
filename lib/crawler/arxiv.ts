import { v4 as uuidv4 } from 'uuid';
import { upsertPaper, upsertArticle } from '../db';

const ARXIV_API = 'http://export.arxiv.org/api/query';

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

export async function fetchArxivPapers(options: {
  category?: string;
  maxResults?: number;
  sortBy?: 'submittedDate' | 'relevance' | 'lastUpdatedDate';
} = {}): Promise<number> {
  const { category = 'cs.AI', maxResults = 30, sortBy = 'submittedDate' } = options;

  const params = new URLSearchParams({
    search_query: `cat:${category}`,
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

    const xml = await response.text();

    // 简单 XML 解析（避免额外依赖）
    const entries = parseArxivXml(xml);
    let count = 0;

    for (const entry of entries) {
      const paperId = uuidv4();
      const arxivId = entry.id.replace('http://arxiv.org/abs/', '').trim();

      // 存为 paper 记录
      upsertPaper({
        id: paperId,
        arxiv_id: arxivId,
        title: entry.title,
        authors: entry.author?.map((a: any) => a.name).join(', ') || '',
        abstract: entry.summary?.substring(0, 2000) || '',
        categories: entry.category?.map((c: any) => c.term).join(',') || '',
        primary_category: entry.primary_category?.term || category,
        published_at: entry.published,
        pdf_url: `https://arxiv.org/pdf/${arxivId}`,
      });

      // 同时存为 article（统一信息流）
      upsertArticle({
        id: uuidv4(),
        source_id: 'arxiv',
        title: `[论文] ${entry.title}`,
        url: entry.link || `https://arxiv.org/abs/${arxivId}`,
        summary: entry.summary?.substring(0, 500) || '',
        author: entry.author?.map((a: any) => a.name).slice(0, 3).join(', ') || '',
        published_at: entry.published,
        category: '学术研究',
        language: 'en',
      });

      count++;
    }

    console.log(`[arXiv] ${category}: ${count} 篇论文`);
    return count;
  } catch (err: any) {
    console.error(`[arXiv Error] ${category}: ${err.message}`);
    return 0;
  }
}

export async function crawlAllArxiv(): Promise<number> {
  const categories = ['cs.AI', 'cs.CL', 'cs.CV', 'cs.LG'];
  let total = 0;

  for (const cat of categories) {
    const count = await fetchArxivPapers({ category: cat, maxResults: 15 });
    total += count;
  }

  return total;
}

// 轻量 XML 解析（提取 <entry> 中的关键字段）
function parseArxivXml(xml: string): ArxivEntry[] {
  const entries: ArxivEntry[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const content = match[1];
    entries.push({
      id: extractTag(content, 'id'),
      title: cleanText(extractTag(content, 'title')),
      summary: cleanText(extractTag(content, 'summary')),
      author: extractAuthors(content),
      published: extractTag(content, 'published'),
      link: extractLink(content),
      category: extractCategories(content),
      primary_category: extractPrimaryCategory(content),
    });
  }

  return entries;
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : '';
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function extractAuthors(xml: string): { name: string }[] {
  const authors: { name: string }[] = [];
  const regex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    authors.push({ name: match[1].trim() });
  }
  return authors;
}

function extractLink(xml: string): string {
  const regex = /<link[^>]*href="([^"]*)"[^>]*\/>/i;
  const match = regex.exec(xml);
  return match ? match[1] : '';
}

function extractCategories(xml: string): { term: string }[] {
  const cats: { term: string }[] = [];
  const regex = /<category[^>]*term="([^"]*)"[^>]*\/>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    cats.push({ term: match[1] });
  }
  return cats;
}

function extractPrimaryCategory(xml: string): { term: string } | undefined {
  const regex = /<arxiv:primary_category[^>]*term="([^"]*)"[^>]*\/>/i;
  const match = regex.exec(xml);
  return match ? { term: match[1] } : undefined;
}
