import {normalize,locationKey,isCancelled,filterEvents,officialUrl,calendarText} from './ui-data.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=s=>new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const dateFull=s=>new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
let events=[],locations={},snapshot,filtered=[],limit=24,selectedLocation='',worldReady=false,rotation=[-12,-24,0],scale=224,groups=[];
let svg,projection,path,landLayer,gridLayer,markerLayer,ocean;
let fallback=false;
async function json(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Request failed');return r.json();}
function readFilters(){return {search:$('#search').value,tour:$('input[name=tour]:checked').value,from:$('#from').value,to:$('#to').value,country:$('#country').value,category:$('#category').value,setting:$('#setting').value,surfaces:$$('input[name=surface]:checked').map(i=>i.value),cancelled:$('#cancelled').checked,location:selectedLocation};}
function saveUrl(){const f=readFilters(),p=new URLSearchParams();for(const k of ['search','tour','from','to','country','category','setting','location'])if(f[k])p.set(k,f[k]);if(f.surfaces.length)p.set('surfaces',f.surfaces.join(','));if(f.cancelled)p.set('cancelled','1');if($('#sort').value!=='date')p.set('sort',$('#sort').value);history.replaceState(null,'',location.pathname+'?'+p.toString());}
function restore(){const p=new URLSearchParams(location.search);$('#from').value=p.has('from')?p.get('from'):today;for(const key of ['search','to','country','category','setting'])if(p.has(key))$('#'+key).value=p.get(key);const tour=$$('input[name=tour]').find(i=>i.value===p.get('tour'));if(tour)tour.checked=true;$$('input[name=surface]').forEach(i=>i.checked=(p.get('surfaces')||'').split(',').includes(i.value));$('#cancelled').checked=p.get('cancelled')==='1';selectedLocation=p.get('location')||'';if(['date','name'].includes(p.get('sort')))$('#sort').value=p.get('sort');}
function update(reset=true,persist=true){
 if(reset)limit=24;const f=readFilters();if(persist)saveUrl();
 const invalid=f.from&&f.to&&f.from>f.to;
 filtered=invalid?[]:filterEvents(events,f);
 filtered.sort($('#sort').value==='name'?(a,b)=>(a.location||'').localeCompare(b.location||'')||a.startDate.localeCompare(b.startDate):(a,b)=>a.startDate.localeCompare(b.startDate)||(a.location||'').localeCompare(b.location||''));
 $('#count').textContent=filtered.length;
 const missing=filtered.filter(t=>!locations[locationKey(t)]).length;
 $('#result-message').textContent=invalid?'Choose an end date on or after the start date.':filtered.length?`${filtered.length} matching events${missing?` · ${missing} without a verified city match are listed below`:''}. Select an event for details.`:'No tournaments match these filters. Try a wider date range or reset the filters.';
 $('#active-location').hidden=!selectedLocation;
 $('#active-location').replaceChildren();
 if(selectedLocation){const b=document.createElement('button');b.textContent=(events.find(t=>locationKey(t)===selectedLocation)?.location||'Selected city')+' · Clear city ×';b.onclick=()=>{selectedLocation='';update();};$('#active-location').append(b);}
 renderCards();updateMap();
}
function renderCards(){
 const container=$('#cards');container.replaceChildren();
 if(!filtered.length){container.innerHTML='<div class="empty-state"><h3>A different route?</h3><p>Adjust your filters to find more places to play.</p></div>';$('#more').hidden=true;return;}
 for(const t of filtered.slice(0,limit)){
 const b=document.createElement('button');b.className='tournament-card';b.type='button';
 b.setAttribute('aria-label',`${t.tournamentName}, ${t.hostNation}, ${dateFull(t.startDate)}${isCancelled(t)?', cancelled':''}. View details`);
 b.innerHTML=`<div class="card-top"><span class="badge ${t.circuit==='WT'?'women':''}">${esc(t.category)} · ${t.circuit==='MT'?'MEN':'WOMEN'}</span><span class="card-date">${dateLabel(t.startDate)} – ${dateLabel(t.endDate)}</span></div><div><h3>${esc((t.location||t.tournamentName).replace(/\s*\(Cancelled\)/i,''))}</h3><p class="card-location">${esc(t.hostNation)}${isCancelled(t)?' <span class="cancel-tag"> · Cancelled</span>':''}</p></div><div class="card-bottom"><span class="card-surface"><i class="surface-dot ${esc((t.surfaceDesc||'').toLowerCase())}"></i>${esc(t.surfaceDesc||'Surface TBC')} · ${esc(t.indoorOrOutDoor||'TBC')}</span><span>${esc(t.prizeMoney||'Prize TBC')}</span><span class="card-arrow" aria-hidden="true">↗</span></div>`;
 b.onclick=()=>showDetails(t);container.append(b);
 }$('#more').hidden=limit>=filtered.length;$('#more').textContent=`Show more tournaments (${filtered.length-limit} remaining) ↓`;
}
function showDetails(t){
 const url=officialUrl(t),point=locations[locationKey(t)];
 $('#detail-content').innerHTML=`<span class="badge ${t.circuit==='WT'?'women':''}">${esc(t.category)} · ${t.circuit==='MT'?"MEN'S":"WOMEN'S"} WORLD TENNIS TOUR</span><h2>${esc(t.tournamentName)}</h2><p class="detail-place">${esc(t.location)}, ${esc(t.hostNation)}</p>${isCancelled(t)?'<p class="cancel-tag">This tournament is listed as cancelled.</p>':''}<dl><div><dt>Dates</dt><dd>${dateLabel(t.startDate)} – ${dateFull(t.endDate)}</dd></div><div><dt>Prize money</dt><dd>${esc(t.prizeMoney||'Not supplied')}</dd></div><div><dt>Surface</dt><dd>${esc(t.surfaceDesc||'Not supplied')}</dd></div><div><dt>Court setting</dt><dd>${esc(t.indoorOrOutDoor||'Not supplied')}</dd></div><div><dt>Location precision</dt><dd>${point?'Approximate city centre':'City not yet mapped'}</dd></div><div><dt>Updated</dt><dd>${dateFull(snapshot.checkedAt)}</dd></div></dl><p class="detail-note">Check the official ITF page for entry deadlines, qualifying dates and acceptance lists. Being listed here does not mean entries are open or that a player is eligible.</p>${url?`<a class="primary-link" href="${esc(url)}" target="_blank" rel="noopener">View official ITF tournament ↗</a>`:'<p class="detail-note">ITF has not provided a link for this event.</p>'}<button class="calendar-button" id="add-calendar">Download calendar event ↓</button>`;
 $('#add-calendar').onclick=()=>{const blob=new Blob([calendarText(t)],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(t.tournamentKey||'tournament')+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 $('#details').showModal();
 if(point&&worldReady){rotation=[-point.lng,-point.lat,0];draw();}
}
function setupGlobe(world){
 if(!window.d3||!window.topojson)throw new Error('Map renderer unavailable');
 svg=d3.select('#globe');projection=d3.geoOrthographic().translate([430,270]).scale(scale).rotate(rotation).clipAngle(90);path=d3.geoPath(projection);
 const defs=svg.append('defs'),gradient=defs.append('radialGradient').attr('id','ocean-fill').attr('cx','35%').attr('cy','30%');gradient.append('stop').attr('offset','0%').attr('stop-color','#285962');gradient.append('stop').attr('offset','100%').attr('stop-color','#173c46');
 ocean=svg.append('path').datum({type:'Sphere'}).attr('fill','url(#ocean-fill)').attr('stroke','#537477').attr('stroke-width',.8);
 gridLayer=svg.append('path').datum(d3.geoGraticule10()).attr('fill','none').attr('stroke','#92b2aa').attr('stroke-opacity',.12).attr('stroke-width',.6);
 landLayer=svg.append('path').datum(topojson.feature(world,world.objects.countries)).attr('fill','#527a70').attr('stroke','#92aa8a').attr('stroke-width',.45).attr('stroke-opacity',.6);
 markerLayer=svg.append('g');
 svg.call(d3.drag().on('drag',e=>{rotation[0]+=e.dx*.28;rotation[1]=Math.max(-80,Math.min(80,rotation[1]-e.dy*.28));draw();}));
 $('#globe').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')rotation[0]-=10;if(e.key==='ArrowRight')rotation[0]+=10;if(e.key==='ArrowUp')rotation[1]=Math.min(80,rotation[1]+10);if(e.key==='ArrowDown')rotation[1]=Math.max(-80,rotation[1]-10);if(e.key==='+'||e.key==='=')scale=Math.min(360,scale+25);if(e.key==='-')scale=Math.max(160,scale-25);draw();}});
 worldReady=true;updateMap();
}
function updateMap(){
 const cities=new Map();for(const t of filtered){const key=locationKey(t),p=locations[key];if(!p)continue;if(!cities.has(key))cities.set(key,{...p,key,city:t.location,country:t.hostNation,count:0});cities.get(key).count++;}groups=[...cities.values()];
 $('#mapped').textContent=`${groups.length} cities · ${filtered.filter(t=>locations[locationKey(t)]).length} mapped events`;
 if(!worldReady)return;
 const pins=markerLayer.selectAll('g.marker').data(groups,d=>d.key).join(enter=>{const g=enter.append('g').attr('class','marker').attr('role','button').attr('tabindex',0);g.append('circle').attr('class','pin-ring').attr('r',11).attr('fill','#d8f36a').attr('fill-opacity',.08);g.append('circle').attr('class','pin-core').attr('r',3.4).attr('fill','#d8f36a').attr('stroke','#e1f898').attr('stroke-width',.7);g.append('title');return g;});
 pins.attr('aria-label',d=>`${d.city}, ${d.country}: ${d.count} tournaments. Filter by this city.`).on('click',(e,d)=>{e.stopPropagation();selectedLocation=d.key;rotation=[-d.lng,-d.lat,0];update();}).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectedLocation=d.key;update();}});
 pins.select('title').text(d=>`${d.city}, ${d.country} · ${d.count} event${d.count===1?'':'s'}`);draw();
}
function draw(){if(!worldReady)return;projection.rotate(rotation).scale(scale);ocean.attr('d',path);gridLayer.attr('d',path);landLayer.attr('d',path);const center=projection.invert([430,270]);markerLayer.selectAll('g.marker').attr('transform',d=>{const p=projection([d.lng,d.lat]);return `translate(${p[0]},${p[1]})`;}).attr('display',d=>d3.geoDistance([d.lng,d.lat],center)>Math.PI/2?'none':null).attr('tabindex',d=>d3.geoDistance([d.lng,d.lat],center)>Math.PI/2?-1:0);}
$('#zoom-in').onclick=()=>{scale=Math.min(360,scale+25);draw();};$('#zoom-out').onclick=()=>{scale=Math.max(160,scale-25);draw();};$('#reset-globe').onclick=()=>{rotation=[-12,-24,0];scale=224;draw();};
$('#close-dialog').onclick=()=>$('#details').close();$('#details').addEventListener('click',e=>{if(e.target===$('#details')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#more').onclick=()=>{limit+=24;renderCards();};
$('#reset').onclick=()=>{$('#search').value='';$('#from').value=today;['to','country','category','setting'].forEach(k=>$('#'+k).value='');$$('input[name=surface]').forEach(i=>i.checked=false);$('input[name=tour][value=""]').checked=true;$('#cancelled').checked=false;$('#sort').value='date';selectedLocation='';update();};
$$('.filters input,.filters select,#sort').forEach(el=>el.addEventListener(el.id==='search'?'input':'change',()=>{update();if((el.id==='country'||el.id==='search')&&groups.length&&worldReady){const center=d3.geoCentroid({type:'MultiPoint',coordinates:groups.map(g=>[g.lng,g.lat])});rotation=[-center[0],-center[1],0];draw();}}));
async function init(){
 try{
 try{snapshot=await json('https://raw.githubusercontent.com/omarbizid/itf-calendar-feasibility/main/data/itf-calendar.json');if(!Array.isArray(snapshot.tournaments))throw new Error('Invalid data');}catch{snapshot=await json('./data/itf-calendar.json');fallback=true;}
 if(!Array.isArray(snapshot.tournaments)||!snapshot.checkedAt)throw new Error('Invalid calendar');
 events=snapshot.tournaments.filter(t=>t.startDate&&t.endDate&&t.tournamentName);
 $('#total').textContent=events.length.toLocaleString();$('#freshness').textContent='Updated '+dateFull(snapshot.checkedAt);
 $('#coverage').textContent=`Calendar window: ${dateFull(snapshot.dateFrom)} – ${dateFull(snapshot.dateTo)}. Future events appear as published by ITF.`;
 if(fallback||Date.now()-new Date(snapshot.checkedAt).getTime()>48*3600000){$('#notice').hidden=false;$('#notice').textContent=`Showing the calendar last updated ${dateFull(snapshot.checkedAt)}${fallback?' from the saved website snapshot':''}. The latest refresh could not be confirmed. Verify changes with ITF.`;}
 for(const [id,field] of [['country','hostNation'],['category','category']]){for(const v of [...new Set(events.map(t=>t[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){const o=document.createElement('option');o.value=v;o.textContent=v;$('#'+id).append(o);}}
 restore();update(true,false);
 try{let locationData;try{locationData=await json('https://raw.githubusercontent.com/omarbizid/itf-calendar-feasibility/main/locations.json');}catch{locationData=await json('./locations.json');}locations=locationData.locations||{};}catch{$('#mapped').textContent='City coordinates unavailable';}
 try{setupGlobe(await json('./world.json'));}catch{$('#map-error').hidden=false;$('#map-error').textContent='The globe could not load. All tournaments are still available in the list below.';}
 update(true,false);
 }catch{ $('#freshness').textContent='Calendar unavailable';$('#result-message').textContent='We could not load the calendar. Check your connection and try again.';$('#cards').innerHTML='<div class="empty-state"><h3>The calendar is taking a break.</h3><p>Please reload, or browse the official ITF calendar linked below.</p><button class="more" id="retry">Try again</button></div>';$('#retry').onclick=()=>location.reload();$('#mapped').textContent='Data unavailable';}
}
document.body.classList.add('filters-collapsed');
$('#toggle-filters').onclick=()=>{const collapsed=document.body.classList.toggle('filters-collapsed');$('#toggle-filters').setAttribute('aria-expanded',String(!collapsed));$('#toggle-filters').innerHTML=`Filters & search <span aria-hidden="true">${collapsed?'＋':'−'}</span>`;};
init();
