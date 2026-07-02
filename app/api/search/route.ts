import { NextRequest, NextResponse } from 'next/server';
import { searchAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';

  if (!q || q.length < 2) {
    return NextResponse.json({ error: '搜索词至少2个字符' }, { status: 400 });
  }

  try {
    // 转义 LIKE 通配符，避免用户输入 % 或 _ 被当作通配符
    const escaped = q.replace(/[%_]/g, '\\$&');
    const results = searchAll(escaped);
    return NextResponse.json(results);
  } catch (err: any) {
    console.error('[Search]:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
