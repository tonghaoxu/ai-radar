/**
 * 模型数据爬虫 — 从 OpenRouter API 获取最新模型和价格
 * OpenRouter API 免费、无需认证
 */
import { getDb } from '../db';

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: {
    modality?: string;
    tokenizer?: string;
  };
  pricing: {
    prompt: string;
    completion: string;
  };
}

export async function fetchOpenRouterModels(): Promise<number> {
  try {
    const response = await fetch(OPENROUTER_API, {
      headers: { 'User-Agent': 'AI-News-Hub/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[OpenRouter] HTTP ${response.status}: ${response.statusText}`);
      return 0;
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data || [];
    console.log(`[OpenRouter] 获取到 ${models.length} 个模型`);

    // 只处理主流厂商的模型
    const majorProviders = [
      'openai', 'anthropic', 'google', 'meta', 'mistral',
      'deepseek', 'qwen', 'cohere', 'xai', 'amazon',
      'microsoft', 'perplexity', 'alibaba', '01-ai', 'zhipu',
    ];

    const db = getDb();
    let count = 0;

    // 先获取现有的模型 id 列表用于判断新增
    const existingModels = new Set(
      (db.prepare('SELECT id FROM models').all() as any[]).map((r: any) => r.id)
    );

    const upsertModel = db.prepare(`
      INSERT INTO models (id, name, provider, version, params_b, context_window, modalities, license_type, is_open_source, description, released_at)
      VALUES (@id, @name, @provider, @version, @params_b, @context_window, @modalities, @license_type, @is_open_source, @description, @released_at)
      ON CONFLICT(id) DO UPDATE SET
        name = @name,
        context_window = @context_window,
        modalities = @modalities,
        description = @description
    `);

    const upsertPrice = db.prepare(`
      INSERT INTO model_prices (id, model_id, input_price_per_1m, output_price_per_1m, currency, source_url)
      VALUES (@id, @model_id, @input_price_per_1m, @output_price_per_1m, @currency, @source_url)
      ON CONFLICT(id) DO UPDATE SET
        input_price_per_1m = @input_price_per_1m,
        output_price_per_1m = @output_price_per_1m,
        updated_at = datetime('now')
    `);

    for (const model of models) {
      const modelId = model.id.replace('/', '-').replace(/[^a-zA-Z0-9-_.]/g, '');

      // 识别厂商
      const provider = model.id.split('/')[0] || 'unknown';
      const providerName = mapProviderName(provider);

      // 跳过非主流厂商（减少噪音）
      if (!majorProviders.includes(provider.toLowerCase())) {
        continue;
      }

      // 确定是否开源
      const isOpenSource = ['meta', 'mistral', 'deepseek', 'qwen'].includes(provider.toLowerCase()) ? 1 : 0;

      // 价格：每百万 token 价格（OpenRouter 返回的是 per-token，需 ×1,000,000）
      const inputPrice = parseFloat(model.pricing.prompt || '0') * 1_000_000;
      const outputPrice = parseFloat(model.pricing.completion || '0') * 1_000_000;

      // 跳过价格为 0 的（通常是免费模型或无定价信息）
      if (inputPrice === 0 && outputPrice === 0 && existingModels.has(modelId)) {
        continue;
      }

      try {
        upsertModel.run({
          id: modelId,
          name: model.name || model.id,
          provider: providerName,
          version: null,
          params_b: null, // OpenRouter 不返回参数量
          context_window: model.context_length || null,
          modalities: model.architecture?.modality || 'text',
          license_type: isOpenSource ? 'Open Source' : 'Proprietary',
          is_open_source: isOpenSource,
          description: model.description?.substring(0, 500) || '',
          released_at: model.created ? new Date(model.created * 1000).toISOString().substring(0, 10) : null,
        });

        if (inputPrice > 0 || outputPrice > 0) {
          upsertPrice.run({
            id: `price_${modelId}`,
            model_id: modelId,
            input_price_per_1m: Math.round(inputPrice * 100) / 100,
            output_price_per_1m: Math.round(outputPrice * 100) / 100,
            currency: 'USD',
            source_url: 'https://openrouter.ai/models',
          });
        }

        count++;
      } catch (err: any) {
        // 单条失败不中断整体
        console.error(`[OpenRouter] 模型 ${model.name} 写入失败: ${err.message}`);
      }
    }

    console.log(`[OpenRouter] 成功更新 ${count} 个模型`);
    return count;
  } catch (err: any) {
    console.error(`[OpenRouter Error] ${err.message}`);
    return 0;
  }
}

/** 将 OpenRouter provider id 映射为中文厂商名 */
function mapProviderName(provider: string): string {
  const nameMap: Record<string, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'google': 'Google',
    'meta': 'Meta',
    'mistral': 'Mistral',
    'deepseek': 'DeepSeek',
    'qwen': '阿里通义',
    'cohere': 'Cohere',
    'xai': 'xAI',
    'amazon': 'Amazon',
    'microsoft': 'Microsoft',
    'perplexity': 'Perplexity',
    'alibaba': '阿里云',
    '01-ai': '零一万物',
    'zhipu': '智谱AI',
  };
  return nameMap[provider.toLowerCase()] || provider;
}
