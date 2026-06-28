'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Article {
  id: string;
  title: string;
  url: string;
  summary: string;
  content_snippet: string;
  source_id: string;
  source_name: string;
  category: string;
  language: string;
  published_at: string;
  author: string;
  is_starred: number;
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchArticle() {
      try {
        const res = await fetch(`/api/articles?id=${id}`);
        const data = await res.json();
        if (data.article) {
          setArticle(data.article);
        } else if (data.articles) {
          // fallback: search by id in articles list
          const found = data.articles.find((a: Article) => a.id === id);
          setArticle(found || null);
        }
      } catch (err) {
        console.error('获取文章失败:', err);
      }
      setLoading(false);
    }
    if (id) fetchArticle();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container px-4 py-20 text-center max-w-3xl mx-auto">
        <p className="text-4xl mb-4">📄</p>
        <p className="text-lg mb-4">文章未找到</p>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回资讯流
          </Button>
        </Link>
      </div>
    );
  }

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(article.published_at), {
        addSuffix: true,
        locale: zhCN,
      });
    } catch {
      return '';
    }
  })();

  return (
    <div className="container px-4 py-6 max-w-3xl mx-auto">
      {/* Back */}
      <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回资讯流
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary" className="text-xs">
              {article.source_name}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {article.category}
            </Badge>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
          <CardTitle className="text-xl leading-snug">{article.title}</CardTitle>
          {article.author && (
            <p className="text-sm text-muted-foreground mt-1">作者: {article.author}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AI 摘要 */}
          {article.summary && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">📋 摘要</p>
              <p className="text-sm leading-relaxed">{article.summary}</p>
            </div>
          )}

          <Separator />

          {/* 内容片段 */}
          {article.content_snippet ? (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {article.content_snippet}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              暂无内容预览，请点击下方链接查看原文
            </p>
          )}

          <Separator />

          {/* 原文链接 */}
          <a href={article.url} target="_blank" rel="noopener noreferrer">
            <Button className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              查看原文
            </Button>
          </a>

          <p className="text-xs text-muted-foreground text-center">
            原文链接: {article.url}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
