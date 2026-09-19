export function catalogFilters(query,conditions,args,fail) {
  for(const name of ['developer','language','country'])if(query[name]){conditions.push(`lower(g.${name})=lower(?)`);args.push(String(query[name]).slice(0,100));}
  if(query.network){if(!['online','offline','unknown'].includes(query.network))fail(400,'Chế độ mạng không hợp lệ.');if(query.network==='unknown')conditions.push('g.network_mode IS NULL');else{conditions.push('g.network_mode=?');args.push(query.network);}}
  if(query.touch){if(!['true','false','unknown'].includes(query.touch))fail(400,'Bộ lọc cảm ứng không hợp lệ.');if(query.touch==='unknown')conditions.push('g.touch_supported IS NULL');else{conditions.push('g.touch_supported=?');args.push(query.touch==='true');}}
  for(const [name,column,operator,min,max] of [['year','release_year','=',1980,2100],['min_size','size','>=',0,20971520],['max_size','size','<=',0,20971520]]){
    if(query[name]){const n=Number(query[name]);if(!Number.isInteger(n)||n<min||n>max)fail(400,'Giới hạn năm hoặc dung lượng không hợp lệ.');conditions.push(`g.${column}${operator}?`);args.push(n);}
  }
  if(query.min_size&&query.max_size&&Number(query.min_size)>Number(query.max_size))fail(400,'Dung lượng tối thiểu vượt tối đa.');
  if(query.compatibility){if(!['works','graphics','network','startup'].includes(query.compatibility))fail(400,'Trạng thái tương thích không hợp lệ.');conditions.push('EXISTS(SELECT 1 FROM game_checks gc WHERE gc.game_id=g.id AND gc.status=?)');args.push(query.compatibility);}
  for(const [key,manifest] of [['midp','microedition-profile'],['cldc','microedition-configuration']])if(query[key]){if(typeof query[key]!=='string'||query[key].length>40)fail(400,'Profile Java không hợp lệ.');conditions.push(`g.inspection->>'sha256'=g.sha256 AND lower(g.inspection->'manifest'->>'${manifest}')=lower(?)`);args.push(query[key]);}
  if(query.transport){if(!['socket','http'].includes(query.transport))fail(400,'Giao thức không hợp lệ.');conditions.push("g.inspection->>'sha256'=g.sha256 AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(g.inspection->'endpoints','[]'::jsonb)) e WHERE e.value LIKE ?)");args.push(query.transport==='socket'?'socket://%':'http%://%');}
  if(query.boot){if(!['captured','review','error','untested'].includes(query.boot))fail(400,'Kết quả boot không hợp lệ.');if(query.boot==='untested')conditions.push("(g.boot_report->>'sha256' IS DISTINCT FROM g.sha256 OR g.boot_state IS NULL OR g.boot_state IN ('queued','running'))");else{conditions.push("g.boot_report->>'sha256'=g.sha256 AND g.boot_state=?");args.push(query.boot);}}
  if(query.smart){
    const smart={teamobi:"lower(g.publisher)='teamobi'",java240:"COALESCE(g.screen,substring(lower(g.filename) from '[0-9]{2,4}x[0-9]{2,4}'))='240x320'",offline:"g.network_mode='offline'",online:"g.network_mode='online'",rpg:"(search_fold(c.name) LIKE '%nhap vai%' OR lower(c.name) LIKE '%rpg%')",vietnam:"upper(g.country)='VN'",nostalgia:'g.nostalgic',new:"g.created_at::timestamp>=now()-interval '30 days'"};
    if(!Object.hasOwn(smart,query.smart))fail(400,'Bộ sưu tập không hợp lệ.');conditions.push(smart[query.smart]);
  }
}

export function metadataFields(body,game,fail) {
  const fields={};
  for(const name of ['publisher','developer','language','country']){
    const value=body[name]===undefined?game[name]||'':body[name];
    if(typeof value!=='string'||value.length>100)fail(400,'Thông tin nhà phát hành/ngôn ngữ không hợp lệ.');fields[name]=value.trim();
  }
  fields.network_mode=body.network_mode===undefined?game.network_mode:body.network_mode||null;
  if(fields.network_mode!=null&&!['online','offline'].includes(fields.network_mode))fail(400,'Chế độ mạng không hợp lệ.');
  fields.release_year=body.release_year===undefined?game.release_year:body.release_year===''?null:Number(body.release_year);
  if(fields.release_year!=null&&(!Number.isInteger(fields.release_year)||fields.release_year<1980||fields.release_year>2100))fail(400,'Năm phát hành không hợp lệ.');
  const nostalgic=body.nostalgic===undefined?game.nostalgic:body.nostalgic;
  if(![true,false,'true','false'].includes(nostalgic))fail(400,'Nhãn tuổi thơ không hợp lệ.');fields.nostalgic=nostalgic===true||nostalgic==='true';
  return fields;
}
