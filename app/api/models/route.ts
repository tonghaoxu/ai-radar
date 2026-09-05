import { NextRequest, NextResponse } from 'next/server';
import { getModels, getAllModelBenchmarks, getModelProviders } from '@/lib/db';
import { apiError } from '@/lib/api';
import { integerParam, booleanParam, searchParam } from '@/lib/validation';
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const limit = integerParam(params, 'limit', 48, 1, 200);
    const offset = integerParam(params, 'offset', 0, 0, 1_000_000);
    const models = getModels({
      provider: params.get('provider') || undefined,
      isOpenSource: booleanParam(params, 'isOpenSource'),
      modality: params.get('modality') || undefined,
      search: searchParam(params),
      limit: limit + 1,
      offset,
    });
    const benchmarks = getAllModelBenchmarks();
    return NextResponse.json({
      hasMore: models.length > limit,
      models: models.slice(0, limit).map((model) => ({
        ...model,
        benchmarks: model.source_url ? benchmarks[model.id] || [] : [],
      })),
      providers: getModelProviders().map((p) => p.provider),
    });
  } catch (error) {
    return apiError(error);
  }
}
