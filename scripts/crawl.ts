import { loadEnvConfig } from '@next/env';
import { closeDb } from '../lib/db';
import { crawlAll } from '../lib/crawler';
import { errorMessage } from '../lib/errors';
loadEnvConfig(process.cwd());
async function main() {
  try {
    const results = await crawlAll();
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => result.error)) process.exitCode = 1;
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}
void main();
