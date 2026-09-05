'use client';

import type { Model } from '@/lib/types';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCollection } from '@/hooks/useCollection';
import { Feedback, Pagination } from '@/components/Feedback';
import { Input } from '@/components/ui/input';
import { ModelCard } from '@/components/models/ModelCard';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

function ModelsContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [draft, setDraft] = useState(query);
  const [page, setPage] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [showOpenSource, setShowOpenSource] = useState(false);
  const params = new URLSearchParams({ limit: '48', offset: String(page * 48) });
  if (selectedProvider) params.set('provider', selectedProvider);
  if (showOpenSource) params.set('isOpenSource', 'true');
  if (query) params.set('search', query);
  const { data, loading, error, reload } = useCollection<{
    models: Model[];
    hasMore: boolean;
    providers: string[];
  }>(`/api/models?${params}`);
  const models = data?.models || [];
  const providers = data?.providers || [];

  return (
    <div className="container px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">大模型追踪</h1>
        <p className="text-sm text-muted-foreground">对比模型上下文与 API 价格，价格以来源页为准</p>
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
      <Separator className="mb-4" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          variant={!selectedProvider && !showOpenSource ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setSelectedProvider('');
            setShowOpenSource(false);
            setPage(0);
          }}
        >
          全部
        </Button>
        <Button
          variant={showOpenSource ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setShowOpenSource(!showOpenSource);
            setPage(0);
          }}
        >
          已核验开源
        </Button>
        <Separator orientation="vertical" className="h-6" />
        {providers.map((provider) => (
          <Button
            key={provider}
            variant={selectedProvider === provider ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedProvider(selectedProvider === provider ? '' : provider);
              setPage(0);
            }}
          >
            {provider}
          </Button>
        ))}
      </div>

      {/* Model Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {!loading && !error && models.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">🤖</p>
          <p>暂无匹配模型，可清除筛选或在资讯流中抓取最新数据</p>
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

export default function ModelsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">加载中…</p>}>
      <ModelsContent />
    </Suspense>
  );
}
