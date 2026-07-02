import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { validateApiKey } from '@/lib/auth';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

interface ArticleInput {
  title: string;
  summary: string;
  source_name: string;
  url: string;
}

/** 抓取网页正文（纯文本），超时/失败返回空，最大提取 2000 字 */
async function fetchArticleText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        Accept: 'text/html,*/*',
      },
    });

    if (!res.ok) return '';

    const html = await res.text();
    const $ = cheerio.load(html);

    // 移除非内容元素
    $('script, style, nav, footer, header, aside, noscript, iframe, svg, img').remove();

    // 优先取正文容器，fallback 到 body
    const text = (
      $('article').text() ||
      $('main').text() ||
      $('[class*="content"]').first().text() ||
      $('[class*="article"]').first().text() ||
      $('[class*="post"]').first().text() ||
      $('body').text()
    )
      .replace(/[\t ]+/g, ' ')       // 合并空白
      .replace(/\n{3,}/g, '\n\n')    // 合并多空行
      .trim();

    // 截取前 2000 字符，尽量在句号处断句
    if (text.length <= 2000) return text;
    const truncated = text.substring(0, 2000);
    const lastPeriod = truncated.lastIndexOf('. ');
    const lastChinesePeriod = truncated.lastIndexOf('。');
    const cut = Math.max(lastPeriod, lastChinesePeriod);
    return cut > 1500 ? truncated.substring(0, cut + 1) : truncated;
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  // 验证 API Key（如果设置了 CRON_SECRET）
  const { authorized, response } = validateApiKey(request);
  if (!authorized) return response;

  try {
    const body = await request.json();
    const articles: ArticleInput[] = body.articles || [];

    if (!articles.length) {
      return NextResponse.json({ error: '请提供文章列表' }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key 未配置' }, { status: 500 });
    }

    // 分批并发抓取，每批最多 5 个，避免同时打开过多连接
    console.log(`[Summary] 开始抓取 ${articles.length} 篇文章原文...`);
    const CONCURRENCY = 5;
    const fetched: (ArticleInput & { content: string })[] = [];
    for (let i = 0; i < articles.length; i += CONCURRENCY) {
      const batch = articles.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (a) => {
          if (!a.url) return { ...a, content: '' };
          const text = await fetchArticleText(a.url);
          if (text) {
            console.log(`[Summary] ✓ ${a.title.substring(0, 40)}... (${text.length} 字)`);
          } else {
            console.log(`[Summary] ✗ ${a.title.substring(0, 40)}... (抓取失败或为空)`);
          }
          return { ...a, content: text };
        })
      );
      fetched.push(...batchResults);
    }

    // 构建 prompt：有原文用原文，没原文用摘要兜底
    const articleList = fetched
      .map((a, i) => {
        const body = a.content || a.summary || '(暂无内容)';
        return `${i + 1}. [${a.source_name}] ${a.title}\n   内容: ${body}`;
      })
      .join('\n\n');

    const systemPrompt = `你是一个专业的 AI 资讯分析师。用户会给你今天最新的 AI 领域文章列表（包含全文或摘要），请你用中文提炼出 3-5 个核心要点。

要求：
- 每个要点 1-2 句话，精炼直接
- 聚焦最重要的进展、趋势和产品发布
- 用 "• " 开头，每条单独一行
- 不需要问候语和结语
- 如果多篇文章涉及同一主题，合并为一个要点
- 尽量从文章正文中提取具体信息，而非仅复述标题`;

    const userPrompt = `以下是今天最新的 AI 资讯文章，请基于内容总结核心要点：\n\n${articleList}`;

    console.log(`[Summary] 发送总结请求 (prompt 长度: ${userPrompt.length} 字)...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const aiResponse = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[Summary API] DeepSeek 调用失败:', aiResponse.status, errText);
      return NextResponse.json(
        { error: `AI 调用失败: ${aiResponse.status}` },
        { status: 500 }
      );
    }

    const data = await aiResponse.json();
    const summary = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error('[Summary API] 异常:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? (err.message || '服务器错误') : '服务器内部错误' },
      { status: 500 }
    );
  }
}
