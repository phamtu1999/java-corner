import {test} from 'node:test';
import assert from 'node:assert/strict';
import {achievements} from '../server/player-progress.js';
import {catalogFilters,metadataFields} from '../server/catalog-filters.js';
test('achievement thresholds, parameterized filters and unknown metadata',()=>{
 assert.deepEqual(achievements(0,0).map(a=>a.unlocked),[false,false,false]);
 assert.deepEqual(achievements(9,35999).map(a=>a.unlocked),[true,false,false]);
 assert(achievements(10,36000).every(a=>a.unlocked));
 const fail=(_,message)=>{throw Error(message);},conditions=[],args=[];
 catalogFilters({developer:"' OR true --",touch:'unknown',network:'offline',year:'2010',min_size:'10',max_size:'100',compatibility:'works',smart:'vietnam'},conditions,args,fail);
 assert(!conditions.join(' ').includes('OR true'));assert(args.includes("' OR true --"));
 assert(conditions.includes('g.touch_supported IS NULL'));
 for(const query of [{smart:'constructor'},{network:'public'},{touch:'maybe'},{year:'2101'},{min_size:'200',max_size:'100'},{compatibility:'other'}])assert.throws(()=>catalogFilters(query,[],[],fail));
 const fields=metadataFields({release_year:'',network_mode:'',nostalgic:'false'},{},fail);
 assert.equal(fields.release_year,null);assert.equal(fields.network_mode,null);assert.equal(fields.nostalgic,false);
 assert.throws(()=>metadataFields({release_year:'NaN'},{nostalgic:false},fail));
});
