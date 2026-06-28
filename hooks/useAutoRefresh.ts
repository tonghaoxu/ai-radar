'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CRAWL_INTERVAL = 30 * 60 * 1000;   // 30分钟自动全量抓取

interface UseAutoRefreshOptions {
  onFetch: () => Promise<void>;
  onCrawl: () => Promise<void>;
}

export function useAutoRefresh({ onFetch, onCrawl }: UseAutoRefreshOptions) {
  const [lastCrawlTime, setLastCrawlTime] = useState<Date | null>(null);
  const [autoCrawl, setAutoCrawl] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const initialCrawlDone = useRef(false);

  // 页面加载时自动检查是否需要抓取
  useEffect(() => {
    if (initialCrawlDone.current) return;
    initialCrawlDone.current = true;

    async function checkAndCrawl() {
      try {
        const res = await fetch('/api/articles?limit=1');
        const data = await res.json();
        const lastArticle = data.articles?.[0];
        if (lastArticle?.crawled_at) {
          const lastCrawl = new Date(lastArticle.crawled_at).getTime();
          const now = Date.now();
          if (now - lastCrawl > CRAWL_INTERVAL) {
            console.log('[自动] 距上次抓取超过30分钟，自动触发');
            const done = await doCrawl();
            if (done) await onFetch();
          }
        }
      } catch {
        // 静默失败
      }
    }
    checkAndCrawl();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 长周期：自动全量抓取
  useEffect(() => {
    if (!autoCrawl) return;

    const interval = setInterval(async () => {
      console.log('[自动] 定时全量抓取触发');
      const done = await doCrawl();
      if (done) await onFetch();
    }, CRAWL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoCrawl]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCrawl = useCallback(async (): Promise<boolean> => {
    setCrawling(true);
    try {
      await onCrawl();
      setLastCrawlTime(new Date());
      return true;
    } catch {
      return false;
    } finally {
      setCrawling(false);
    }
  }, [onCrawl]);

  const manualCrawl = useCallback(async () => {
    const done = await doCrawl();
    if (done) await onFetch();
  }, [doCrawl, onFetch]);

  const getTimeAgo = useCallback((date: Date | null): string => {
    if (!date) return '暂无';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
    return `${Math.floor(seconds / 3600)}小时前`;
  }, []);

  return {
    lastCrawlTime,
    autoCrawl,
    crawling,
    setAutoCrawl,
    manualCrawl,
    getTimeAgo,
  };
}
