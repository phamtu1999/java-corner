import pg from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
export const databaseActor=new AsyncLocalStorage();
import { readFileSync } from 'node:fs';

// Supabase's published root CA, fetched over HTTPS from:
// https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
export function databaseConfig(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL chưa được điền trong .env.');
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL phải là URI PostgreSQL.');
  // Never let URI options disable verification or override the trusted CA.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: { ca: readFileSync(new URL('./certs/supabase-ca.crt', import.meta.url), 'utf8'), rejectUnauthorized: true },
    max: 5, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000,
    statement_timeout: 15000,
    types: { getTypeParser: (oid, format) => oid === 20 ? Number : pg.types.getTypeParser(oid, format) },
  };
}

export async function openDatabase({ connectionString, schema = 'public' } = {}) {
  if (!/^[a-z][a-z0-9_]*$/.test(schema)) throw new Error('Invalid database schema');
  const pool = new pg.Pool(databaseConfig(connectionString));
  pool.on('error', error => console.error('PostgreSQL pool:', error.code || 'connection error'));
  const query = async (text, values = []) => {
    const client = await pool.connect();
    try {
      // Explicit scope on every checkout also works with session poolers.
      await client.query(`SET search_path TO "${schema}"`);
      await client.query("SELECT set_config('app.actor_id',$1,false)",[databaseActor.getStore()||'']);
      return await client.query(text, values);
    } finally { client.release(); }
  };
  try { await query('SELECT 1'); } catch (error) { await pool.end(); throw error; }
  return {
    query,
    // Internal statements use ? placeholders; values always stay parameterized.
    prepare(sql) {
      let i = 0;
      const text = sql.replace(/\?/g, () => `$${++i}`);
      return {
        async get(...values) { return (await query(text, values)).rows[0]; },
        async all(...values) { return (await query(text, values)).rows; },
        async run(...values) { const result = await query(text, values); return { changes: result.rowCount }; },
      };
    },
    async transaction(callback) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO "${schema}"`);
        await client.query("SELECT set_config('app.actor_id',$1,true)",[databaseActor.getStore()||'']);
        const result = await callback(client);
        await client.query('COMMIT'); return result;
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    },
    close: () => pool.end(),
  };
}

export async function migrateDatabase(db) {
  const sql = readFileSync(new URL('./migrations/001-community.sql', import.meta.url), 'utf8');
  await db.transaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(74810321)');
    await client.query(sql);
    // Supabase default grants must not expose password hashes or private games
    // through PostgREST. All access goes through authenticated Express routes.
    const roles = (await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows;
    for (const { rolname } of roles) {
      await client.query(`REVOKE ALL ON users,sessions,categories,games,history,posts,comments,favorites,reviews,game_reports,notifications,cloud_saves,collections,collection_games,game_checks,admin_audit,game_guides,content_reports,cloud_save_versions,topic_follows,game_requests,game_updates FROM "${rolname}"`);
    }
  });
}
