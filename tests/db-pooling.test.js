import {test} from "node:test";
import assert from "node:assert/strict";
import {databaseConfig} from "../server/db.js";
test("Vercel uses Supabase transaction pooling without changing credentials",()=>{
 const source="postgresql://tester:password@aws-0-region.pooler.supabase.com:5432/postgres";
 const cfg=databaseConfig(source,{VERCEL:"1"});
 const target=new URL(cfg.connectionString);
 assert.equal(target.port,"6543");assert.equal(target.username,"tester");assert.equal(target.password,"password");
 assert.equal(cfg.idleTimeoutMillis,5000);assert.equal(cfg.ssl.rejectUnauthorized,true);
 assert.equal(new URL(databaseConfig(source,{}).connectionString).port,"5432");
 assert.equal(new URL(databaseConfig("postgresql://tester:password@db.example.com:5432/postgres",{VERCEL:"1"}).connectionString).port,"5432");
});
