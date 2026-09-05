import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import {
  getDb,
  closeDb,
  upsertArticle,
  getArticles,
  getArticleCount,
  markArticleRead,
  markArticleStarred,
  getArticleById,
  upsertPaper,
  getPapers,
  searchAll,
  getModels,
  getPaperCount,
} from '../lib/db';
import { validateApiKey } from '../lib/auth';
import { GET as articlesGet, POST as articlesPost } from '../app/api/articles/route';
import { GET as productsGet } from '../app/api/products/route';
import { GET as papersGet } from '../app/api/papers/route';
import { GET as modelsGet } from '../app/api/models/route';
import { POST as summaryPost } from '../app/api/summary/route';
import { crawlAll } from '../lib/crawler';
import { parseTokenPrice, fetchOpenRouterModels } from '../lib/crawler/models';
import { parseArxivXml } from '../lib/crawler/arxiv';
import { seedProducts } from '../lib/seed-products';
import { isAiRelated } from '../lib/crawler/keywords';
import { safeHttpUrl } from '../lib/validation';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
before(() => {
  process.env.AI_RADAR_DB_PATH = ':memory:';
  process.env.CRON_SECRET = 'test-secret';
  getDb();
});
after(() => {
  closeDb();
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
});
const request = (path: string, body?: unknown, authorized = true) =>
  new NextRequest(
    `http://localhost:3000${path}`,
    body === undefined
      ? undefined
      : {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(authorized ? { 'x-api-key': 'test-secret' } : {}),
          },
          body: JSON.stringify(body),
        },
  );

test('article search composes all filters, counts and local-day boundaries', () => {
  for (const row of [
    {
      id: 'a',
      title: 'AI 100%_\\ 中文',
      source_id: 'qbitai',
      category: '大模型',
      language: 'zh',
      published_at: '2026-09-04T17:00:00Z',
    },
    {
      id: 'b',
      title: 'AI other',
      source_id: 'qbitai',
      category: 'AI综合',
      language: 'en',
      published_at: '2026-09-05T12:00:00Z',
    },
    {
      id: 'c',
      title: 'AI third',
      source_id: 'hackernews',
      category: '大模型',
      language: 'en',
      published_at: '2026-09-04T12:00:00Z',
    },
  ])
    upsertArticle({ ...row, url: `https://example.com/${row.id}` });
  markArticleStarred('a', true);
  const options = {
    search: 'AI',
    category: '大模型',
    sourceId: 'qbitai',
    language: 'zh',
    isStarred: true,
    date: '2026-09-05',
    timezoneOffset: -480,
  };
  assert.deepEqual(
    getArticles(options).map((a) => a.id),
    ['a'],
  );
  assert.equal(getArticleCount(options), 1);
  assert.equal(getArticles({ search: '%_\\' }).length, 1);
  assert.equal(getArticles({ search: '中文' }).length, 1);
  assert.equal(getArticles({ date: '2026-09-05', timezoneOffset: 0 }).length, 1);
  assert.equal(getArticleCount({ isStarred: false }), 2);
});

test('upsert preserves article identity and user state, FTS stays synchronized', () => {
  markArticleRead('a', true);
  upsertArticle({
    id: 'new-id',
    source_id: 'qbitai',
    title: 'updated AI',
    url: 'https://example.com/a',
  });
  const article = getArticleById('a')!;
  assert.equal(article.is_starred, 1);
  assert.equal(article.is_read, 1);
  assert.equal(article.published_at, '2026-09-04T17:00:00.000Z');
  assert.equal(getArticleById('new-id'), undefined);
  const count = getDb()
    .prepare("SELECT COUNT(*) AS n FROM articles_fts WHERE articles_fts MATCH 'updated'")
    .get() as { n: number };
  assert.equal(count.n, 1);
  assert.throws(() =>
    upsertArticle({ id: 'unsafe', source_id: 'qbitai', title: 'bad', url: 'javascript:alert(1)' }),
  );
});

test('paper search respects category/featured, upsert updates links', () => {
  upsertPaper({
    id: 'paper-a',
    arxiv_id: '2609.00001',
    title: 'AI 中文',
    primary_category: 'cs.AI',
    pdf_url: 'https://arxiv.org/pdf/old',
  });
  upsertPaper({
    id: 'paper-b',
    arxiv_id: '2609.00002',
    title: 'AI vision',
    primary_category: 'cs.CV',
  });
  assert.equal(getPapers({ search: 'AI', category: 'cs.AI' }).length, 1);
  assert.equal(getPaperCount({ search: 'AI', category: 'cs.CV', isFeatured: true }), 0);
  upsertPaper({
    id: 'ignored',
    arxiv_id: '2609.00001',
    title: 'AI 中文',
    primary_category: 'cs.AI',
    pdf_url: 'https://arxiv.org/pdf/new',
  });
  assert.equal(getPapers({ category: 'cs.AI' })[0].pdf_url, 'https://arxiv.org/pdf/new');
});

