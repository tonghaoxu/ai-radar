import { errorMessage } from '../errors';
/**
 * 模型数据爬虫 — 从 OpenRouter API 获取最新模型和价格
 * OpenRouter API 免费、无需认证
 */
import { getDb, updateSourceLastCrawled, markSourceFailure } from '../db';

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
      throw new Error(`OpenRouter HTTP ${response.status}`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = data.data;
    if (!Array.isArray(models) || !models.length) throw new Error('OpenRouter 返回了空模型目录');
    console.log(`[OpenRouter] 获取到 ${models.length} 个模型`);

    // 只处理主流厂商的模型
    const majorProviders = [
      'openai',
      'anthropic',
      'google',
      'meta',
      'meta-llama',
      'mistral',
      'mistralai',
      'deepseek',
      'qwen',
      'cohere',
      'xai',
      'amazon',
      'microsoft',
      'perplexity',
      'alibaba',
      '01-ai',
      'zhipu',
    ];

    const db = getDb();
    let count = 0;

    const upsertModel = db.prepare(`
      INSERT INTO models (id, name, provider, version, params_b, context_window, modalities, license_type, is_open_source, description, released_at)
      VALUES (@id, @name, @provider, @version, @params_b, @context_window, @modalities, @license_type, @is_open_source, @description, @released_at)
      ON CONFLICT(id) DO UPDATE SET
        name = @name,
        context_window = @context_window,
        modalities = @modalities,
        description = @description,
        released_at = @released_at,
        license_type = @license_type,
        is_open_source = @is_open_source
    `);

    const upsertPrice = db.prepare(`
      INSERT INTO model_prices (id, model_id, input_price_per_1m, output_price_per_1m, currency, source_url)
      VALUES (@id, @model_id, @input_price_per_1m, @output_price_per_1m, @currency, @source_url)
      ON CONFLICT(id) DO UPDATE SET
        input_price_per_1m = @input_price_per_1m,
        output_price_per_1m = @output_price_per_1m,
        updated_at = datetime('now')
    `);

    db.transaction(() => {
      for (const model of models) {
        const modelId = `openrouter:${model.id}`;

        // 识别厂商
        const provider = model.id.split('/')[0] || 'unknown';
        const providerName = mapProviderName(provider);

        // 跳过非主流厂商（减少噪音）
        if (!majorProviders.includes(provider.toLowerCase())) {
          continue;
        }

        // 确定是否开源
        const isOpenSource = 0; // API 未提供许可证，不能根据厂商推断开源。

        // 价格：每百万 token 价格（OpenRouter 返回的是 per-token，需 ×1,000,000）
        const inputPrice = parseTokenPrice(model.pricing?.prompt);
        const outputPrice = parseTokenPrice(model.pricing?.completion);

        try {
          upsertModel.run({
            id: modelId,
            name: model.name || model.id,
            provider: providerName,
            version: null,
            params_b: null, // OpenRouter 不返回参数量
            context_window: model.context_length || null,
            modalities: model.architecture?.modality || 'text',
            license_type: '未核验',
            is_open_source: isOpenSource,
            description: model.description?.substring(0, 500) || '',
            released_at: model.created
              ? new Date(model.created * 1000).toISOString().substring(0, 10)
              : null,
          });

          {
            upsertPrice.run({
              id: `price_${modelId}`,
              model_id: modelId,
              input_price_per_1m: inputPrice,
              output_price_per_1m: outputPrice,
              currency: 'USD',
              source_url: `https://openrouter.ai/${model.id}`,
            });
          }

          // 旧版本使用损失信息的 ID；新条目接替后保留历史记录但隐藏重复显示。
          const legacyId = model.id.replace('/', '-').replace(/[^a-zA-Z0-9-_.]/g, '');
          db.prepare(
            "UPDATE models SET superseded_by = ? WHERE id = ? AND EXISTS (SELECT 1 FROM model_prices WHERE model_id = ? AND source_url = 'https://openrouter.ai/models')",
          ).run(modelId, legacyId, legacyId);
          count++;
        } catch (err) {
          // 单条失败不中断整体
          console.error(`[OpenRouter] 模型 ${model.name} 写入失败: ${errorMessage(err)}`);
        }
      }
    })();
    if (!count) throw new Error('OpenRouter 未成功更新任何模型');
    updateSourceLastCrawled('openrouter');
    console.log(`[OpenRouter] 成功更新 ${count} 个模型`);
    return count;
  } catch (err) {
    console.error(`[OpenRouter Error] ${errorMessage(err)}`);
    markSourceFailure('openrouter', errorMessage(err));
    throw err;
  }
}

/** 将 OpenRouter provider id 映射为中文厂商名 */
function mapProviderName(provider: string): string {
  const nameMap: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    meta: 'Meta',
    'meta-llama': 'Meta',
    mistralai: 'Mistral',
    mistral: 'Mistral',
    deepseek: 'DeepSeek',
    qwen: '阿里通义',
    cohere: 'Cohere',
    xai: 'xAI',
    amazon: 'Amazon',
    microsoft: 'Microsoft',
    perplexity: 'Perplexity',
    alibaba: '阿里云',
    '01-ai': '零一万物',
    zhipu: '智谱AI',
  };
  return nameMap[provider.toLowerCase()] || provider;
}

export function parseTokenPrice(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const price = Number(value) * 1_000_000;
  return Number.isFinite(price) && price >= 0 ? Number(price.toPrecision(12)) : null;
}
