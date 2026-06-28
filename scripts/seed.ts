/**
 * 种子数据脚本 — 初始化数据源、模型、产品
 * 用法: npx tsx scripts/seed.ts
 */
import { getDb, upsertSource, closeDb } from '../lib/db';

const sources = [
  // 中文AI媒体
  { id: 'jiqizhixin', name: '机器之心', type: 'news', url: 'https://www.jiqizhixin.com', rss_url: 'https://www.jiqizhixin.com/rss' },
  { id: 'qbitai', name: '量子位', type: 'news', url: 'https://www.qbitai.com', rss_url: 'https://www.qbitai.com/feed' },
  { id: '36kr-ai', name: '36氪AI', type: 'news', url: 'https://36kr.com', rss_url: 'https://36kr.com/feed' },
  { id: 'huxiu-ai', name: '虎嗅AI', type: 'news', url: 'https://www.huxiu.com', rss_url: 'https://www.huxiu.com/rss/0.xml' },
  // 英文AI媒体
  { id: 'techcrunch-ai', name: 'TechCrunch AI', type: 'news', url: 'https://techcrunch.com/category/artificial-intelligence/', rss_url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { id: 'venturebeat-ai', name: 'VentureBeat AI', type: 'news', url: 'https://venturebeat.com/category/ai/', rss_url: 'https://venturebeat.com/category/ai/feed/' },
  { id: 'the-batch', name: 'The Batch', type: 'news', url: 'https://www.deeplearning.ai/the-batch/', rss_url: '' },
  { id: 'mit-tr-ai', name: 'MIT Tech Review AI', type: 'news', url: 'https://www.technologyreview.com/topic/artificial-intelligence/', rss_url: 'https://www.technologyreview.com/feed/' },
  // 社区
  { id: 'hackernews', name: 'Hacker News', type: 'news', url: 'https://news.ycombinator.com', rss_url: '' },
  { id: 'github-trending', name: 'GitHub Trending AI', type: 'news', url: 'https://github.com/trending', rss_url: '' },
  // arXiv (通过API)
  { id: 'arxiv', name: 'arXiv', type: 'paper', url: 'https://arxiv.org', rss_url: '' },
];

const models = [
  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'OpenAI', version: '5.2', params_b: null, context_window: 256000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'OpenAI最新旗舰大模型，强大的推理和代码能力', released_at: '2025-12-01' },
  { id: 'gpt-5.1', name: 'GPT-5.1', provider: 'OpenAI', version: '5.1', params_b: null, context_window: 128000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'OpenAI旗舰模型上一版本', released_at: '2025-08-01' },
  { id: 'o3-pro', name: 'o3 pro', provider: 'OpenAI', version: 'o3', params_b: null, context_window: 200000, modalities: 'text,code', license_type: 'Proprietary', is_open_source: 0, description: 'OpenAI最强推理模型，擅长数学和科学', released_at: '2025-07-01' },
  { id: 'claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Anthropic', version: '4.6', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'Anthropic旗舰模型，擅长长文本和复杂推理', released_at: '2025-11-01' },
  { id: 'claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Anthropic', version: '4.6', params_b: null, context_window: 200000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'Claude性价比最优模型，速度与能力平衡', released_at: '2025-11-01' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', version: '2.5', params_b: null, context_window: 1000000, modalities: 'text,code,image,audio,video', license_type: 'Proprietary', is_open_source: 0, description: '谷歌最强多模态模型，100万上下文窗口', released_at: '2025-09-01' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', version: '2.5', params_b: null, context_window: 1000000, modalities: 'text,code,image,audio,video', license_type: 'Proprietary', is_open_source: 0, description: '谷歌轻量多模态模型，速度极快', released_at: '2025-09-01' },
  { id: 'deepseek-v3.2', name: 'DeepSeek V3.2', provider: 'DeepSeek', version: '3.2', params_b: 671, context_window: 128000, modalities: 'text,code', license_type: 'MIT', is_open_source: 1, description: '国产开源最强模型，性价比极高', released_at: '2025-06-01' },
  { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', version: 'R1-0528', params_b: 671, context_window: 128000, modalities: 'text,code', license_type: 'MIT', is_open_source: 1, description: 'DeepSeek深度推理模型，思维链增强', released_at: '2025-05-28' },
  { id: 'qwen3-max', name: 'Qwen3-Max', provider: '阿里通义', version: 'Qwen3', params_b: null, context_window: 128000, modalities: 'text,code,image', license_type: 'Apache 2.0', is_open_source: 1, description: '阿里最新旗舰模型，多模态理解', released_at: '2025-10-01' },
  { id: 'doubao-seed-2.0', name: '豆包 Seed 2.0 Pro', provider: '字节跳动', version: '2.0', params_b: null, context_window: 128000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: '字节豆包旗舰，国内市场份额第一', released_at: '2025-09-15' },
  { id: 'ernie-5.0', name: '文心 ERNIE 5.0', provider: '百度', version: '5.0', params_b: 2400, context_window: 128000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: '百度最新旗舰，2400B参数', released_at: '2025-08-01' },
  { id: 'kimi-k2', name: 'Kimi K2', provider: '月之暗面', version: 'K2', params_b: null, context_window: 128000, modalities: 'text,code', license_type: 'Proprietary', is_open_source: 0, description: '月之暗面旗舰，Agent能力突出', released_at: '2025-07-01' },
  { id: 'grok-4', name: 'Grok 4', provider: 'xAI', version: '4', params_b: null, context_window: 128000, modalities: 'text,code,image', license_type: 'Proprietary', is_open_source: 0, description: 'xAI最新模型，实时信息获取', released_at: '2025-10-01' },
  { id: 'llama-4', name: 'Llama 4 Maverick', provider: 'Meta', version: '4', params_b: 400, context_window: 128000, modalities: 'text,code,image', license_type: 'Llama Community', is_open_source: 1, description: 'Meta开源旗舰，多模态能力', released_at: '2025-04-01' },
];

const modelPrices = [
  { model_id: 'gpt-5.2', input_price_per_1m: 1.75, output_price_per_1m: 14.00, currency: 'USD', cache_discount: 90, free_tier: '无' },
  { model_id: 'o3-pro', input_price_per_1m: 20.00, output_price_per_1m: 80.00, currency: 'USD', cache_discount: 0, free_tier: '无' },
  { model_id: 'claude-opus-4.6', input_price_per_1m: 5.00, output_price_per_1m: 25.00, currency: 'USD', cache_discount: 90, free_tier: '无' },
  { model_id: 'claude-sonnet-4.6', input_price_per_1m: 3.00, output_price_per_1m: 15.00, currency: 'USD', cache_discount: 90, free_tier: '免费套餐可用' },
  { model_id: 'gemini-2.5-pro', input_price_per_1m: 1.25, output_price_per_1m: 10.00, currency: 'USD', cache_discount: 0, free_tier: '免费套餐可用' },
  { model_id: 'gemini-2.5-flash', input_price_per_1m: 0.10, output_price_per_1m: 0.40, currency: 'USD', cache_discount: 0, free_tier: '免费套餐可用' },
  { model_id: 'deepseek-v3.2', input_price_per_1m: 0.27, output_price_per_1m: 0.41, currency: 'CNY', cache_discount: 90, free_tier: '注册赠送额度' },
  { model_id: 'deepseek-r1', input_price_per_1m: 0.55, output_price_per_1m: 2.19, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'qwen3-max', input_price_per_1m: 2.50, output_price_per_1m: 10.00, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'doubao-seed-2.0', input_price_per_1m: 3.20, output_price_per_1m: 16.00, currency: 'CNY', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'kimi-k2', input_price_per_1m: 0.60, output_price_per_1m: 2.50, currency: 'USD', cache_discount: 0, free_tier: '注册赠送额度' },
  { model_id: 'grok-4', input_price_per_1m: 3.00, output_price_per_1m: 15.00, currency: 'USD', cache_discount: 0, free_tier: '无' },
];

const modelBenchmarks = [
  { model_id: 'gpt-5.2', benchmark_name: 'MMLU-Pro', score: 92.5, metric: 'accuracy', tested_at: '2025-12-01' },
  { model_id: 'gpt-5.2', benchmark_name: 'HumanEval', score: 96.3, metric: 'pass@1', tested_at: '2025-12-01' },
  { model_id: 'gpt-5.2', benchmark_name: 'GPQA Diamond', score: 88.1, metric: 'accuracy', tested_at: '2025-12-01' },
  { model_id: 'claude-opus-4.6', benchmark_name: 'MMLU-Pro', score: 91.2, metric: 'accuracy', tested_at: '2025-11-01' },
  { model_id: 'claude-opus-4.6', benchmark_name: 'HumanEval', score: 94.5, metric: 'pass@1', tested_at: '2025-11-01' },
  { model_id: 'claude-opus-4.6', benchmark_name: 'GPQA Diamond', score: 87.3, metric: 'accuracy', tested_at: '2025-11-01' },
  { model_id: 'gemini-2.5-pro', benchmark_name: 'MMLU-Pro', score: 90.8, metric: 'accuracy', tested_at: '2025-09-01' },
  { model_id: 'gemini-2.5-pro', benchmark_name: 'HumanEval', score: 93.2, metric: 'pass@1', tested_at: '2025-09-01' },
  { model_id: 'deepseek-v3.2', benchmark_name: 'MMLU-Pro', score: 88.5, metric: 'accuracy', tested_at: '2025-06-01' },
  { model_id: 'deepseek-v3.2', benchmark_name: 'HumanEval', score: 91.7, metric: 'pass@1', tested_at: '2025-06-01' },
  { model_id: 'deepseek-v3.2', benchmark_name: 'GPQA Diamond', score: 76.2, metric: 'accuracy', tested_at: '2025-06-01' },
  { model_id: 'qwen3-max', benchmark_name: 'MMLU-Pro', score: 87.3, metric: 'accuracy', tested_at: '2025-10-01' },
  { model_id: 'qwen3-max', benchmark_name: 'HumanEval', score: 90.1, metric: 'pass@1', tested_at: '2025-10-01' },
  { model_id: 'doubao-seed-2.0', benchmark_name: 'MMLU-Pro', score: 86.8, metric: 'accuracy', tested_at: '2025-09-15' },
  { model_id: 'llama-4', benchmark_name: 'MMLU-Pro', score: 85.2, metric: 'accuracy', tested_at: '2025-04-01' },
  { model_id: 'llama-4', benchmark_name: 'HumanEval', score: 88.9, metric: 'pass@1', tested_at: '2025-04-01' },
];

const products = [
  { id: 'chatgpt', name: 'ChatGPT', category: '智能助手', description: 'OpenAI官方聊天助手，支持多模态对话和联网搜索', url: 'https://chatgpt.com', pricing_model: '免费+订阅($20/月)', based_model: 'GPT-5.2', is_hot: 1 },
  { id: 'claude-ai', name: 'Claude', category: '智能助手', description: 'Anthropic官方助手，擅长长文本和代码', url: 'https://claude.ai', pricing_model: '免费+Pro($20/月)', based_model: 'Claude Opus 4.6', is_hot: 1 },
  { id: 'doubao', name: '豆包', category: '智能助手', description: '字节跳动AI助手，国内用户量最大', url: 'https://www.doubao.com', pricing_model: '免费', based_model: '豆包Seed 2.0', is_hot: 1 },
  { id: 'deepseek-chat', name: 'DeepSeek', category: '智能助手', description: '深度求索AI助手，支持深度推理', url: 'https://chat.deepseek.com', pricing_model: '免费', based_model: 'DeepSeek V3.2', is_hot: 1 },
  { id: 'gemini', name: 'Gemini', category: '智能助手', description: 'Google AI助手，多模态能力最强', url: 'https://gemini.google.com', pricing_model: '免费+Advanced($19.99/月)', based_model: 'Gemini 2.5 Pro', is_hot: 1 },
  { id: 'perplexity', name: 'Perplexity', category: '搜索引擎', description: 'AI搜索引擎，实时联网回答', url: 'https://www.perplexity.ai', pricing_model: '免费+Pro($20/月)', based_model: '多模型', is_hot: 1 },
  { id: 'metaso', name: '秘塔AI搜索', category: '搜索引擎', description: '国产AI搜索引擎，支持深度研究', url: 'https://metaso.cn', pricing_model: '免费', based_model: '自研', is_hot: 1 },
  { id: 'cursor', name: 'Cursor', category: '编程工具', description: 'AI编程IDE，基于VS Code', url: 'https://cursor.sh', pricing_model: '免费+Pro($20/月)', based_model: '多模型', is_hot: 1 },
  { id: 'github-copilot', name: 'GitHub Copilot', category: '编程工具', description: 'GitHub官方AI编程助手', url: 'https://github.com/features/copilot', pricing_model: '$10/月', based_model: 'GPT+Claude', is_hot: 1 },
  { id: 'cline', name: 'Cline', category: '编程工具', description: '开源AI编程助手，支持自主编程', url: 'https://github.com/cline/cline', pricing_model: '免费开源', based_model: '多模型', is_hot: 1 },
  { id: 'midjourney', name: 'Midjourney', category: '设计创作', description: '专业AI图片生成工具', url: 'https://www.midjourney.com', pricing_model: '$10-60/月', based_model: '自研', is_hot: 1 },
  { id: 'jimeng', name: '即梦', category: '设计创作', description: '字节旗下AI图片和视频生成', url: 'https://jimeng.jianying.com', pricing_model: '免费+会员', based_model: '自研', is_hot: 1 },
  { id: 'kling', name: '可灵', category: '视频生成', description: '快手AI视频生成工具', url: 'https://kling.kuaishou.com', pricing_model: '免费+会员', based_model: '自研', is_hot: 1 },
  { id: 'sora', name: 'Sora', category: '视频生成', description: 'OpenAI视频生成模型', url: 'https://sora.com', pricing_model: 'ChatGPT Plus包含', based_model: '自研', is_hot: 1 },
  { id: 'notion-ai', name: 'Notion AI', category: '办公效率', description: 'Notion内置AI写作和辅助功能', url: 'https://www.notion.so/product/ai', pricing_model: '$10/月附加', based_model: '多模型', is_hot: 1 },
  { id: 'feishu-ai', name: '飞书智能伙伴', category: '办公效率', description: '飞书内置AI办公助手', url: 'https://www.feishu.cn', pricing_model: '企业版含', based_model: '豆包', is_hot: 1 },
];

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

  // 5. AI产品
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
