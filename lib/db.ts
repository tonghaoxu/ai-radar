import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 确保 data 目录存在
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'ai-news.db');

// 单例模式
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables(db);
  }
  return db;
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
      crawl_interval_min INTEGER DEFAULT 60
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
    CREATE TRIGGER IF NOT EXISTS articles_fts_au AFTER UPDATE ON articles BEGIN
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
    CREATE TRIGGER IF NOT EXISTS papers_fts_au AFTER UPDATE ON papers BEGIN
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

  // 重建 FTS 索引（确保已有数据和新增触发器同步）
  try {
    db.prepare("INSERT INTO articles_fts(articles_fts) VALUES('rebuild')").run();
    db.prepare("INSERT INTO papers_fts(papers_fts) VALUES('rebuild')").run();
  } catch (err: any) {
    // 表尚不存在时忽略，其他错误需要输出日志排查
    if (!err.message?.includes('no such table')) {
      console.error('[DB] FTS 索引重建失败:', err.message);
    }
  }
}

// ============ Articles CRUD ============

export function getArticles(options: {
  category?: string;
  sourceId?: string;
  language?: string;
  isStarred?: boolean;
  search?: string;
  date?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const db = getDb();
  const { category, sourceId, language, isStarred, search, date, limit = 50, offset = 0 } = options;

  if (search) {
    const like = `%${search}%`;
    return db.prepare(`
      SELECT a.*, s.name as source_name
      FROM articles a
      LEFT JOIN sources s ON a.source_id = s.id
      WHERE a.title LIKE ? OR a.summary LIKE ?
      ORDER BY a.published_at DESC
      LIMIT ? OFFSET ?
    `).all(like, like, limit, offset);
  }

  let sql = 'SELECT a.*, s.name as source_name FROM articles a LEFT JOIN sources s ON a.source_id = s.id WHERE 1=1';
  const params: any[] = [];

  if (category && category !== '全部') {
    sql += ' AND a.category = ?';
    params.push(category);
  }
  if (sourceId) {
    sql += ' AND a.source_id = ?';
    params.push(sourceId);
  }
  if (language) {
    sql += ' AND a.language = ?';
    params.push(language);
  }
  if (isStarred) {
    sql += ' AND a.is_starred = 1';
  }
  if (date) {
    sql += " AND date(a.published_at) = ?";
    params.push(date);
  }

  sql += ' ORDER BY a.published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
}

export function getArticleById(id: string) {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, s.name as source_name
    FROM articles a
    LEFT JOIN sources s ON a.source_id = s.id
    WHERE a.id = ?
  `).get(id);
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
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO articles (id, source_id, title, url, summary, content_snippet, author, published_at, category, language, crawled_at)
    VALUES (@id, @source_id, @title, @url, @summary, @content_snippet, @author, @published_at, @category, @language, datetime('now'))
    ON CONFLICT(url) DO UPDATE SET
      title = @title,
      summary = @summary,
      content_snippet = @content_snippet,
      author = @author,
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
    published_at: article.published_at ?? null,
    category: article.category ?? 'AI综合',
    language: article.language ?? 'zh',
  });
}

export function markArticleRead(id: string, isRead: boolean) {
  const db = getDb();
  db.prepare('UPDATE articles SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, id);
}

export function markArticleStarred(id: string, isStarred: boolean) {
  const db = getDb();
  db.prepare('UPDATE articles SET is_starred = ? WHERE id = ?').run(isStarred ? 1 : 0, id);
}

export function getArticleCount(options: { category?: string; sourceId?: string; date?: string } = {}) {
  const db = getDb();
  const { category, sourceId, date } = options;
  let sql = 'SELECT COUNT(*) as count FROM articles WHERE 1=1';
  const params: any[] = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (sourceId) {
    sql += ' AND source_id = ?';
    params.push(sourceId);
  }
  if (date) {
    sql += ' AND date(published_at) = ?';
    params.push(date);
  }

  return (db.prepare(sql).get(...params) as any).count;
}

export function getDistinctSourceCount(options: { date?: string } = {}) {
  const db = getDb();
  const { date } = options;
  let sql = 'SELECT COUNT(DISTINCT source_id) as count FROM articles WHERE 1=1';
  const params: any[] = [];

  if (date) {
    sql += ' AND date(published_at) = ?';
    params.push(date);
  }

  return (db.prepare(sql).get(...params) as any).count;
}

// ============ Sources CRUD ============

export function getSources(type?: string) {
  const db = getDb();
  if (type) {
    return db.prepare('SELECT * FROM sources WHERE type = ? AND enabled = 1').all(type);
  }
  return db.prepare('SELECT * FROM sources WHERE enabled = 1').all();
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
    enabled: source.enabled ?? 1,
  });
}

export function updateSourceLastCrawled(sourceId: string) {
  const db = getDb();
  db.prepare("UPDATE sources SET last_crawled_at = datetime('now') WHERE id = ?").run(sourceId);
}

// ============ Models CRUD ============

export function getModels(options: {
  provider?: string;
  isOpenSource?: boolean;
  modality?: string;
  limit?: number;
} = {}) {
  const db = getDb();
  const { provider, isOpenSource, modality, limit = 50 } = options;

  let sql = `
    SELECT m.*,
           mp.input_price_per_1m, mp.output_price_per_1m, mp.currency, mp.free_tier
    FROM models m
    LEFT JOIN model_prices mp ON m.id = mp.model_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (provider) {
    sql += ' AND m.provider = ?';
    params.push(provider);
  }
  if (isOpenSource !== undefined) {
    sql += ' AND m.is_open_source = ?';
    params.push(isOpenSource ? 1 : 0);
  }
  if (modality) {
    sql += ' AND m.modalities LIKE ?';
    params.push(`%${modality}%`);
  }

  sql += ' ORDER BY m.released_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

export function getModelBenchmarks(modelId: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM model_benchmarks WHERE model_id = ? ORDER BY benchmark_name').all(modelId);
}

/** 批量获取所有模型的基准测试，避免 N+1 查询 */
export function getAllModelBenchmarks() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM model_benchmarks ORDER BY benchmark_name').all() as any[];
  const byModel: Record<string, any[]> = {};
  for (const row of rows) {
    if (!byModel[row.model_id]) byModel[row.model_id] = [];
    byModel[row.model_id].push(row);
  }
  return byModel;
}

export function getModelProviders() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT provider FROM models ORDER BY provider').all();
}

