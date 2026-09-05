export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const timeout = AbortSignal.timeout(init?.method === 'POST' ? 180_000 : 20_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const response = await fetch(url, { ...init, signal });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiClientError(data?.error || `请求失败（${response.status}）`, response.status);
  if (!data) throw new Error('服务器返回了无效数据');
  return data as T;
}

export async function mutateJson<T>(url: string, body: object): Promise<T> {
  let key: string | null = null;
  const send = () =>
    fetchJson<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
      body: JSON.stringify(body),
    });
  // 密钥仅存在于本次调用内，不写入浏览器存储或打包到客户端。
  try {
    return await send();
  } catch (error) {
    if (!(error instanceof ApiClientError) || error.status !== 401) throw error;
    key = window.prompt('此操作需要管理密钥（CRON_SECRET），仅用于本次请求：');
    if (!key) throw new Error('已取消操作');
    return send();
  }
}
