import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getProductCategories } from '@/lib/db';
import { apiError } from '@/lib/api';
import { integerParam, booleanParam, searchParam } from '@/lib/validation';
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = integerParam(params, 'limit', 48, 1, 200);
    const offset = integerParam(params, 'offset', 0, 0, 1_000_000);
    const products = getProducts({
      category: params.get('category') || undefined,
      isHot: booleanParam(params, 'isHot'),
      search: searchParam(params),
      limit: limit + 1,
      offset,
    });
    return NextResponse.json({
      products: products.slice(0, limit),
      hasMore: products.length > limit,
      categories: getProductCategories().map((c) => c.category),
    });
  } catch (error) {
    return apiError(error);
  }
}
