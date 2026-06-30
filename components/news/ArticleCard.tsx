'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import Link from 'next/link';
import { Star } from 'lucide-react';

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

interface ArticleCardProps {
  article: Article;
  onStar?: (id: string, starred: boolean) => void;
}

export function ArticleCard({ article, onStar }: ArticleCardProps) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    setTimeAgo(publishedAtToTimeAgo(article.published_at, article.language));
  }, [article.published_at, article.language]);

  return (
    <Card className={`group hover:shadow-md transition-shadow ${article.is_read ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Meta */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="secondary" className="text-xs font-normal">
                {article.source_name}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {article.category}
              </Badge>
              <span className="text-xs text-muted-foreground">{timeAgo}</span>
            </div>

            {/* Title */}
            <Link href={`/article/${article.id}`} className="hover:underline">
              <h3 className="text-base font-semibold leading-snug mb-1 line-clamp-2">
                {article.title}
              </h3>
            </Link>

            {/* Summary */}
            {article.summary && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                {article.summary}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {article.author && <span>👤 {article.author}</span>}
                <span>{article.language === 'zh' ? '🇨🇳' : '🇺🇸'}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.preventDefault();
                    onStar?.(article.id, !article.is_starred);
                  }}
                >
                  <Star
                    className={`h-4 w-4 ${
                      article.is_starred ? 'fill-yellow-400 text-yellow-400' : ''
                    }`}
                  />
                </Button>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-border bg-background hover:bg-muted h-7 px-2.5 text-xs"
                >
                  原文 →
                </a>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function publishedAtToTimeAgo(dateStr: string, lang: string): string {
  try {
    const date = new Date(dateStr);
    const locale = lang === 'zh' ? zhCN : enUS;
    return formatDistanceToNow(date, { addSuffix: true, locale });
  } catch {
    return '';
  }
}
