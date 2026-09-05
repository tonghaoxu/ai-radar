import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { DEFAULT_SOURCES } from './sources';
import type { Article, Source, Paper, Model, ModelBenchmark, Product } from './types';
import { likePattern, safeHttpUrl } from './validation';

// 确保 data 目录存在
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.AI_RADAR_DB_PATH || path.join(DATA_DIR, 'ai-news.db');

// 单例模式
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const connection = new Database(process.env.AI_RADAR_DB_PATH || DB_PATH);
  try {
    connection.pragma('journal_mode = WAL');
    connection.pragma('foreign_keys = ON');
    connection.pragma('busy_timeout = 5000');
    // IMMEDIATE 事务串行化多个进程首次启动时的迁移，失败时不会留下半初始化单例。
    connection
      .transaction(() => {
        initTables(connection);
        const insertSource = connection.prepare(
          'INSERT OR IGNORE INTO sources(id, name, type, url, rss_url, enabled) VALUES (@id, @name, @type, @url, @rss_url, @enabled)',
        );
        for (const source of DEFAULT_SOURCES)
          insertSource.run({ ...source, enabled: 'enabled' in source ? source.enabled : 1 });
      })
      .immediate();
    db = connection;
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}

function initTables(db: Database.Database) {
  db.exec(`
    -- 数据源配置
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('news', 'paper', 'model', 'product')),
      url TEXT,
      rss_url TEXT,
      enabled INTEGER DEFAULT 1,
      last_crawled_at TEXT,
      crawl_interval_min INTEGER DEFAULT 60,
      -- 健康度追踪：区分「尝试过」和「成功过」，让静默失效的源可见
      last_attempt_at TEXT,
      fail_count INTEGER DEFAULT 0,
      last_error TEXT
    );

    -- 聚合文章
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      source_id TEXT REFERENCES sources(id),
      title TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      summary TEXT,
      content_snippet TEXT,
      author TEXT,
      published_at TEXT,
      crawled_at TEXT DEFAULT (datetime('now')),
      category TEXT DEFAULT 'AI综合',
      language TEXT DEFAULT 'zh',
      is_read INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0
    );

    -- AI模型
    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      version TEXT,
      params_b REAL,
      context_window INTEGER,
      modalities TEXT DEFAULT 'text',
      license_type TEXT,
      is_open_source INTEGER DEFAULT 0,
      description TEXT,
      released_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 模型基准测试
    CREATE TABLE IF NOT EXISTS model_benchmarks (
      id TEXT PRIMARY KEY,
      model_id TEXT REFERENCES models(id),
      benchmark_name TEXT NOT NULL,
      score REAL,
      metric TEXT,
      rank INTEGER,
      tested_at TEXT,
      UNIQUE(model_id, benchmark_name)
    );

    -- 模型价格
    CREATE TABLE IF NOT EXISTS model_prices (
      id TEXT PRIMARY KEY,
      model_id TEXT REFERENCES models(id),
      input_price_per_1m REAL,
      output_price_per_1m REAL,
      currency TEXT DEFAULT 'USD',
      cache_discount REAL,
      free_tier TEXT,
      source_url TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 学术论文
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      arxiv_id TEXT UNIQUE,
      title TEXT NOT NULL,
      authors TEXT,
      abstract TEXT,
      categories TEXT,
      primary_category TEXT,
      published_at TEXT,
      pdf_url TEXT,
      code_url TEXT,
      is_featured INTEGER DEFAULT 0,
      crawled_at TEXT DEFAULT (datetime('now'))
    );

    -- AI产品
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      url TEXT,
      pricing_model TEXT,
      based_model TEXT,
      languages TEXT DEFAULT '多语言',
      is_hot INTEGER DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now'))
    );

    -- 文章全文搜索索引
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title,
      summary,
      content='articles',
      content_rowid='rowid'
    );

    -- 论文全文搜索索引
    CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
      title,
      abstract,
      content='papers',
      content_rowid='rowid'
    );

    -- FTS5 同步触发器：articles
    CREATE TRIGGER IF NOT EXISTS articles_fts_ai AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
    END;
    CREATE TRIGGER IF NOT EXISTS articles_fts_ad AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
    END;
    CREATE TRIGGER IF NOT EXISTS articles_fts_au AFTER UPDATE OF title, summary ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
      INSERT INTO articles_fts(rowid, title, summary) VALUES (new.rowid, new.title, new.summary);
    END;

    -- FTS5 同步触发器：papers
    CREATE TRIGGER IF NOT EXISTS papers_fts_ai AFTER INSERT ON papers BEGIN
      INSERT INTO papers_fts(rowid, title, abstract) VALUES (new.rowid, new.title, new.abstract);
    END;
    CREATE TRIGGER IF NOT EXISTS papers_fts_ad AFTER DELETE ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract) VALUES('delete', old.rowid, old.title, old.abstract);
    END;
    CREATE TRIGGER IF NOT EXISTS papers_fts_au AFTER UPDATE OF title, abstract ON papers BEGIN
      INSERT INTO papers_fts(papers_fts, rowid, title, abstract) VALUES('delete', old.rowid, old.title, old.abstract);
      INSERT INTO papers_fts(rowid, title, abstract) VALUES (new.rowid, new.title, new.abstract);
    END;

    -- 文章索引
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source_id);
    CREATE INDEX IF NOT EXISTS idx_articles_starred ON articles(is_starred);

    -- 论文索引
    CREATE INDEX IF NOT EXISTS idx_papers_published ON papers(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_papers_category ON papers(primary_category);

    -- 模型索引
    CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
    CREATE INDEX IF NOT EXISTS idx_models_open_source ON models(is_open_source);
  `);

  // 迁移：为已存在的 sources 表补齐健康度字段（CREATE TABLE IF NOT EXISTS 不会改老表）
  const sourceCols = new Set(
    (db.prepare('PRAGMA table_info(sources)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!sourceCols.has('last_attempt_at')) {
    db.exec('ALTER TABLE sources ADD COLUMN last_attempt_at TEXT');
  }
  if (!sourceCols.has('fail_count')) {
    db.exec('ALTER TABLE sources ADD COLUMN fail_count INTEGER DEFAULT 0');
  }
  if (!sourceCols.has('last_error')) {
    db.exec('ALTER TABLE sources ADD COLUMN last_error TEXT');
  }

  const modelCols = db.prepare('PRAGMA table_info(models)').all() as { name: string }[];
  if (!modelCols.some((column) => column.name === 'superseded_by'))
    db.exec('ALTER TABLE models ADD COLUMN superseded_by TEXT');

  // 一次性迁移：避免每次启动扫描整库重建全文索引。
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)');
  if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = 1').get()) {
    db.transaction(() => {
      db.prepare("INSERT INTO articles_fts(articles_fts) VALUES('rebuild')").run();
      db.prepare("INSERT INTO papers_fts(papers_fts) VALUES('rebuild')").run();
      db.prepare('INSERT INTO schema_migrations(version) VALUES (1)').run();
    })();
  }
  if (!db.prepare('SELECT 1 FROM schema_migrations WHERE version = 2').get()) {
    db.exec(`
      DROP TRIGGER IF EXISTS articles_fts_au;
      CREATE TRIGGER articles_fts_au AFTER UPDATE OF title, summary ON articles BEGIN
        INSERT INTO articles_fts(articles_fts, rowid, title, summary) VALUES('delete', old.rowid, old.title, old.summary);
        INSERT INTO articles_fts(rowid, title, summary) VALUES(new.rowid, new.title, new.summary);
      END;
      DROP TRIGGER IF EXISTS papers_fts_au;
      CREATE TRIGGER papers_fts_au AFTER UPDATE OF title, abstract ON papers BEGIN
        INSERT INTO papers_fts(papers_fts, rowid, title, abstract) VALUES('delete', old.rowid, old.title, old.abstract);
        INSERT INTO papers_fts(rowid, title, abstract) VALUES(new.rowid, new.title, new.abstract);
      END;
      INSERT INTO schema_migrations(version) VALUES (2);
    `);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_category_published ON articles(category, published_at DESC, id);
    CREATE INDEX IF NOT EXISTS idx_articles_source_published ON articles(source_id, published_at DESC, id);
    CREATE INDEX IF NOT EXISTS idx_prices_model_updated ON model_prices(model_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS crawl_locks (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL);
  `);
}

// ============ Articles CRUD ============

export interface ArticleOptions {
  category?: string;
  sourceId?: string;
  language?: string;
  isStarred?: boolean;
  search?: string;
  date?: string;
  timezoneOffset?: number;
  limit?: number;
  offset?: number;
}

function articleWhere(options: ArticleOptions) {
  let sql = '1=1';
  const params: (string | number)[] = [];
  if (options.category && options.category !== '全部') {
    sql += ' AND a.category = ?';
    params.push(options.category);
  }
  if (options.sourceId) {
    sql += ' AND a.source_id = ?';
    params.push(options.sourceId);
  }
  if (options.language) {
    sql += ' AND a.language = ?';
    params.push(options.language);
  }
  if (options.isStarred !== undefined) {
    sql += ' AND a.is_starred = ?';
    params.push(Number(options.isStarred));
  }
  if (options.search) {
    sql += " AND (a.title LIKE ? ESCAPE '\\' OR a.summary LIKE ? ESCAPE '\\')";
    params.push(likePattern(options.search), likePattern(options.search));
  }
  if (options.date) {
    sql += ' AND date(a.published_at, ?) = ?';
    params.push(`${-(options.timezoneOffset ?? 0)} minutes`, options.date);
  }
  return { sql, params };
}

export function getArticles(options: ArticleOptions = {}): Article[] {
  const { sql, params } = articleWhere(options);
  return getDb()
    .prepare(
      `SELECT a.*, s.name AS source_name FROM articles a
    LEFT JOIN sources s ON a.source_id = s.id WHERE ${sql}
    ORDER BY a.published_at DESC, a.id ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit ?? 50, options.offset ?? 0) as Article[];
}

export function getArticleById(id: string) {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT a.*, s.name as source_name
    FROM articles a
    LEFT JOIN sources s ON a.source_id = s.id
    WHERE a.id = ?
  `,
    )
    .get(id) as Article | undefined;
}

export function upsertArticle(article: {
  id: string;
  source_id: string;
  title: string;
  url: string;
  summary?: string;
  content_snippet?: string;
  author?: string;
  published_at?: string;
  category?: string;
  language?: string;
}) {
  if (!safeHttpUrl(article.url)) throw new Error('文章链接必须为 HTTP(S) URL');
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO articles (id, source_id, title, url, summary, content_snippet, author, published_at, category, language, crawled_at)
    VALUES (@id, @source_id, @title, @url, @summary, @content_snippet, @author, @published_at, @category, @language, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      title = @title,
      summary = @summary,
      content_snippet = @content_snippet,
      author = @author,
      published_at = COALESCE(articles.published_at, @published_at),
      category = @category,
      language = @language,
      crawled_at = datetime('now')
  `);
  return stmt.run({
    id: article.id,
    source_id: article.source_id,
    title: article.title,
    url: article.url,
    summary: article.summary ?? null,
    content_snippet: article.content_snippet ?? null,
    author: article.author ?? null,
    published_at: normalizeTimestamp(article.published_at),
    category: article.category ?? 'AI综合',
    language: article.language ?? 'zh',
  });
}

