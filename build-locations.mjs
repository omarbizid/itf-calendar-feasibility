import { readFile, writeFile } from 'node:fs/promises';
const norm=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\(cancelled\)/g,'').replace(/[^a-z0-9]/g,'');
const countries=(await readFile('countryInfo.txt','utf8')).split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('\t'));
const aliases={'USA':'US','Great Britain':'GB','China, P.R.':'CN','Korea, Rep.':'KR','Turkiye':'TR','Czechia':'CZ'};
const cities=(await readFile('.geo/cities500.txt','utf8')).split('\n').filter(Boolean).map(l=>{const c=l.split('\t');return {name:c[1],names:new Set([c[1],c[2],...c[3].split(',')].map(norm)),lat:+c[4],lng:+c[5],country:c[8],state:c[10],population:+c[14]}});
const snapshot=JSON.parse(await readFile('data/itf-calendar.json','utf8'));
const cache={}; const missing=[];
const corrections={'Sharm ElSheikh':'Sharm el-Sheikh','Szczawno':'Szczawno-Zdrój','Qian Daohu':'Qiandaohu','Luan':"Lu'an",'yanagawa city':'Yanagawa','VISERBA DI RIMINI':'Viserba','Bali':'Denpasar'};
for(const t of snapshot.tournaments){
 const key=t.hostNationCode+'|'+norm(t.location||''); if(key in cache)continue;
 const country=aliases[t.hostNation]||countries.find(c=>norm(c[4])===norm(t.hostNation)||c[2]===t.hostNationCode)?.[0];
 const clean=(t.location||'').replace(/\s*\(Cancelled\)/i,'').trim();
 const [raw,state]=clean.split(',').map(s=>s.trim());
 if(raw==='Bali'){missing.push(clean+'|'+t.hostNation);cache[key]=null;continue;}
 const name=norm(corrections[raw]||raw);
 const matches=cities.filter(c=>c.country===country&&c.names.has(name)&&(!state||country!=='US'||c.state===state)).sort((a,b)=>b.population-a.population);
 if(matches.length===1 || matches.length>1&&matches[0].population>matches[1].population*5){const c=matches[0];cache[key]={lat:c.lat,lng:c.lng,name:c.name,precision:'city'};}
 else {cache[key]=null;missing.push(clean+'|'+t.hostNation);}
}
await writeFile('locations.json',JSON.stringify({source:'GeoNames cities500, CC BY 4.0',locations:cache}));
console.log({matched:Object.values(cache).filter(Boolean).length,missing});
