'use client';

import { safeHttpUrl } from '@/lib/validation';
import type { Article } from '@/lib/types';
import { useCollection } from '@/hooks/useCollection';
import { Feedback } from '@/components/Feedback';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Loader2, ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { NEWS_RESTORE_FLAG } from '@/lib/session-keys';

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useCollection<{ article: Article }>(
    `/api/articles?id=${encodeURIComponent(id)}`,
  );
  const article = data?.article;
  const handleBack = () => {
    let returnUrl = '/news';
    try {
      const stored = sessionStorage.getItem('ai-radar-news-return');
      if (stored && (stored === '/news' || stored.startsWith('/news?'))) {
        returnUrl = stored;
        sessionStorage.setItem(NEWS_RESTORE_FLAG, '1');
        if (window.history.length > 1) {
          router.back();
          return;
        }
      }
    } catch {}
    router.push(returnUrl);
  };

  if (error)
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Feedback message={error} onRetry={reload} />
        <Link href="/news" className="underline">
          返回资讯流
        </Link>
      </div>
    );
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
        <Link href="/news" className={cn(buttonVariants({ variant: 'outline' }))}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回资讯流
        </Link>
      </div>
    );
  }

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(article.published_at || ''), {
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
      <button
        onClick={handleBack}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        返回资讯流
      </button>

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
          <a
            href={safeHttpUrl(article.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-9 px-4 py-2 w-full text-sm font-medium"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            查看原文
          </a>

          <p className="text-xs text-muted-foreground text-center break-all">
            原文链接: {article.url}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
