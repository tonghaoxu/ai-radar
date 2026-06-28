import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (!q || q.length < 2) {
    return NextResponse.json({ error: '搜索词至少2个字符' }, { status: 400 });
  }

  try {
    const results = searchAll(q);
    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