export function markArticleRead(id: string, isRead: boolean) {
  const db = getDb();
  return db.prepare('UPDATE articles SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, id);
}

export function markArticleStarred(id: string, isStarred: boolean) {
  const db = getDb();
  return db.prepare('UPDATE articles SET is_starred = ? WHERE id = ?').run(isStarred ? 1 : 0, id);
}

export function getArticleCount(options: ArticleOptions = {}): number {
  const { sql, params } = articleWhere(options);
  return (
    getDb()
      .prepare(`SELECT COUNT(*) as count FROM articles a WHERE ${sql}`)
      .get(...params) as { count: number }
  ).count;
}

export function getDistinctSourceCount(options: ArticleOptions = {}): number {
  const { sql, params } = articleWhere(options);
  return (
    getDb()
      .prepare(`SELECT COUNT(DISTINCT a.source_id) as count FROM articles a WHERE ${sql}`)
      .get(...params) as { count: number }
  ).count;
}

// ============ Sources CRUD ============

export function getSources(type?: string) {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM sources WHERE type = ? AND enabled = 1').all(type) as Source[];
  }
  return db.prepare('SELECT * FROM sources WHERE enabled = 1').all() as Source[];
}

export function upsertSource(source: {
  id: string;
  name: string;
  type: string;
  url?: string;
  rss_url?: string;
  enabled?: number;
}) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO sources (id, name, type, url, rss_url, enabled)
    VALUES (@id, @name, @type, @url, @rss_url, @enabled)
    ON CONFLICT(id) DO UPDATE SET
      name = @name,
      url = @url,
      rss_url = @rss_url
  `);
  return stmt.run({
    ...source,
    url: source.url ?? null,
    rss_url: source.rss_url ?? null,
    enabled: source.enabled ?? 1,
  });
}

/** 抓取成功：推进成功时间戳并清零失败计数 */
export function updateSourceLastCrawled(sourceId: string) {
  const db = getDb();
  db.prepare(
    `UPDATE sources SET
       last_crawled_at = datetime('now'),
       last_attempt_at = datetime('now'),
       fail_count = 0,
       last_error = NULL
     WHERE id = ?`,
  ).run(sourceId);
}

/**
 * 抓取失败：只推进尝试时间戳并累加失败次数，`last_crawled_at` 保持为最后一次
 * 成功的时间，这样「上次成功抓取」和「一直在重试但一直失败」能被区分开。
 */
export function markSourceFailure(sourceId: string, message: string) {
  const db = getDb();
  db.prepare(
    `UPDATE sources SET
       last_attempt_at = datetime('now'),
       fail_count = COALESCE(fail_count, 0) + 1,
       last_error = ?
     WHERE id = ?`,
  ).run((message || '未知错误').substring(0, 300), sourceId);
}

// ============ Models CRUD ============

export function getModels(
  options: {
    provider?: string;
    isOpenSource?: boolean;
    modality?: string;
    search?: string;
    offset?: number;
    limit?: number;
  } = {},
) {
  const db = getDb();
  const { provider, isOpenSource, modality, search, offset = 0, limit = 50 } = options;

  let sql = `
    SELECT m.*,
           mp.input_price_per_1m, mp.output_price_per_1m, mp.currency, mp.free_tier, mp.source_url, mp.updated_at as price_updated_at
    FROM models m
    LEFT JOIN model_prices mp ON mp.id = (
      SELECT id FROM model_prices WHERE model_id = m.id ORDER BY updated_at DESC, id ASC LIMIT 1
    )
    WHERE m.superseded_by IS NULL
  `;
  const params: (string | number)[] = [];

  if (provider) {
    sql += ' AND m.provider = ?';
    params.push(provider);
  }
  if (isOpenSource !== undefined) {
    sql += ' AND m.is_open_source = ?';
    if (isOpenSource)
      sql += " AND mp.source_url IS NOT NULL AND m.license_type NOT IN ('未核验', 'Open Source')";
    params.push(isOpenSource ? 1 : 0);
  }
  if (modality) {
    sql += ' AND m.modalities LIKE ?';
    params.push(`%${modality}%`);
  }

  if (search) {
    sql += " AND (m.name LIKE ? ESCAPE '\\' OR m.description LIKE ? ESCAPE '\\')";
    params.push(likePattern(search), likePattern(search));
  }
  sql += ' ORDER BY m.released_at DESC, m.id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params) as Model[];
}

export function getModelBenchmarks(modelId: string) {
  const db = getDb();
  return db
    .prepare('SELECT * FROM model_benchmarks WHERE model_id = ? ORDER BY benchmark_name')
    .all(modelId) as ModelBenchmark[];
}

/** 批量获取所有模型的基准测试，避免 N+1 查询 */
export function getAllModelBenchmarks() {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM model_benchmarks ORDER BY benchmark_name')
    .all() as ModelBenchmark[];
  const byModel: Record<string, ModelBenchmark[]> = {};
  for (const row of rows) {
    if (!byModel[row.model_id]) byModel[row.model_id] = [];
    byModel[row.model_id].push(row);
  }
  return byModel;
}

export function getModelProviders() {
  const db = getDb();
  return db
    .prepare('SELECT DISTINCT provider FROM models WHERE superseded_by IS NULL ORDER BY provider')
    .all() as { provider: string }[];
}

// ============ Papers CRUD ============

export interface PaperOptions {
  category?: string;
  search?: string;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
}
function paperWhere(options: PaperOptions) {
  let sql = '1=1';
  const params: (string | number)[] = [];
  if (options.category && options.category !== '全部') {
    sql += ' AND primary_category = ?';
    params.push(options.category);
  }
  if (options.isFeatured !== undefined) {
    sql += ' AND is_featured = ?';
    params.push(Number(options.isFeatured));
  }
  if (options.search) {
    sql += " AND (title LIKE ? ESCAPE '\\' OR abstract LIKE ? ESCAPE '\\')";
    params.push(likePattern(options.search), likePattern(options.search));
  }
  return { sql, params };
}
export function getPapers(options: PaperOptions = {}): Paper[] {
  const { sql, params } = paperWhere(options);
  return getDb()
    .prepare(
      `SELECT * FROM papers WHERE ${sql} ORDER BY published_at DESC, id ASC LIMIT ? OFFSET ?`,
    )
    .all(...params, options.limit ?? 50, options.offset ?? 0) as Paper[];
}
export function getPaperCount(options: PaperOptions = {}) {
  const { sql, params } = paperWhere(options);
  return (
    getDb()
      .prepare(`SELECT COUNT(*) as count FROM papers WHERE ${sql}`)
      .get(...params) as { count: number }
  ).count;
}

export function upsertPaper(paper: {
  id: string;
  arxiv_id?: string;
  title: string;
  authors?: string;
  abstract?: string;
  categories?: string;
  primary_category?: string;
  published_at?: string;
  pdf_url?: string;
  code_url?: string;
}) {
  const db = getDb();
  // 注意：arxiv_id 为 NULL 时 UNIQUE 约束不生效（SQLite 将多个 NULL 视为互异），
  // 需要业务层保证不重复插入无 arxiv_id 的论文
  const stmt = db.prepare(`
    INSERT INTO papers (id, arxiv_id, title, authors, abstract, categories, primary_category, published_at, pdf_url, code_url, crawled_at)
    VALUES (@id, @arxiv_id, @title, @authors, @abstract, @categories, @primary_category, @published_at, @pdf_url, @code_url, datetime('now'))
    ON CONFLICT(arxiv_id) DO UPDATE SET
      title = @title,
      authors = @authors,
      abstract = @abstract,
      categories = @categories,
      primary_category = @primary_category,
      published_at = @published_at,
      pdf_url = COALESCE(@pdf_url, papers.pdf_url),
      code_url = COALESCE(@code_url, papers.code_url),
      crawled_at = datetime('now')
  `);
  return stmt.run({
    id: paper.id,
    arxiv_id: paper.arxiv_id ?? null,
    title: paper.title,
    authors: paper.authors ?? null,
    abstract: paper.abstract ?? null,
    categories: paper.categories ?? null,
    primary_category: paper.primary_category ?? null,
    published_at: normalizeTimestamp(paper.published_at),
    pdf_url: paper.pdf_url ?? null,
    code_url: paper.code_url ?? null,
  });
}

export function getPaperCategories() {
  const db = getDb();
  return db
    .prepare(
      "SELECT DISTINCT primary_category FROM papers WHERE primary_category != '' ORDER BY primary_category",
    )
    .all() as { primary_category: string }[];
}

// ============ Products CRUD ============

export function getProducts(
  options: {
    category?: string;
    isHot?: boolean;
    search?: string;
    offset?: number;
    limit?: number;
  } = {},
) {
  const db = getDb();
  const { category, isHot, search, offset = 0, limit = 100 } = options;

  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: (string | number)[] = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (isHot !== undefined) {
    sql += ' AND is_hot = ?';
    params.push(Number(isHot));
  }

  if (search) {
    sql += " AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\')";
    params.push(likePattern(search), likePattern(search));
  }
  sql += ' ORDER BY is_hot DESC, name ASC, id ASC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params) as Product[];
}

export function getProductCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all() as {
    category: string;
  }[];
}

// ============ Search ============

export function searchAll(query: string) {
  const db = getDb();
  const like = likePattern(query);
  const articles = db
    .prepare(
      `
    SELECT a.*, s.name as source_name, 'article' as result_type
    FROM articles a
    LEFT JOIN sources s ON a.source_id = s.id
    WHERE a.title LIKE ? ESCAPE '\\' OR a.summary LIKE ? ESCAPE '\\'
    ORDER BY a.published_at DESC
    LIMIT 20
  `,
    )
    .all(like, like);

  const papers = db
    .prepare(
      `
    SELECT p.*, 'paper' as result_type
    FROM papers p
    WHERE p.title LIKE ? ESCAPE '\\' OR p.abstract LIKE ? ESCAPE '\\'
    ORDER BY p.published_at DESC
    LIMIT 20
  `,
    )
    .all(like, like);

  const models = db
    .prepare(
      "SELECT id, name, provider, description FROM models WHERE superseded_by IS NULL AND (name LIKE ? ESCAPE '\\' OR provider LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') ORDER BY released_at DESC, id LIMIT 20",
    )
    .all(like, like, like);
  const products = db
    .prepare(
      "SELECT id, name, category, description, url FROM products WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ORDER BY name, id LIMIT 20",
    )
    .all(like, like);
  return { articles, papers, models, products };
}

// ============ Stats ============

export function getStats() {
  const db = getDb();
  const articleCount = (
    db.prepare('SELECT COUNT(*) as count FROM articles').get() as { count: number }
  ).count;
  const paperCount = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as { count: number })
    .count;
  const modelCount = (
    db.prepare('SELECT COUNT(*) as count FROM models WHERE superseded_by IS NULL').get() as {
      count: number;
    }
  ).count;
  const productCount = (
    db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }
  ).count;
  const sourceCount = (
    db.prepare('SELECT COUNT(*) as count FROM sources').get() as { count: number }
  ).count;

  return { articleCount, paperCount, modelCount, productCount, sourceCount };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

function normalizeTimestamp(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
