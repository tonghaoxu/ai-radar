/**
 * 只更新产品数据，不影响模型和数据源
 * 用法: npx tsx scripts/seed-products.ts
 */
import { getDb, closeDb } from '../lib/db';
import fs from 'fs';
import path from 'path';

const products = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'data', 'products.json'), 'utf-8')
);

const db = getDb();
const stmt = db.prepare(`
  INSERT OR REPLACE INTO products (id, name, category, description, url, pricing_model, based_model, is_hot)
  VALUES (@id, @name, @category, @description, @url, @pricing_model, @based_model, @is_hot)
`);

let count = 0;
for (const p of products) {
  stmt.run(p);
  count++;
}

console.log(`✅ 产品数据已更新: ${count} 条`);
closeDb();
