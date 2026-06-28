/**
 * 种子数据脚本 — 初始化数据源、模型、产品
 * 用法: npx tsx scripts/seed.ts
 */
import { getDb, upsertSource, closeDb } from '../lib/db';
import fs from 'fs';
import path from 'path';

const sources = [
  // 中文AI媒体 — 无RSS，用 cheerio 网页抓取
  { id: 'jiqizhixin', name: '机器之心', type: 'news', url: 'https://www.jiqizhixin.com', rss_url: '' },
  { id: 'qbitai', name: '量子位', type: 'news', url: 'https://www.qbitai.com', rss_url: '' },
  { id: '36kr-ai', name: '36氪AI', type: 'news', url: 'https://36kr.com/information/AI/', rss_url: 'https://36kr.com/feed' },
  // 英文AI媒体
  { id: 'techcrunch-ai', name: 'TechCrunch AI', type: 'news', url: 'https://techcrunch.com/category/artificial-intelligence/', rss_url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { id: 'venturebeat-ai', name: 'VentureBeat AI', type: 'news', url: 'https://venturebeat.com/category/ai/', rss_url: 'https://venturebeat.com/category/ai/feed/' },
  { id: 'the-batch', name: 'The Batch', type: 'news', url: 'https://www.deeplearning.ai/the-batch/', rss_url: '' },
  { id: 'mit-tr-ai', name: 'MIT Tech Review AI', type: 'news', url: 'https://www.technologyreview.com/topic/artificial-intelligence/', rss_url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/' },
  // RSSHub 聚合源
  { id: 'rsshub-36kr', name: 'RSSHub-36氪', type: 'news', url: 'https://rsshub.app', rss_url: 'https://rsshub.app/36kr/motif/ai' },
  // 社区
  { id: 'hackernews', name: 'Hacker News', type: 'news', url: 'https://news.ycombinator.com', rss_url: '' },
  { id: 'github-trending', name: 'GitHub Trending AI', type: 'news', url: 'https://github.com/trending', rss_url: '' },
  // arXiv
  { id: 'arxiv', name: 'arXiv', type: 'paper', url: 'https://arxiv.org', rss_url: '' },
];

const models = [
  // OpenAI
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', version: '5.2', params_b: null, context_window: 256000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'OpenAI最新旗舰大模型，强大的推理和代码能力，支持多模态', released_at: '2026-05-15' },
  { id: 'o4', name: 'o4', provider: 'OpenAI', version: 'o4', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'OpenAI最强深度推理模型，擅长数学、科学和复杂编程', released_at: '2026-04-01' },
  { id: 'o4-mini', name: 'o4-mini', provider: 'OpenAI', version: 'o4-mini', params_b: null, context_window: 200000, modalities: 'text,code', license_type: 'Proprietary', is_open_source: 0, description: 'o4轻量版，性价比极高的推理模型', released_at: '2026-04-01' },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', version: '4.1', params_b: null, context_window: 1000000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'GPT-4系列最新版本，100万上下文窗口', released_at: '2026-01-15' },
  // Anthropic
  { id: 'claude-opus-4.8', name: 'Claude Opus 4.8', provider: 'Anthropic', version: '4.8', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'Anthropic旗舰模型，擅长长文本深度分析和复杂推理', released_at: '2026-05-01' },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', version: '4.6', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: '速度与能力完美平衡，性价比最优', released_at: '2026-04-15' },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Anthropic', version: '4.5', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'Claude最快模型，适合日常任务和高吞吐场景', released_at: '2026-04-15' },
  // Google
  { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro', provider: 'Google', version: '3.0', params_b: null, context_window: 2000000, modalities: 'text,code,image,audio,video', license_type: 'Proprietary', is_open_source: 0, description: '谷歌最强多模态模型，200万上下文窗口，原生多模态', released_at: '2026-06-01' },
  { id: 'gemini-3.0-flash', name: 'Gemini 3.0 Flash', provider: 'Google', version: '3.0', params_b: null, context_window: 1000000, modalities: 'text,code,image,audio,video', license_type: 'Proprietary', is_open_source: 0, description: '谷歌轻量多模态模型，速度极快，价格极低', released_at: '2026-06-01' },
  // DeepSeek
  { id: 'deepseek-v4', name: 'DeepSeek V4', provider: 'DeepSeek', version: 'V4', params_b: 685, context_window: 256000, modalities: 'text,code', license_type: 'MIT', is_open_source: 1, description: '国产开源最强模型最新版，MoE架构685B参数，性价比极高', released_at: '2026-03-01' },
  { id: 'deepseek-r2', name: 'DeepSeek R2', provider: 'DeepSeek', version: 'R2', params_b: 685, context_window: 256000, modalities: 'text,code', license_type: 'MIT', is_open_source: 1, description: 'DeepSeek深度推理模型第二代，思维链+代码执行增强', released_at: '2026-05-01' },
  // 阿里
  { id: 'qwen3-max', name: 'Qwen3-Max', provider: '阿里通义', version: 'Qwen3', params_b: null, context_window: 256000, modalities: 'text,code,image,video', license_type: 'Apache 2.0', is_open_source: 1, description: '阿里最新旗舰模型，多模态理解+Agent能力', released_at: '2026-04-01' },
  { id: 'qwen3-coder', name: 'Qwen3-Coder', provider: '阿里通义', version: 'Qwen3', params_b: null, context_window: 128000, modalities: 'text,code', license_type: 'Apache 2.0', is_open_source: 1, description: '通义千问编程专用模型，代码能力顶级', released_at: '2026-05-01' },
  // 字节跳动
  { id: 'doubao-seed-2.5', name: '豆包 Seed 2.5 Pro', provider: '字节跳动', version: '2.5', params_b: null, context_window: 256000, modalities: 'text,code,image,audio', license_type: 'Proprietary', is_open_source: 0, description: '字节豆包最新旗舰，国内市场份额第一', released_at: '2026-05-01' },
  // 百度
  { id: 'ernie-5.5', name: '文心 ERNIE 5.5', provider: '百度', version: '5.5', params_b: null, context_window: 128000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: '百度最新旗舰大模型，深度思考+工具调用', released_at: '2026-03-01' },
  // 月之暗面
  { id: 'kimi-k2.5', name: 'Kimi K2.5', provider: '月之暗面', version: 'K2.5', params_b: null, context_window: 256000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: '月之暗面旗舰，Agent和长文本能力行业领先', released_at: '2026-04-01' },
  // xAI
  { id: 'grok-4', name: 'Grok 4', provider: 'xAI', version: '4', params_b: null, context_window: 256000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'xAI最新模型，深度推理+实时信息获取', released_at: '2026-02-01' },
  // Meta
  { id: 'llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', version: '4', params_b: 400, context_window: 256000, modalities: 'text,code,image', license_type: 'Llama Community', is_open_source: 1, description: 'Meta开源旗舰，多模态+超长上下文', released_at: '2026-01-01' },
  // Mistral
  { id: 'mistral-large-3', name: 'Mistral Large 3', provider: 'Mistral', version: '3', params_b: null, context_window: 256000, modalities: 'text,code', license_type: 'Mistral Research', is_open_source: 0, description: 'Mistral最新旗舰，欧洲最强AI模型', released_at: '2026-03-01' },
];

const modelPrices = [
  { model_id: 'gpt-5.2', input_price_per_1m: 1.75, output_price_per_1m: 14.00, currency: 'USD', cache_discount: 90, free_tier: '无' },
  { model_id: 'o4', input_price_per_1m: 5.00, output_price_per_1m: 20.00, currency: 'USD', cache_discount: 50, free_tier: '无' },
  { model_id: 'o4-mini', input_price_per_1m: 0.55, output_price_per_1m: 4.40, currency: 'USD', cache_discount: 50, free_tier: '免费套餐可用' },
  { model_id: 'gpt-4.1', input_price_per_1m: 2.00, output_price_per_1m: 8.00, currency: 'USD', cache_discount: 50, free_tier: '无' },
  { model_id: 'claude-opus-4.8', input_price_per_1m: 5.00, output_price_per_1m: 25.00, currency: 'USD', cache_discount: 90, free_tier: '无' },
  { model_id: 'claude-sonnet-4.6', input_price_per_1m: 3.00, output_price_per_1m: 15.00, currency: 'USD', cache_discount: 90, free_tier: '免费套餐可用' },
  { model_id: 'claude-haiku-4.5', input_price_per_1m: 0.80, output_price_per_1m: 4.00, currency: 'USD', cache_discount: 50, free_tier: '免费套餐可用' },
  { model_id: 'gemini-3.0-pro', input_price_per_1m: 1.25, output_price_per_1m: 10.00, currency: 'USD', cache_discount: 0, free_tier: '免费套餐可用' },
  { model_id: 'gemini-3.0-flash', input_price_per_1m: 0.10, output_price_per_1m: 0.40, currency: 'USD', cache_discount: 0, free_tier: '免费套餐可用' },
  { model_id: 'deepseek-v4', input_price_per_1m: 0.27, output_price_per_1m: 0.41, currency: 'CNY', cache_discount: 90, free_tier: '注册赠送额度' },
  { model_id: 'deepseek-r2', input_price_per_1m: 1.00, output_price_per_1m: 4.00, currency: 'CNY', cache_discount: 90, free_tier: '注册赠送额度' },
  { model_id: 'qwen3-max', input_price_per_1m: 2.50, output_price_per_1m: 10.00, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'qwen3-coder', input_price_per_1m: 2.00, output_price_per_1m: 8.00, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'doubao-seed-2.5', input_price_per_1m: 3.20, output_price_per_1m: 16.00, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'kimi-k2.5', input_price_per_1m: 0.60, output_price_per_1m: 2.50, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'grok-4', input_price_per_1m: 3.00, output_price_per_1m: 15.00, currency: 'USD', cache_discount: 0, free_tier: '无' },
  { model_id: 'llama-4-maverick', input_price_per_1m: 0.20, output_price_per_1m: 0.75, currency: 'USD', cache_discount: 0, free_tier: '开源可自部署' },
  { model_id: 'mistral-large-3', input_price_per_1m: 2.00, output_price_per_1m: 6.00, currency: 'USD', cache_discount: 0, free_tier: '免费套餐可用' },
];

const modelBenchmarks = [
  { model_id: 'gpt-5.2', benchmark_name: 'MMLU-Pro', score: 93.2, metric: 'accuracy', tested_at: '2026-05-15' },
  { model_id: 'gpt-5.2', benchmark_name: 'HumanEval', score: 97.1, metric: 'pass@1', tested_at: '2026-05-15' },
  { model_id: 'gpt-5.2', benchmark_name: 'GPQA Diamond', score: 89.5, metric: 'accuracy', tested_at: '2026-05-15' },
  { model_id: 'o4', benchmark_name: 'MMLU-Pro', score: 93.8, metric: 'accuracy', tested_at: '2026-04-01' },
  { model_id: 'o4', benchmark_name: 'HumanEval', score: 98.2, metric: 'pass@1', tested_at: '2026-04-01' },
  { model_id: 'o4', benchmark_name: 'GPQA Diamond', score: 91.3, metric: 'accuracy', tested_at: '2026-04-01' },
  { model_id: 'claude-opus-4.8', benchmark_name: 'MMLU-Pro', score: 92.5, metric: 'accuracy', tested_at: '2026-05-01' },
  { model_id: 'claude-opus-4.8', benchmark_name: 'HumanEval', score: 95.8, metric: 'pass@1', tested_at: '2026-05-01' },
  { model_id: 'claude-opus-4.8', benchmark_name: 'GPQA Diamond', score: 89.1, metric: 'accuracy', tested_at: '2026-05-01' },
  { model_id: 'claude-sonnet-4.6', benchmark_name: 'MMLU-Pro', score: 90.8, metric: 'accuracy', tested_at: '2026-04-15' },
  { model_id: 'claude-sonnet-4.6', benchmark_name: 'HumanEval', score: 93.5, metric: 'pass@1', tested_at: '2026-04-15' },
  { model_id: 'gemini-3.0-pro', benchmark_name: 'MMLU-Pro', score: 91.5, metric: 'accuracy', tested_at: '2026-06-01' },
  { model_id: 'gemini-3.0-pro', benchmark_name: 'HumanEval', score: 94.0, metric: 'pass@1', tested_at: '2026-06-01' },
  { model_id: 'deepseek-v4', benchmark_name: 'MMLU-Pro', score: 90.2, metric: 'accuracy', tested_at: '2026-03-01' },
  { model_id: 'deepseek-v4', benchmark_name: 'HumanEval', score: 93.5, metric: 'pass@1', tested_at: '2026-03-01' },
  { model_id: 'deepseek-v4', benchmark_name: 'GPQA Diamond', score: 80.1, metric: 'accuracy', tested_at: '2026-03-01' },
  { model_id: 'deepseek-r2', benchmark_name: 'MMLU-Pro', score: 91.8, metric: 'accuracy', tested_at: '2026-05-01' },
  { model_id: 'deepseek-r2', benchmark_name: 'HumanEval', score: 96.0, metric: 'pass@1', tested_at: '2026-05-01' },
  { model_id: 'qwen3-max', benchmark_name: 'MMLU-Pro', score: 89.5, metric: 'accuracy', tested_at: '2026-04-01' },
  { model_id: 'qwen3-max', benchmark_name: 'HumanEval', score: 91.5, metric: 'pass@1', tested_at: '2026-04-01' },
  { model_id: 'qwen3-coder', benchmark_name: 'HumanEval', score: 94.2, metric: 'pass@1', tested_at: '2026-05-01' },
  { model_id: 'doubao-seed-2.5', benchmark_name: 'MMLU-Pro', score: 88.5, metric: 'accuracy', tested_at: '2026-05-01' },
  { model_id: 'kimi-k2.5', benchmark_name: 'MMLU-Pro', score: 88.0, metric: 'accuracy', tested_at: '2026-04-01' },
  { model_id: 'kimi-k2.5', benchmark_name: 'HumanEval', score: 90.2, metric: 'pass@1', tested_at: '2026-04-01' },
  { model_id: 'llama-4-maverick', benchmark_name: 'MMLU-Pro', score: 86.5, metric: 'accuracy', tested_at: '2026-01-01' },
  { model_id: 'llama-4-maverick', benchmark_name: 'HumanEval', score: 89.5, metric: 'pass@1', tested_at: '2026-01-01' },
];

// 从 JSON 文件读取产品数据
const productsPath = path.join(process.cwd(), 'data', 'products.json');
const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));

