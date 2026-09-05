'use client';
import {
  Suspense,
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleCard } from '@/components/news/ArticleCard';
import { CategoryFilter } from '@/components/news/CategoryFilter';
import { Button } from '@/components/ui/button';
import { Feedback, Pagination } from '@/components/Feedback';
import { RefreshCw, Loader2, X } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useCollection } from '@/hooks/useCollection';
import { mutateJson } from '@/lib/client-api';
import { errorMessage } from '@/lib/errors';
import { NEWS_CACHE_KEY, NEWS_SCROLL_KEY, NEWS_RESTORE_FLAG } from '@/lib/session-keys';
import type { Article, Source } from '@/lib/types';
import type { CrawlResult } from '@/lib/crawler';

type Feed = { articles: Article[]; sources: Source[]; total: number; hasMore: boolean };
const subscribe = () => () => {};
const EMPTY: Article[] = [];

function NewsFeed() {
  const router = useRouter(),
    searchParams = useSearchParams();
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '全部';
  const sourceId = searchParams.get('sourceId') || '';
  const starred = searchParams.get('isStarred') === 'true';
  const rawPage = Number(searchParams.get('page') || 0);
  const page = Number.isInteger(rawPage) && rawPage >= 0 && rawPage <= 25_000 ? rawPage : 0;
  const params = new URLSearchParams({ limit: '40', offset: String(page * 40) });
  if (search) params.set('search', search);
  if (category !== '全部') params.set('category', category);
  if (sourceId) params.set('sourceId', sourceId);
  if (starred) params.set('isStarred', 'true');
  const url = `/api/articles?${params}`;
  const [initial] = useState<Feed | null>(() => {
    try {
      const cache = JSON.parse(sessionStorage.getItem(NEWS_CACHE_KEY) || 'null');
      return cache?.url === url && Date.now() - cache.savedAt < 300_000 ? cache.data : null;
    } catch {
      return null;
    }
  });
  const { data, loading, error, reload } = useCollection<Feed>(url, initial);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState('');
  const [crawling, setCrawling] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const { autoCrawl, setAutoCrawl } = useAutoRefresh({ onFetch: async () => reload() });
  const articles = (data?.articles || EMPTY)
    .map((article) =>
      overrides[article.id] === undefined
        ? article
        : { ...article, is_starred: overrides[article.id] },
    )
    .filter((article) => !starred || article.is_starred);
  const sources = data?.sources || [];
  const failing = sources.filter((source) => source.fail_count >= 2);

  useEffect(() => {
    if (!data) return;
    try {
      sessionStorage.setItem(NEWS_CACHE_KEY, JSON.stringify({ url, data, savedAt: Date.now() }));
    } catch {}
  }, [data, url]);
  useEffect(() => {
    const save = () => {
      if (!listRef.current?.isConnected) return;
      try {
        sessionStorage.setItem(NEWS_SCROLL_KEY, JSON.stringify({ url, y: window.scrollY }));
      } catch {}
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => window.removeEventListener('scroll', save);
  }, [url]);
  useLayoutEffect(() => {
    if (!data) return;
    try {
      if (sessionStorage.getItem(NEWS_RESTORE_FLAG) !== '1') return;
      sessionStorage.removeItem(NEWS_RESTORE_FLAG);
      const saved = JSON.parse(sessionStorage.getItem(NEWS_SCROLL_KEY) || 'null');
      if (saved?.url === url) window.scrollTo(0, saved.y);
    } catch {}
  }, [data, url]);

  const select = (name: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== 'page') next.delete('page');
    router.push(`/news${next.size ? `?${next}` : ''}`);
  };
  const crawl = async () => {
    setCrawling(true);
    setNotice('正在抓取资讯，已有内容仍可浏览…');
    try {
      const result = await mutateJson<{ results: CrawlResult[] }>('/api/articles', {
        action: 'crawl',
      });
      const failures = result.results.filter((item) => item.error);
      setNotice(
        `抓取结束：处理 ${result.results.reduce((sum, item) => sum + item.count, 0)} 条内容（包含更新）。${failures.length ? ` ${failures.length} 个来源失败：${failures.map((item) => item.source).join('、')}` : ''}`,
      );
      reload();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setCrawling(false);
    }
  };
  const star = async (id: string, value: boolean) => {
    try {
      await mutateJson('/api/articles', { action: 'markStarred', id, isStarred: value });
      setOverrides((previous) => ({ ...previous, [id]: Number(value) }));
      try {
        sessionStorage.removeItem(NEWS_CACHE_KEY);
      } catch {}
      reload();
    } catch (error) {
      setNotice(errorMessage(error));
    }
  };
  const resetFilters = () => router.push('/news');
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">AI 资讯流</h1>
          <p className="text-sm text-muted-foreground">
            共 {data?.total ?? 0} 篇文章 · {sources.length} 个数据源
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            aria-pressed={autoCrawl}
            onClick={() => setAutoCrawl(!autoCrawl)}
            title="每 10 分钟更新列表"
          >
            自动刷新 {autoCrawl ? 'ON' : 'OFF'}
          </Button>
          <Button
            size="sm"
            variant={starred ? 'default' : 'outline'}
            aria-pressed={starred}
            onClick={() => select('isStarred', starred ? '' : 'true')}
          >
            收藏
          </Button>
          <Button size="sm" variant="outline" disabled={loading} onClick={reload}>
            <RefreshCw className="mr-1 h-4 w-4" />
            刷新列表
          </Button>
          <Button size="sm" disabled={crawling} onClick={crawl}>
            {crawling && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {crawling ? '抓取中' : '抓取最新'}
          </Button>
        </div>
      </div>
      <Feedback message={notice} />
      {failing.length > 0 && (
        <details className="mb-4 rounded-lg border border-amber-300 p-3 text-sm">
          <summary className="cursor-pointer">
            {failing.length} 个数据源连续抓取失败，点击查看
          </summary>
          <ul className="mt-2 space-y-1">
            {failing.map((source) => (
              <li key={source.id}>
                {source.name}：{source.last_error}（连续 {source.fail_count} 次）
              </li>
            ))}
          </ul>
        </details>
      )}
      {search && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-muted p-3 text-sm">
          <span>搜索「{search}」</span>
          <Button size="sm" variant="ghost" onClick={() => select('search', '')}>
            <X className="h-4 w-4" />
            清除搜索
          </Button>
        </div>
      )}
      <CategoryFilter
        selected={category}
        onSelect={(value) => select('category', value === '全部' ? '' : value)}
      />
      <div className="my-4 flex flex-wrap gap-2" aria-label="来源筛选">
        <Button
          size="sm"
          variant={!sourceId ? 'default' : 'outline'}
          onClick={() => select('sourceId', '')}
        >
          全部来源
        </Button>
        {sources
          .filter((source) => source.type === 'news' || source.type === 'paper')
          .map((source) => (
            <Button
              key={source.id}
              size="sm"
              variant={sourceId === source.id ? 'default' : 'outline'}
              aria-pressed={sourceId === source.id}
              onClick={() => select('sourceId', source.id === sourceId ? '' : source.id)}
            >
              {source.name}
            </Button>
          ))}
      </div>
      <Feedback message={error} onRetry={reload} />
      {loading && !data ? (
        <div role="status" className="py-20 text-center">
          <Loader2 aria-label="加载资讯" className="mx-auto h-8 w-8 animate-spin" />
        </div>
      ) : !error && articles.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="mb-4">
            {search || starred || sourceId || category !== '全部'
              ? '没有符合当前筛选的文章'
              : '还没有文章，抓取最新资讯开始阅读'}
          </p>
          {search || starred || sourceId || category !== '全部' ? (
            <Button onClick={resetFilters}>清除筛选</Button>
          ) : (
            <Button onClick={crawl} disabled={crawling}>
              开始抓取
            </Button>
          )}
        </div>
      ) : (
        <div
          className="space-y-3"
          ref={listRef}
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest('a[href^="/article/"]')) {
              try {
                sessionStorage.setItem(NEWS_RESTORE_FLAG, '1');
                sessionStorage.setItem('ai-radar-news-return', `/news?${searchParams}`);
                sessionStorage.setItem(NEWS_SCROLL_KEY, JSON.stringify({ url, y: window.scrollY }));
              } catch {}
            }
          }}
        >
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} onStar={star} />
          ))}
        </div>
      )}
      {!error && (
        <Pagination
          page={page}
          hasMore={data?.hasMore ?? false}
          loading={loading}
          onChange={(value) => select('page', String(value))}
        />
      )}
    </div>
  );
}

export default function NewsPage() {
  // 缓存只在 hydration 完成后读取，避免服务端空列表与客户端缓存不一致。
  const client = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  return (
    <Suspense fallback={<p className="p-8 text-center">加载资讯…</p>}>
      {client ? <NewsFeed /> : <p className="p-8 text-center">加载资讯…</p>}
    </Suspense>
  );
}
