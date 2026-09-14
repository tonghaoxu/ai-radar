'use client';

import { useState, useEffect, useLayoutEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArticleCard } from '@/components/news/ArticleCard';
import { CategoryFilter } from '@/components/news/CategoryFilter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Loader2, X, AlertTriangle } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { NEWS_CACHE_KEY, NEWS_SCROLL_KEY, NEWS_RESTORE_FLAG } from '@/lib/session-keys';
import { mutateJson } from '@/lib/client-api';

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

// —— 让「详情页返回资讯流」停在原来的位置 ——
//
// 要同时解决两件事，缺一不可：
//
// 1) 首帧就得有内容。返回时组件是重新挂载的，列表回到空数组、渲染 loading 转圈，
//    页面高度为 0 —— 谁来恢复滚动都滚不动。所以列表快照进 sessionStorage，
//    用 useState 惰性初始化同步塞进首帧。
//
// 2) 滚动位置得自己恢复。浏览器 / Next 确实会按历史记录恢复，但那发生在
//    history 回退的瞬间，比 React 重新渲染要早，那时页面还是空的，恢复到 0。
//    所以内容就位后必须由我们再滚一次。
const CACHE_TTL = 30 * 60 * 1000;        // 超过 30 分钟的缓存直接丢弃，走正常加载
const WATCHDOG_MS = 500;                 // 恢复滚动后盯住位置的时长，见下面的说明

// 连续失败几次才算「这个源坏了」。任何一次成功都会把 fail_count 清零，
// 所以 2 次意味着约 20 分钟（抓取间隔 10 分钟）持续失败。
// 阈值定成 1 会被偶发超时误报——RSS 源偶尔超时一次很正常，报了反而降低信噪比。
const FAIL_THRESHOLD = 2;
const REVALIDATE_AFTER = 5 * 60 * 1000;  // 缓存足够新时连后台刷新都不做，避免列表跳动

// 只有「后退回来」才恢复滚动；从导航栏点进资讯流必须停在顶部。
// history.state 里没有可用的 per-entry key（Next 只塞了 __NA 和内部路由树），
// 只能靠两个信号合起来判断，各管一条路径：
//   · 浏览器自带的后退按钮 —— popstate 先于渲染到达，靠下面这个模块级时间戳
//   · 详情页的「返回资讯流」 —— router.back() 后 Next 先渲染、popstate 晚 ~45ms 才到，
//     首帧判断根本来不及，所以改由详情页在跳转前写 NEWS_RESTORE_FLAG
// 时间戳必须记在模块级：popstate 触发时组件还没挂载，记在组件里就晚了。
let lastPopstateAt = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    lastPopstateAt = Date.now();
  });
}

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
    const raw = sessionStorage.getItem(NEWS_CACHE_KEY);
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

/** 筛选条件指纹。用它判断「这组数据是不是已经在手上」，见下面对严格模式的说明。 */
function filterKey(
  category: string,
  sourceId: string,
  showStarred: boolean,
  searchQuery: string
) {
  return `${category}|${sourceId}|${showStarred}|${searchQuery}`;
}

