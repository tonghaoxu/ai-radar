import { getDb, closeDb } from '../lib/db';

const db = getDb();
db.prepare("UPDATE sources SET rss_url = 'https://36kr.com/feed' WHERE id = '36kr-ai'").run();
console.log('36kr RSS URL 已更新');
closeDb();
