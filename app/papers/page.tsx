'use client';

import type { Paper } from '@/lib/types';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCollection } from '@/hooks/useCollection';
import { Feedback, Pagination } from '@/components/Feedback';
import { mutateJson } from '@/lib/client-api';
import { errorMessage } from '@/lib/errors';
import type { CrawlResult } from '@/lib/crawler';
import { Input } from '@/components/ui/input';
import { PaperCard } from '@/components/papers/PaperCard';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw } from 'lucide-react';
import { getCategoryFullName } from '@/lib/arxiv-categories';

const PAPER_CATEGORIES = ['全部', 'cs.AI', 'cs.CL', 'cs.CV', 'cs.LG'];

function PapersContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [draft, setDraft] = useState(query);
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [fetching, setFetching] = useState(false);
  const [notice, setNotice] = useState('');
  const params = new URLSearchParams({ limit: '48', offset: String(page * 48) });
  if (selectedCategory !== '全部') params.set('category', selectedCategory);
  if (query) params.set('search', query);
  const { data, loading, error, reload } = useCollection<{
    papers: Paper[];
    hasMore: boolean;
    categories: string[];
    total: number;
  }>(`/api/papers?${params}`);
  const papers = data?.papers || [];
  const categories = data?.categories || [];
  const handleFetchArxiv = async () => {
    setFetching(true);
    setNotice('正在抓取 arXiv 论文…');
    try {
      const result = await mutateJson<{ results: CrawlResult[] }>('/api/cron', { scope: 'papers' });
      const failure = result.results.find((item) => item.error);
      setNotice(
        failure
          ? `抓取失败：${failure.error}`
          : `处理了 ${result.results.reduce((sum, item) => sum + item.count, 0)} 篇论文（包含更新）`,
      );
      reload();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setFetching(false);
    }
  };
  return (
    <div className="container px-4 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">论文追踪</h1>
          <p className="text-sm text-muted-foreground">
            追踪 arXiv 最新AI论文 (cs.AI, cs.CL, cs.CV, cs.LG)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleFetchArxiv} disabled={fetching}>
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          抓取arXiv
        </Button>
      </div>

      <form
        className="my-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
          setPage(0);
        }}
      >
        <Input
          type="search"
          aria-label="搜索当前目录"
          placeholder="输入关键词搜索…"
          maxLength={200}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outline">
          搜索
        </Button>
      </form>
      <Feedback message={error} onRetry={reload} />
      <Feedback message={notice} />
      <Separator className="mb-4" />

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PAPER_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedCategory(cat);
              setPage(0);
            }}
            title={cat !== '全部' ? getCategoryFullName(cat) : undefined}
          >
            {cat}
          </Button>
        ))}
        {categories
          .filter((c) => !PAPER_CATEGORIES.includes(c))
          .map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedCategory(cat);
                setPage(0);
              }}
              title={getCategoryFullName(cat)}
            >
              {cat}
            </Button>
          ))}
      </div>

      {/* Paper List */}
      {error ? null : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">📄</p>
          <p className="text-lg mb-2">暂无符合筛选的论文</p>
          <p className="text-sm mb-4">点击「抓取arXiv」按钮获取最新AI论文</p>
          <Button onClick={handleFetchArxiv} disabled={fetching}>
            {fetching ? '抓取中...' : '🚀 抓取arXiv论文'}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map((paper) => (
            <PaperCard key={paper.id} paper={paper} />
          ))}
        </div>
      )}
      {!error && (
        <Pagination
          page={page}
          hasMore={data?.hasMore ?? false}
          loading={loading}
          onChange={(value) => {
            setPage(value);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </div>
  );
}

export default function PapersPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">加载中…</p>}>
      <PapersContent />
    </Suspense>
  );
}
