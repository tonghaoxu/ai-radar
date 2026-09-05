import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/db';
import { apiError } from '@/lib/api';
import { searchParam, ValidationError } from '@/lib/validation';
export async function GET(request: NextRequest) {
  try {
    const query = searchParam(request.nextUrl.searchParams, 'q');
    if (!query) throw new ValidationError('请输入搜索词');
    return NextResponse.json(searchAll(query));
  } catch (error) {
    return apiError(error);
  }
}
