/**
 * 只更新产品数据，不影响模型和数据源
 * 用法: npx tsx scripts/seed-products.ts
 */
import { getDb, closeDb } from '../lib/db';
import fs from 'fs';
import path from 'path';

let products: any[] = [];
try {
  const productsPath = path.join(process.cwd(), 'data', 'products.json');
  products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
} catch (err: any) {
  console.error(`❌ 无法读取产品数据文件: ${err.message}`);
  process.exit(1);
}

const db = getDb();

try {
  const seedProducts = db.transaction(() => {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO products (id, name, category, description, url, pricing_model, based_model, is_hot)
      VALUES (@id, @name, @category, @description, @url, @pricing_model, @based_model, @is_hot)
    `);

    let count = 0;
    for (const p of products) {
      stmt.run(p);
      count++;
    }
    return count;
  });

  const count = seedProducts();
  console.log(`✅ 产品数据已更新: ${count} 条`);
} catch (err: any) {
  console.error(`❌ 产品数据更新失败: ${err.message}`);
  process.exit(1);
} finally {
  closeDb();
}
