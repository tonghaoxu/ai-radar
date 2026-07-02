'use client';

import { useState, useEffect } from 'react';
import { ModelCard } from '@/components/models/ModelCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

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

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [showOpenSource, setShowOpenSource] = useState(false);

  useEffect(() => {
    async function fetchModels() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedProvider) params.set('provider', selectedProvider);
        if (showOpenSource) params.set('isOpenSource', 'true');
        params.set('limit', '50');

        const res = await fetch(`/api/models?${params}`);
        const data = await res.json();
        if (data.models) {
          setModels(data.models);
        }
        if (data.providers) {
          setProviders(data.providers);
        }
      } catch (err) {
        console.error('获取模型失败:', err);
      }
      setLoading(false);
    }
    fetchModels();
  }, [selectedProvider, showOpenSource]);

  return (
    <div className="container px-4 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">大模型追踪</h1>
        <p className="text-sm text-muted-foreground">
          追踪主流AI大模型的性能基准、API价格和发布动态
        </p>
      </div>

      <Separator className="mb-4" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button
          variant={!selectedProvider && !showOpenSource ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setSelectedProvider(''); setShowOpenSource(false); }}
        >
          全部
        </Button>
        <Button
          variant={showOpenSource ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOpenSource(!showOpenSource)}
        >
          🔓 仅开源
        </Button>
        <Separator orientation="vertical" className="h-6" />
        {providers.map((provider) => (
          <Button
            key={provider}
            variant={selectedProvider === provider ? 'default' : 'outline'}
            size="sm"
            onClick={() =>
              setSelectedProvider(selectedProvider === provider ? '' : provider)
            }
          >
            {provider}
          </Button>
        ))}
      </div>

      {/* Model Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {!loading && models.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-4xl mb-4">🤖</p>
          <p>暂无模型数据</p>
        </div>
      )}
    </div>
  );
}
