import fs from 'node:fs';
import path from 'node:path';
import { getDb } from './db';
import { safeHttpUrl } from './validation';
import type { Product } from './types';

export function seedProducts() {
  const input: unknown = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/products.json'), 'utf8'),
  );
  if (!Array.isArray(input)) throw new Error('产品数据必须是数组');
  const products = input.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('无效产品记录');
    const row = item as Record<string, unknown>;
    for (const key of ['id', 'name', 'category', 'url'])
      if (typeof row[key] !== 'string' || !row[key]) throw new Error(`产品缺少 ${key}`);
    if (!safeHttpUrl(String(row.url))) throw new Error(`产品 ${row.id} 的网址无效`);
    return {
      id: String(row.id),
      name: String(row.name),
      category: String(row.category),
      url: String(row.url),
      description: typeof row.description === 'string' ? row.description : null,
      pricing_model: typeof row.pricing_model === 'string' ? row.pricing_model : null,
      based_model: typeof row.based_model === 'string' ? row.based_model : null,
      languages: typeof row.languages === 'string' ? row.languages : '多语言',
      is_hot: row.is_hot === 1 ? 1 : 0,
    } satisfies Product;
  });
  const db = getDb();
  const insert =
    db.prepare(`INSERT INTO products (id, name, category, description, url, pricing_model, based_model, languages, is_hot)
    VALUES (@id, @name, @category, @description, @url, @pricing_model, @based_model, @languages, @is_hot)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, category=excluded.category, description=excluded.description,
      url=excluded.url, pricing_model=excluded.pricing_model, based_model=excluded.based_model, languages=excluded.languages, is_hot=excluded.is_hot`);
  db.transaction(() => {
    for (const product of products) insert.run(product);
  })();
  return products.length;
}
