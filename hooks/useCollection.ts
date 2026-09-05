'use client';
import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/client-api';
import { errorMessage } from '@/lib/errors';

/** 取消过期请求，防止快速切换筛选时旧响应覆盖新结果。 */
export function useCollection<T>(url: string, initial?: T | null) {
  const [state, setState] = useState<{ url: string; data: T | null; error: string }>({
    url: initial ? url : '',
    data: initial ?? null,
    error: '',
  });
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetchJson<T>(url, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ url, data, error: '' });
          setPending(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({ url, data: null, error: errorMessage(error) });
          setPending(false);
        }
      });
    return () => controller.abort();
  }, [url, revision]);
  return {
    data: state.url === url ? state.data : null,
    error: state.url === url ? state.error : '',
    loading: state.url !== url || pending,
    reload: () => {
      setPending(true);
      setRevision((value) => value + 1);
    },
  };
}
