'use client';
import { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { useCollection } from '@/hooks/useCollection';
import { fetchJson, mutateJson } from '@/lib/client-api';
import { Feedback } from '@/components/Feedback';
import { errorMessage } from '@/lib/errors';
import { safeHttpUrl } from '@/lib/validation';
import type { Article } from '@/lib/types';

type Feed = { articles: Article[]; total: number; sourceCount: number };
const subscribe = () => () => {};
function formatTime(value: string | null) {
  if (!value) return '时间未知';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '时间未知';
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return new Date(timestamp).toLocaleDateString('zh-CN');
}
function HomeContent() {
  const now = new Date();
  const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const { data, loading, error, reload } = useCollection<Feed>(
    `/api/articles?date=${day}&timezoneOffset=${now.getTimezoneOffset()}&limit=10`,
  );
  const [recent, setRecent] = useState<Feed | null>(null);
  const [recentLoading, setRecentLoading] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryKey, setSummaryKey] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const feed = recent || data;
  const articles = feed?.articles || [];
  const ids = articles.map((article) => article.id).join(',');
  const loadRecent = async () => {
    setRecentLoading(true);
    try {
      setRecent(await fetchJson<Feed>('/api/articles?limit=10'));
    } catch (error) {
      setSummaryError(errorMessage(error));
    } finally {
      setRecentLoading(false);
    }
  };
  const summarize = async () => {
    if (showSummary) {
      setShowSummary(false);
      return;
    }
    setShowSummary(true);
    if (summary && summaryKey === ids) return;
    setSummaryLoading(true);
    setSummaryError('');
    setSummary('');
    try {
      const result = await mutateJson<{ summary: string }>('/api/summary', {
        articleIds: articles.slice(0, 10).map((article) => article.id),
      });
      setSummary(result.summary);
      setSummaryKey(ids);
    } catch (error) {
      setSummaryError(errorMessage(error));
    } finally {
      setSummaryLoading(false);
    }
  };
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-2xl flex-col px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs tracking-widest text-muted-foreground">AI RADAR · 每日速览</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {recent ? '最近 AI 资讯' : '今日 AI 资讯'}
          </h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}
        </p>
      </div>
      <Feedback message={error} onRetry={reload} />
      {loading ? (
        <div role="status" className="flex flex-1 items-center justify-center py-20">
          <Loader2 aria-label="加载资讯" className="h-6 w-6 animate-spin" />
        </div>
      ) : !error && !articles.length ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-muted-foreground">
          <p>{recent ? '还没有收录的资讯' : '今天暂时没有新资讯'}</p>
          {!recent && (
            <button className="text-sm underline" disabled={recentLoading} onClick={loadRecent}>
              {recentLoading ? '加载中…' : '查看最近资讯'}
            </button>
          )}
          <Link href="/news" className="text-sm underline">
            前往资讯流抓取最新内容 →
          </Link>
        </div>
      ) : (
        <div className="flex-1 space-y-3">
          <p className="mb-4 text-xs text-muted-foreground">
            {recent ? '最近收录' : '今日收录'} {feed?.total || 0} 篇 · {feed?.sourceCount || 0}{' '}
            个来源 · 精选五条速览
          </p>
          {articles.slice(0, 5).map((article) => (
            <a
              key={article.id}
              href={safeHttpUrl(article.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:shadow-sm"
            >
              <h2 className="mb-1 line-clamp-2 font-semibold leading-snug group-hover:text-primary">
                {article.title}
              </h2>
              <p className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                {article.summary || `来自 ${article.source_name || '未知来源'} 的资讯`}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{article.source_name}</span>
                <span>·</span>
                <time dateTime={article.published_at || undefined}>
                  {formatTime(article.published_at)}
                </time>
                <ExternalLink className="ml-auto h-3 w-3" />
              </div>
            </a>
          ))}
        </div>
      )}
      {showSummary && (
        <section aria-label="AI 资讯总结" className="my-5 rounded-xl border bg-muted/40 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            {recent ? '最近资讯总结' : '今日资讯总结'}
          </h2>
          {summaryLoading ? (
            <p role="status" className="text-sm">
              正在分析摘要…
            </p>
          ) : (
            <>
              <p className="whitespace-pre-wrap text-sm leading-7">{summary}</p>
              <Feedback message={summaryError} />
              <p className="mt-3 text-xs text-muted-foreground">
                基于已收录的标题和摘要生成，请结合原文核对。
              </p>
              {summary && (
                <ol className="mt-2 space-y-1 text-xs">
                  {articles.slice(0, 10).map((article, index) => (
                    <li key={article.id}>
                      <a
                        href={safeHttpUrl(article.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        [{index + 1}] {article.title}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {articles.length > 0 && (
          <button
            onClick={summarize}
            disabled={summaryLoading}
            className="inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-2 text-sm disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {summaryLoading ? '总结中…' : showSummary ? '收起总结' : 'AI 资讯总结'}
          </button>
        )}
        <Link
          href="/news"
          className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          查看全部资讯
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
export default function HomePage() {
  const client = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return client ? <HomeContent /> : <p className="p-8 text-center">加载资讯…</p>;
}
