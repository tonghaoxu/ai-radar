import fs from 'node:fs';
import path from 'node:path';
import { getDb, closeDb, upsertArticle, upsertPaper } from '../lib/db';
import { seedProducts } from '../lib/seed-products';
const target = process.env.AI_RADAR_DB_PATH;
const root = path.resolve('.e2e-work') + path.sep;
if (!target || !path.resolve(target).startsWith(root))
  throw new Error('E2E 数据库必须位于项目 .e2e-work 目录');
fs.mkdirSync(path.dirname(target), { recursive: true });
try {
  const db = getDb();
  seedProducts();
  for (let i = 0; i < 95; i++) {
    upsertArticle({
      id: `test-${String(i).padStart(3, '0')}`,
      source_id: i % 2 ? 'hackernews' : 'qbitai',
      title: `AI 测试资讯 ${String(i).padStart(3, '0')}`,
      summary: '用于验证资讯阅读、筛选、分页和返回位置的测试内容。',
      published_at: new Date(Date.now() - i * 60_000).toISOString(),
      category: i % 2 ? 'AI综合' : '大模型',
      language: i % 2 ? 'en' : 'zh',
      url: `https://example.com/test-${i}`,
    });
  }
  for (let i = 0; i < 65; i++)
    upsertPaper({
      id: `paper-${i}`,
      arxiv_id: `2609.${String(i).padStart(5, '0')}`,
      title: `AI 论文 ${i}`,
      authors: 'Alice, Bob',
      abstract: '论文摘要测试。',
      primary_category: i % 2 ? 'cs.CV' : 'cs.AI',
      categories: 'cs.AI,cs.CV',
      published_at: new Date().toISOString(),
    });
  for (let i = 0; i < 55; i++) {
    db.prepare(
      'INSERT INTO models(id, name, provider, context_window, license_type, released_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(`model-${i}`, `AI Model ${i}`, 'Test provider', 128000, '未核验', '2026-09-01');
    db.prepare(
      'INSERT INTO model_prices(id, model_id, input_price_per_1m, output_price_per_1m, source_url) VALUES (?, ?, ?, ?, ?)',
    ).run(`price-${i}`, `model-${i}`, 0.001, 0.002, 'https://openrouter.ai/test/model');
  }
} finally {
  closeDb();
}
