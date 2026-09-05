import { NextRequest, NextResponse } from 'next/server';
import { crawlAll } from '@/lib/crawler';
import { getStats } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';
import { apiError, readBody } from '@/lib/api';
import { ValidationError } from '@/lib/validation';
export async function POST(request: NextRequest) {
  const auth = validateApiKey(request);
  if (!auth.authorized) return auth.response;
  try {
    const body = request.headers.get('content-type')?.includes('application/json')
      ? await readBody(request)
      : {};
    if (body.scope !== undefined && body.scope !== 'all' && body.scope !== 'papers')
      throw new ValidationError('无效抓取范围');
    const results = await crawlAll(body.scope === 'papers' ? 'papers' : 'all');
    return NextResponse.json({
      success: true,
      results,
      stats: getStats(),
      crawledAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
