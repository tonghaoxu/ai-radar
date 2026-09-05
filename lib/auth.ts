import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

type AuthResult =
  { authorized: true; response?: never } | { authorized: false; response: NextResponse };

export function validateApiKey(request: NextRequest): AuthResult {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const supplied =
      request.headers.get('x-api-key') ||
      request.headers.get('authorization')?.replace(/^Bearer /, '') ||
      '';
    const expected = Buffer.from(secret);
    const actual = Buffer.from(supplied);
    if (actual.length === expected.length && timingSafeEqual(actual, expected))
      return { authorized: true };
    return {
      authorized: false,
      response: NextResponse.json({ error: '此操作需要有效的管理密钥' }, { status: 401 }),
    };
  }
  // 无密钥仅支持本机开发；Origin 只能做 CSRF 检查，不能充当身份认证。
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const origin = request.headers.get('origin');
  if (
    process.env.NODE_ENV !== 'production' &&
    local &&
    (!origin || origin === url.origin) &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  ) {
    return { authorized: true };
  }
  return {
    authorized: false,
    response: NextResponse.json(
      { error: '请在服务端配置管理密钥 CRON_SECRET 后再执行写入操作' },
      { status: 503 },
    ),
  };
}
