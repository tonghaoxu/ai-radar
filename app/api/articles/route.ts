import { NextRequest, NextResponse } from 'next/server';
import {
  getArticles,
  getArticleById,
  getArticleCount,
  getSources,
  getDistinctSourceCount,
  markArticleRead,
  markArticleStarred,
} from '@/lib/db';
import { crawlAll } from '@/lib/crawler';
import { validateApiKey } from '@/lib/auth';
import { apiError, readBody } from '@/lib/api';
import {
  booleanParam,
  dateParam,
  integerParam,
  searchParam,
  ValidationError,
} from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const id = params.get('id');
    if (id) {
      const article = getArticleById(id);
      return article
        ? NextResponse.json({ article })
        : NextResponse.json({ error: '文章不存在' }, { status: 404 });
    }
    const timezoneRaw = params.get('timezoneOffset') ?? '0';
    const timezoneOffset = Number(timezoneRaw);
    if (
      !/^-?\d+$/.test(timezoneRaw) ||
      !Number.isInteger(timezoneOffset) ||
      Math.abs(timezoneOffset) > 840
    )
      throw new ValidationError('时区偏移无效');
    const options = {
      category: params.get('category') || undefined,
      sourceId: params.get('sourceId') || undefined,
      language: params.get('language') || undefined,
      isStarred: booleanParam(params, 'isStarred'),
      search: searchParam(params),
      date: dateParam(params),
      timezoneOffset,
      limit: integerParam(params, 'limit', 50, 1, 200),
      offset: integerParam(params, 'offset', 0, 0, 1_000_000),
    };
    const articles = getArticles(options);
    const total = getArticleCount(options);
    return NextResponse.json({
      articles,
      total,
      sources: getSources(),
      sourceCount: getDistinctSourceCount(options),
      hasMore: options.offset + articles.length < total,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.authorized) return auth.response;
  try {
    const body = await readBody(request);
    if (body.action === 'crawl') {
      const results = await crawlAll();
      return NextResponse.json({ success: true, results });
    }
    if (!['markRead', 'markStarred'].includes(String(body.action)))
      throw new ValidationError('无效操作');
    if (typeof body.id !== 'string' || !body.id || body.id.length > 200)
      throw new ValidationError('文章 ID 无效');
    const value = body.action === 'markRead' ? body.isRead : body.isStarred;
    if (typeof value !== 'boolean') throw new ValidationError('状态必须为布尔值');
    const result =
      body.action === 'markRead'
        ? markArticleRead(body.id, value)
        : markArticleStarred(body.id, value);
    return result.changes
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: '文章不存在' }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