function seed() {
  console.log('🌱 开始填充种子数据...\n');
  const db = getDb();

  // 1. 数据源
  console.log(`📡 注册 ${sources.length} 个数据源...`);
  for (const s of sources) {
    upsertSource(s);
  }

  // 2. 模型
  console.log(`🤖 添加 ${models.length} 个AI模型...`);
  const modelStmt = db.prepare(`
    INSERT OR REPLACE INTO models (id, name, provider, version, params_b, context_window, modalities, license_type, is_open_source, description, released_at)
    VALUES (@id, @name, @provider, @version, @params_b, @context_window, @modalities, @license_type, @is_open_source, @description, @released_at)
  `);
  for (const m of models) {
    modelStmt.run(m);
  }

  // 3. 模型价格
  console.log(`💰 添加 ${modelPrices.length} 条价格数据...`);
  const priceStmt = db.prepare(`
    INSERT OR REPLACE INTO model_prices (id, model_id, input_price_per_1m, output_price_per_1m, currency, cache_discount, free_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of modelPrices) {
    const priceId = `price_${p.model_id}`;
    priceStmt.run(priceId, p.model_id, p.input_price_per_1m, p.output_price_per_1m, p.currency, p.cache_discount, p.free_tier);
  }

  // 4. 基准测试
  console.log(`📊 添加 ${modelBenchmarks.length} 条基准测试...`);
  const benchStmt = db.prepare(`
    INSERT OR REPLACE INTO model_benchmarks (id, model_id, benchmark_name, score, metric, tested_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const b of modelBenchmarks) {
    const benchId = `bench_${b.model_id}_${b.benchmark_name}`;
    benchStmt.run(benchId, b.model_id, b.benchmark_name, b.score, b.metric, b.tested_at);
  }

  // 5. AI产品（从 data/products.json 读取）
  console.log(`📦 添加 ${products.length} 个AI产品...`);
  const prodStmt = db.prepare(`
    INSERT OR REPLACE INTO products (id, name, category, description, url, pricing_model, based_model, is_hot)
    VALUES (@id, @name, @category, @description, @url, @pricing_model, @based_model, @is_hot)
  `);
  for (const p of products) {
    prodStmt.run(p);
  }

  console.log('\n✅ 种子数据填充完成！');
  console.log(`   - ${sources.length} 个数据源`);
  console.log(`   - ${models.length} 个AI模型`);
  console.log(`   - ${modelBenchmarks.length} 条基准测试`);
  console.log(`   - ${modelPrices.length} 条价格数据`);
  console.log(`   - ${products.length} 个AI产品`);

  closeDb();
}

seed();