test('invalid API pagination and dates return 400 rather than SQL errors/unlimited scans', async () => {
  for (const handler of [articlesGet, papersGet, productsGet, modelsGet]) {
    for (const value of ['-1', 'NaN', '0', '99999', '1.5', '1e2']) {
      const response = await handler(request(`/api/test?limit=${value}`));
      assert.equal(response.status, 400, `${handler.name} limit=${value}`);
    }
  }
  assert.equal((await articlesGet(request('/api/articles?offset=-1'))).status, 400);
  assert.equal((await articlesGet(request('/api/articles?date=2026-02-30'))).status, 400);
  assert.equal((await articlesGet(request('/api/articles?isStarred=yes'))).status, 400);
  const response = await articlesGet(request('/api/articles?limit=1'));
  const body = await response.json();
  assert.equal(body.articles.length, 1);
  assert.equal(body.total, 3);
  assert.equal(body.hasMore, true);
});

test('secret cannot be bypassed by forged same-origin headers and all mutations are protected', async () => {
  const forged = new NextRequest('http://localhost:3000/api/cron', {
    headers: { origin: 'http://localhost:3000', host: 'localhost:3000' },
  });
  assert.equal(validateApiKey(forged).authorized, false);
  assert.equal(validateApiKey(request('/api/cron', {})).authorized, true);
  assert.equal(
    (
      await articlesPost(
        request('/api/articles', { action: 'markStarred', id: 'a', isStarred: false }, false),
      )
    ).status,
    401,
  );
  assert.equal(
    (await articlesPost(request('/api/articles', { action: 'markRead', id: 'a', isRead: 'false' })))
      .status,
    400,
  );
  assert.equal(
    (
      await articlesPost(
        request('/api/articles', { action: 'markRead', id: 'missing', isRead: true }),
      )
    ).status,
    404,
  );
  const env = process.env.NODE_ENV;
  delete process.env.CRON_SECRET;
  Object.assign(process.env, { NODE_ENV: 'production' });
  assert.equal(validateApiKey(request('/api/cron')).authorized, false);
  process.env.CRON_SECRET = 'test-secret';
  Object.assign(process.env, { NODE_ENV: env });
});

