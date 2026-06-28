/**
 * 网页抓取器 — 对没有 RSS 的中文 AI 媒体用 cheerio 抓取首页文章列表
 */
import * as cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import { upsertArticle, updateSourceLastCrawled, getSources } from '../db';

interface WebSource {
  id: string;
  name: string;
  url: string;
  /** CSS 选择器配置 */
  selector?: {
    article: string;       // 文章容器
    title: string;         // 标题（相对 article）
    link: string;          // 链接（相对 article）
    time?: string;         // 时间（相对 article）
    summary?: string;      // 摘要（相对 article）
  };
}

// 预定义各网站的抓取配置
const SITE_CONFIGS: Record<string, WebSource['selector']> = {
  jiqizhixin: {
    article: '.article-item, article, .post-item, .list-item',
    title: 'h2, h3, .title, a',
    link: 'a',
    time: 'time, .date, .time, [datetime]',
    summary: '.description, .summary, .excerpt, p',
  },
  qbitai: {
    article: '.article-list-item, article, .post-item',
    title: 'h2, h3, .title, a',
    link: 'a',
    time: 'time, .date, .time',
    summary: '.desc, .description, p',
  },
};

/** 通用网页抓取 */
async function scrapeWebSource(source: { id: string; name: string; url: string }): Promise<number> {
  try {
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[Web] ${source.name}: HTTP ${response.status}`);
      return 0;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const config = SITE_CONFIGS[source.id];
    let count = 0;

    if (!config) {
      console.log(`[Web] ${source.name}: 无抓取配置，跳过`);
      return 0;
    }

    $(config.article).each((_i, el) => {
      try {
        const $el = $(el);
        const titleEl = $el.find(config.title).first();
        const title = titleEl.text().trim();
        const link = extractUrl($el.find(config.link).first().attr('href'), source.url);
        const timeText = config.time ? $el.find(config.time).first().text().trim() || $el.find(config.time).first().attr('datetime') : '';
        const summary = config.summary ? $el.find(config.summary).first().text().trim() : '';

        if (!title || title.length < 5 || !link) return;
        // 过滤掉明显不是AI相关的内容
        if (!isTechRelated(title)) return;

        const articleId = uuidv4();
        upsertArticle({
          id: articleId,
          source_id: source.id,
          title,
          url: link,
          summary: summary.substring(0, 500) || title,
          author: '',
          published_at: parseChineseTime(timeText) || new Date().toISOString(),
          category: inferCategory(title),
          language: 'zh',
        });
        count++;
      } catch {
        // 跳过解析失败的单条
      }
    });

    updateSourceLastCrawled(source.id);
    console.log(`[Web] ${source.name}: ${count} 篇文章`);
    return count;
  } catch (err: any) {
    console.error(`[Web Error] ${source.name}: ${err.message}`);
    return 0;
  }
}

/** 抓取所有网页源 */
export async function crawlAllWeb(): Promise<{ source: string; count: number }[]> {
  const sources = getSources('news') as any[];
  const results = [];

  for (const source of sources) {
    // 跳过有 RSS 的源和有特殊抓取器的源
    if (source.rss_url) continue;
    if (source.id === 'hackernews' || source.id === 'github-trending' || source.id === 'arxiv' || source.id === 'the-batch') continue;

    const config = SITE_CONFIGS[source.id];
    if (!config) {
      console.log(`[Web] ${source.name}: 无页面选择器配置，跳过`);
      continue;
    }

    const count = await scrapeWebSource(source);
    results.push({ source: source.name, count });
  }

  return results;
}

// ========== 辅助函数 ==========

/** 处理相对路径 URL */
function extractUrl(href: string | undefined, baseUrl: string): string {
  if (!href) return '';
  if (href.startsWith('http')) return href.trim();
  if (href.startsWith('//')) return 'https:' + href.trim();
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

/** 解析中文时间格式 */
function parseChineseTime(text: string): string | null {
  if (!text) return null;
  // 尝试解析 "2024年12月15日" 格式
  const match = text.match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/);
  if (match) {
    const [_, y, m, d] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // 尝试 "2小时前" "昨天" "3天前"
  const now = new Date();
  if (/刚刚|片刻?/.test(text)) return now.toISOString();
  if (/(\d+)\s*分钟前/.test(text)) {
    const min = parseInt(RegExp.$1);
    now.setMinutes(now.getMinutes() - min);
    return now.toISOString();
  }
  if (/(\d+)\s*小时前/.test(text)) {
    const hr = parseInt(RegExp.$1);
    now.setHours(now.getHours() - hr);
    return now.toISOString();
  }
  if (/昨天/.test(text)) {
    now.setDate(now.getDate() - 1);
    return now.toISOString().substring(0, 10);
  }
  if (/(\d+)\s*天前/.test(text)) {
    const days = parseInt(RegExp.$1);
    now.setDate(now.getDate() - days);
    return now.toISOString().substring(0, 10);
  }
  return null;
}

/** 过滤非科技类内容 */
function isTechRelated(title: string): boolean {
  const keywords = [
    'AI', '模型', '大模型', 'GPT', 'Claude', 'OpenAI', 'DeepSeek', 'Gemini',
    '智能', '算法', '芯片', 'GPU', '算力', '机器人', '自动驾驶',
    'LLM', 'Agent', 'RAG', '推理', '训练', '开源', '编程', '代码',
    'ChatGPT', 'Sora', '文心', '通义', '豆包', 'Kimi', '元宝',
    '搜索', '语音', '视频生成', '图片生成', '多模态', '深度学习',
    '机器学习', '神经网络', 'Transformer', '标注', '数据',
    '融资', '发布', '上线', '评测', '基准',
  ];
  return keywords.some(kw => title.includes(kw));
}

/** 分类推断 */
function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/模型|gpt|claude|gemini|deepseek|qwen|llm|开源|推理|训练/i.test(t)) return '大模型';
  if (/芯片|gpu|nvidia|算力|h100|b200|huawei|昇腾/i.test(t)) return '算力芯片';
  if (/发布|上线|推出|融资|产品|launch/i.test(t)) return '产品发布';
  if (/融资|估值|收购|ipo|上市|funding|invest/i.test(t)) return '投融资';
  if (/政策|监管|法规|合规|policy|regulation/i.test(t)) return '政策监管';
  if (/论文|paper|arxiv|研究|research/i.test(t)) return '学术研究';
  if (/agent|智能体|mcp|skill|rag/i.test(t)) return 'AI技术';
  return 'AI综合';
}
