import { NextRequest, NextResponse } from 'next/server';
import { getPapers, getPaperCount, getPaperCategories } from '@/lib/db';
import { apiError } from '@/lib/api';
import { integerParam, booleanParam, searchParam } from '@/lib/validation';
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const options = {
      category: params.get('category') || undefined,
      search: searchParam(params),
      isFeatured: booleanParam(params, 'isFeatured'),
      limit: integerParam(params, 'limit', 50, 1, 200),
      offset: integerParam(params, 'offset', 0, 0, 1_000_000),
    };
    const papers = getPapers(options),
      total = getPaperCount(options);
    return NextResponse.json({
      papers,
      total,
      hasMore: options.offset + papers.length < total,
      categories: getPaperCategories().map((c) => c.primary_category),
    });
  } catch (error) {
    return apiError(error);
  }
}
