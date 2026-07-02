import { NextRequest, NextResponse } from 'next/server';
import { crawlAll } from '@/lib/crawler';
import { getStats } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { authorized, response } = validateApiKey(request);
  if (!authorized) return response;

  try {
    const results = await crawlAll();
    const stats = getStats();

    return NextResponse.json({
      success: true,
      results,
      stats,
      crawledAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Cron]', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
