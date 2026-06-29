import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ModelBenchmark {
  benchmark_name: string;
  score: number;
  metric: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  version: string;
  params_b: number | null;
  context_window: number;
  modalities: string;
  license_type: string;
  is_open_source: number;
  description: string;
  released_at: string;
  input_price_per_1m: number | null;
  output_price_per_1m: number | null;
  currency: string;
  free_tier: string | null;
  benchmarks: ModelBenchmark[];
}

interface ModelCardProps {
  model: Model;
}

export function ModelCard({ model }: ModelCardProps) {
  const priceSymbol = model.currency === 'CNY' ? '¥' : '$';
  const isOpen = model.is_open_source === 1;

  const topBenchmarks = (model.benchmarks || []).filter(
    (b) => ['MMLU-Pro', 'HumanEval', 'GPQA Diamond'].includes(b.benchmark_name)
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              {model.name}
              {isOpen && <Badge variant="secondary" className="text-xs">开源</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{model.provider}</p>
          </div>
          <Badge variant="outline" className="text-xs">
            {model.modalities}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 关键参数 */}
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
              {model.context_window >= 1000000
                ? `${(model.context_window / 1000000).toFixed(1)}M`
                : `${(model.context_window / 1000).toFixed(0)}K`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">许可:</span>{' '}
            <span className="font-medium text-xs">{model.license_type}</span>
          </div>
          <div>
            <span className="text-muted-foreground">发布:</span>{' '}
            <span className="font-medium text-xs">{model.released_at?.slice(0, 7)}</span>
          </div>
        </div>

        {/* 价格 */}
        {model.input_price_per_1m != null && (
          <div className="bg-muted rounded-lg p-2 text-sm">
            <div className="flex justify-between">
              <span>输入 {priceSymbol}{model.input_price_per_1m}/M tokens</span>
              <span>输出 {priceSymbol}{model.output_price_per_1m}/M tokens</span>
            </div>
            {model.free_tier && model.free_tier !== '无' && (
              <p className="text-xs text-green-600 mt-0.5">{model.free_tier}</p>
            )}
          </div>
        )}

        {/* 基准测试 */}
        {topBenchmarks.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {topBenchmarks.map((b) => (
              <Badge key={b.benchmark_name} variant="secondary" className="text-xs">
                {b.benchmark_name}: {b.score}
              </Badge>
            ))}
          </div>
        )}

        {/* 描述 — 2行截断 + hover tooltip */}
        {model.description && (
          <Tooltip>
            <TooltipTrigger>
              <p className="text-xs text-muted-foreground line-clamp-2 cursor-default text-left">
                {model.description}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[320px] text-xs leading-relaxed">
              {model.description}
            </TooltipContent>
          </Tooltip>
        )}
      </CardContent>
    </Card>
  );
}
