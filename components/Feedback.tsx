import { Button } from '@/components/ui/button';
export function Feedback({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <div
      role={onRetry ? 'alert' : 'status'}
      className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/50 p-3 text-sm"
    >
      <span className="whitespace-pre-line break-words">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}
export function Pagination({
  page,
  hasMore,
  loading,
  onChange,
}: {
  page: number;
  hasMore: boolean;
  loading: boolean;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="分页" className="mt-6 flex items-center justify-center gap-4">
      <Button variant="outline" disabled={page === 0 || loading} onClick={() => onChange(page - 1)}>
        上一页
      </Button>
      <span className="text-sm text-muted-foreground">第 {page + 1} 页</span>
      <Button variant="outline" disabled={!hasMore || loading} onClick={() => onChange(page + 1)}>
        下一页
      </Button>
    </nav>
  );
}
