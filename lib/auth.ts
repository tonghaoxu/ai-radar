/**
 * API 路由验证工具
 *
 * 验证逻辑（优先级从高到低）：
 * 1. 未设置 CRON_SECRET → 本地开发模式，全部放行
 * 2. 已设置 CRON_SECRET：
 *    a. 同源请求（Origin 匹配 Host）→ 自动放行（浏览器前端调用）
 *    b. 请求头 x-api-key 匹配 → 放行（外部 cron/脚本调用）
 *    c. 其他 → 401
 */

import { NextRequest, NextResponse } from 'next/server';

export interface AuthResult {
  authorized: boolean;
  response?: NextResponse;
}

export function validateApiKey(request: NextRequest): AuthResult {
  const secret = process.env.CRON_SECRET;

  // 未设置密钥：本地开发模式，放行
  if (!secret) {
    return { authorized: true };
  }

  // 同源请求自动放行（浏览器前端调用自己的 API）
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) {
        return { authorized: true };
      }
    } catch {
      // URL 解析失败，继续检查 x-api-key
    }
  }

  // 检查 API Key
  const apiKey = request.headers.get('x-api-key');
  if (apiKey === secret) {
    return { authorized: true };
  }

  return {
    authorized: false,
    response: NextResponse.json(
      { error: '未授权访问。同源请求自动放行，外部调用请在请求头中提供有效的 x-api-key。' },
      { status: 401 }
    ),
  };
}
