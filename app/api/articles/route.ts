import { NextRequest, NextResponse } from 'next/server';
import { getArticles, getArticleById, getArticleCount, getSources, getDistinctSourceCount, markArticleRead, markArticleStarred } from '@/lib/db';
import { crawlAll } from '@/lib/crawler';
import { validateApiKey } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 单篇文章详情
  const id = searchParams.get('id');
  if (id) {
    try {
      const article = getArticleById(id);
      if (!article) {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      return NextResponse.json({ article });
    } catch (err: any) {
      console.error('[Articles] GET by id:', err);
      return NextResponse.json(
        { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
        { status: 500 }
      );
    }
  }

  const category = searchParams.get('category') || undefined;
  const sourceId = searchParams.get('sourceId') || undefined;
  const language = searchParams.get('language') || undefined;
  const isStarred = searchParams.get('isStarred') === 'true' || undefined;
  const search = searchParams.get('search') || undefined;
  const date = searchParams.get('date') || undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  try {
    const [articles, total, sources, sourceCount] = await Promise.all([
      Promise.resolve(getArticles({ category, sourceId, language, isStarred, search, date, limit, offset })),
      Promise.resolve(getArticleCount({ category, sourceId, date })),
      Promise.resolve(getSources()),
      Promise.resolve(date ? getDistinctSourceCount({ date }) : null),
    ]);

    return NextResponse.json({ articles, total, sources, sourceCount });
  } catch (err: any) {
    console.error('[Articles] GET:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // 手动触发数据抓取（需要验证）
    if (body.action === 'crawl') {
      const { authorized, response } = validateApiKey(request);
      if (!authorized) return response;

      const results = await crawlAll();
      return NextResponse.json({ success: true, results });
    }

    // 标记已读/收藏（前端同源自动放行 ∈ auth.ts）
    if (body.action === 'markRead' && body.id) {
      markArticleRead(body.id, body.isRead);
      return NextResponse.json({ success: true });
    }

    if (body.action === 'markStarred' && body.id) {
      markArticleStarred(body.id, body.isStarred);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[Articles] POST:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
