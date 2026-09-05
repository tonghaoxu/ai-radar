import { errorMessage } from '../lib/errors';
/**
 * 清理数据库中与 AI 无关的文章（中英文均检查）
 * 用法: npx tsx scripts/cleanup.ts
 */
import { getDb, closeDb } from '../lib/db';
import { isAiRelated } from '../lib/crawler/keywords';

try {
  const db = getDb();
  const articles = db.prepare('SELECT id, title, source_id, language FROM articles').all() as {
    id: string;
    title: string;
    source_id: string;
    language: string;
  }[];

  const toDelete = articles.filter((a) => !isAiRelated(a.title || ''));
  const apply = process.argv.includes('--apply');
  console.log(apply ? '执行清理（保留已收藏和已读文章）' : '预览模式，传入 --apply 才执行删除');

  console.log(`总文章数: ${articles.length}`);
  console.log(`非AI相关需删除: ${toDelete.length}`);
  for (const a of toDelete) {
    console.log(`  删除: [${a.source_id}][${a.language}] ${(a.title || '').substring(0, 80)}`);
  }

  if (apply && toDelete.length > 0) {
    const deleteAll = db.transaction(() => {
      const deleteStmt = db.prepare(
        'DELETE FROM articles WHERE id = ? AND is_starred = 0 AND is_read = 0',
      );
      for (const a of toDelete) {
        deleteStmt.run(a.id);
      }
    });
    deleteAll();
    console.log(`\n已清理 ${toDelete.length} 篇无关文章`);
  }

  const remaining = db.prepare('SELECT COUNT(*) as c FROM articles').get() as { c: number };
  console.log(`剩余文章: ${remaining.c} 篇`);
} catch (err) {
  console.error(`清理失败: ${errorMessage(err)}`);
  process.exitCode = 1;
} finally {
  closeDb();
}
