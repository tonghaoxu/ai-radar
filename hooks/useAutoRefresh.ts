'use client';
import { useState, useEffect, useEffectEvent } from 'react';
const INTERVAL = 10 * 60 * 1000;
const KEY = 'ai-radar-auto-refresh';
/** 自动刷新读取列表；抓取由用户操作或服务端定时任务负责。 */
export function useAutoRefresh({ onFetch }: { onFetch: () => Promise<void> }) {
  const [autoCrawl, setEnabled] = useState(true);
  const [lastCrawlTime, setLastTime] = useState<Date | null>(null);
  const refresh = useEffectEvent(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      await onFetch();
      setLastTime(new Date());
    } catch {
      /* 页面负责错误提示 */
    }
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setEnabled(localStorage.getItem(KEY) !== 'false');
      } catch {}
    }, 0);
    const sync = (event: StorageEvent) => {
      if (event.key === KEY) setEnabled(event.newValue !== 'false');
    };
    window.addEventListener('storage', sync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', sync);
    };
  }, []);
  useEffect(() => {
    if (!autoCrawl) return;
    const timer = setInterval(() => {
      void refresh();
    }, INTERVAL);
    return () => clearInterval(timer);
  }, [autoCrawl]);
  return {
    autoCrawl,
    lastCrawlTime,
    setAutoCrawl: (enabled: boolean) => {
      setEnabled(enabled);
      try {
        localStorage.setItem(KEY, String(enabled));
      } catch {}
    },
    getTimeAgo: (date: Date | null) =>
      date ? `${Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000))} 分钟前` : '暂无',
  };
}
