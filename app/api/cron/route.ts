import { NextRequest, NextResponse } from 'next/server';
import { crawlAll } from '@/lib/crawler';
import { getStats } from '@/lib/db';
import { validateApiKey } from '@/lib/auth';

function checkAuth(request: NextRequest) {
  const { authorized, response } = validateApiKey(request);
  if (!authorized) return response;
  return null;
}

export async function POST(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

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
export async function GET(request: NextRequest) {
  const authError = checkAuth(request);
  if (authError) return authError;

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
