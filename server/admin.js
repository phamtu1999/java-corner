import { openDatabase } from './db.js';
const email = process.argv[2]?.trim().toLowerCase();
if (!email) { console.error('Đăng ký tài khoản trên web, sau đó chạy: npm run admin -- email@example.com'); process.exit(1); }
let db;
try {
  db = await openDatabase();
  const result = await db.prepare("UPDATE users SET role='admin' WHERE email=?").run(email);
  if (!result.changes) { console.error('Không tìm thấy tài khoản. Hãy đăng ký trước.'); process.exitCode = 1; }
  else console.log('Đã cấp quyền admin trên Supabase. Tải lại trang để mở mục Quản trị.');
} catch (error) { console.error('Không cập nhật được admin:', error.code || error.message); process.exitCode = 1; }
finally { if (db) await db.close(); }
