/**
 * 清理数据库中与 AI 无关的文章（中英文均检查）
 * 用法: npx tsx scripts/cleanup.ts
 */
import { getDb, closeDb } from '../lib/db';
import { isAiRelated } from '../lib/crawler/keywords';

try {
  const db = getDb();
  const articles = db.prepare(
    'SELECT id, title, source_id, language FROM articles'
  ).all() as { id: string; title: string; source_id: string; language: string }[];

  const toDelete = articles.filter(a => !isAiRelated(a.title || ''));

  console.log(`总文章数: ${articles.length}`);
  console.log(`非AI相关需删除: ${toDelete.length}`);
  for (const a of toDelete) {
    console.log(`  删除: [${a.source_id}][${a.language}] ${(a.title || '').substring(0, 80)}`);
  }

  if (toDelete.length > 0) {
    const deleteAll = db.transaction(() => {
      const deleteStmt = db.prepare('DELETE FROM articles WHERE id = ?');
      for (const a of toDelete) {
        deleteStmt.run(a.id);
      }
    });
    deleteAll();
    console.log(`\n已清理 ${toDelete.length} 篇无关文章`);
  }

  const remaining = db.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number };
  console.log(`剩余文章: ${remaining.c} 篇`);
} catch (err: any) {
  console.error(`清理失败: ${err.message}`);
  process.exit(1);
} finally {
  closeDb();
}
