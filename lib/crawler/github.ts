import { errorDetail } from '../errors';
/**
 * GitHub Trending 抓取器 — 用 cheerio 抓取当日热门 AI 仓库
 */
import * as cheerio from 'cheerio';
import { randomUUID as uuidv4 } from 'node:crypto';
import { upsertArticle, updateSourceLastCrawled, markSourceFailure } from '../db';
import { isAiRelated } from './keywords';

export async function crawlGitHubTrending(): Promise<number> {
  try {
    const response = await fetch('https://github.com/trending?since=daily', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new Error(`GitHub HTTP ${response.status}`);
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

        // 只收录 AI 相关仓库（复用共享关键词列表）
        if (!isAiRelated(`${repoPath} ${description}`)) return;

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

    if ($('article.Box-row').length === 0) throw new Error('GitHub 页面结构已变化');
    updateSourceLastCrawled('github-trending');
    console.log(`[GitHub] Trending: ${count} 个 AI 仓库`);
    return count;
  } catch (err) {
    const detail = errorDetail(err);
    console.error(`[GitHub Error]: ${detail}`);
    markSourceFailure('github-trending', detail);
    throw err;
  }
}
