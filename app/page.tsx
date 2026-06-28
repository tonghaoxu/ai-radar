'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';

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

  useEffect(() => {
    async function fetchToday() {
      const today = new Date().toISOString().substring(0, 10);
      try {
        const res = await fetch(`/api/articles?date=${today}&limit=20`);
        const data = await res.json();
        if (data.articles) {
          // 当天不够时，取最新的补齐
          let list = data.articles;
          if (list.length < 5) {
            const fallbackRes = await fetch('/api/articles?limit=20');
            const fallbackData = await fallbackRes.json();
            list = fallbackData.articles || [];
          }
          setArticles(list);
          setTotal(data.total || list.length);
        }
        if (data.sources) {
          setSourceCount(data.sources.filter((s: { type: string }) => s.type === 'news').length);
        }
      } catch (err) {
        console.error('获取文章失败:', err);
      }
      setLoading(false);
    }
    fetchToday();
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

  // 取前 5 条展示
  const top5 = articles.slice(0, 5);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex-1 max-w-2xl mx-auto px-6 py-12 w-full">
        {/* 顶部：日期和统计 */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">AI Radar</h1>
          <p className="text-muted-foreground">
            {dateStr} {weekday} · 今日 {total} 篇 · {sourceCount} 个来源
          </p>
        </div>

        {/* 加载状态 */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : top5.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
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
            {/* 五张卡片 */}
            <div className="space-y-3 mb-10">
              {top5.map((article) => (
                <a
                  key={article.id}
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group"
                >
                  <div className="rounded-xl border bg-card p-5 transition-all duration-150 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5">
                    <h2 className="font-semibold leading-snug mb-1.5 line-clamp-2 group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                      {article.summary || '暂无摘要'}
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

            {/* AI 总结按钮（预留） */}
            <div className="flex justify-center mb-8">
              <button
                onClick={() => alert('AI 总结功能即将上线')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border bg-secondary/50 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                AI 总结今日资讯
              </button>
            </div>
          </>
        )}

        {/* 底部导航 */}
        <div className="text-center">
          <Link
            href="/news"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            查看全部资讯
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
