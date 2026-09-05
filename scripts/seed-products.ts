import { closeDb } from '../lib/db';
import { seedProducts } from '../lib/seed-products';
import { errorMessage } from '../lib/errors';
try {
  console.log(`更新 ${seedProducts()} 个产品`);
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  closeDb();
}