test('summary refuses client URLs, bounds input, caches by stored content', async () => {
  let calls = 0;
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  globalThis.fetch = async (input) => {
    calls++;
    assert.equal(String(input), 'https://api.deepseek.com/v1/chat/completions');
    return Response.json({ choices: [{ message: { content: '• 测试总结 [1]' } }] });
  };
  try {
    assert.equal(
      (
        await summaryPost(
          request('/api/summary', { articles: [{ url: 'http://127.0.0.1/private' }] }),
        )
      ).status,
      400,
    );
    assert.equal(calls, 0);
    assert.equal(
      (await summaryPost(request('/api/summary', { articleIds: Array(11).fill('a') }))).status,
      400,
    );
    const response = await summaryPost(request('/api/summary', { articleIds: ['a'] }));
    assert.equal(response.status, 200);
    const again = await summaryPost(request('/api/summary', { articleIds: ['a'] }));
    assert.equal((await again.json()).cached, true);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('model prices retain small values, zero and unknown; model IDs do not collide', async () => {
  assert.equal(parseTokenPrice('0.000000001'), 0.001);
  assert.equal(parseTokenPrice('0'), 0);
  assert.equal(parseTokenPrice(''), null);
  assert.equal(parseTokenPrice('-1'), null);
  assert.equal(parseTokenPrice('garbage'), null);
  globalThis.fetch = async () =>
    Response.json({
      data: [
        {
          id: 'meta-llama/model:free',
          name: 'Test free',
          created: 1,
          context_length: 8000,
          pricing: { prompt: '0', completion: '0' },
        },
        {
          id: 'meta-llama/modelfree',
          name: 'Test paid',
          created: 1,
          context_length: 8000,
          pricing: { prompt: '0.000000001', completion: '0.000000002' },
        },
      ],
    });
  try {
    assert.equal(await fetchOpenRouterModels(), 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const models = getModels({ provider: 'Meta' });
  assert.equal(models.length, 2);
  assert.equal(models[0].is_open_source, 0);
  assert.equal(models.find((m) => m.name === 'Test free')?.input_price_per_1m, 0);
  assert.equal(models.find((m) => m.name === 'Test paid')?.input_price_per_1m, 0.001);
});

test('arXiv XML supports Atom namespaces, entities and alternate links', () => {
  const entries = parseArxivXml(
    `<atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><atom:entry><atom:id>https://arxiv.org/abs/2609.12345v2</atom:id><atom:title>AI &amp; vision</atom:title><atom:summary>Some &#x4E2D; text</atom:summary><atom:author><atom:name>Alice</atom:name></atom:author><atom:category term="cs.CV"/><arxiv:primary_category term="cs.CV"/><atom:link rel="related" href="https://example.com/other"/><atom:link rel="alternate" href="https://arxiv.org/abs/2609.12345v2"/></atom:entry></atom:feed>`,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'AI & vision');
  assert.equal(entries[0].primary_category?.term, 'cs.CV');
  assert.equal(entries[0].author[0].name, 'Alice');
  assert.equal(entries[0].link, 'https://arxiv.org/abs/2609.12345v2');
});

test('seed is repeatable and does not reset product timestamps or disable preferences', () => {
  getDb().prepare("UPDATE sources SET enabled = 0 WHERE id = 'qbitai'").run();
  const count = seedProducts();
  assert.ok(count > 0);
  getDb().prepare("UPDATE products SET added_at = '2020-01-01' WHERE id = 'chatgpt'").run();
  assert.equal(seedProducts(), count);
  assert.equal(
    (
      getDb().prepare("SELECT added_at FROM products WHERE id = 'chatgpt'").get() as {
        added_at: string;
      }
    ).added_at,
    '2020-01-01',
  );
  assert.equal(
    (
      getDb().prepare("SELECT enabled FROM sources WHERE id = 'qbitai'").get() as {
        enabled: number;
      }
    ).enabled,
    0,
  );
  const results = searchAll('Test');
  assert.equal(results.models.length, 2);
  assert.equal(searchAll('ChatGPT').products.length, 1);
});

test('crawl lock coordinates requests and skips disabled sources', async () => {
  getDb().prepare('UPDATE sources SET enabled = 0').run();
  assert.deepEqual(await crawlAll(), []);
  await assert.rejects(crawlAll(), /已有抓取任务/);
});

test('external links accept HTTP(S) only', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///tmp/x',
    'https://user:password@example.com',
    null,
  ])
    assert.equal(safeHttpUrl(value), undefined);
  assert.equal(safeHttpUrl('https://example.com/a'), 'https://example.com/a');
});

test('AI keywords do not match unrelated English substrings', () => {
  assert.equal(isAiRelated('EMAIL and RETAIL systems'), false);
  assert.equal(isAiRelated('AI 模型进展'), true);
  assert.equal(isAiRelated('New OpenAI research'), true);
});

test('legacy database migrations preserve sources and do not rebuild FTS on reopen', () => {
  closeDb();
  fs.mkdirSync('.e2e-work', { recursive: true });
  const filename = path.resolve('.e2e-work', `migration-${Date.now()}.db`);
  const legacy = new Database(filename);
  legacy.exec(`CREATE TABLE sources (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url TEXT, rss_url TEXT,
    enabled INTEGER DEFAULT 1, last_crawled_at TEXT, crawl_interval_min INTEGER DEFAULT 60
  ); INSERT INTO sources(id, name, type, enabled) VALUES ('qbitai', '自定义名称', 'news', 0);`);
  legacy.close();
  process.env.AI_RADAR_DB_PATH = filename;
  const db = getDb();
  const source = db
    .prepare("SELECT name, enabled, fail_count FROM sources WHERE id='qbitai'")
    .get() as { name: string; enabled: number; fail_count: number };
  assert.deepEqual(source, { name: '自定义名称', enabled: 0, fail_count: 0 });
  upsertArticle({
    id: 'legacy-test',
    source_id: 'qbitai',
    title: 'Migration searchable',
    url: 'https://example.com/migration',
  });
  markArticleStarred('legacy-test', true);
  closeDb();
  const reopened = getDb();
  assert.equal(getArticleById('legacy-test')?.is_starred, 1);
  assert.equal(
    (reopened.prepare('SELECT COUNT(*) as n FROM schema_migrations').get() as { n: number }).n,
    2,
  );
  assert.equal(
    (
      reopened
        .prepare("SELECT COUNT(*) as n FROM articles_fts WHERE articles_fts MATCH 'searchable'")
        .get() as { n: number }
    ).n,
    1,
  );
});
