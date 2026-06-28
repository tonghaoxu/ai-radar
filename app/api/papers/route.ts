import { NextRequest, NextResponse } from 'next/server';
import { getPapers, getPaperCategories } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const search = searchParams.get('search') || undefined;
  const isFeatured = searchParams.has('isFeatured')
    ? searchParams.get('isFeatured') === 'true'
    : undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
