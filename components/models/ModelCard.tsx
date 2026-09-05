import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Model } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { safeHttpUrl } from '@/lib/validation';

interface ModelCardProps {
  model: Model;
}

export function ModelCard({ model }: ModelCardProps) {
  const priceSymbol = model.currency === 'CNY' ? '¥' : '$';
  const verified = Boolean(model.source_url);
  const isOpen = verified && model.is_open_source === 1;

  const topBenchmarks = (model.benchmarks || []).filter((b) =>
    ['MMLU-Pro', 'HumanEval', 'GPQA Diamond'].includes(b.benchmark_name),
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex flex-wrap items-center gap-2 break-words">
              {model.name}
              {isOpen && (
                <Badge variant="secondary" className="text-xs">
                  开源
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{model.provider}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {model.modalities}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!verified && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            历史条目，参数和价格缺少来源，待重新核验。
          </p>
        )}
        {/* 关键参数 */}
        {verified && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {model.params_b && (
              <div>
                <span className="text-muted-foreground">参数:</span>{' '}
                <span className="font-medium">{model.params_b}B</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">上下文:</span>{' '}
              <span className="font-medium">
                {model.context_window == null
                  ? '未知'
                  : model.context_window >= 1000000
                    ? `${(model.context_window / 1000000).toFixed(1)}M`
                    : `${(model.context_window / 1000).toFixed(0)}K`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">许可:</span>{' '}
              <span className="font-medium text-xs">{model.license_type}</span>
            </div>
            <div>
              <span className="text-muted-foreground">收录:</span>{' '}
              <span className="font-medium text-xs">{model.released_at?.slice(0, 7)}</span>
            </div>
          </div>
        )}

        {/* 价格 */}
        {verified && model.input_price_per_1m != null && (
          <div className="bg-muted rounded-lg p-2 text-sm">
            <div className="flex flex-wrap justify-between gap-1">
              <span>
                输入 {priceSymbol}
                {model.input_price_per_1m}/M tokens
              </span>
              <span>
                输出{' '}
                {model.output_price_per_1m == null
                  ? '未知'
                  : `${priceSymbol}${model.output_price_per_1m}/M tokens`}
              </span>
            </div>
            {model.free_tier && model.free_tier !== '无' && (
              <p className="text-xs text-green-600 mt-0.5">{model.free_tier}</p>
            )}
          </div>
        )}

        {/* 基准测试 */}
        {verified && topBenchmarks.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {topBenchmarks.map((b) => (
              <Badge key={b.benchmark_name} variant="secondary" className="text-xs">
                {b.benchmark_name}: {b.score}
              </Badge>
            ))}
          </div>
        )}

        {model.description && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">查看模型说明</summary>
            <p className="mt-2 leading-relaxed">{model.description}</p>
          </details>
        )}
        {verified && (
          <p className="text-xs text-muted-foreground">
            价格更新：{model.price_updated_at?.slice(0, 10) || '未知'} ·{' '}
            <a
              href={safeHttpUrl(model.source_url)}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              来源
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
