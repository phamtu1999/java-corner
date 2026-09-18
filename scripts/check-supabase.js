import { openDatabase } from '../server/db.js';
// Read-only connection checks. Never print keys, connection strings or server error bodies.
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Điền SUPABASE_URL và SUPABASE_SECRET_KEY trong .env trước khi kiểm tra.');
  process.exitCode = 1;
} else {
  try {
    const origin = new URL(url);
    if (origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('invalid URL');
    const headers = { apikey: key };
    if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
    const check = async path => {
      const response = await fetch(new URL(path, origin), { headers, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    };
    await check('/rest/v1/');
    console.log('Supabase Data API: kết nối được. Chưa xác minh schema hoặc kết nối PostgreSQL trực tiếp.');
    for (const [variable, privateBucket] of [['SUPABASE_STORAGE_BUCKET', false], ['SUPABASE_PRIVATE_STORAGE_BUCKET', true]]) {
      const bucket = process.env[variable];
      if (!bucket) throw new Error(`Chưa điền ${variable}`);
      const response = await check(`/storage/v1/bucket/${encodeURIComponent(bucket)}`);
      const info = await response.json();
      if (privateBucket && info.public !== false) throw new Error('Bucket game riêng phải đặt Private.');
      console.log(`${variable}: tồn tại (${info.public ? 'Public' : 'Private'}).`);
    }
    console.log('Kiểm tra hoàn tất. Không ghi hoặc upload dữ liệu.');
  } catch (error) {
    const safe = /^(HTTP \d{3}|Chưa điền SUPABASE_[A-Z_]+|Bucket game riêng phải đặt Private\.)$/.test(error.message);
    console.error(safe ? error.message : 'Không kết nối được Supabase. Kiểm tra URL, key và kết nối mạng.');
    process.exitCode = 1;
  }
}

let database;
try {
  database = await openDatabase();
  await database.query('SELECT 1');
  console.log('PostgreSQL trực tiếp: SELECT 1 thành công, chứng chỉ SSL đã xác minh.');
} catch (error) {
  console.error('PostgreSQL:', error.code || error.message);
  process.exitCode = 1;
} finally { if (database) await database.close(); }
