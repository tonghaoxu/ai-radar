import { NextResponse } from 'next/server';
import { CrawlBusyError } from './errors';
import { ValidationError } from './validation';

export function apiError(error: unknown) {
  if (error instanceof CrawlBusyError)
    return NextResponse.json(
      { error: error.message },
      { status: 409, headers: { 'Retry-After': '60' } },
    );
  if (error instanceof ValidationError || error instanceof SyntaxError) {
    return NextResponse.json(
      { error: error instanceof ValidationError ? error.message : '请求 JSON 格式错误' },
      { status: 400 },
    );
  }
  console.error('[API]', error);
  return NextResponse.json({ error: '服务器内部错误，请稍后重试' }, { status: 500 });
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ValidationError('请求必须使用 application/json');
  const reader = request.body?.getReader();
  if (!reader) throw new ValidationError('请求正文不能为空');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32_768) {
        await reader.cancel();
        throw new ValidationError('请求正文过大');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ValidationError('请求正文必须是对象');
  return body as Record<string, unknown>;
}
