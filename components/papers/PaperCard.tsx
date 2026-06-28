import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

interface PaperCardProps {
  paper: Paper;
}

export function PaperCard({ paper }: PaperCardProps) {
  const mainCategories = (paper.categories || '')
    .split(',')
    .slice(0, 3)
    .map((c) => c.trim());

  const authorsList = (paper.authors || '')
    .split(',')
    .slice(0, 3)
    .map((a) => a.trim());

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* 分类标签 */}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {mainCategories.map((cat) => (
                <Badge key={cat} variant="secondary" className="text-xs">
                  {cat}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                {paper.published_at?.slice(0, 10)}
              </span>
            </div>

            {/* 标题 */}
            <a
              href={paper.pdf_url || `https://arxiv.org/abs/${paper.arxiv_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              <h3 className="text-base font-semibold leading-snug mb-1 line-clamp-2">
                {paper.title}
              </h3>
            </a>

            {/* 作者 */}
            {authorsList.length > 0 && (
              <p className="text-sm text-muted-foreground mb-2">
                {authorsList.join(', ')}
                {(paper.authors || '').split(',').length > 3 ? ' et al.' : ''}
              </p>
            )}

            {/* 摘要 */}
            {paper.abstract && (
              <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                {paper.abstract}
              </p>
            )}

            {/* 链接 */}
            <div className="flex items-center gap-2 text-xs">
              <a
                href={paper.pdf_url || `https://arxiv.org/abs/${paper.arxiv_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                📄 arXiv: {paper.arxiv_id}
              </a>
              {paper.code_url && (
                <a
                  href={paper.code_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  💻 代码
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
