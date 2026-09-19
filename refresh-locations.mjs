// Optional enrichment: a failed coordinate download must not erase known positions.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {locationKey} from './ui-data.mjs';
try {
 const snapshot=JSON.parse(await readFile('data/itf-calendar.json','utf8'));
 let cached={};try{cached=JSON.parse(await readFile('locations.json','utf8')).locations||{};}catch{}
 if(snapshot.tournaments.every(t=>Object.hasOwn(cached,locationKey(t))))console.log('All tournament cities already checked.');
 else {
  await mkdir('.geo',{recursive:true});
  for(const [url,file] of [['https://download.geonames.org/export/dump/cities500.zip','.geo/cities500.zip'],['https://download.geonames.org/export/dump/countryInfo.txt','countryInfo.txt']]){
   const r=await fetch(url,{signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('GeoNames download failed');await writeFile(file,Buffer.from(await r.arrayBuffer()));
  }
  execFileSync('unzip',['-o','.geo/cities500.zip','-d','.geo'],{stdio:'inherit'});
  execFileSync(process.execPath,['build-locations.mjs'],{stdio:'inherit'});
 }
}catch(error){console.warn('Coordinate enrichment unavailable; retaining existing locations:',error.message);}
