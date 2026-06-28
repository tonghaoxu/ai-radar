'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArticleCard } from '@/components/news/ArticleCard';
import { CategoryFilter } from '@/components/news/CategoryFilter';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Loader2 } from 'lucide-react';

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
}

export default function HomePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [category, setCategory] = useState('全部');
  const [sourceId, setSourceId] = useState('');
  const [showStarred, setShowStarred] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== '全部') params.set('category', category);
      if (sourceId) params.set('sourceId', sourceId);
      if (showStarred) params.set('isStarred', 'true');
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
  }, [category, sourceId, showStarred]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleCrawl = async () => {
    setCrawling(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'crawl' }),
      });
      const data = await res.json();
      if (data.success) {
        const total = data.results.reduce((s: number, r: { count: number }) => s + r.count, 0);
        alert(`抓取完成！新增 ${total} 条内容`);
        fetchArticles();
      }
    } catch (err) {
      console.error('抓取失败:', err);
      alert('抓取失败，请查看控制台');
    }
    setCrawling(false);
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

  return (
    <div className="container px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">AI 资讯流</h1>
          <p className="text-sm text-muted-foreground">
            共 {total} 篇文章 · {sources.length} 个数据源
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showStarred ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowStarred(!showStarred)}
          >
            ⭐ 收藏
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCrawl}
            disabled={crawling}
          >
            {crawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            刷新
          </Button>
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Category Filter */}
      <div className="mb-4">
        <CategoryFilter selected={category} onSelect={setCategory} />
      </div>

      {/* Source Filter */}
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
        {sources
          .filter((s) => s.type === 'news')
          .map((s) => (
            <button
              key={s.id}
              onClick={() => setSourceId(s.id === sourceId ? '' : s.id)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                s.id === sourceId
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {s.name}
            </button>
          ))}
      </div>

      <Separator className="mb-4" />

      {/* Article List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">📭</p>
          <p className="text-lg mb-2">还没有文章</p>
          <p className="text-sm mb-4">点击「刷新」按钮开始抓取AI资讯</p>
          <Button onClick={handleCrawl} disabled={crawling}>
            {crawling ? '抓取中...' : '🚀 开始抓取'}
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