function NewsPageContent({ urlSearch }: { urlSearch: string }) {

  // 惰性初始化：缓存必须在首帧就进入 state，列表才能带着完整高度渲染出来，
  // 后面才有东西可以滚。放进 useEffect 就晚了——那一刻页面还是空的。
  const [restored] = useState<NewsCache | null>(() => {
    try {
      return readListCache(urlSearch);
    } catch {
      return null; // 服务端渲染时没有 sessionStorage
    }
  });

  const [arrivedViaHistory] = useState(() => {
    if (typeof window === 'undefined') return false;
    // 注意：不要在这里清除标记。React 严格模式会把初始化函数跑两遍，
    // 第一遍清掉的话第二遍就读不到了。清除放在下面的 effect 里。
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(NEWS_RESTORE_FLAG) === '1';
    } catch {}
    return flagged || Date.now() - lastPopstateAt < 1500;
  });

  // 标记是一次性的，用完即焚，免得下次从导航栏进来时被误判成后退
  useEffect(() => {
    try {
      sessionStorage.removeItem(NEWS_RESTORE_FLAG);
    } catch {}
  }, []);

  // 用来判断列表是否还在文档里，见下面滚动记录处的说明
  const listRef = useRef<HTMLDivElement>(null);

  const [articles, setArticles] = useState<Article[]>(restored?.articles ?? []);
  const [sources, setSources] = useState<Source[]>(restored?.sources ?? []);
  const [total, setTotal] = useState(restored?.total ?? 0);
  const [loading, setLoading] = useState(!restored);
  const [category, setCategory] = useState(restored?.category ?? '全部');
  const [sourceId, setSourceId] = useState(restored?.sourceId ?? '');
  const [showStarred, setShowStarred] = useState(restored?.showStarred ?? false);
  const [searchQuery, setSearchQuery] = useState(restored?.searchQuery ?? urlSearch);

  // —— 为什么不用「是不是第一次」这种一次性 ref 做守卫 ——
  //
  // app router 从 Next 13.5.1 起默认开启 React 严格模式，开发环境下 effect 会跑两遍
  // （挂载 → 清理 → 再挂载）。一次性 ref 会被第一遍消费掉，第二遍就直接掉进
  // 非静默的 fetchArticles()：刚从缓存渲染出来的列表立刻被 loading 转圈清空，
  // 页面高度从两万像素塌回几百，滚动位置随之归零——就是「闪回顶部再跳回来」的成因。
  //
  // 改成记「哪一组筛选条件的数据已经在手上」，重复执行天然幂等。
  const loadedKeyRef = useRef<string | null>(
    restored
      ? filterKey(
          restored.category,
          restored.sourceId,
          restored.showStarred,
          restored.searchQuery
        )
      : null
  );
  const revalidatedRef = useRef(false);

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

  useEffect(() => {
    const key = filterKey(category, sourceId, showStarred, searchQuery);

    if (loadedKeyRef.current === key) {
      // 这组数据已经在手上（来自 sessionStorage 缓存）。
      // 只有缓存明显变旧才后台静默刷新一次：静默 = 不切 loading，
      // 列表不会被替换掉，滚动位置也就不会丢。
      if (
        restored &&
        !revalidatedRef.current &&
        Date.now() - restored.savedAt > REVALIDATE_AFTER
      ) {
        revalidatedRef.current = true;
        fetchArticles({ silent: true });
      }
      return;
    }

    loadedKeyRef.current = key;
    fetchArticles();
  }, [category, sourceId, showStarred, searchQuery, fetchArticles, restored]);

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
      sessionStorage.setItem(NEWS_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // 配额超了就放弃缓存，不影响正常浏览
    }
  }, [articles, sources, total, category, sourceId, showStarred, searchQuery]);

  // —— 记录滚动位置 ——
  // 两个坑，都踩过：
  // 1) 不要用 rAF 节流。后台标签页里 rAF 会被暂停，最后一段滚动永远落不了盘。
  //    往 sessionStorage 写一个数字本来就极便宜，滚动事件每帧至多一次，直接同步写。
  // 2) 不要在卸载时补写 window.scrollY。那一刻详情页 DOM 已经换上去了，页面高度骤降，
  //    浏览器会把 scrollY 自动钳位到 0，补写等于把好值擦成 0。
  //    这里再加一道保险：列表节点已经脱离文档就不记——不管这个事件是谁触发的。
  useEffect(() => {
    const onScroll = () => {
      if (!listRef.current?.isConnected) return;
      try {
        sessionStorage.setItem(NEWS_SCROLL_KEY, String(window.scrollY));
      } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // —— 恢复滚动位置 ——
  // 只在「缓存命中 + 是后退回来的」时候做。首帧列表已经渲染出来了，
  // 这里在浏览器绘制前滚回去，所以看不到跳动。
  useLayoutEffect(() => {
    if (!restored || !arrivedViaHistory) return;
    let y = 0;
    try {
      y = Number(sessionStorage.getItem(NEWS_SCROLL_KEY) || 0);
    } catch {}
    if (!y) return;

    window.scrollTo(0, y);

    // 滚回去还不够，之后得再盯一小会儿：浏览器的滚动锚定、Next 的路由滚动处理，
    // 以及字体/图片加载引起的高度变化，都可能在随后几十毫秒里把位置改掉。
    //
    // 用 timer 而不是 requestAnimationFrame：后台标签页里 rAF 会被暂停，
    // 补偿就永远跑不到。
    //
    // 用户一旦自己动了（滚轮/触摸/按键）立刻收手，绝不跟人抢滚动条。
    const deadline = Date.now() + WATCHDOG_MS;
    let stopped = false;
    const yieldToUser = () => {
      stopped = true;
    };
    // mousedown 是为了拖滚动条：那个动作不触发 wheel，也不触发 keydown
    const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'];
    userEvents.forEach((e) => window.addEventListener(e, yieldToUser, { passive: true }));

    const timer = setInterval(() => {
      if (stopped || Date.now() > deadline) {
        clearInterval(timer);
        return;
      }
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
    }, 32);

    return () => {
      stopped = true;
      clearInterval(timer);
      userEvents.forEach((e) => window.removeEventListener(e, yieldToUser));
    };
  }, [restored, arrivedViaHistory]);

  // 切换筛选条件时回到顶部（首次挂载不算，那是「恢复」场景）
  // 同样不能用一次性 ref：严格模式跑第二遍时会直接 scrollTo(0, 0)，
  // 把刚恢复好的滚动位置顶回去。记「已经为哪组条件归过位」才是幂等的。
  const scrolledForKeyRef = useRef<string | null>(
    filterKey(
      restored?.category ?? '全部',
      restored?.sourceId ?? '',
      restored?.showStarred ?? false,
      restored?.searchQuery ?? urlSearch
    )
  );
  useEffect(() => {
    const key = filterKey(category, sourceId, showStarred, searchQuery);
    if (scrolledForKeyRef.current === key) return;
    scrolledForKeyRef.current = key;
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
      const data = await mutateJson<{
        success: boolean;
        results: { source: string; type: string; count: number }[];
      }>('/api/articles', { action: 'crawl' });
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
    await mutateJson('/api/articles', { action: 'markStarred', id, isStarred: starred });
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, is_starred: starred ? 1 : 0 } : a))
    );
  };

  const newsSources = sources.filter((s) => s.type === 'news');
  const failingSources = newsSources.filter((s) => (s.fail_count ?? 0) >= FAIL_THRESHOLD);

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
          const failing = (s.fail_count ?? 0) >= FAIL_THRESHOLD;
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
        <div className="space-y-3" ref={listRef}>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} onStar={handleStar} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewsPageWithSearchParams() {
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  return <NewsPageContent key={urlSearch} urlSearch={urlSearch} />;
}

export default function NewsPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <NewsPageWithSearchParams />
    </Suspense>
  );
}
