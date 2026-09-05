'use client';

import { safeHttpUrl } from '@/lib/validation';
import type { Product } from '@/lib/types';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCollection } from '@/hooks/useCollection';
import { Feedback, Pagination } from '@/components/Feedback';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ExternalLink } from 'lucide-react';

const PRODUCT_CATEGORIES = [
  '全部',
  '智能助手',
  '搜索引擎',
  '编程工具',
  '设计创作',
  '视频生成',
  '办公效率',
];

function ProductsContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('search') || '');
  const [draft, setDraft] = useState(query);
  const [page, setPage] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [showHot, setShowHot] = useState(false);
  const params = new URLSearchParams({ limit: '48', offset: String(page * 48) });
  if (selectedCategory !== '全部') params.set('category', selectedCategory);
  if (showHot) params.set('isHot', 'true');
  if (query) params.set('search', query);
  const { data, loading, error, reload } = useCollection<{
    products: Product[];
    hasMore: boolean;
    categories: string[];
  }>(`/api/products?${params}`);
  const products = data?.products || [];
  const categories = [...new Set([...PRODUCT_CATEGORIES, ...(data?.categories || [])])];

  return (
    <div className="container px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI 产品库</h1>
        <p className="text-sm text-muted-foreground">
          按用途发现 AI 工具；产品介绍为目录资料，功能与套餐以官网为准
        </p>
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
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectedCategory(cat);
              setPage(0);
            }}
          >
            {cat}
          </Button>
        ))}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Button
          variant={showHot ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setShowHot(!showHot);
            setPage(0);
          }}
        >
          🔥 热门
        </Button>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="hover:shadow-md transition-shadow flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{product.name}</CardTitle>
                  {product.is_hot === 1 && (
                    <Badge variant="destructive" className="text-xs">
                      🔥
                    </Badge>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs w-fit">
                  {product.category}
                </Badge>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between gap-2">
                <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {product.pricing_model && <p>历史套餐：{product.pricing_model}</p>}
                  {product.based_model && <p>历史模型信息: {product.based_model}</p>}
                </div>
                <a
                  href={safeHttpUrl(product.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center rounded-lg border border-border bg-background hover:bg-muted h-7 px-2.5 w-full mt-2 text-xs"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  访问
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">🧩</p>
          <p>暂无产品数据</p>
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

export default function ProductsPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">加载中…</p>}>
      <ProductsContent />
    </Suspense>
  );
}
