import { errorMessage } from '../lib/errors';
import { getDb, closeDb } from '../lib/db';

try {
  const db = getDb();
  const result = db
    .prepare("UPDATE articles SET category = 'AI综合' WHERE category = '综合'")
    .run();
  console.log(`已将 ${result.changes} 条文章分类从"综合"改为"AI综合"`);
} catch (err) {
  console.error(`分类重命名失败: ${errorMessage(err)}`);
  process.exitCode = 1;
} finally {
  closeDb();
}
