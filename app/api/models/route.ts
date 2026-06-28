import { NextRequest, NextResponse } from 'next/server';
import { getModels, getModelBenchmarks, getModelProviders } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || undefined;
  const isOpenSource = searchParams.has('isOpenSource')
    ? searchParams.get('isOpenSource') === 'true'
    : undefined;
  const modality = searchParams.get('modality') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const [models, providers] = await Promise.all([
      Promise.resolve(getModels({ provider, isOpenSource, modality, limit })),
      Promise.resolve(getModelProviders()),
    ]);

    // 为每个模型附加基准测试数据
    const modelsWithBenchmarks = (models as any[]).map((model) => {
      const benchmarks = getModelBenchmarks(model.id);
      return { ...model, benchmarks };
    });

    return NextResponse.json({
      models: modelsWithBenchmarks,
      providers: (providers as any[]).map((p) => p.provider),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
