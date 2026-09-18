import { openDatabase, migrateDatabase } from '../server/db.js';
let db;
try {
  db = await openDatabase();
  await migrateDatabase(db);
  console.log('Supabase PostgreSQL: schema sẵn sàng, RLS bật, anon/authenticated không truy cập trực tiếp các bảng.');
} catch (error) {
  console.error('Database migration failed:', error.code || error.message);
  process.exitCode = 1;
} finally { if (db) await db.close(); }
