import {gameStorage} from './game-storage.js';
import {deploymentConfig} from './deployment.js';
import {uploadGuard,mediaQuota} from './upload-guard.js';
import {revokeRelay} from './game-network.js';
import {publicCache} from './public-cache.js';
import {installGameHttp} from './game-network.js';
import express from 'express';
import {installFeatures} from './features.js';
import {installCommunityExtras} from './community-extras.js';
import {installSafetyFeatures} from './safety-features.js';
import {installDiscoveryFeatures} from './discovery-features.js';
import {databaseActor} from './db.js';
import {inspectMedia,mediaStorage} from './media.js';
import multer from 'multer';
import handler from 'serve-handler';
import { randomBytes, randomUUID, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { validateJar, extractJarIcon, extractJarPublisher } from './jar.js';

const scrypt = promisify(scryptCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const digest = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function field(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400, `${label}: cần từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
function emailField(value) {
  const email = field(value, 'Email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Email không hợp lệ.');
  return email;
}
async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 64)).toString('hex')}`;
}
async function checkPassword(password, saved) {
  const [salt, hash] = saved.split(':');
  return timingSafeEqual(Buffer.from(hash, 'hex'), await scrypt(password, salt, 64));
}

export async function createApp({ mediaStore = mediaStorage(), deployment = deploymentConfig(), jarStore = gameStorage(), database, dataDir = deployment.dataDir || resolve(root, 'data'), siteOrigin = process.env.SITE_ORIGIN, production = process.env.NODE_ENV === 'production' } = {}) {
  if (production && (!siteOrigin || !siteOrigin.startsWith('https://'))) throw new Error('Production cần SITE_ORIGIN=https://ten-mien-cua-ban');
  const db = database || await openDatabase();
  const uploads = resolve(dataDir, 'uploads'), temp = resolve(dataDir, 'tmp');
  mkdirSync(uploads, { recursive: true }); mkdirSync(temp, { recursive: true });
  const app = express();
  app.disable('x-powered-by');
  if(process.env.TRUST_PROXY)app.set('trust proxy',process.env.TRUST_PROXY.split(',').map(s=>s.trim()));
  app.use(async (req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    res.set('X-Frame-Options', 'SAMEORIGIN');
    next();
  });
  app.use('/api', async (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const expected = siteOrigin || `${req.protocol}://${req.get('host')}`;
      if (req.get('origin') !== expected || req.get('x-requested-with') !== 'JavaCommunity') return res.status(403).json({ error: 'Yêu cầu không hợp lệ. Hãy tải lại trang.' });
    }
    next();
  });
  app.get('/api/deployment', (req,res) => res.json({uploadLimit:deployment.uploadLimit,relayMaxSeconds:deployment.relayMaxSeconds}));
  app.use('/api', (req,res,next) => {
    if(deployment.uploadLimit && Number(req.get('content-length')) > deployment.uploadLimit) return res.status(413).json({error:'Bản Vercel nhận tối đa 4 MB mỗi lần tải lên. Hãy dùng tệp nhỏ hơn hoặc máy chủ Docker.'});
    next();
  });
  app.use('/api', express.json({ limit: '40kb' }));
  const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: production, path: '/' };
  app.use('/api', async (req, res, next) => {
    const token = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith('java_session='))?.slice(13);
    req.sessionHash = token ? digest(token) : '';
    req.user = token ? await db.prepare(`SELECT u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>?`).get(req.sessionHash, Date.now()) : undefined;
    databaseActor.run(req.user?.id||'',next);
  });
  app.use('/api',publicCache());
  const member = async (req, res, next) => { if (!req.user) return res.status(401).json({ error: 'Bạn cần đăng nhập.' }); next(); };
  const admin = async (req, res, next) => { if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Chỉ quản trị viên được thực hiện thao tác này.' }); next(); };
  const limits = new Map();
  function rate(bucket, max, windowMs) {
    return async (req, res, next) => {
      const now = Date.now(), key = `${bucket}:${req.user?.id || req.ip}`;
      if (limits.size > 5000) for (const [k, value] of limits) if (value.until < now) limits.delete(k);
      let entry = limits.get(key);
      if (!entry || entry.until < now) { entry = { count: 0, until: now + windowMs }; limits.set(key, entry); }
      if (++entry.count > max) { res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))); return res.status(429).json({ error: 'Thao tác quá nhiều lần. Vui lòng thử lại sau.' }); }
      next();
    };
  }
  installGameHttp(app, member, rate('game-http', 30, 60000));
  const authLimit = rate('auth', 20, 15 * 60 * 1000);
  async function session(req, res, user) {
    (await db.prepare('DELETE FROM sessions WHERE expires<? OR token=?').run(Date.now(), req.sessionHash));
    const token = randomBytes(32).toString('hex');
    (await db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token), user.id, Date.now() + 7 * 86400000));
    res.cookie('java_session', token, { ...cookieOptions, maxAge: 7 * 86400000 });
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }
  app.get('/api/me', async (req, res) => res.json({ user: req.user || null }));
  app.post('/api/register', authLimit, async (req, res) => {
    const email = emailField(req.body.email), name = field(req.body.name, 'Tên hiển thị', 2, 40);
    const password = field(req.body.password, 'Mật khẩu', 10, 128);
    const hash = await hashPassword(password);
    const user = { id: randomUUID(), email, name, role: 'member' };
    try { (await db.prepare('INSERT INTO users(id,email,name,password) VALUES (?,?,?,?)').run(user.id, email, name, hash)); }
    catch (e) { if (e.code === '23505') fail(409, 'Email này đã được đăng ký.'); throw e; }
    await session(req, res, user);
  });
  // A real hash for unknown users keeps password verification on both paths.
  const dummyPassword = hashPassword(randomBytes(24).toString('hex'));
  app.post('/api/login', authLimit, async (req, res) => {
    const email = emailField(req.body.email), password = field(req.body.password, 'Mật khẩu', 1, 128);
    const user = (await db.prepare('SELECT * FROM users WHERE email=?').get(email));
    const valid = await checkPassword(password, user?.password || await dummyPassword);
    if (!user || !valid) fail(401, 'Email hoặc mật khẩu không đúng.');
    await session(req, res, user);
  });
  app.post('/api/logout', async (req, res) => {
    (await db.prepare('DELETE FROM sessions WHERE token=?').run(req.sessionHash));
    revokeRelay(db,{token:req.sessionHash});
    res.clearCookie('java_session', cookieOptions); res.json({ ok: true });
  });
  app.post('/api/password', member, authLimit, async (req, res) => {
    const current = field(req.body.current, 'Mật khẩu hiện tại', 1, 128), password = field(req.body.password, 'Mật khẩu mới', 10, 128);
    const user = (await db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id));
    if (!await checkPassword(current, user.password)) fail(400, 'Mật khẩu hiện tại không đúng.');
    const hash = await hashPassword(password);
    await db.transaction(async client => {
      await client.query('UPDATE users SET password=$1 WHERE id=$2', [hash, user.id]);
      await client.query('DELETE FROM sessions WHERE user_id=$1', [user.id]);
    });
    revokeRelay(db,{userId:user.id});
    await session(req, res, user);
  });
  app.get('/api/categories', async (req, res) => res.json((await db.prepare(`SELECT c.*,COUNT(g.id) AS games FROM categories c LEFT JOIN games g ON g.category_id=c.id AND g.visibility='public' AND g.deleted_at IS NULL GROUP BY c.id ORDER BY c.name`).all())));
  app.post('/api/categories', member, admin, async (req, res) => {
    const id = randomUUID(), name = field(req.body.name, 'Tên thể loại', 2, 40);
    if ((await db.prepare('SELECT id FROM categories WHERE name=?').get(name))) fail(409, 'Thể loại đã tồn tại.');
    (await db.prepare('INSERT INTO categories VALUES (?,?)').run(id, name)); res.status(201).json({ id, name });
  });
  app.patch('/api/categories/:id', member, admin, async (req, res) => {
    const name = field(req.body.name, 'Tên thể loại', 2, 40);
    if ((await db.prepare('SELECT id FROM categories WHERE name=? AND id<>?').get(name, req.params.id))) fail(409, 'Thể loại đã tồn tại.');
    if (!(await db.prepare('UPDATE categories SET name=? WHERE id=?').run(name, req.params.id)).changes) fail(404, 'Không tìm thấy thể loại.');
    res.json({ ok: true });
  });
  app.delete('/api/categories/:id', member, admin, async (req, res) => {
    if ((await db.prepare('SELECT id FROM games WHERE category_id=?').get(req.params.id))) fail(409, 'Hãy chuyển game sang thể loại khác trước khi xóa.');
    (await db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id)); res.json({ ok: true });
  });
  const gameSelect = `SELECT g.id,g.owner_id,g.visibility,g.category_id,g.title,g.description,g.filename,g.size,g.sha256,g.family_key,g.family_title,g.touch_supported,COALESCE(g.screen,substring(lower(g.filename) from '[0-9]{2,4}x[0-9]{2,4}')) AS screen,(g.icon_data IS NOT NULL) AS has_icon,g.created_at,c.name AS category FROM games g LEFT JOIN categories c ON c.id=g.category_id`;
  async function gameFor(req, id) {
    const game = (await db.prepare(`${gameSelect} WHERE g.id=? AND g.deleted_at IS NULL AND (g.visibility='public' OR g.owner_id=?) AND (NOT g.hidden OR ?)` ).get(id, req.user?.id || '',req.user?.role==='admin'));
    if (!game) fail(404, 'Không tìm thấy game hoặc bạn không có quyền truy cập.');
    return game;
  }
  installFeatures(app,{db,member,admin,gameFor,fail,field,rate,temp});
  installCommunityExtras(app,{db,member,admin,gameFor,fail,field,rate,mediaStore,temp,uploads});
  installSafetyFeatures(app,{db,member,admin,gameFor,fail,field,rate,mediaStore,uploads,jarStore});
  installDiscoveryFeatures(app,{db,member,admin,gameFor,fail,field,rate});
  app.get('/api/publishers',async(req,res)=>res.json(await db.prepare("SELECT DISTINCT publisher FROM games WHERE visibility='public' AND deleted_at IS NULL AND NOT hidden AND publisher<>'' ORDER BY publisher").all()));
  async function gameFields(body, visibility) {
    const title = field(body.title, 'Tên game', 1, 100), description = field(body.description || '', 'Mô tả', 0, 3000);
    const category = body.category_id || null;
    if ((visibility === 'public' && !category) || (category && !(await db.prepare('SELECT id FROM categories WHERE id=?').get(category)))) fail(400, 'Hãy chọn một thể loại hợp lệ.');
    return { title, description, category };
  }
  app.get('/api/games', async (req, res) => {
    const scope = req.query.scope || 'public';
    if (scope !== 'public' && !req.user) fail(401, 'Bạn cần đăng nhập.');
    const conditions = ['g.deleted_at IS NULL'], args = [];
    if(req.query.include_hidden==='1' && req.user?.role==='admin') {} else conditions.push('NOT g.hidden');
    let join = '', columns = '';
    if (scope === 'mine') { conditions.push("g.owner_id=? AND g.visibility='private'"); args.push(req.user.id); }
    else if (scope === 'history') {
      join = ' JOIN history h ON h.game_id=g.id'; columns = ',h.last_played,h.plays';
      conditions.push("h.user_id=? AND (g.visibility='public' OR g.owner_id=?)"); args.push(req.user.id, req.user.id);
    } else if (scope === 'favorites') {
      conditions.push("EXISTS (SELECT 1 FROM favorites f WHERE f.user_id=? AND f.family_key=COALESCE(g.family_key,g.id)) AND (g.visibility='public' OR g.owner_id=?)");args.push(req.user.id,req.user.id);
    } else if (scope === 'public') conditions.push("g.visibility='public'");
    else fail(400, 'Danh sách không hợp lệ.');
    if (req.query.category) { conditions.push('g.category_id=?'); args.push(String(req.query.category)); }
    if (req.query.q) { conditions.push('(search_fold(g.title) LIKE search_fold(?) OR search_fold(g.description) LIKE search_fold(?) OR search_fold(g.family_title) LIKE search_fold(?))'); const q = `%${String(req.query.q).slice(0,100)}%`; args.push(q, q, q); }
    if(req.query.publisher) {conditions.push('g.publisher=?');args.push(String(req.query.publisher));}
    if (req.query.screen) {
      const screen = String(req.query.screen);
      if (screen === 'unknown') conditions.push("COALESCE(g.screen,substring(lower(g.filename) from '[0-9]{2,4}x[0-9]{2,4}')) IS NULL");
      else { conditions.push("COALESCE(g.screen,substring(lower(g.filename) from '[0-9]{2,4}x[0-9]{2,4}'))=?"); args.push(screen); }
    }
    const page = Math.max(1, Math.min(100000, parseInt(req.query.page) || 1)), limit = 24;
    const from = `FROM games g LEFT JOIN categories c ON c.id=g.category_id ${join} WHERE ${conditions.join(' AND ')}`;
    if ((scope === 'public' && req.query.editions !== '1') || scope === 'history' || scope === 'favorites') {
      const grouped = `WITH editions AS (SELECT g.id,g.owner_id,g.visibility,g.category_id,
        COALESCE(g.family_title,g.title) AS title,g.description,g.size,g.hidden,
        (g.icon_data IS NOT NULL) AS has_icon,g.created_at,c.name AS category ${columns},
        COUNT(*) OVER (PARTITION BY COALESCE(g.family_key,g.id)) AS variant_count,
        ROW_NUMBER() OVER (PARTITION BY COALESCE(g.family_key,g.id) ORDER BY ${scope === 'history' ? 'h.last_played DESC,' : ''}g.id) AS rn ${from})`;
      const rows = await db.prepare(`${grouped}, representatives AS (SELECT * FROM editions WHERE rn=1)
        SELECT page_rows.*, totals.list_total, totals.list_editions
        FROM (SELECT COUNT(*) AS list_total,COALESCE(SUM(variant_count),0)::bigint AS list_editions FROM representatives) totals
        LEFT JOIN LATERAL (SELECT * FROM representatives ORDER BY ${scope === 'history' ? 'last_played' : 'created_at'} DESC,id LIMIT ? OFFSET ?) page_rows ON true
        ORDER BY page_rows.${scope === 'history' ? 'last_played' : 'created_at'} DESC,page_rows.id`).all(...args,limit,(page-1)*limit);
      const total = rows[0].list_total, editions = rows[0].list_editions;
      const items = rows.filter(row=>row.id!==null).map(({list_total,list_editions,...game})=>game);
      return res.json({items,total,editions,page,pages:Math.ceil(total/limit)});
    }
    const [totalRow,items] = await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n ${from}`).get(...args),
      db.prepare(`SELECT g.id,g.owner_id,g.visibility,g.category_id,g.title,g.description,g.size,(g.icon_data IS NOT NULL) AS has_icon,g.created_at,c.name AS category ${columns} ${from} ORDER BY ${scope === 'history' ? 'h.last_played' : 'g.created_at'} DESC,g.id LIMIT ? OFFSET ?`).all(...args, limit, (page - 1) * limit)
    ]);
    const total = totalRow.n;
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  });
  app.get('/api/game-screens', async (req, res) => {
    const expression = "COALESCE(screen,substring(lower(filename) from '[0-9]{2,4}x[0-9]{2,4}'))";
    const items = await db.prepare(`SELECT ${expression} AS screen,COUNT(*) AS editions
      FROM games WHERE visibility='public' AND deleted_at IS NULL AND NOT hidden GROUP BY ${expression}
      ORDER BY screen NULLS LAST`).all();
    res.json(items.map(item => ({ screen: item.screen || 'unknown', editions: item.editions })));
  });
  app.get('/api/games/:id', async (req, res) => {
    const game = await gameFor(req, req.params.id);
    const variants = game.family_key && game.visibility === 'public'
      ? await db.prepare(`${gameSelect} WHERE g.family_key=? AND g.visibility='public' AND g.deleted_at IS NULL AND (NOT g.hidden OR ?) ORDER BY g.filename,g.id`).all(game.family_key,req.user?.role==='admin')
      : [game];
    let lastPlayedId = null;
    if (req.user) {
      const last = await db.prepare(`SELECT h.game_id FROM history h JOIN games g ON g.id=h.game_id
        WHERE h.user_id=? AND g.deleted_at IS NULL AND NOT g.hidden AND (g.visibility='public' OR g.owner_id=?)
        AND (g.id=? OR (g.family_key=? AND g.visibility='public'))
        ORDER BY h.last_played DESC,g.id LIMIT 1`).get(req.user.id,req.user.id,game.id,game.visibility === 'public' ? game.family_key : null);
      lastPlayedId = last?.game_id || null;
    }
    res.json({...game, variants, last_played_id:lastPlayedId});
  });
  app.get('/api/games/:id/icon', async (req, res) => {
    const row = await db.prepare("SELECT icon_data FROM games WHERE id=? AND deleted_at IS NULL AND (visibility='public' OR owner_id=?) AND (NOT hidden OR ?)").get(req.params.id, req.user?.id || '', req.user?.role === 'admin');
    if (!row) fail(404, 'Không tìm thấy game hoặc bạn không có quyền truy cập.');
    const match = /^data:image\/(png|gif);base64,([A-Za-z0-9+/=]+)$/.exec(row?.icon_data || '');
    if (!match) return res.status(404).end();
    res.set('Cache-Control', 'private, max-age=3600');
    res.type('image/' + match[1]).send(Buffer.from(match[2], 'base64'));
  });
  app.get('/api/games/:id/file', async (req, res) => {
    const game = await gameFor(req, req.params.id);
    const stored = await db.prepare('SELECT storage_object FROM games WHERE id=?').get(game.id);
    if (stored?.storage_object) {
      res.set('Cache-Control', 'no-store');
      return res.redirect(302, await jarStore.url(stored.storage_object, game.visibility));
    }
    res.type('application/java-archive'); res.set('Content-Disposition', 'attachment; filename="game.jar"');
    res.sendFile(resolve(uploads, `${game.id}.jar`), { cacheControl: false });
  });
  const upload = multer({ dest: temp, limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 5, fieldSize: 12000 }, fileFilter: (req, file, cb) => cb(/\.jar$/i.test(file.originalname) ? null : Object.assign(new Error('Chỉ nhận game .jar.'), { status: 400 }), /\.jar$/i.test(file.originalname)) });
  app.post('/api/games', member, rate('upload', 30, 3600000),uploadGuard(), upload.single('file'), async (req, res) => {
    let destination, remote, committed = false;
    try {
      const visibility = req.body.visibility || 'private';
      if (!['private', 'public'].includes(visibility)) fail(400, 'Chế độ game không hợp lệ.');
      if (visibility === 'public' && req.user.role !== 'admin') fail(403, 'Chỉ admin được thêm game công khai.');
      if (!req.file) fail(400, 'Hãy chọn tệp .jar.');
      const { title, description, category } = await gameFields(req.body, visibility);
      const bytesUsed = (await db.prepare('SELECT COALESCE(SUM(size),0) AS n FROM games WHERE owner_id=?').get(req.user.id)).n;
      if (req.user.role !== 'admin' && Number(bytesUsed) + req.file.size > 200 * 1024 * 1024) fail(413, 'Kho game cá nhân tối đa 200 MB. Hãy xóa game không dùng.');
      try { await validateJar(req.file.path); } catch (error) { fail(400, error.message); }
      const icon = await extractJarIcon(req.file.path), publisher=await extractJarPublisher(req.file.path);
      const id = randomUUID(), sha = digest(readFileSync(req.file.path));
      const duplicate=await db.prepare("SELECT id,title,deleted_at FROM games WHERE sha256=? AND (visibility='public' OR owner_id=?) ORDER BY created_at LIMIT 1").get(sha,req.user.id);
      if(duplicate)return res.status(409).json({error:duplicate.deleted_at?'Tệp game đã có trong thùng rác. Hãy khôi phục thay vì tải lại.':'Tệp JAR này đã có trong kho. Mở game hiện có để quản lý nhóm phiên bản.',duplicate:{id:duplicate.id,title:duplicate.title,trashed:!!duplicate.deleted_at}});
      if (deployment.remoteJars) remote = {object:await jarStore.put(req.file, visibility, req.user.id, id), visibility};
      else { destination = resolve(uploads, `${id}.jar`); renameSync(req.file.path, destination); }
      await db.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[sha]);
        const existing=await client.query("SELECT id FROM games WHERE sha256=$1 AND (visibility='public' OR owner_id=$2)",[sha,req.user.id]);
        if(existing.rows.length)fail(409,'Tệp JAR này vừa được thêm vào kho. Hãy mở game hiện có.');
        // Serialize uploads by owner so parallel requests cannot exceed quota.
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
        const used = (await client.query('SELECT COALESCE(SUM(size),0) AS n FROM games WHERE owner_id=$1', [req.user.id])).rows[0].n;
        if (req.user.role !== 'admin' && Number(used) + req.file.size > 200 * 1024 * 1024) fail(413, 'Kho game cá nhân tối đa 200 MB.');
        await client.query('INSERT INTO games(id,owner_id,visibility,category_id,title,description,filename,size,sha256,icon_data,publisher,storage_object) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [id, req.user.id, visibility, category, title, description, 'game.jar', req.file.size, sha, icon,publisher,remote?.object || null]);
      });
      committed = true; destination = null; res.status(201).json(await gameFor(req, id));
    } finally {
      if (req.file) rmSync(req.file.path, { force: true });
      if (destination) rmSync(destination, { force: true });
      if (remote && !committed) { try { await jarStore.remove(remote.object, remote.visibility); } catch { console.error("JAR rollback cleanup failed"); } }
    }
  });
  app.patch('/api/games/:id', member, async (req, res) => {
    const game = await gameFor(req, req.params.id);
    if (game.visibility === 'public' ? req.user.role !== 'admin' : game.owner_id !== req.user.id) fail(403, 'Bạn không có quyền sửa game.');
    const { title, description, category } = await gameFields(req.body, game.visibility);
    const screen = req.body.screen === undefined ? game.screen : String(req.body.screen).trim() || null;
    if (screen && !/^[0-9]{2,4}x[0-9]{2,4}$/.test(screen)) fail(400,'Màn hình cần có dạng 240x320.');
    const touch=req.body.touch_supported===undefined?game.touch_supported:req.body.touch_supported===''?null:req.body.touch_supported==='true'?true:req.body.touch_supported==='false'?false:undefined;
    if(touch===undefined)fail(400,'Thông tin cảm ứng không hợp lệ.');
    (await db.prepare('UPDATE games SET title=?,description=?,category_id=?,screen=?,touch_supported=? WHERE id=?').run(title, description, category, screen,touch, game.id));
    res.json(await gameFor(req, game.id));
  });
  app.delete('/api/games/:id', member, async (req, res) => {
    const game = await gameFor(req, req.params.id);
    if (game.visibility === 'public' ? req.user.role !== 'admin' : game.owner_id !== req.user.id) fail(403, 'Bạn không có quyền xóa game.');
    const family = req.query.scope === 'family';
    if (family && (req.user.role !== 'admin' || game.visibility !== 'public')) fail(403,'Chỉ admin được xóa cả nhóm game công khai.');
    const removed = family && game.family_key
      ? (await db.query("UPDATE games SET deleted_at=now() WHERE family_key=$1 AND visibility='public' AND deleted_at IS NULL RETURNING id",[game.family_key])).rows
      : (await db.query('UPDATE games SET deleted_at=now() WHERE id=$1 RETURNING id',[game.id])).rows;
    res.json({ok:true,removed:removed.length});
  });
  app.post('/api/games/:id/play', member, async (req, res) => {
    const game = await gameFor(req, req.params.id);
    (await db.prepare(`INSERT INTO history(user_id,game_id) VALUES (?,?) ON CONFLICT(user_id,game_id) DO UPDATE SET last_played=to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'),plays=history.plays+1`).run(req.user.id, game.id));
    res.json({ ok: true });
  });
  const postSelect = `SELECT p.*,u.name AS author,g.title AS game_title FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN games g ON g.id=p.game_id`;
  const postFor = async id => { const p = (await db.prepare(`${postSelect} WHERE p.id=? AND p.deleted_at IS NULL AND (p.game_id IS NULL OR g.deleted_at IS NULL)`).get(id)); if (!p) fail(404, 'Bài viết không còn tồn tại.'); return p; };
  app.get('/api/posts', async (req, res) => {
    const conditions = ['p.deleted_at IS NULL','(p.game_id IS NULL OR EXISTS(SELECT 1 FROM games visible_game WHERE visible_game.id=p.game_id AND visible_game.deleted_at IS NULL))'], args = [];
    if(req.query.tag){conditions.push('p.tag=?');args.push(String(req.query.tag));}
    if(req.query.mine==='1'){if(!req.user)fail(401,'Đăng nhập để xem bài viết của bạn.');conditions.push('p.user_id=?');args.push(req.user.id);}
    if(req.query.unanswered==='1')conditions.push('NOT EXISTS(SELECT 1 FROM comments c WHERE c.post_id=p.id)');
    if(req.query.author){conditions.push('EXISTS(SELECT 1 FROM users author WHERE author.id=p.user_id AND search_fold(author.name) LIKE search_fold(?))');args.push('%'+String(req.query.author).slice(0,40)+'%');}

    if (req.query.game) { const g = await gameFor(req, String(req.query.game)); if (g.visibility !== 'public') fail(400, 'Game riêng tư không có thảo luận công khai.'); conditions.push('p.game_id=?'); args.push(g.id); }
    if (req.query.q) { conditions.push('(search_fold(p.title) LIKE search_fold(?) OR search_fold(p.body) LIKE search_fold(?))'); const q = `%${String(req.query.q).slice(0,100)}%`; args.push(q,q); }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const total = (await db.prepare(`SELECT COUNT(*) AS n FROM posts p${where}`).get(...args)).n;
    const items = (await db.prepare(`SELECT p.id,p.user_id,p.game_id,p.title,p.created_at,u.name AS author,g.title AS game_title,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS replies FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN games g ON g.id=p.game_id${where} ORDER BY ${req.query.sort==='oldest'?'p.created_at ASC':req.query.sort==='replies'?'replies DESC,p.created_at DESC':'p.created_at DESC'},p.id LIMIT 20 OFFSET ?`).all(...args, (page-1)*20));
    res.json({ items, page, total, pages: Math.ceil(total/20) });
  });
  app.get('/api/posts/:id', async (req, res) => res.json({ ...(await postFor(req.params.id)), comments: (await db.prepare('SELECT c.*,u.name AS author,ru.name AS reply_author,rc.body AS reply_body FROM comments c JOIN users u ON c.user_id=u.id LEFT JOIN comments rc ON rc.id=c.reply_to LEFT JOIN users ru ON ru.id=rc.user_id WHERE c.post_id=? ORDER BY c.created_at,c.id LIMIT 500').all(req.params.id)) }));
  const writeLimit = rate('discussion', 20, 60000);
  const mediaGuard=uploadGuard(),checkMediaQuota=mediaQuota(db);
  const postUpload = multer({dest:temp,limits:{fileSize:20*1024*1024,files:4,fields:4,fieldSize:40000}}).array('media',4);
  app.post('/api/posts', member, writeLimit,mediaGuard,checkMediaQuota, (req,res,next) => postUpload(req,res,error => {
    if (error) return next(Object.assign(new Error('Tối đa 4 tệp, mỗi video tối đa 20 MB, ảnh tối đa 8 MB.'),{status:400}));
    next();
  }), async (req, res) => {
    const stored = [];
    try {
      const title = field(req.body.title, 'Tiêu đề', 3, 150), body = field(req.body.body, 'Nội dung', 3, 10000);
      const gameId = req.body.game_id || null;
      const tag=req.body.tag||'share';if(!['share','question','guide'].includes(tag))fail(400,'Thẻ bài viết không hợp lệ.');
      if (gameId && (await gameFor(req, gameId)).visibility !== 'public') fail(400, 'Chỉ tạo thảo luận cho game công khai.');
      const files = req.files || [];
      if (files.reduce((n,f)=>n+f.size,0)>40*1024*1024) fail(400,'Tổng tệp đính kèm tối đa 40 MB.');
      const types = await Promise.all(files.map(inspectMedia));
      const id = randomUUID();
      for (let i=0;i<files.length;i++) stored.push(await mediaStore.put(files[i],types[i],req.user.id,id));
      await db.prepare('INSERT INTO posts(id,user_id,game_id,title,body,media,tag) VALUES (?,?,?,?,?,?::jsonb,?)').run(id,req.user.id,gameId,title,body,JSON.stringify(stored),tag);
      res.status(201).json({id});
    } catch (error) {
      try { await mediaStore.remove(stored); } catch { console.error('Media cleanup failed after post upload'); }
      throw error;
    } finally { for (const file of req.files || []) rmSync(file.path,{force:true}); }
  });
  app.patch('/api/posts/:id', member, writeLimit,mediaGuard,checkMediaQuota, async (req, res, next) => {
    const post = await postFor(req.params.id);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') fail(403, 'Bạn không có quyền sửa bài viết.');
    next();
  }, (req,res,next) => postUpload(req,res,error => next(error ? Object.assign(new Error('Tối đa 4 tệp, mỗi tệp tối đa 20 MB.'),{status:400}) : undefined)), async (req,res) => {
    const stored=[]; let committed=false;
    try {
      const post=await postFor(req.params.id);
      const title=field(req.body.title,'Tiêu đề',3,150), body=field(req.body.body,'Nội dung',3,10000);
      let removed=[];
      try { removed=JSON.parse(req.body.remove_media || '[]'); } catch { fail(400,'Danh sách ảnh cần xóa không hợp lệ.'); }
      if (!Array.isArray(removed) || removed.some(object=>typeof object!=='string' || !(post.media || []).some(m=>m.object===object))) fail(400,'Ảnh cần xóa không thuộc bài viết.');
      const keep=(post.media || []).filter(m=>!removed.includes(m.object)), files=req.files || [];
      if (keep.length+files.length>4) fail(400,'Mỗi bài viết tối đa 4 ảnh/video. Hãy bỏ bớt tệp cũ trước khi thêm.');
      if ([...keep,...files].reduce((n,f)=>n+Number(f.size || 0),0)>40*1024*1024) fail(400,'Tổng tệp đính kèm tối đa 40 MB.');
      const types=await Promise.all(files.map(inspectMedia));
      for(let i=0;i<files.length;i++) stored.push(await mediaStore.put(files[i],types[i],req.user.id,post.id));
      const result=await db.prepare('UPDATE posts SET title=?,body=?,media=?::jsonb WHERE id=? AND media=?::jsonb').run(title,body,JSON.stringify([...keep,...stored]),post.id,JSON.stringify(post.media || []));
      if (!result.changes) fail(409,'Bài viết đã thay đổi. Hãy mở lại để chỉnh sửa.');
      committed=true;
      try { await mediaStore.remove((post.media || []).filter(m=>removed.includes(m.object))); } catch { console.error('Media cleanup failed after post edit'); }
      res.json(await postFor(post.id));
    } catch(error) {
      if (!committed) { try { await mediaStore.remove(stored); } catch { console.error('Media cleanup failed after edit upload'); } }
      throw error;
    } finally { for(const file of req.files || []) rmSync(file.path,{force:true}); }
  });
  app.delete('/api/posts/:id', member, async (req, res) => {
    const post = await postFor(req.params.id);
    if (post.user_id !== req.user.id && req.user.role !== 'admin') fail(403, 'Bạn không có quyền xóa bài viết.');
    (await db.prepare('UPDATE posts SET deleted_at=now() WHERE id=?').run(post.id)); res.json({ ok: true });
  });
  app.post('/api/posts/:id/comments', member, writeLimit, async (req, res) => {
    await postFor(req.params.id);
    if ((await db.prepare('SELECT COUNT(*) AS n FROM comments WHERE post_id=?').get(req.params.id)).n >= 500) fail(409, 'Chủ đề đã đủ 500 bình luận. Hãy tạo chủ đề tiếp theo.');
    const body = field(req.body.body, 'Bình luận', 1, 3000), id = randomUUID();
    const replyTo=req.body.reply_to||null;
    if(replyTo&&!await db.prepare('SELECT id FROM comments WHERE id=? AND post_id=?').get(replyTo,req.params.id))fail(400,'Bình luận được trả lời không còn trong bài viết này.');
    let mentions=req.body.mentions||[];
    if(typeof mentions==='string'){try{mentions=JSON.parse(mentions);}catch{fail(400,'Danh sách nhắc tên không hợp lệ.');}}
    if(!Array.isArray(mentions)||mentions.length>10||mentions.some(id=>typeof id!=='string'))fail(400,'Tối đa 10 thành viên được nhắc tên.');
    const participants=await db.prepare('SELECT u.id,u.name FROM users u WHERE u.id IN (SELECT user_id FROM posts WHERE id=? UNION SELECT user_id FROM comments WHERE post_id=?)').all(req.params.id,req.params.id);
    const mentioned=participants.filter(u=>mentions.includes(u.id)&&body.includes('@'+u.name)).map(u=>u.id);
    await db.transaction(async client=>{
      await client.query('INSERT INTO comments(id,post_id,user_id,body,reply_to) VALUES ($1,$2,$3,$4,$5)',[id,req.params.id,req.user.id,body,replyTo]);
      const recipients=(await client.query(replyTo?'SELECT user_id FROM posts WHERE id=$1 UNION SELECT user_id FROM comments WHERE post_id=$1 AND id=$2':'SELECT user_id FROM posts WHERE id=$1 UNION SELECT user_id FROM comments WHERE post_id=$1',replyTo?[req.params.id,replyTo]:[req.params.id])).rows;
      const preferences=(await client.query('SELECT user_id,enabled FROM topic_follows WHERE post_id=$1',[req.params.id])).rows;
      const selected=new Set([...recipients.map(r=>r.user_id),...mentioned]);
      for(const p of preferences){if(p.enabled)selected.add(p.user_id);else selected.delete(p.user_id);}
      for(const userId of selected) if(userId!==req.user.id) await client.query('INSERT INTO notifications(id,user_id,actor_id,post_id,comment_id) VALUES ($1,$2,$3,$4,$5)',[randomUUID(),userId,req.user.id,req.params.id,id]);
    });res.status(201).json({ id });
  });
  app.delete('/api/comments/:id', member, async (req, res) => {
    const comment = (await db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id));
    if (!comment) fail(404, 'Bình luận không tồn tại.');
    if (comment.user_id !== req.user.id && req.user.role !== 'admin') fail(403, 'Bạn không có quyền xóa bình luận.');
    (await db.prepare('DELETE FROM comments WHERE id=?').run(comment.id)); res.json({ ok: true });
  });
  app.use('/api', async (req, res) => res.status(404).json({ error: 'Không tìm thấy chức năng.' }));
  const staticConfig = JSON.parse(readFileSync(resolve(root, 'web/serve.json')));
  // Canonical page URLs retain query parameters used by the emulator.
  const pageRedirects = { '/':'/games', '/index.html':'/games', '/emulator':'/library', '/emulator/':'/library', '/emulator/index.html':'/library', '/emulator/run.html':'/play' };
  app.use((req, res, next) => {
    const target = pageRedirects[req.path];
    if (target && ['GET','HEAD'].includes(req.method)) return res.redirect(302, target + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''));
    next();
  });
  app.get(['/library','/play'], (req,res) => {
    res.set('Cache-Control','no-cache');
    res.sendFile(resolve(root, 'web/emulator', req.path === '/library' ? 'index.html' : 'run.html'));
  });
  app.get(/^\/(?:games|forum|history|mine|admin|login|register|account|game\/[^/]+|post\/[^/]+)\/?$/, (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(resolve(root, 'web/index.html'));
  });
  app.use(async (req, res) => handler(req, res, { ...staticConfig, public: resolve(root, 'web'), directoryListing: false }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error instanceof multer.MulterError ? 400 : (error.status || 500);
    if (status === 500) console.error('API database/server error:', error.code || error.name);
    res.status(status).json({ error: error instanceof multer.MulterError ? 'Tệp tối đa 20 MB; chỉ chọn một game .jar.' : status === 500 ? 'Máy chủ gặp lỗi. Vui lòng thử lại.' : error.message });
  });
  return { app, db };
}
