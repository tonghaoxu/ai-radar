'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, ExternalLink, ArrowRight, ArrowDownUp } from 'lucide-react';

const CRAWL_INTERVAL = 10 * 60 * 1000;
const SESSION_KEY = 'ai-radar-last-crawl-check';

interface Article {
  id: string;
  title: string;
  url: string;
  summary: string;
  source_name: string;
  published_at: string;
}

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [sourceCount, setSourceCount] = useState(0);
  const [showNextFive, setShowNextFive] = useState(false);

  useEffect(() => {
    async function init() {
      const lastCheck = sessionStorage.getItem(SESSION_KEY);
      const shouldCheck = !lastCheck || Date.now() - parseInt(lastCheck) > CRAWL_INTERVAL;

      // 检查是否需要自动抓取（与资讯流共享 sessionStorage 防重）
      if (shouldCheck) {
        try {
          const res = await fetch('/api/articles?limit=1');
          const data = await res.json();
          const lastArticle = data.articles?.[0];
          if (lastArticle?.crawled_at) {
            const lastCrawl = new Date(lastArticle.crawled_at).getTime();
            if (Date.now() - lastCrawl > CRAWL_INTERVAL) {
              console.log('[首页] 距上次抓取超过10分钟，自动触发');
              sessionStorage.setItem(SESSION_KEY, String(Date.now()));
              await fetch('/api/articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'crawl' }),
              });
            } else {
              sessionStorage.setItem(SESSION_KEY, String(Date.now()));
            }
          }
        } catch {}
      }

      // 获取今日文章
      const today = new Date().toISOString().substring(0, 10);
      try {
        const res = await fetch(`/api/articles?date=${today}&limit=20`);
        const data = await res.json();
        if (data.articles) {
          let list = data.articles;
          if (list.length < 5) {
            const fallbackRes = await fetch('/api/articles?limit=20');
            const fallbackData = await fallbackRes.json();
            list = fallbackData.articles || [];
          }
          setArticles(list);
          setTotal(data.total || list.length);
        }
        if (data.sourceCount !== null && data.sourceCount !== undefined) {
          setSourceCount(data.sourceCount);
        }
      } catch (err) {
        console.error('获取文章失败:', err);
      }
      setLoading(false);
    }
    init();
  }, []);

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[today.getDay()];

  const formatTime = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return d.toISOString().substring(0, 10);
  };

  // 取前 5 条或 6-10 条展示
  const displayedArticles = showNextFive ? articles.slice(5, 10) : articles.slice(0, 5);
  const hasMorePages = articles.length > 5;

  return (
    <div className="max-w-2xl mx-auto px-6 h-[calc(100vh-3.5rem)] flex flex-col">
      {/* 加载状态 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : displayedArticles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <p className="mb-4">暂无今日资讯</p>
          <Link
            href="/news"
            className="text-sm underline underline-offset-4 hover:text-foreground"
          >
            前往资讯流手动抓取 →
          </Link>
        </div>
      ) : (
        <>
          {/* 五张卡片 — 垂直居中 */}
          <div className="flex-1 flex flex-col justify-center space-y-3">
            {displayedArticles.map((article) => (
              <a
                key={article.id}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <div className="rounded-xl border bg-card p-4 transition-all duration-150 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                  <h2 className="font-semibold leading-snug mb-1 line-clamp-2 group-hover:text-primary transition-colors">
                    {article.title}
                  </h2>
                  <p className="text-sm text-muted-foreground line-clamp-1 mb-1.5">
                    {article.summary || `来自 ${article.source_name} 的 AI 资讯`}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{article.source_name}</span>
                    <span>·</span>
                    <span>{formatTime(article.published_at)}</span>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </a>
            ))}
          </div>

          {/* 底部栏：日期 | AI总结 | 查看全部 */}
          <div className="grid grid-cols-3 items-center py-4 border-t border-border/40">
            <span className="text-sm text-muted-foreground text-left">
              {dateStr} {weekday}
            </span>
            <div className="flex justify-center">
              {hasMorePages && (
                <button
                  onClick={() => setShowNextFive(!showNextFive)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border bg-secondary/50 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                >
                  <ArrowDownUp className="h-3.5 w-3.5" />
                  {showNextFive ? '返回前 5 条' : '查看 6~10 条'}
                </button>
              )}
            </div>
            <div className="flex justify-end">
              <Link
                href="/news"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                查看全部资讯
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
