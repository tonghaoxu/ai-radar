/**
 * GitHub Trending 抓取器 — 用 cheerio 抓取当日热门 AI 仓库
 */
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled } from '../db';

const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'machine-learning', 'deep-learning', 'nlp',
  'computer-vision', 'neural', 'transformer', 'agent', 'rag',
  'langchain', 'llama', 'openai', 'chatbot', 'embedding', 'vector',
  'stable-diffusion', 'generative', 'text-to', 'speech', 'voice',
  'copilot', 'inference', 'fine-tuning', 'cuda', 'ml', 'model',
  'prompt', 'tokenizer', 'diffusion', 'mcp', 'reinforcement',
  'robotics', 'autonomous', 'vision', 'whisper', 'tts', 'stt',
  'artificial-intelligence', 'data-science', 'pytorch', 'tensorflow',
];

function isAiRepo(name: string, description: string): boolean {
  const text = (name + ' ' + description).toLowerCase();
  return AI_KEYWORDS.some(kw => text.includes(kw));
}

export async function crawlGitHubTrending(): Promise<number> {
  try {
    const response = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.error(`[GitHub] HTTP ${response.status}`);
      return 0;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    let count = 0;

    // GitHub Trending 每个仓库在 article.Box-row 中
    $('article.Box-row').each((_i, el) => {
      try {
        const $el = $(el);

        // 仓库名: h2.h3 a 中的文本（格式: "owner / repo"）
        const nameEl = $el.find('h2.h3 a');
        const fullName = nameEl.text().trim().replace(/\s+/g, '');
        // 提取 owner/repo
        const href = nameEl.attr('href') || '';
        const repoPath = href.replace(/^\//, ''); // owner/repo

        if (!repoPath || repoPath.split('/').length < 2) return;

        // 描述
        const description = $el.find('p.col-9').text().trim();

        // 语言
        const language = $el.find('[itemprop="programmingLanguage"]').text().trim();

        // 今日 stars（可选）
        const starsToday = $el.find('.float-sm-right').text().trim();

        // 只收录 AI 相关仓库
        if (!isAiRepo(repoPath, description)) return;

        const title = `GitHub Trending: ${repoPath}${language ? ' [' + language + ']' : ''}${starsToday ? ' ⭐' + starsToday : ''}`;
        const url = `https://github.com/${repoPath}`;
        const summary = description || `GitHub 今日热门 AI 仓库: ${repoPath}`;

        const articleId = uuidv4();
        upsertArticle({
          id: articleId,
          source_id: 'github-trending',
          title,
          url,
          summary: summary.substring(0, 500),
          author: repoPath.split('/')[0],
          published_at: new Date().toISOString(),
          category: '开源生态',
          language: 'en',
        });
        count++;
      } catch {
        // 单条解析失败跳过
      }
    });

    updateSourceLastCrawled('github-trending');
    console.log(`[GitHub] Trending: ${count} 个 AI 仓库`);
    return count;
  } catch (err: any) {
    console.error(`[GitHub Error]: ${err.message}`);
    return 0;
  }
}
