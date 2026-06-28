import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getProductCategories } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const isHot = searchParams.has('isHot')
    ? searchParams.get('isHot') === 'true'
    : undefined;
  const limit = parseInt(searchParams.get('limit') || '100');

  try {
    const [products, categories] = await Promise.all([
      Promise.resolve(getProducts({ category, isHot, limit })),
      Promise.resolve(getProductCategories()),
    ]);

    return NextResponse.json({
      products,
      categories: (categories as any[]).map((c) => c.category),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
