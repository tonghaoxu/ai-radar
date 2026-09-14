'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const CRAWL_INTERVAL = 10 * 60 * 1000;   // 10分钟自动全量抓取
const SESSION_KEY = 'ai-radar-last-crawl-check';

interface UseAutoRefreshOptions {
  onFetch: () => Promise<void>;
  onCrawl: () => Promise<void>;
}

export function useAutoRefresh({ onFetch, onCrawl }: UseAutoRefreshOptions) {
  const [lastCrawlTime, setLastCrawlTime] = useState<Date | null>(null);
  const [autoCrawl, setAutoCrawl] = useState(true);
  const [crawling, setCrawling] = useState(false);

  // 用 ref 保持回调引用最新，避免闭包过期。放到 effect 中同步，避免在渲染阶段
  // 修改 ref；自动抓取的节奏和用户可见反馈保持原有行为。
  const onFetchRef = useRef(onFetch);
  const onCrawlRef = useRef(onCrawl);
  useEffect(() => {
    onFetchRef.current = onFetch;
  }, [onFetch]);
  useEffect(() => {
    onCrawlRef.current = onCrawl;
  }, [onCrawl]);

  const doCrawl = useCallback(async (): Promise<boolean> => {
    setCrawling(true);
    try {
      await onCrawlRef.current();
      setLastCrawlTime(new Date());
      return true;
    } catch {
      return false;
    } finally {
      setCrawling(false);
    }
  }, []);

  // 页面加载时自动检查是否需要抓取（sessionStorage 防重，10分钟内不重复检查）
  useEffect(() => {
    const lastCheck = sessionStorage.getItem(SESSION_KEY);
    if (lastCheck && Date.now() - parseInt(lastCheck) < CRAWL_INTERVAL) {
      return; // 10分钟内已检查过，跳过
    }

    // 立即占位，防止首页和资讯流并发时重复触发爬虫
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));

    async function checkAndCrawl() {
      try {
        const res = await fetch('/api/articles?limit=1');
        const data = await res.json();
        const lastArticle = data.articles?.[0];
        if (lastArticle?.crawled_at) {
          const lastCrawl = new Date(lastArticle.crawled_at).getTime();
          const now = Date.now();
          if (now - lastCrawl > CRAWL_INTERVAL) {
            console.log('[自动] 距上次抓取超过10分钟，自动触发');
            const done = await doCrawl();
            if (done) await onFetchRef.current();
          }
        }
      } catch {
        // 静默失败
      }
    }
    checkAndCrawl();
  }, [doCrawl]);

  // 长周期：自动全量抓取
  useEffect(() => {
    if (!autoCrawl) return;

    const interval = setInterval(async () => {
      console.log('[自动] 定时全量抓取触发');
      const done = await doCrawl();
      if (done) await onFetchRef.current();
    }, CRAWL_INTERVAL);
    return () => clearInterval(interval);
  }, [autoCrawl, doCrawl]);

  const manualCrawl = useCallback(async () => {
    const done = await doCrawl();
    if (done) await onFetchRef.current();
  }, [doCrawl]);

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
