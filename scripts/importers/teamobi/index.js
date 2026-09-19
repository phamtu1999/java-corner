import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const names={'118-1':'Mobi Army 3','30-18':'Avatar Online','31-4':'Khí Phách Anh Hùng','116-14':'Khí Phách Anh Hùng','116-1':'Chú Bé Rồng','116-13':'Hải Tặc Tí Hon','116-4':'Knight Age','116-11':'Ngũ Long Tranh Bá','116-10':'Ninja School Online'};
export function teamobiRecord(f){const variant=f.path.split('/').pop().replace(/\.jar$/i,'');if(!names[variant])throw Error('Unknown Teamobi title');return {title:names[variant],jar:resolve(f.path),sourceUrl:f.page,publisher:'TeaMobi',version:f.version||'',images:[],sha256:f.sha256};}
export default async function(input){return JSON.parse(await readFile(input,'utf8')).filter(f=>!f.error).map(teamobiRecord);}
