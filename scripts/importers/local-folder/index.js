import {readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
export default async function(input){return (await readdir(input,{withFileTypes:true})).filter(e=>e.isFile()&&/\.jar$/i.test(e.name)).map(e=>({title:e.name.replace(/\.jar$/i,''),jar:resolve(input,e.name),sourceUrl:'',publisher:'',version:'',images:[]}));}
