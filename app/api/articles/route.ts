import { NextRequest, NextResponse } from 'next/server';
import { getArticles, getArticleById, getArticleCount, getSources, markArticleRead, markArticleStarred } from '@/lib/db';
import { crawlAll } from '@/lib/crawler';

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
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  const category = searchParams.get('category') || undefined;
  const sourceId = searchParams.get('sourceId') || undefined;
  const language = searchParams.get('language') || undefined;
  const isStarred = searchParams.get('isStarred') === 'true' || undefined;
  const search = searchParams.get('search') || undefined;
  const date = searchParams.get('date') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const [articles, total, sources] = await Promise.all([
      Promise.resolve(getArticles({ category, sourceId, language, isStarred, search, date, limit, offset })),
      Promise.resolve(getArticleCount({ category, sourceId, date })),
      Promise.resolve(getSources()),
    ]);

    return NextResponse.json({ articles, total, sources });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // 手动触发数据抓取
    if (body.action === 'crawl') {
      const results = await crawlAll();
      return NextResponse.json({ success: true, results });
    }

    // 标记已读/收藏
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
