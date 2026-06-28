import { getDb, closeDb } from '../lib/db';

const db = getDb();
const articles = db.prepare(
  "SELECT title, category, language FROM articles WHERE source_id = '36kr-ai' ORDER BY published_at DESC LIMIT 20"
).all() as { title: string; category: string; language: string }[];

console.log(`36氪AI 共 ${articles.length} 篇:\n`);
articles.forEach((a, i) => {
  console.log(`${i + 1}. [${a.category}] ${(a.title || '').substring(0, 90)}`);
});
closeDb();
