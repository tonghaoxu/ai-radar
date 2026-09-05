'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCollection } from '@/hooks/useCollection';
import { Feedback } from '@/components/Feedback';
import { safeHttpUrl } from '@/lib/validation';
import type { Article, Paper, Model, Product } from '@/lib/types';

type Results = { articles: Article[]; papers: Paper[]; models: Model[]; products: Product[] };
function ResultsContent({ query }: { query: string }) {
  const { data, loading, error, reload } = useCollection<Results>(
    `/api/search?q=${encodeURIComponent(query)}`,
  );
  const groups = [
    {
      title: '资讯',
      more: `/news?search=${encodeURIComponent(query)}`,
      items: (data?.articles || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary,
        href: `/article/${item.id}`,
      })),
    },
    {
      title: '论文',
      more: `/papers?search=${encodeURIComponent(query)}`,
      items: (data?.papers || []).map((item) => ({
        id: item.id,
        title: item.title,
        description: item.abstract,
        href: `https://arxiv.org/abs/${item.arxiv_id}`,
      })),
    },
    {
      title: '模型',
      more: `/models?search=${encodeURIComponent(query)}`,
      items: (data?.models || []).map((item) => ({
        id: item.id,
        title: item.name,
        description: item.description,
        href: `/models?search=${encodeURIComponent(item.name)}`,
      })),
    },
    {
      title: '产品',
      more: `/products?search=${encodeURIComponent(query)}`,
      items: (data?.products || []).map((item) => ({
        id: item.id,
        title: item.name,
        description: item.description,
        href: safeHttpUrl(item.url) || `/products?search=${encodeURIComponent(item.name)}`,
      })),
    },
  ];
  return (
    <>
      <Feedback message={error} onRetry={reload} />
      {loading ? (
        <p role="status" className="py-12 text-center">
          正在搜索…
        </p>
      ) : (
        !error && (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.title}>
                <div className="mb-3 flex justify-between">
                  <h2 className="font-semibold">
                    {group.title}（{group.items.length}
                    {group.items.length === 20 ? '+' : ''}）
                  </h2>
                  <Link className="text-sm text-primary" href={group.more}>
                    在目录中查看 →
                  </Link>
                </div>
                {group.items.length ? (
                  <ul className="divide-y rounded-lg border px-4">
                    {group.items.map((item) => (
                      <li key={item.id} className="py-3">
                        <a
                          href={item.href}
                          target={item.href.startsWith('http') ? '_blank' : undefined}
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {item.title}
                        </a>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">没有匹配的{group.title}</p>
                )}
              </section>
            ))}
          </div>
        )
      )}
    </>
  );
}
function SearchContent() {
  const query = useSearchParams().get('q')?.trim() || '';
  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-5 text-2xl font-bold">{query ? `搜索「${query}」` : '全站搜索'}</h1>
      {query ? (
        <ResultsContent query={query} />
      ) : (
        <p className="text-muted-foreground">在顶部输入关键词，搜索资讯、论文、模型和产品。</p>
      )}
    </div>
  );
}
export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center">加载搜索…</p>}>
      <SearchContent />
    </Suspense>
  );
}
