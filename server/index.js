import {attachGameNetwork} from './game-network.js';
import { createApp } from './app.js';
let db;
try {
  const instance = await createApp();
  db = instance.db;
  // Fail early instead of serving an app against an unmigrated database.
  await db.query('SELECT id FROM users LIMIT 0');
  const port = Number(process.env.PORT || 3000);
  const server = instance.app.listen(port, () => console.log(`Java Community: http://localhost:${port} · Supabase PostgreSQL`));
  const closeNetwork = attachGameNetwork(server, db);
  server.on('error', async error => {
    console.error(error.code === 'EADDRINUSE' ? `Cổng ${port} đang được sử dụng.` : `Server error: ${error.code || error.name}`);
    await db.close(); process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { closeNetwork(); server.close(async () => { await db.close(); process.exit(0); }); });
} catch (error) {
  console.error('Không khởi động được Supabase Database:', error.code || error.message);
  if (db) await db.close();
  process.exitCode = 1;
}
