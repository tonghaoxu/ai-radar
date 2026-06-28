import { NextResponse } from 'next/server';
import { crawlAll } from '@/lib/crawler';
import { getStats } from '@/lib/db';

export async function POST() {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// 也允许 GET 方便调试
export async function GET() {
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
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
