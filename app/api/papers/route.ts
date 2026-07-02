import { NextRequest, NextResponse } from 'next/server';
import { getPapers, getPaperCategories } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search') || undefined;
  const isFeatured = searchParams.has('isFeatured')
    ? searchParams.get('isFeatured') === 'true'
    : undefined;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  try {
    const [papers, categories] = await Promise.all([
      Promise.resolve(getPapers({ category, search, isFeatured, limit, offset })),
      Promise.resolve(getPaperCategories()),
    ]);

    return NextResponse.json({
      papers,
      categories: (categories as any[]).map((c) => c.primary_category),
    });
  } catch (err: any) {
    console.error('[Papers]:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