// ============ Papers CRUD ============

export function getPapers(options: {
  category?: string;
  search?: string;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
} = {}) {
  const db = getDb();
  const { category, search, isFeatured, limit = 50, offset = 0 } = options;

  if (search) {
    const like = `%${search}%`;
    return db.prepare(`
      SELECT * FROM papers
      WHERE title LIKE ? OR abstract LIKE ?
      ORDER BY published_at DESC
      LIMIT ? OFFSET ?
    `).all(like, like, limit, offset);
  }

  let sql = 'SELECT * FROM papers WHERE 1=1';
  const params: any[] = [];

  if (category && category !== '全部') {
    sql += ' AND primary_category = ?';
    params.push(category);
  }
  if (isFeatured) {
    sql += ' AND is_featured = 1';
  }

  sql += ' ORDER BY published_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(sql).all(...params);
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
    published_at: paper.published_at ?? null,
    pdf_url: paper.pdf_url ?? null,
    code_url: paper.code_url ?? null,
  });
}

export function getPaperCategories() {
  const db = getDb();
  return db.prepare("SELECT DISTINCT primary_category FROM papers WHERE primary_category != '' ORDER BY primary_category").all();
}

// ============ Products CRUD ============

export function getProducts(options: {
  category?: string;
  isHot?: boolean;
  limit?: number;
} = {}) {
  const db = getDb();
  const { category, isHot, limit = 100 } = options;

  let sql = 'SELECT * FROM products WHERE 1=1';
  const params: any[] = [];

  if (category && category !== '全部') {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (isHot) {
    sql += ' AND is_hot = 1';
  }

  sql += ' ORDER BY added_at DESC LIMIT ?';
  params.push(limit);

  return db.prepare(sql).all(...params);
}

export function getProductCategories() {
  const db = getDb();
  return db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
}

// ============ Search ============

export function searchAll(query: string) {
  const db = getDb();
  const like = `%${query}%`;
  const articles = db.prepare(`
    SELECT a.*, s.name as source_name, 'article' as result_type
    FROM articles a
    LEFT JOIN sources s ON a.source_id = s.id
    WHERE a.title LIKE ? ESCAPE '\\' OR a.summary LIKE ? ESCAPE '\\'
    ORDER BY a.published_at DESC
    LIMIT 20
  `).all(like, like);

  const papers = db.prepare(`
    SELECT p.*, 'paper' as result_type
    FROM papers p
    WHERE p.title LIKE ? ESCAPE '\\' OR p.abstract LIKE ? ESCAPE '\\'
    ORDER BY p.published_at DESC
    LIMIT 20
  `).all(like, like);

  return { articles, papers };
}

// ============ Stats ============

export function getStats() {
  const db = getDb();
  const articleCount = (db.prepare('SELECT COUNT(*) as count FROM articles').get() as any).count;
  const paperCount = (db.prepare('SELECT COUNT(*) as count FROM papers').get() as any).count;
  const modelCount = (db.prepare('SELECT COUNT(*) as count FROM models').get() as any).count;
  const productCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
  const sourceCount = (db.prepare('SELECT COUNT(*) as count FROM sources').get() as any).count;

  return { articleCount, paperCount, modelCount, productCount, sourceCount };
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
