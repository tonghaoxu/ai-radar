'use client';

import { useState, useEffect } from 'react';
import { PaperCard } from '@/components/papers/PaperCard';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw } from 'lucide-react';
import { getCategoryFullName } from '@/lib/arxiv-categories';

interface Paper {
  id: string;
  arxiv_id: string;
  title: string;
  authors: string;
  abstract: string;
  categories: string;
  primary_category: string;
  published_at: string;
  pdf_url: string;
  code_url: string;
}

const PAPER_CATEGORIES = [
  '全部',
  'cs.AI',
  'cs.CL',
  'cs.CV',
  'cs.LG',
];

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('全部');

  const fetchPapers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== '全部') params.set('category', selectedCategory);
      params.set('limit', '60');

      const res = await fetch(`/api/papers?${params}`);
      const data = await res.json();
      if (data.papers) {
        setPapers(data.papers);
      }
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error('获取论文失败:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPapers();
  }, [selectedCategory]);

  const handleFetchArxiv = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      if (data.success) {
        alert(`arXiv抓取完成！总论文数: ${data.stats.paperCount}`);
        fetchPapers();
      }
    } catch (err) {
      console.error('arXiv抓取失败:', err);
    }
    setFetching(false);
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
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchArxiv}
          disabled={fetching}
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          抓取arXiv
        </Button>
      </div>

      <Separator className="mb-4" />

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PAPER_CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
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
              onClick={() => setSelectedCategory(cat)}
              title={getCategoryFullName(cat)}
            >
              {cat}
            </Button>
          ))}
      </div>

      {/* Paper List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">📄</p>
          <p className="text-lg mb-2">还没有论文</p>
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
    </div>
  );
}
