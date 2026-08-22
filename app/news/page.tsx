'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArticleCard } from '@/components/news/ArticleCard';
import { CategoryFilter } from '@/components/news/CategoryFilter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Loader2, X, AlertTriangle } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

interface Article {
  id: string;
  title: string;
  url: string;
  summary: string;
  source_id: string;
  source_name: string;
  category: string;
  language: string;
  published_at: string;
  author: string;
  is_starred: number;
  is_read: number;
}

interface Source {
  id: string;
  name: string;
  type: string;
  last_crawled_at?: string | null;
  fail_count?: number | null;
  last_error?: string | null;
}

// —— 列表状态缓存：让「详情页返回资讯流」能停在原来的位置 ——
//
// 滚动位置本身不用我们存。浏览器和 Next 路由本来就会按历史记录恢复滚动，
// 之前之所以每次都弹回顶部，是因为返回时组件重新挂载、列表是空的——
// 恢复滚动的那一刻页面根本没有高度，滚无可滚。
// 所以这里只解决「首帧就要有内容」，滚动恢复交还给平台，别去跟它抢。
const LIST_CACHE_KEY = 'ai-radar-news-cache';
const CACHE_TTL = 30 * 60 * 1000;        // 超过 30 分钟的缓存直接丢弃，走正常加载
const REVALIDATE_AFTER = 5 * 60 * 1000;  // 缓存足够新时连后台刷新都不做，避免列表跳动

interface NewsCache {
  articles: Article[];
  sources: Source[];
  total: number;
  category: string;
  sourceId: string;
  showStarred: boolean;
  searchQuery: string;
  savedAt: number;
}

/**
 * 读取列表缓存。只有当缓存里的搜索词和当前 URL 的 ?search= 一致时才认，
 * 否则（比如从导航栏发起了一次新搜索）必须重新拉取。
 */
