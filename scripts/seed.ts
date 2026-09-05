import { getDb, closeDb } from '../lib/db';
import { seedProducts } from '../lib/seed-products';
import { errorMessage } from '../lib/errors';

try {
  // getDb 补齐默认来源，不覆盖用户禁用状态、阅读记录或在线模型数据。
  getDb();
  console.log(
    `初始化完成，更新 ${seedProducts()} 个产品。模型请通过 npm run crawl 获取可追溯数据。`,
  );
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  closeDb();
}
