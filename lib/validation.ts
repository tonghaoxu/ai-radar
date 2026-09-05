export class ValidationError extends Error {}

export function integerParam(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
) {
  const raw = params.get(name);
  if (raw === null) return fallback;
  if (!/^\d+$/.test(raw)) throw new ValidationError(`${name} 必须是整数`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new ValidationError(`${name} 必须在 ${min} 到 ${max} 之间`);
  }
  return value;
}

export function booleanParam(params: URLSearchParams, name: string) {
  const raw = params.get(name);
  if (raw === null) return undefined;
  if (raw !== 'true' && raw !== 'false') throw new ValidationError(`${name} 必须为 true 或 false`);
  return raw === 'true';
}

export function searchParam(params: URLSearchParams, name = 'search') {
  const value = params.get(name)?.trim();
  if (value && value.length > 200) throw new ValidationError('搜索词不能超过 200 个字符');
  return value || undefined;
}

export function dateParam(params: URLSearchParams) {
  const value = params.get('date');
  if (!value) return undefined;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  ) {
    throw new ValidationError('日期必须是有效的 YYYY-MM-DD');
  }
  return value;
}

export function likePattern(value: string) {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

export function safeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
