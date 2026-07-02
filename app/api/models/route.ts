import { NextRequest, NextResponse } from 'next/server';
import { getModels, getAllModelBenchmarks, getModelProviders } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider') || undefined;
  const isOpenSource = searchParams.has('isOpenSource')
    ? searchParams.get('isOpenSource') === 'true'
    : undefined;
  const modality = searchParams.get('modality') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    const [models, providers, allBenchmarks] = await Promise.all([
      Promise.resolve(getModels({ provider, isOpenSource, modality, limit })),
      Promise.resolve(getModelProviders()),
      Promise.resolve(getAllModelBenchmarks()),
    ]);

    // 批量附加基准测试（一次查询替代 N 次查询）
    const modelsWithBenchmarks = (models as any[]).map((model) => ({
      ...model,
      benchmarks: allBenchmarks[model.id] || [],
    }));

    return NextResponse.json({
      models: modelsWithBenchmarks,
      providers: (providers as any[]).map((p) => p.provider),
    });
  } catch (err: any) {
    console.error('[Models]:', err);
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误' },
      { status: 500 }
    );
  }
}