function readListCache(urlSearch: string): NewsCache | null {
  try {
    const raw = sessionStorage.getItem(LIST_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as NewsCache;
    if (!cache?.articles?.length) return null;
    if (Date.now() - cache.savedAt > CACHE_TTL) return null;
    if ((cache.searchQuery || '') !== urlSearch) return null;
    return cache;
  } catch {
    return null;
  }
}

function NewsPageContent() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  // 惰性初始化：缓存必须在首帧就进入 state，列表才能带着完整高度渲染出来，
  // 平台的滚动恢复才有东西可以滚。放进 useEffect 就晚了——那一刻页面还是空的。
  const [restored] = useState<NewsCache | null>(() => {
    try {
      return readListCache(urlSearch);
    } catch {
      return null; // 服务端渲染时没有 sessionStorage
    }
  });

  const [articles, setArticles] = useState<Article[]>(restored?.articles ?? []);
  const [sources, setSources] = useState<Source[]>(restored?.sources ?? []);
  const [total, setTotal] = useState(restored?.total ?? 0);
  const [loading, setLoading] = useState(!restored);
  const [category, setCategory] = useState(restored?.category ?? '全部');
  const [sourceId, setSourceId] = useState(restored?.sourceId ?? '');
  const [showStarred, setShowStarred] = useState(restored?.showStarred ?? false);
  const [searchQuery, setSearchQuery] = useState(restored?.searchQuery ?? urlSearch);

  const isFirstLoad = useRef(true);

  const fetchArticles = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      // silent 用于后台刷新：不切 loading，列表就不会被转圈替换掉，滚动位置也就不会丢
      if (!opts.silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category !== '全部') params.set('category', category);
        if (sourceId) params.set('sourceId', sourceId);
        if (showStarred) params.set('isStarred', 'true');
        if (searchQuery) params.set('search', searchQuery);
        params.set('limit', '100');

        const res = await fetch(`/api/articles?${params}`);
        const data = await res.json();
        if (data.articles) {
          setArticles(data.articles);
          setTotal(data.total);
        }
        if (data.sources) {
          setSources(data.sources);
        }
      } catch (err) {
        console.error('获取文章失败:', err);
      }
      setLoading(false);
    },
    [category, sourceId, showStarred, searchQuery]
  );

  // 同步 URL search 参数到状态
  useEffect(() => {
    setSearchQuery(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      // 带着缓存回来的：够新就完全不请求，稍旧才后台静默刷新一次
      if (restored) {
        if (Date.now() - restored.savedAt > REVALIDATE_AFTER) {
          fetchArticles({ silent: true });
        }
        return;
      }
    }
    fetchArticles();
  }, [fetchArticles, restored]);

  // —— 写缓存：列表或筛选条件变化时快照一次 ——
  useEffect(() => {
    if (!articles.length) return;
    try {
      const cache: NewsCache = {
        articles,
        sources,
        total,
        category,
        sourceId,
        showStarred,
        searchQuery,
        savedAt: Date.now(),
      };
      sessionStorage.setItem(LIST_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // 配额超了就放弃缓存，不影响正常浏览
    }
  }, [articles, sources, total, category, sourceId, showStarred, searchQuery]);

  // 切换筛选条件时回到顶部（首次挂载不算，那是「恢复」场景）
  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [category, sourceId, showStarred, searchQuery]);

  const handleCrawl = useCallback(async () => {
    const res = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'crawl' }),
    });
    const data = await res.json();
    if (data.success) {
      await fetchArticles({ silent: true });
    }
  }, [fetchArticles]);

  const { lastCrawlTime, autoCrawl, crawling, setAutoCrawl, getTimeAgo } =
    useAutoRefresh({ onFetch: () => fetchArticles({ silent: true }), onCrawl: handleCrawl });

  const [manualCrawling, setManualCrawling] = useState(false);

  const handleManualCrawl = async () => {
    setManualCrawling(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl' }),
      });
      const data = await res.json();
      if (data.success) {
        const total = data.results.reduce((s: number, r: { count: number }) => s + r.count, 0);
        const sourceDetails = data.results
          .filter((r: { count: number }) => r.count > 0)
          .map((r: { source: string; type: string; count: number }) =>
            `  ${r.source}: ${r.count} 条`)
          .join('\n');
        const emptySources = data.results.filter((r: { count: number }) => r.count === 0).length;
        const msg = `抓取完成！共 ${total} 条内容\n\n${sourceDetails}${emptySources > 0 ? `\n\n${emptySources} 个源无新数据` : ''}`;
        alert(msg);
        fetchArticles({ silent: true });
      }
    } catch (err) {
      console.error('手动抓取失败:', err);
    } finally {
      setManualCrawling(false);
    }
  };

  const handleStar = async (id: string, starred: boolean) => {
    await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'markStarred', id, isStarred: starred }),
    });
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_starred: starred ? 1 : 0 } : a))
    );
  };

  const newsSources = sources.filter((s) => s.type === 'news');
  const failingSources = newsSources.filter((s) => (s.fail_count ?? 0) > 0);

  return (
    <div className="container px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI 资讯流</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 篇文章 · {sources.length} 个数据源
            {lastCrawlTime && (
              <span className="ml-2 text-xs">
                · 上次抓取: {getTimeAgo(lastCrawlTime)}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoCrawl(!autoCrawl)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              autoCrawl
                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                : 'bg-secondary text-muted-foreground'
            }`}
            title={autoCrawl ? '自动抓取已开启（每10分钟）' : '自动抓取已关闭'}
          >
            {autoCrawl ? '自动刷新 ON' : '自动刷新 OFF'}
          </button>
          <Button
            variant={showStarred ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowStarred(!showStarred)}
          >
            收藏
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualCrawl}
            disabled={crawling || manualCrawling}
          >
            {crawling || manualCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            刷新
          </Button>
        </div>
      </div>

      <Separator className="mb-4" />

      {/* 数据源失效提示：避免某个源静默挂掉好几周都没人发现 */}
      {failingSources.length > 0 && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
            <span className="font-medium">{failingSources.length} 个数据源抓取失败</span>
            <span className="mx-1">·</span>
            {failingSources.map((s, i) => (
              <span key={s.id}>
                {i > 0 && '、'}
                <span
                  className="underline decoration-dotted underline-offset-2 cursor-help"
                  title={`原因: ${s.last_error || '未知错误'}\n连续失败: ${s.fail_count} 次\n上次成功: ${s.last_crawled_at || '从未'}`}
                >
                  {s.name}
                </span>
              </span>
            ))}
            <span className="ml-1 opacity-70">（悬停查看原因）</span>
          </div>
        </div>
      )}

      {/* 搜索状态提示 */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <span className="text-sm text-muted-foreground">
            搜索「<span className="text-foreground font-medium">{searchQuery}</span>」的结果
          </span>
          <button
            onClick={() => setSearchQuery('')}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            清除
          </button>
        </div>
      )}

      <div className="mb-4">
        <CategoryFilter selected={category} onSelect={setCategory} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setSourceId('')}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
            !sourceId
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          }`}
        >
          全部来源
        </button>
        {newsSources.map((s) => {
          const failing = (s.fail_count ?? 0) > 0;
          return (
            <button
              key={s.id}
              onClick={() => setSourceId(s.id === sourceId ? '' : s.id)}
              title={
                failing
                  ? `抓取失败: ${s.last_error || '未知错误'}\n连续失败: ${s.fail_count} 次\n上次成功: ${s.last_crawled_at || '从未'}`
                  : undefined
              }
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                s.id === sourceId
                  ? 'bg-primary text-primary-foreground'
                  : failing
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:hover:bg-amber-900'
                    : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {failing && '⚠ '}
              {s.name}
            </button>
          );
        })}
      </div>

      <Separator className="mb-4" />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg mb-2">还没有文章</p>
          <p className="text-sm mb-4">点击「刷新」按钮开始抓取AI资讯</p>
          <Button onClick={handleManualCrawl} disabled={crawling || manualCrawling}>
            {crawling || manualCrawling ? '抓取中...' : '开始抓取'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} onStar={handleStar} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewsPageContent />
    </Suspense>
  );
}
