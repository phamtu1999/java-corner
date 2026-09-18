import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase, migrateDatabase, databaseActor } from '../server/db.js';
import { createApp } from '../server/app.js';

const jar = Buffer.from('UEsDBBQAAAAIAIyUMF0C6Ce+OgAAAGUAAAAUAAAATUVUQS1JTkYvTUFOSUZFU1QuTUbzTczLTEstLtENSy0qzszPs1Iw1DPg8vV0yUkt0fVLzE21UggBSsNEDCFcHR1kQWxaw1LzUvKLoJoBUEsDBBQAAAAIAIyUMF0dVx21BgAAAAQAAAAKAAAAVGVzdC5jbGFzczv1b9c+AFBLAQIUAxQAAAAIAIyUMF0C6Ce+OgAAAGUAAAAUAAAAAAAAAAAAAACAAQAAAABNRVRBLUlORi9NQU5JRkVTVC5NRlBLAQIUAxQAAAAIAIyUMF0dVx21BgAAAAQAAAAKAAAAAAAAAAAAAACAAWwAAABUZXN0LmNsYXNzUEsFBgAAAAACAAIAegAAAJoAAAAAAA==', 'base64');
async function setup(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), 'java-community-'));
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const database = await openDatabase({ schema });
  await database.query(`CREATE SCHEMA "${schema}"`);
  t.after(async () => {
    try { await database.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await database.close(); await rm(dataDir, { recursive:true, force:true }); }
  });
  await migrateDatabase(database);
  const instance = await createApp({ ...options, dataDir, database, siteOrigin: null, production: false });
  const server = instance.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { await new Promise(resolve => server.close(resolve));  });
  function client() {
    let cookie = '';
    return async (path, { method='GET', body, headers={} } = {}) => {
      const requestHeaders = { Cookie: cookie, Origin: base, 'X-Requested-With':'JavaCommunity', ...headers };
      if (body && !(body instanceof FormData)) { requestHeaders['Content-Type']='application/json'; body=JSON.stringify(body); }
      const response = await fetch(base+'/api'+path,{method,body,headers:requestHeaders});
      if (response.headers.get('set-cookie')) cookie=response.headers.get('set-cookie').split(';')[0];
      const data = response.headers.get('content-type')?.includes('json') ? await response.json() : await response.arrayBuffer();
      return { status:response.status, data, headers:response.headers };
    };
  }
  return { ...instance, server, base, client, dataDir, schema };
}
async function register(client, name) {
  const response = await client('/register',{method:'POST',body:{name,email:`${name}@example.com`,password:'TestPassword123!'}});
  assert.equal(response.status,200,JSON.stringify(response.data)); return response.data.user;
}
function uniqueJar() { const copy=Buffer.from(jar),comment=Buffer.from(randomUUID());copy.writeUInt16LE(comment.length,copy.length-2);return Buffer.concat([copy,comment]); }
function upload(visibility='private', category='', bytes=uniqueJar()) {
  const form = new FormData(); form.set('title','Test game'); form.set('description','A Java ME game'); form.set('visibility',visibility); form.set('category_id',category); form.set('file',new Blob([bytes]),'test.jar'); return form;
}
test('guides, forum reports, accepted answers, recycle bin and duplicate archives',async t=>{
 const removed=[];
 const {client,db}=await setup(t,{mediaStore:{remove:async media=>removed.push(...media)}});
 const a=client(),b=client(),guest=client();const admin=await register(a,'safety_admin');await register(b,'safety_member');
 await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
 const category=(await a('/categories',{method:'POST',body:{name:'Safety games'}})).data.id;
 const g=(await a('/games',{method:'POST',body:upload('public',category,jar)})).data;
 const dup=await a('/games',{method:'POST',body:upload('public',category,jar)});assert.equal(dup.status,409);assert.equal(dup.data.duplicate.id,g.id);
 assert.equal((await b(`/games/${g.id}/guide`,{method:'PUT',body:{body:'Guide'}})).status,403);
 assert.equal((await a(`/games/${g.id}/guide`,{method:'PUT',body:{body:'Use arrows to move'}})).status,200);
 assert.equal((await guest(`/games/${g.id}/guide`)).data.body,'Use arrows to move');
 const p=(await a('/posts',{method:'POST',body:{game_id:g.id,title:'Help please',body:'How to play?',tag:'question'}})).data;
 const c=(await b(`/posts/${p.id}/comments`,{method:'POST',body:{body:'Use arrow keys'}})).data;
 assert.equal((await b(`/posts/${p.id}/topic`,{method:'PATCH',body:{accepted_comment_id:c.id}})).status,403);
 assert.equal((await a(`/posts/${p.id}/topic`,{method:'PATCH',body:{accepted_comment_id:'missing'}})).status,400);
 assert.equal((await a(`/posts/${p.id}/topic`,{method:'PATCH',body:{accepted_comment_id:c.id}})).status,200);
 assert.equal((await guest(`/posts/${p.id}`)).data.accepted_comment_id,c.id);
 assert.equal((await guest('/posts?tag=question')).data.total,1);
 assert.equal((await guest('/posts?tag=guide')).data.total,0);
 assert.equal((await b(`/posts/${p.id}/report`,{method:'POST',body:{comment_id:c.id,reason:'Please review this comment'}})).status,201);
 assert.equal((await b('/admin/content-reports')).status,403);
 const reports=(await a('/admin/content-reports')).data;
 assert.equal(reports.length,1);
 assert.equal((await a(`/admin/content-reports/${reports[0].id}`,{method:'PATCH',body:{resolved:true}})).status,200);
 await db.prepare('UPDATE posts SET media=?::jsonb WHERE id=?').run(JSON.stringify([{object:'test.png'}]),p.id);
 assert.equal((await a(`/posts/${p.id}`,{method:'DELETE'})).status,200);assert.equal(removed.length,0);
 assert.equal((await guest(`/posts/${p.id}`)).status,404);assert.equal((await guest('/posts')).data.total,0);
 assert.equal((await b(`/admin/trash/post/${p.id}/restore`,{method:'POST'})).status,403);
 assert.equal((await a(`/admin/trash/post/${p.id}/restore`,{method:'POST'})).status,200);
 assert.equal((await guest(`/posts/${p.id}`)).data.comments.length,1);
 await a(`/games/${g.id}`,{method:'DELETE'});
 assert.equal((await guest(`/games/${g.id}`)).status,404);assert.equal((await guest(`/posts/${p.id}`)).status,404);
 assert.equal((await a('/games',{method:'POST',body:upload('public',category,jar)})).data.duplicate.trashed,true);
 assert.equal((await a(`/admin/trash/game/${g.id}/restore`,{method:'POST'})).status,200);
 assert.equal((await guest(`/games/${g.id}/guide`)).data.body,'Use arrows to move');
 await a(`/posts/${p.id}`,{method:'DELETE'});
 assert.equal((await a(`/admin/trash/post/${p.id}`,{method:'DELETE',body:{confirm:'wrong'}})).status,400);
 assert.equal((await a(`/admin/trash/post/${p.id}`,{method:'DELETE',body:{confirm:p.id}})).status,200);
 assert.equal(removed.length,1);assert.equal((await a(`/admin/trash/post/${p.id}/restore`,{method:'POST'})).status,404);
});
test('cloud saves retain five checkpoints and isolate owners',async t=>{
 const {client}=await setup(t);const a=client(),b=client();await register(a,'checkpoint_a');await register(b,'checkpoint_b');
 const revisions=[];let revision='';
 for(let i=0;i<6;i++) {const f=new FormData();f.set('revision',revision);f.set('file',new Blob([jar]),'save.zip');const result=await a('/cloud-save',{method:'POST',body:f});assert.equal(result.status,200);revision=result.data.revision;revisions.push(revision);}
 const versions=(await a('/cloud-save/versions')).data;assert.equal(versions.length,5);assert.equal(versions[0].revision,revision);
 assert.equal((await a('/cloud-save/versions/'+revisions[0])).status,404);
 assert.deepEqual(Buffer.from((await a('/cloud-save/versions/'+revisions[1])).data),jar);
 assert.equal((await b('/cloud-save/versions/'+revisions[1])).status,404);
 assert.deepEqual((await b('/cloud-save/versions')).data,[]);
});
test('favorites, reviews, reports, notifications, bulk management and private cloud saves',async t=>{
  const {client,db}=await setup(t);const a=client(),b=client(),guest=client();
  const adminUser=await register(a,'feature_admin'),user=await register(b,'feature_user');
  await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(adminUser.id);
  const category=(await a('/categories',{method:'POST',body:{name:'Nhập vai'}})).data.id;
  const g=(await a('/games',{method:'POST',body:upload('public',category)})).data;
  const g2=(await a('/games',{method:'POST',body:upload('public',category)})).data;
  await db.prepare('UPDATE games SET family_key=?,family_title=?,title=? WHERE id=? OR id=?').run('family','Sơn Tinh Thủy Tinh','Sơn Tinh Thủy Tinh',g.id,g2.id);
  assert.equal((await guest('/games?q=son+tinh')).data.total,1,'accent insensitive search');
  assert.equal((await guest(`/games/${g.id}/favorite`,{method:'POST',body:{enabled:true}})).status,401);
  await b(`/games/${g.id}/favorite`,{method:'POST',body:{enabled:true}});
  assert.equal((await b(`/games/${g2.id}/social`)).data.favorite,true);
  assert.equal((await b('/games?scope=favorites')).data.total,1);
  assert.equal((await a('/games?scope=favorites')).data.total,0);
  assert.equal((await b(`/games/${g.id}/review`,{method:'POST',body:{rating:5,body:'Hay'}})).status,400);
  await b(`/games/${g.id}/play`,{method:'POST'});
  assert.equal((await b(`/games/${g.id}/review`,{method:'POST',body:{rating:6}})).status,400);
  assert.equal((await b(`/games/${g.id}/review`,{method:'POST',body:{rating:5,body:'Hay'}})).status,200);
  await b(`/games/${g2.id}/play`,{method:'POST'});
  await b(`/games/${g2.id}/review`,{method:'POST',body:{rating:4,body:'Bản khác'}});
  const social=(await guest(`/games/${g.id}/social`)).data;assert.equal(social.count,1);assert.equal(social.average,4);assert.equal(social.reviews[0].game_id,g2.id);
  await b(`/games/${g2.id}/report`,{method:'POST',body:{body:'Màn hình đen sau khi mở'}});
  assert.equal((await b('/reports')).status,403);
  const report=(await a('/reports')).data[0];assert.equal(report.game_id,g2.id);
  assert.equal((await a(`/reports/${report.id}`,{method:'PATCH',body:{resolved:true}})).status,200);
  const post=(await a('/posts',{method:'POST',body:{title:'Thảo luận',body:'Cùng chơi game nhé'}})).data;
  await b(`/posts/${post.id}/comments`,{method:'POST',body:{body:'Xin chào'}});
  const notices=(await a('/notifications')).data;assert.equal(notices.length,1);assert.equal((await b('/notifications')).data.length,0);
  await b('/notifications/read',{method:'POST',body:{ids:[notices[0].id]}});
  assert.equal((await a('/notifications')).data[0].is_read,false);
  await a('/notifications/read',{method:'POST',body:{ids:[notices[0].id]}});
  assert.equal((await a('/notifications')).data[0].is_read,true);
  assert.equal((await b('/admin/bulk',{method:'POST',body:{ids:[g.id],action:'hide'}})).status,403);
  assert.equal((await a('/admin/bulk',{method:'POST',body:{ids:[g.id],action:'hide'}})).data.changed,2);
  assert.equal((await guest('/games')).data.total,0);
  assert.equal((await guest(`/games/${g.id}`)).status,404);
  assert.equal((await a('/games?include_hidden=1')).data.total,1);
  await a('/admin/bulk',{method:'POST',body:{ids:[g.id],action:'show'}});
  await a('/admin/bulk',{method:'POST',body:{ids:[g.id],action:'publisher',publisher:'Test Studio'}});
  assert.equal((await guest('/games?publisher=Test%20Studio')).data.total,1);
  const privateGame=(await b('/games',{method:'POST',body:upload()})).data;
  assert.equal((await a('/admin/bulk',{method:'POST',body:{ids:[g.id,privateGame.id],action:'hide'}})).status,400);
  assert.equal((await guest('/games')).data.total,1,'bulk is atomic');
  const cloud=(revision='',bytes=jar)=>{const f=new FormData();f.set('file',new Blob([bytes]),'save.zip');f.set('revision',revision);return f;};
  assert.equal((await guest('/cloud-save')).status,401);
  assert.equal((await b('/cloud-save',{method:'POST',body:cloud('',Buffer.from('bad'))})).status,400);
  const saved=await b('/cloud-save',{method:'POST',body:cloud()});assert.equal(saved.status,200);
  assert.equal((await a('/cloud-save')).data,null);assert.equal((await a('/cloud-save/file')).status,404);
  assert.equal((await b('/cloud-save',{method:'POST',body:cloud()})).status,409);
  const file=await b('/cloud-save/file');assert.deepEqual(Buffer.from(file.data),jar);assert.equal(file.headers.get('x-save-revision'),saved.data.revision);
  assert.equal((await b('/cloud-save',{method:'POST',body:cloud(saved.data.revision)})).status,200);
  assert.equal((await b('/cloud-save',{method:'POST',body:cloud(saved.data.revision)})).status,409);
  const g3=(await a('/games',{method:'POST',body:upload('public',category)})).data;
  await b(`/games/${g3.id}/favorite`,{method:'POST',body:{enabled:true}});
  assert.equal((await a('/admin/bulk',{method:'POST',body:{ids:[g.id,g3.id],action:'group',family_title:'Nhóm mới'}})).status,200);
  assert.equal((await b('/games?scope=favorites')).data.total,1);
  assert.equal((await guest(`/games/${g3.id}/social`)).data.count,1);
});
test('collections, profile privacy, replies, recommendations, health and audit',async t=>{
 const {client,db}=await setup(t,{mediaStore:{put:async(file,type)=>({object:'avatar.png',url:'https://example.com/avatar.png',type:type.mime,size:file.size}),remove:async()=>{}}});const a=client(),b=client(),guest=client();const admin=await register(a,'extra_admin'),member=await register(b,'extra_member');
 await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
 const cat=(await a('/categories',{method:'POST',body:{name:'Action'}})).data.id;
 const g=(await a('/games',{method:'POST',body:upload('public',cat)})).data;
 const g2=(await a('/games',{method:'POST',body:upload('public',cat)})).data;
 await db.prepare('UPDATE games SET family_key=? WHERE id=? OR id=?').run('extra-family',g.id,g2.id);
 await db.prepare('UPDATE games SET screen=? WHERE id=?').run('240x320',g.id);await db.prepare('UPDATE games SET screen=? WHERE id=?').run('128x160',g2.id);
 assert.equal((await guest(`/games/${g.id}/recommendation?width=240&height=320`)).data.id,g.id);
 await a(`/games/${g2.id}`,{method:'PATCH',body:{title:'Touch version',category_id:cat,touch_supported:'true'}});
 assert.equal((await guest(`/games/${g.id}/recommendation?width=240&height=320&touch=1`)).data.id,g2.id);
 await b(`/games/${g2.id}/works`,{method:'POST'});
 assert.equal((await b(`/games/${g.id}/recommendation?width=240&height=320`)).data.id,g2.id);
 const c=(await b('/collections',{method:'POST',body:{title:'Tuổi thơ',public:false}})).data;
 await b(`/collections/${c.id}/games`,{method:'POST',body:{game_id:g.id}});
 assert.equal((await guest(`/collections/${c.id}`)).status,404);assert.equal((await a(`/collections/${c.id}`,{method:'PATCH',body:{title:'Hijack'}})).status,404);
 await b(`/collections/${c.id}`,{method:'PATCH',body:{title:'Tuổi thơ',public:true}});
 assert.equal((await guest(`/collections/${c.id}`)).data.games[0].id,g.id);
 assert.equal((await guest(`/profiles/${member.id}`)).data.private,true);
 const profile=new FormData();profile.set('name','Player');profile.set('bio','Yêu game Java');profile.set('profile_public','true');profile.set('avatar',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDTsAAAAASUVORK5CYII=','base64')]),'avatar.png');
 assert.equal((await b('/profile',{method:'PATCH',body:profile})).status,200);
 const publicProfile=(await guest(`/profiles/${member.id}`)).data;assert.equal(publicProfile.bio,'Yêu game Java');assert.equal(publicProfile.collections.length,1);assert.equal(publicProfile.email,undefined);
 assert.equal(publicProfile.avatar.type,'image/png');
 const post=(await a('/posts',{method:'POST',body:{title:'Chủ đề mới',body:'Chơi thử game'}})).data;
 const comment=(await b(`/posts/${post.id}/comments`,{method:'POST',body:{body:'Game hay'}})).data;
 const otherPost=(await a('/posts',{method:'POST',body:{title:'Chủ đề khác',body:'Nội dung khác'}})).data;
 assert.equal((await a(`/posts/${otherPost.id}/comments`,{method:'POST',body:{body:'Reply',reply_to:comment.id}})).status,400);
 assert.equal((await a(`/posts/${post.id}/comments`,{method:'POST',body:{body:'Cảm ơn',reply_to:comment.id}})).status,201);
 const reply=(await guest(`/posts/${post.id}`)).data.comments.find(x=>x.reply_to);assert.equal(reply.reply_author,'Player');assert.equal(reply.reply_body,'Game hay');
 assert.equal((await b('/notifications')).data.length,1);
 assert.equal((await b('/admin/audit')).status,403);assert.equal((await b('/admin/health')).status,403);
 await a(`/games/${g.id}`,{method:'PATCH',body:{title:'Updated',category_id:cat,description:''}});
 const audit=(await a('/admin/audit')).data.find(x=>x.action==='UPDATE'&&x.actor_id===admin.id);assert(audit);assert.equal(audit.after_data.title,'Updated');assert.equal(audit.before_data.title,'Test game');
 const health=(await a('/admin/health')).data;assert.equal(health.items.length,2);assert.equal(health.items[0].file,'Có tệp');
});
test('accounts, sessions, password changes and origin protection',async t => {
  const {client,db}=await setup(t); const a=client(), stranger=client();
  assert.equal((await a('/me')).data.user,null);
  const user=await register(a,'alice');
  assert.equal(user.role,'member');
  assert.notEqual((await db.prepare('SELECT password FROM users WHERE id=?').get(user.id)).password,'TestPassword123!');
  assert.equal((await a('/me')).data.user.id,user.id);
  assert.equal((await stranger('/register',{method:'POST',body:{name:'Other',email:'alice@example.com',password:'TestPassword123!'}})).status,409);
  assert.equal((await a('/categories',{method:'POST',body:{name:'Action'}})).status,403);
  assert.equal((await a('/logout',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await a('/logout',{method:'POST',headers:{'X-Requested-With':''}})).status,403);
  assert.equal((await stranger('/login',{method:'POST',body:{email:'alice@example.com',password:'wrong'}})).status,401);
  const login=await stranger('/login',{method:'POST',body:{email:'alice@example.com',password:'TestPassword123!'}});
  assert.equal(login.status,200); assert.match(login.headers.get('set-cookie'),/HttpOnly/); assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  assert.equal((await a('/password',{method:'POST',body:{current:'TestPassword123!',password:'ChangedPassword123!'}})).status,200);
  assert.equal((await stranger('/me')).data.user,null,'password change revokes other sessions');
  await a('/logout',{method:'POST'}); assert.equal((await a('/me')).data.user,null);
});
test('public catalog, private uploads, history, permissions and archive validation',async t => {
  const {client,db,dataDir,base}=await setup(t); const admin=client(), owner=client(), other=client(), guest=client();
  const manager=await register(admin,'admin'); (await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(manager.id));
  await register(owner,'owner'); await register(other,'other');
  const category=await admin('/categories',{method:'POST',body:{name:'Nhập vai'}}); assert.equal(category.status,201);
  assert.equal((await owner('/games',{method:'POST',body:upload('public',category.data.id)})).status,403);
  const published=await admin('/games',{method:'POST',body:upload('public',category.data.id)}); assert.equal(published.status,201,JSON.stringify(published.data));
  const own=await owner('/games',{method:'POST',body:upload()}); assert.equal(own.status,201);
  for (const stranger of [other,guest,admin]) {
    assert.equal((await stranger(`/games/${own.data.id}`)).status,404);
    assert.equal((await stranger(`/games/${own.data.id}/file`)).status,404);
    assert.equal((await stranger(`/games/${own.data.id}/play`,{method:'POST'})).status,stranger===guest?401:404);
  }
  assert.equal((await guest('/games')).data.total,1);
  assert.equal((await owner('/games?scope=mine')).data.total,1);
  assert.equal((await other('/games?scope=mine')).data.total,0);
  assert.equal((await guest('/games?scope=history')).status,401);
  const binary=await owner(`/games/${own.data.id}/file`,{headers:{Range:'bytes=0-3'}});
  assert.equal(binary.status,206); assert.deepEqual([...new Uint8Array(binary.data)],[80,75,3,4]);
  await owner(`/games/${own.data.id}/play`,{method:'POST'}); await owner(`/games/${published.data.id}/play`,{method:'POST'});
  assert.equal((await owner('/games?scope=history')).data.total,2);
  assert.equal((await other('/games?scope=history')).data.total,0);
  assert.equal((await owner('/games',{method:'POST',body:upload('private','',Buffer.from('not a jar'))})).status,400);
  assert.deepEqual(await readdir(join(dataDir,'tmp')),[]);
  assert.equal((await admin(`/categories/${category.data.id}`,{method:'DELETE'})).status,409);
  assert.equal((await owner(`/games/${published.data.id}`,{method:'PATCH',body:{title:'Hijack',category_id:category.data.id}})).status,403);
  assert.equal((await admin(`/games/${published.data.id}`,{method:'PATCH',body:{title:'New title',description:'Updated',category_id:category.data.id}})).status,200);
  assert.equal((await guest('/games?q=New')).data.total,1);
  assert.equal((await other(`/games/${own.data.id}`,{method:'DELETE'})).status,404);
  await owner(`/games/${own.data.id}`,{method:'DELETE'});
  assert.equal((await owner('/games?scope=history')).data.total,1);
  assert.equal((await readdir(join(dataDir,'uploads'))).length,2);
  assert.equal((await fetch(base+'/data/community.sqlite')).status,404);
});
test('game discussions and comment moderation enforce authorship',async t => {
  const {client,db}=await setup(t); const a=client(), b=client(), admin=client();
  await register(a,'writer'); await register(b,'reader'); const manager=await register(admin,'moderator'); (await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(manager.id));
  const c=await admin('/categories',{method:'POST',body:{name:'Action'}});
  const game=await admin('/games',{method:'POST',body:upload('public',c.data.id)});
  const privateGame=await a('/games',{method:'POST',body:upload()});
  assert.equal((await a('/posts',{method:'POST',body:{title:'Private topic',body:'Should not publish',game_id:privateGame.data.id}})).status,400);
  const post=await a('/posts',{method:'POST',body:{title:'How to play?',body:'<script>alert(1)</script>',game_id:game.data.id}}); assert.equal(post.status,201);
  assert.equal((await b(`/posts/${post.data.id}`,{method:'PATCH',body:{title:'Other edit',body:'Not allowed'}})).status,403);
  assert.equal((await a(`/posts/${post.data.id}`,{method:'PATCH',body:{title:'Updated title',body:'Updated content'}})).status,200);
  assert.equal((await b(`/posts/${post.data.id}`)).data.body,'Updated content');
  assert.equal((await admin(`/posts/${post.data.id}`,{method:'PATCH',body:{title:'Moderated title',body:'Moderated content'}})).status,200);
  assert.equal((await b(`/posts?game=${game.data.id}`)).data.total,1);
  const comment=await b(`/posts/${post.data.id}/comments`,{method:'POST',body:{body:'Try button 5'}}); assert.equal(comment.status,201);
  assert.equal((await a(`/posts/${post.data.id}`)).data.comments.length,1);
  assert.equal((await b(`/posts/${post.data.id}`,{method:'DELETE'})).status,403);
  assert.equal((await a(`/comments/${comment.data.id}`,{method:'DELETE'})).status,403);
  assert.equal((await admin(`/comments/${comment.data.id}`,{method:'DELETE'})).status,200);
  assert.equal((await admin(`/posts/${post.data.id}`,{method:'DELETE'})).status,200);
  assert.equal((await a(`/posts/${post.data.id}`)).status,404);
});

test('database and sessions survive reopening; runtime remains range-enabled', async t => {
  const { client, db, dataDir, base, schema } = await setup(t);
  const user = await register(client(), 'persistent');
  const second = await createApp({ dataDir, database: await openDatabase({ schema }), siteOrigin: null, production: false });
  try {
    assert.equal((await second.db.prepare('SELECT name FROM users WHERE id=?').get(user.id)).name, 'persistent');
    assert.equal((await second.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id=?').get(user.id)).n, 1);
  } finally { await second.db.close(); }
  const runtime = await fetch(base+'/emulator/freej2me-web.jar',{headers:{Range:'bytes=0-3'}});
  assert.equal(runtime.status,206);
  assert.deepEqual([...new Uint8Array(await runtime.arrayBuffer())],[80,75,3,4]);
  const run = await fetch(base+'/emulator/run.html?app=test&mobile=1',{redirect:'manual'});
  assert.equal(run.status,302);
  assert.equal(run.headers.get('location'),'/play?app=test&mobile=1');
  assert.equal((await fetch(base+run.headers.get('location'))).status,200);
  const wasm = await fetch(base+'/emulator/libmidi/libmidi.wasm',{headers:{Range:'bytes=0-3'}});
  assert.equal(wasm.headers.get('content-type'),'application/wasm');
});

test('PostgreSQL tables deny browser roles and rollback partial writes', async t => {
  const { db, schema } = await setup(t);
  const tables = await db.query('SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname=$1 AND relkind=$2', [schema,'r']);
  const expected=['users','sessions','categories','games','history','posts','comments','favorites','reviews','game_reports','notifications','cloud_saves','collections','collection_games','game_checks','admin_audit','game_guides','content_reports','cloud_save_versions','topic_follows','game_requests','game_updates'];
  assert.deepEqual(tables.rows.map(row=>row.relname).sort(),expected.slice().sort());
  assert.ok(tables.rows.every(row => row.relrowsecurity));
  for (const role of ['anon','authenticated']) {
    for (const table of expected) {
      const result = await db.query('SELECT has_table_privilege($1,$2,$3) AS allowed',[role,`${schema}.${table}`,'SELECT']);
      assert.equal(result.rows[0].allowed,false);
    }
  }
  await assert.rejects(db.transaction(async client => {
    await client.query('INSERT INTO categories VALUES ($1,$2)',['rollback-test','Temporary']);
    throw new Error('force rollback');
  }),/force rollback/);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM categories').get()).n,0);
  await migrateDatabase(db); // repeat migration is safe
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM categories').get()).n,0);
});

test('parallel uploads cannot exceed the account quota', async t => {
  const { client, db, dataDir } = await setup(t);
  const owner=client(); await register(owner,'quota');
  const initial=await owner('/games',{method:'POST',body:upload()});
  assert.equal(initial.status,201);
  await db.prepare('UPDATE games SET size=? WHERE id=?').run(200*1024*1024-uniqueJar().length,initial.data.id);
  const results=await Promise.all([owner('/games',{method:'POST',body:upload()}),owner('/games',{method:'POST',body:upload()})]);
  assert.equal(results.filter(r=>r.status===201).length,1);
  assert.ok(results.some(r=>r.status===413 || r.status===429));
  // A concurrent request can hit the per-account upload guard first. Once
  // released, retrying must still be rejected by the persistent quota.
  assert.equal((await owner('/games',{method:'POST',body:upload()})).status,413);
  assert.equal((await readdir(join(dataDir,'uploads'))).length,2);
});

test('verified Storage games redirect publicly but never expose private games', async t => {
  const { client, db } = await setup(t);
  const member = client();
  const user = await register(member, 'storageowner');
  const { data: game } = await member('/games', { method:'POST', body:upload() });
  await db.prepare('UPDATE games SET storage_object=? WHERE id=?').run('giaitri321/test game.jar',game.id);
  const instance = await createApp({database:db});
  const server = instance.app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/games/${game.id}/file`;
  assert.equal((await fetch(url,{redirect:'manual'})).status,404);
  await db.prepare("UPDATE games SET visibility='public' WHERE id=?").run(game.id);
  const response = await fetch(url,{redirect:'manual'});
  assert.equal(response.status,302);
  const target = new URL(response.headers.get('location'));
  assert.equal(target.origin,new URL(process.env.SUPABASE_URL).origin);
  assert.ok(target.pathname.endsWith('/giaitri321/test%20game.jar'));
  assert.equal(target.search,'');
});

test('catalog groups editions before pagination and detail excludes private siblings', async t => {
  const {client,db}=await setup(t); const a=client(), guest=client();
  const user=await register(a,'editions');
  await db.prepare("INSERT INTO categories(id,name) VALUES (?,?)").run('cat','Action');
  for (let i=0;i<26;i++) await db.prepare("INSERT INTO games(id,owner_id,visibility,category_id,title,filename,size,sha256,family_key,family_title) VALUES (?,?,?,?,?,?,?,?,?,?)").run('edition'+i,user.id,i===25?'private':'public','cat','Test '+i,'Test-'+(i===0?'240x320':'128x160')+'.jar',123,'test','family','Test family');
  const list=(await guest('/games')).data;
  assert.equal(list.total,1); assert.equal(list.pages,1); assert.equal(list.items[0].variant_count,25);
  assert.equal(list.items[0].title,'Test family');
  assert.equal(list.editions,25);
  const beyond=(await guest('/games?page=999')).data;
  assert.deepEqual(beyond.items,[]);assert.equal(beyond.total,1);assert.equal(beyond.editions,25);
  const empty=(await guest('/games?q=absent')).data;
  assert.deepEqual(empty.items,[]);assert.equal(empty.total,0);assert.equal(empty.editions,0);
  assert.ok(!('list_total' in list.items[0]));
  assert.equal((await guest('/games?editions=1')).data.total,25);
  assert.equal((await guest('/games?category=cat&q=Test')).data.total,1);
  assert.equal((await guest('/games?q=absent')).data.total,0);
  assert.equal((await guest('/games?q=Test%20family')).data.total,1);
  const detail=(await guest('/games/edition0')).data;
  assert.equal(detail.variants.length,25);
  assert.ok(detail.variants.every(v=>v.visibility==='public'));
  assert.equal((await guest('/games/edition25')).status,404);
  assert.equal((await a('/games/edition25')).data.variants.length,1);
  await db.prepare('INSERT INTO history(user_id,game_id,last_played) VALUES (?,?,?)').run(user.id,'edition0','2026-01-01 00:00:00');
  await db.prepare('INSERT INTO history(user_id,game_id,last_played) VALUES (?,?,?)').run(user.id,'edition1','2026-01-02 00:00:00');
  const history=(await a('/games?scope=history')).data;
  assert.equal(history.total,1);
  assert.equal(history.items[0].id,'edition1');
  assert.equal(history.items[0].title,'Test family');
  assert.equal((await a('/games/edition0')).data.last_played_id,'edition1');
  assert.equal((await guest('/games/edition0')).data.last_played_id,null);
});

test('forum media validates content, saves metadata and removes stored attachments', async t => {
  const saved=[],removed=[];
  const mediaStore={async put(file,type,user,post){const m={object:`posts/${post}/image.png`,url:'https://example.com/image.png',type:type.mime,size:file.size};saved.push(m);return m;},async remove(items){removed.push(...items);}};
  const {client,dataDir}=await setup(t,{mediaStore}); const a=client(),guest=client();await register(a,'mediauser');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY9sAAAAASUVORK5CYII=','base64');
  const form=bytes=>{const f=new FormData();f.set('title','Media post');f.set('body','Test attachment');f.set('media',new Blob([bytes],{type:'image/png'}),'image.png');return f;};
  assert.equal((await guest('/posts',{method:'POST',body:form(png)})).status,401);
  assert.equal((await a('/posts',{method:'POST',body:form(Buffer.from('<script>bad</script>'))})).status,400);
  assert.equal(saved.length,0);
  const result=await a('/posts',{method:'POST',body:form(png)});assert.equal(result.status,201,JSON.stringify(result.data));
  const detail=(await guest(`/posts/${result.data.id}`)).data;assert.equal(detail.media[0].type,'image/png');
  const edit=form(png);edit.set('remove_media',JSON.stringify([detail.media[0].object]));
  assert.equal((await a(`/posts/${result.data.id}`,{method:'PATCH',body:edit})).status,200);
  assert.equal(saved.length,2);assert.equal(removed.length,1);
  const bad=form(png);bad.set('remove_media',JSON.stringify(['other-post/image.png']));
  assert.equal((await a(`/posts/${result.data.id}`,{method:'PATCH',body:bad})).status,400);
  assert.equal((await guest(`/posts/${result.data.id}`,{method:'DELETE'})).status,401);
  assert.equal((await a(`/posts/${result.data.id}`,{method:'DELETE'})).status,200);
  assert.equal(removed.length,1);assert.deepEqual(await readdir(join(dataDir,'tmp')),[]);
});

test('admin screen filtering, editing and family deletion preserve other games',async t=>{
 const {client,db}=await setup(t);const a=client(),guest=client();const user=await register(a,'screenadmin');
 await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
 await db.prepare('INSERT INTO categories(id,name) VALUES (?,?)').run('screen-cat','Screen games');
 for(const [id,family] of [['v1','group'],['v2','group'],['other','other']]) await db.prepare("INSERT INTO games(id,owner_id,visibility,category_id,title,filename,size,sha256,family_key) VALUES (?,?,?,?,?,?,?,?,?)").run(id,user.id,'public','screen-cat',id,'game-240x320.jar',123,'sha',family);
  assert.equal((await guest('/games?screen=240x320')).data.total,2);
  const screens=(await guest('/game-screens')).data;
  assert.deepEqual(screens,[{screen:'240x320',editions:3}]);
 assert.equal((await a('/games/v1',{method:'PATCH',body:{title:'Version one',description:'',category_id:'screen-cat',screen:'128x160'}})).status,200);
  assert.equal((await guest('/games?screen=128x160')).data.editions,1);
  assert.deepEqual((await guest('/game-screens')).data,[{screen:'128x160',editions:1},{screen:'240x320',editions:2}]);
 assert.equal((await guest('/games/v1')).data.screen,'128x160');
 assert.equal((await guest('/games/v1?scope=family',{method:'DELETE'})).status,401);
 assert.equal((await a('/games/v1?scope=family',{method:'DELETE'})).data.removed,2);
 assert.equal((await guest('/games')).data.total,1);
 assert.equal((await guest('/games/other')).status,200);
});
test('topic notification preferences, game requests and update history',async t=>{
 const {client,db}=await setup(t);const a=client(),b=client(),c=client(),guest=client();const admin=await register(a,'discovery_admin');await register(b,'discovery_b');await register(c,'discovery_c');await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(admin.id);
 const p=(await a('/posts',{method:'POST',body:{title:'Topic to follow',body:'A test discussion'}})).data;
 assert.equal((await b(`/posts/${p.id}/follow`)).data.enabled,false);
 await b(`/posts/${p.id}/follow`,{method:'PUT',body:{enabled:true}});
 await a(`/posts/${p.id}/follow`,{method:'PUT',body:{enabled:false}});
 await c(`/posts/${p.id}/comments`,{method:'POST',body:{body:'First reply'}});
 assert.equal((await b('/notifications')).data.length,1);assert.equal((await a('/notifications')).data.length,0);
 await b(`/posts/${p.id}/follow`,{method:'PUT',body:{enabled:false}});
 await c(`/posts/${p.id}/comments`,{method:'POST',body:{body:'Second reply'}});
 assert.equal((await b('/notifications')).data.length,1);
 assert.equal((await guest('/game-requests')).status,401);
 const request=(await b('/game-requests',{method:'POST',body:{title:'Requested game',description:'240x320 version'}})).data;
 assert.equal((await c('/game-requests')).data.total,0);assert.equal((await a('/game-requests')).data.total,1);
 assert.equal((await b('/game-requests/'+request.id,{method:'PATCH',body:{status:'searching'}})).status,403);
 assert.equal((await a('/game-requests/'+request.id,{method:'PATCH',body:{status:'added'}})).status,400);
 assert.equal((await a('/game-requests/'+request.id,{method:'PATCH',body:{status:'searching'}})).status,200);
 assert.equal((await b('/game-requests')).data.items[0].status,'searching');
 const category=(await a('/categories',{method:'POST',body:{name:'Discovery'}})).data.id;
 const game=(await a('/games',{method:'POST',body:upload('public',category)})).data;
 assert.equal((await a('/game-requests/'+request.id,{method:'PATCH',body:{status:'added',game_id:game.id}})).status,200);
 assert.equal((await b(`/games/${game.id}/updates`,{method:'POST',body:{body:'Unauthorized'}})).status,403);
 assert.equal((await a(`/games/${game.id}/updates`,{method:'POST',body:{body:'Fixed controls'}})).status,201);
 assert.equal((await guest(`/games/${game.id}/updates`)).data.items[0].body,'Fixed controls');
});


test('compatibility updates one vote per member and excludes failing personal recommendations',async t=>{
 const {client,db}=await setup(t);const a=client(),b=client(),guest=client();const owner=await register(a,'compat_owner');await register(b,'compat_player');
 await db.prepare("UPDATE users SET role='admin' WHERE id=?").run(owner.id);
 const category=(await a('/categories',{method:'POST',body:{name:'Compatibility'}})).data.id;
 const game=(await a('/games',{method:'POST',body:upload('public',category)})).data;
 const url=`/games/${game.id}/compatibility`;
 assert.equal((await guest(url,{method:'POST',body:{status:'works'}})).status,401);
 assert.equal((await b(url,{method:'POST',body:{status:'invalid'}})).status,400);
 for(const status of ['works','graphics','network'])assert.equal((await b(url,{method:'POST',body:{status}})).status,200);
 assert.deepEqual((await guest(url)).data,{counts:{network:1},mine:null,configuration:'',configurations:[]});
 assert.equal((await b(url)).data.mine,'network');
 assert.equal((await b(`/games/${game.id}/recommendation`)).data.variants[0].works,false);
 await b(`/games/${game.id}/works`,{method:'POST'});
 assert.deepEqual((await b(url)).data,{counts:{works:1},mine:'works',configuration:'',configurations:[]});
 assert.equal((await b(url,{method:'POST',body:{status:'works',configuration:'240x320 · Nokia · offline'}})).status,200);
 assert.equal((await b(url)).data.configuration,'240x320 · Nokia · offline');
 assert.equal((await guest(url)).data.configurations[0].configuration,'240x320 · Nokia · offline');
 assert.equal((await b(url,{method:'POST',body:{status:'works',configuration:'x'.repeat(301)}})).status,400);
 const privateGame=(await a('/games',{method:'POST',body:upload()})).data;
 assert.equal((await b(`/games/${privateGame.id}/compatibility`)).status,404);
});

test('mentions validate input, only notify topic participants, and respect muted topics',async t=>{
 const {client}=await setup(t);const a=client(),b=client(),c=client();await register(a,'mention_owner');const participant=await register(b,'mention_player');const outsider=await register(c,'mention_outside');
 const post=(await a('/posts',{method:'POST',body:{title:'Mention test',body:'Topic body'}})).data;
 await b(`/posts/${post.id}/comments`,{method:'POST',body:{body:'Here'}});
 const target=(await a(`/posts/${post.id}/comments`,{method:'POST',body:{body:'Target'}})).data;
 const before=(await b('/notifications')).data.length;
 assert.equal((await a(`/posts/${post.id}/comments`,{method:'POST',body:{body:'bad',mentions:'invalid'}})).status,400);
 await a(`/posts/${post.id}/comments`,{method:'POST',body:{body:'@mention_player @mention_outside hello',reply_to:target.id,mentions:[participant.id,outsider.id]}});
 assert.equal((await b('/notifications')).data.length,before+1);assert.equal((await c('/notifications')).data.length,0);
 await b(`/posts/${post.id}/follow`,{method:'PUT',body:{enabled:false}});
 await a(`/posts/${post.id}/comments`,{method:'POST',body:{body:'@mention_player again',reply_to:target.id,mentions:[participant.id]}});
 assert.equal((await b('/notifications')).data.length,before+1);
});


test('forum advanced filters combine ownership, author, unanswered and reply sorting',async t=>{
 const {client}=await setup(t);const a=client(),b=client(),guest=client();await register(a,'forum_owner');await register(b,'forum_guest');
 const first=(await a('/posts',{method:'POST',body:{title:'Câu hỏi đầu',body:'Nội dung tiếng Việt'}})).data;
 const second=(await b('/posts',{method:'POST',body:{title:'Câu hỏi khác',body:'Không trả lời'}})).data;
 await b(`/posts/${first.id}/comments`,{method:'POST',body:{body:'Một trả lời'}});
 assert.equal((await guest('/posts?mine=1')).status,401);
 assert.deepEqual((await a('/posts?mine=1')).data.items.map(p=>p.id),[first.id]);
 assert.deepEqual((await guest('/posts?unanswered=1')).data.items.map(p=>p.id),[second.id]);
 assert.deepEqual((await guest('/posts?author=forum_owner&q=cau%20hoi')).data.items.map(p=>p.id),[first.id]);
 assert.equal((await guest('/posts?sort=replies')).data.items[0].id,first.id);
 assert.equal((await a('/posts?mine=1&unanswered=1')).data.total,0);
});

test('remote JAR uploads persist metadata, enforce download ownership and roll back failures',async t=>{
 const put=[],removed=[],signed=[];
 const jarStore={put:async(file,visibility,owner,id)=>{const object=`uploads/${owner}/${id}.jar`;put.push(object);return object;},remove:async(object)=>removed.push(object),url:async(object,visibility)=>{signed.push({object,visibility});return '/api/me';}};
 const {client,db,dataDir}=await setup(t,{deployment:{remoteJars:true,uploadLimit:4194304},jarStore});
 const owner=client(),other=client();await register(owner,'remote_owner');await register(other,'remote_other');
 const uploaded=await owner('/games',{method:'POST',body:upload()});assert.equal(uploaded.status,201);
 const id=uploaded.data.id;
 assert.equal((await db.prepare('SELECT storage_object FROM games WHERE id=?').get(id)).storage_object,put[0]);
 assert.deepEqual(await readdir(join(dataDir,'uploads')),[]);
 assert.equal((await other(`/games/${id}/file`)).status,404);assert.equal(signed.length,0);
 assert.equal((await owner(`/games/${id}/file`)).status,200);assert.equal(signed[0].visibility,'private');
 const transaction=db.transaction;db.transaction=async()=>{throw new Error('simulated persistence failure');};
 try {assert.equal((await owner('/games',{method:'POST',body:upload()})).status,500);}finally{db.transaction=transaction;}
 assert.deepEqual(removed,[put[1]]);assert.deepEqual(await readdir(join(dataDir,'tmp')),[]);
});


test('transaction pool keeps actor context isolated and recovers after query failure',async t=>{
 const {db}=await setup(t);
 await Promise.all(Array.from({length:10},(_,i)=>databaseActor.run('actor-'+i,async()=>{
  const result=await db.query("SELECT current_setting('app.actor_id',true) AS actor");
  assert.equal(result.rows[0].actor,'actor-'+i);
 })));
 await assert.rejects(db.query('SELECT missing_column_for_rollback_test'));
 assert.equal((await db.query("SELECT current_setting('app.actor_id',true) AS actor")).rows[0].actor,'');
});
