import {normalize,locationKey,isCancelled,filterEvents,officialUrl,calendarText,tierOf,prizeValue,weekStart,categoryCounts,nextNearby} from './ui-data.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=s=>new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const dateFull=s=>new Date(s.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const tierColors={15:'#d8f36a',25:'#5ad1e6',35:'#f7b267',50:'#f4845f',75:'#f25c9a',100:'#c792ea'};
const tierColor=c=>tierColors[tierOf(c)]||tierColors[15];
const isoDay=d=>d.toISOString().slice(0,10),addDays=(s,n)=>{const d=new Date(s+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return isoDay(d);};
let events=[],locations={},snapshot,filtered=[],mapEvents=[],limit=24,selectedLocation='',categories=[],worldReady=false,rotation=[-12,-24,0],scale=224,groups=[];
let svg,projection,path,landLayer,gridLayer,markerLayer,ocean;
let fallback=false;
async function json(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Request failed');return r.json();}
function readFilters(){return {search:$('#search').value,tour:$('input[name=tour]:checked').value,from:$('#from').value,to:$('#to').value,country:$('#country').value,categories,setting:$('#setting').value,surfaces:$$('input[name=surface]:checked').map(i=>i.value),cancelled:$('#cancelled').checked,location:selectedLocation};}
function saveUrl(){const f=readFilters(),p=new URLSearchParams();for(const k of ['search','tour','from','to','country','setting','location'])if(f[k])p.set(k,f[k]);if(categories.length)p.set('categories',categories.join(','));if(f.surfaces.length)p.set('surfaces',f.surfaces.join(','));if(f.cancelled)p.set('cancelled','1');if($('#sort').value!=='date')p.set('sort',$('#sort').value);history.replaceState(null,'',location.pathname+'?'+p.toString());}
function restore(){const p=new URLSearchParams(location.search);$('#from').value=p.has('from')?p.get('from'):today;for(const key of ['search','to','country','setting'])if(p.has(key))$('#'+key).value=p.get(key);const known=new Set(events.map(t=>t.category));categories=(p.get('categories')||p.get('category')||'').split(',').map(c=>c.trim().toUpperCase()).filter(c=>known.has(c));const tour=$$('input[name=tour]').find(i=>i.value===p.get('tour'));if(tour)tour.checked=true;$$('input[name=surface]').forEach(i=>i.checked=(p.get('surfaces')||'').split(',').includes(i.value));$('#cancelled').checked=p.get('cancelled')==='1';selectedLocation=p.get('location')||'';if(['date','name','prize'].includes(p.get('sort')))$('#sort').value=p.get('sort');}
function update(reset=true,persist=true){
 if(reset)limit=24;const f=readFilters();if(persist)saveUrl();
 const invalid=f.from&&f.to&&f.from>f.to;
 filtered=invalid?[]:filterEvents(events,f);
 // The globe keeps every matching city so another one can be picked while a city is selected.
 mapEvents=invalid?[]:selectedLocation?filterEvents(events,{...f,location:''}):filtered;
 const byDate=(a,b)=>a.startDate.localeCompare(b.startDate)||(a.location||'').localeCompare(b.location||''),sort=$('#sort').value;
 filtered.sort(sort==='name'?(a,b)=>(a.location||'').localeCompare(b.location||'')||a.startDate.localeCompare(b.startDate):sort==='prize'?(a,b)=>prizeValue(b)-prizeValue(a)||byDate(a,b):byDate);
 $('#count').textContent=filtered.length;
 const missing=filtered.filter(t=>!locations[locationKey(t)]).length;
 $('#result-message').textContent=invalid?'Choose an end date on or after the start date.':filtered.length?`${filtered.length} matching events${missing?` · ${missing} without a verified city match are listed below`:''}. Select an event for details.`:'No tournaments match these filters. Try a wider date range or reset the filters.';
 $('#active-location').hidden=!selectedLocation;
 $('#active-location').replaceChildren();
 if(selectedLocation){const b=document.createElement('button');b.textContent=cityName(selectedLocation)+' · Clear city ×';b.onclick=()=>selectCity('');$('#active-location').append(b);}
 $('#map-clear').hidden=!selectedLocation;$('#map-clear').textContent=selectedLocation?`${cityName(selectedLocation)} · Show all cities ×`:'';
 renderTiers(f);renderCards();updateMap();
}
function renderTiers(f){
 const counts=categoryCounts(filterEvents(events,{...f,categories:[]})),all=[...new Set(events.map(t=>t.category).filter(Boolean))].sort((a,b)=>a[0].localeCompare(b[0])||tierOf(a)-tierOf(b));
 const chip=(label,value,count,pressed,color)=>{const b=document.createElement('button');b.type='button';b.className='tier-chip';b.dataset.category=value;b.setAttribute('aria-pressed',String(pressed));if(color)b.style.setProperty('--tier',color);b.disabled=!pressed&&count===0;b.innerHTML=`${color?'<i aria-hidden="true"></i>':''}${esc(label)} <small>${count}</small>`;b.setAttribute('aria-label',`${label}: ${count} event${count===1?'':'s'}`);return b;};
 $('#tiers').replaceChildren(chip('All','',[...counts.values()].reduce((a,b)=>a+b,0),!categories.length),...all.map(c=>chip(c,c,counts.get(c)||0,categories.includes(c),tierColor(c))));
}
$('#tiers').addEventListener('click',e=>{const b=e.target.closest('.tier-chip');if(!b)return;const c=b.dataset.category;categories=!c?[]:categories.includes(c)?categories.filter(x=>x!==c):[...categories,c];update();focusResults();$(`.tier-chip[data-category="${c}"]`)?.focus();});
function renderCards(){
 const container=$('#cards');container.replaceChildren();
 if(!filtered.length){container.innerHTML='<div class="empty-state"><h3>A different route?</h3><p>Adjust your filters to find more places to play.</p></div>';$('#more').hidden=true;return;}
 const weeks=categoryCounts(filtered.map(t=>({category:weekStart(t.startDate)})));let week='';
 for(const t of filtered.slice(0,limit)){
 if($('#sort').value==='date'&&weekStart(t.startDate)!==week){week=weekStart(t.startDate);const h=document.createElement('h3');h.className='week-heading';h.innerHTML=`Week of ${dateFull(week)} <span>${weeks.get(week)} event${weeks.get(week)===1?'':'s'}</span>`;container.append(h);}
 const b=document.createElement('button');b.className='tournament-card';b.type='button';
 b.setAttribute('aria-label',`${t.tournamentName}, ${t.hostNation}, ${dateFull(t.startDate)}${isCancelled(t)?', cancelled':''}. View details`);
 b.innerHTML=`<div class="card-top"><span class="badge ${t.circuit==='WT'?'women':''}"><i class="tier-dot" style="background:${tierColor(t.category)}"></i>${esc(t.category)} · ${t.circuit==='MT'?'MEN':'WOMEN'}</span><span class="card-date">${dateLabel(t.startDate)} – ${dateLabel(t.endDate)}</span></div><div><h3>${esc((t.location||t.tournamentName).replace(/\s*\(Cancelled\)/i,''))}</h3><p class="card-location">${esc(t.hostNation)}${isCancelled(t)?' <span class="cancel-tag"> · Cancelled</span>':''}</p></div><div class="card-bottom"><span class="card-surface"><i class="surface-dot ${esc((t.surfaceDesc||'').toLowerCase())}"></i>${esc(t.surfaceDesc||'Surface TBC')} · ${esc(t.indoorOrOutDoor||'TBC')}</span><span>${esc(t.prizeMoney||'Prize TBC')}</span><span class="card-arrow" aria-hidden="true">↗</span></div>`;
 b.onclick=()=>showDetails(t);container.append(b);
 }$('#more').hidden=limit>=filtered.length;$('#more').textContent=`Show more tournaments (${filtered.length-limit} remaining) ↓`;
}
function showDetails(t){
 const url=officialUrl(t),point=locations[locationKey(t)],swing=nextNearby(t,events,locations);
 const swingHtml=point?`<section class="swing"><h3>Plan a swing</h3><p>Same tour, within 800 km, in the four weeks after this event.</p>${swing.length?`<ul>${swing.map((x,i)=>`<li><button type="button" data-swing="${i}"><span class="swing-date">${dateLabel(x.event.startDate)}</span><span class="swing-name"><i class="tier-dot" style="background:${tierColor(x.event.category)}"></i>${esc(x.event.category)} ${esc(x.event.location.replace(/\s*\(Cancelled\)/i,''))}<small>${esc(x.event.hostNation)}</small></span><span class="swing-km">${x.km<5?'Same city':x.km.toLocaleString()+' km'}</span></button></li>`).join('')}</ul>`:'<p class="swing-empty">No other events nearby in the following four weeks yet.</p>'}</section>`:'';
 $('#detail-content').innerHTML=`<span class="badge ${t.circuit==='WT'?'women':''}"><i class="tier-dot" style="background:${tierColor(t.category)}"></i>${esc(t.category)} · ${t.circuit==='MT'?"MEN'S":"WOMEN'S"} WORLD TENNIS TOUR</span><h2>${esc(t.tournamentName)}</h2><p class="detail-place">${esc(t.location)}, ${esc(t.hostNation)}</p>${isCancelled(t)?'<p class="cancel-tag">This tournament is listed as cancelled.</p>':''}<dl><div><dt>Dates</dt><dd>${dateLabel(t.startDate)} – ${dateFull(t.endDate)}</dd></div><div><dt>Prize money</dt><dd>${esc(t.prizeMoney||'Not supplied')}</dd></div><div><dt>Surface</dt><dd>${esc(t.surfaceDesc||'Not supplied')}</dd></div><div><dt>Court setting</dt><dd>${esc(t.indoorOrOutDoor||'Not supplied')}</dd></div><div><dt>Location precision</dt><dd>${point?'Approximate city centre':'City not yet mapped'}</dd></div><div><dt>Updated</dt><dd>${dateFull(snapshot.checkedAt)}</dd></div></dl>${point?`<div class="detail-map"><button type="button" class="calendar-button" id="show-on-globe">Show on globe ◎</button><a class="calendar-button" href="https://www.openstreetmap.org/?mlat=${point.lat}&amp;mlon=${point.lng}#map=13/${point.lat}/${point.lng}" target="_blank" rel="noopener">City street map ↗</a></div>`:''}${swingHtml}<p class="detail-note">Check the official ITF page for entry deadlines, qualifying dates, venue address and acceptance lists. Being listed here does not mean entries are open or that a player is eligible.</p>${url?`<a class="primary-link" href="${esc(url)}" target="_blank" rel="noopener">View official ITF tournament ↗</a>`:'<p class="detail-note">ITF has not provided a link for this event.</p>'}<button class="calendar-button" id="add-calendar">Download calendar event ↓</button>`;
 $('#add-calendar').onclick=()=>{const blob=new Blob([calendarText(t)],{type:'text/calendar;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(t.tournamentKey||'tournament')+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 $$('[data-swing]').forEach(b=>b.onclick=()=>{showDetails(swing[+b.dataset.swing].event);$('#details').scrollTop=0;});
 if(point&&$('#show-on-globe'))$('#show-on-globe').onclick=()=>{$('#details').close();$('.map-panel').scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'});spotlight=locationKey(t);updateMap();flyTo(point.lng,point.lat,Math.max(scale,CITY_SCALE));};
 if(!$('#details').open)$('#details').showModal();
}
// Globe view: d3.zoom drives both rotation (drag) and scale (wheel, pinch, double-click, buttons).
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORLD_SCALE=224,MIN_SCALE=160,MAX_SCALE=12000,CITY_SCALE=3200,DETAIL_SCALE=650,LABEL_SCALE=1800;
let zoom,lastTransform,coarseLand,detailLand,detailRequested=false,flight=null,spotlight='',wheelArmed=false,hintTimer;
const clampScale=s=>Math.max(MIN_SCALE,Math.min(MAX_SCALE,s)),clampLat=v=>Math.max(-85,Math.min(85,v));
function syncZoom(){if(zoom)svg.call(zoom.transform,d3.zoomIdentity.translate(lastTransform.x,lastTransform.y).scale(scale));}
function stopFlight(){if(flight){flight.stop();flight=null;}}
function flyTo(lng,lat,target,duration=1300){
 if(!worldReady)return;stopFlight();
 const from=[-rotation[0],-rotation[1]],to=[lng,lat],dist=d3.geoDistance(from,to),s0=scale,s1=clampScale(target);
 if(reduceMotion){rotation=[-lng,-lat,0];scale=s1;syncZoom();draw();return;}
 // Long hops pull back towards the whole globe mid-flight, then land zoomed in.
 const mid=Math.min(s0,s1,Math.max(MIN_SCALE,WORLD_SCALE*.8/Math.max(dist,.01))),geo=d3.geoInterpolate(from,to),[l0,lm,l1]=[s0,mid,s1].map(Math.log);
 if(dist<.4&&Math.abs(l1-l0)<.05)duration=400;
 flight=d3.timer(elapsed=>{const k=Math.min(1,elapsed/duration),e=d3.easeCubicInOut(k),p=geo(e);rotation=[-p[0],-p[1],0];scale=Math.exp((1-e)**2*l0+2*e*(1-e)*lm+e*e*l1);draw();if(k===1){stopFlight();syncZoom();}});
}
const zoomBy=f=>flyTo(-rotation[0],-rotation[1],scale*f,350);
function loadDetail(){if(detailRequested)return;detailRequested=true;fetch('./world-50m.json').then(r=>r.ok?r.json():Promise.reject()).then(w=>{detailLand=topojson.feature(w,w.objects.countries);draw();}).catch(()=>{});}
function globeHint(text){clearTimeout(hintTimer);$('#globe-hint').textContent=text;$('#globe-hint').hidden=false;hintTimer=setTimeout(()=>$('#globe-hint').hidden=true,1600);}
function setupGlobe(world){
 if(!window.d3||!window.topojson)throw new Error('Map renderer unavailable');
 svg=d3.select('#globe');projection=d3.geoOrthographic().translate([430,270]).scale(scale).rotate(rotation).clipAngle(90).clipExtent([[-40,-40],[900,590]]);path=d3.geoPath(projection);
 const defs=svg.append('defs'),gradient=defs.append('radialGradient').attr('id','ocean-fill').attr('cx','35%').attr('cy','30%');gradient.append('stop').attr('offset','0%').attr('stop-color','#285962');gradient.append('stop').attr('offset','100%').attr('stop-color','#173c46');
 ocean=svg.append('path').datum({type:'Sphere'}).attr('fill','url(#ocean-fill)').attr('stroke','#537477').attr('stroke-width',.8);
 gridLayer=svg.append('path').datum(d3.geoGraticule10()).attr('fill','none').attr('stroke','#92b2aa').attr('stroke-opacity',.12).attr('stroke-width',.6);
 coarseLand=topojson.feature(world,world.objects.countries);
 landLayer=svg.append('path').datum(coarseLand).attr('fill','#527a70').attr('stroke','#92aa8a').attr('stroke-width',.45).attr('stroke-opacity',.6);
 markerLayer=svg.append('g');
 lastTransform=d3.zoomIdentity.scale(scale);
 zoom=d3.zoom().scaleExtent([MIN_SCALE,MAX_SCALE]).clickDistance(5)
  // The page keeps scrolling over the globe until it is clicked; Ctrl/⌘ + scroll and trackpad pinch always zoom.
  .filter(e=>{if(e.type==='wheel'&&!(e.ctrlKey||e.metaKey||wheelArmed)){globeHint('Click the globe, then scroll to zoom');return false;}return !e.button&&!(e.type==='dblclick'&&e.target.closest('.marker'));})
  .on('zoom',e=>{const t=e.transform;if(e.sourceEvent){stopFlight();if(t.k===lastTransform.k){const f=.28*WORLD_SCALE/scale;rotation=[rotation[0]+(t.x-lastTransform.x)*f,clampLat(rotation[1]-(t.y-lastTransform.y)*f),0];}else scale=t.k;draw();}lastTransform=t;});
 svg.call(zoom).call(zoom.transform,lastTransform);
 $('#globe').addEventListener('pointerdown',()=>{wheelArmed=true;});$('#globe').addEventListener('pointerleave',()=>{wheelArmed=false;});
 svg.on('click',e=>{if(e.target.closest('.marker'))return;if(selectedLocation)selectCity('');else if(spotlight){spotlight='';updateMap();}});
 $('#globe').addEventListener('keydown',e=>{if(e.key==='Escape'&&(selectedLocation||spotlight)){e.preventDefault();if(selectedLocation)selectCity('');else{spotlight='';updateMap();}return;}if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();stopFlight();const step=10*WORLD_SCALE/scale;if(e.key==='ArrowLeft')rotation[0]-=step;if(e.key==='ArrowRight')rotation[0]+=step;if(e.key==='ArrowUp')rotation[1]=clampLat(rotation[1]+step);if(e.key==='ArrowDown')rotation[1]=clampLat(rotation[1]-step);if(e.key==='+'||e.key==='=')return zoomBy(1.6);if(e.key==='-')return zoomBy(1/1.6);draw();}});
 worldReady=true;updateMap();
}
const cityName=key=>(events.find(t=>locationKey(t)===key)?.location||'Selected city').replace(/\s*\(Cancelled\)/i,'');
function selectCity(key){
 selectedLocation=key;spotlight='';update();if(!worldReady)return;
 const g=groups.find(g=>g.key===key);
 if(g)flyTo(g.lng,g.lat,Math.max(scale,CITY_SCALE));else flyTo(-rotation[0],-rotation[1],Math.min(scale,WORLD_SCALE));
}
function updateMap(){
 const cities=new Map();for(const t of mapEvents){const key=locationKey(t),p=locations[key];if(!p)continue;if(!cities.has(key))cities.set(key,{...p,key,city:t.location.replace(/\s*\(Cancelled\)/i,''),country:t.hostNation,count:0,tier:0,categories:new Set()});const g=cities.get(key);g.count++;g.categories.add(t.category);if(tierOf(t.category)>g.tier){g.tier=tierOf(t.category);g.color=tierColor(t.category);}}groups=[...cities.values()];
 const tiers=[...new Set(groups.map(g=>g.tier))].sort((a,b)=>a-b);$('#legend').innerHTML=tiers.length?tiers.map(n=>`<span><i style="background:${tierColors[n]||tierColors[15]}"></i>${n}</span>`).join('')+'<em>Highest level in each city</em>':'';
 $('#mapped').textContent=`${groups.length} cities · ${mapEvents.filter(t=>locations[locationKey(t)]).length} mapped events`;
 if(!worldReady)return;
 const pins=markerLayer.selectAll('g.marker').data(groups,d=>d.key).join(enter=>{const g=enter.append('g').attr('class','marker').attr('role','button').attr('tabindex',0);g.append('circle').attr('class','pin-pulse').attr('r',9).attr('fill','none');g.append('circle').attr('class','pin-ring').attr('fill-opacity',.12);g.append('circle').attr('class','pin-core').attr('stroke','#122d34').attr('stroke-width',.8);g.append('text').attr('class','globe-label').attr('x',10).attr('y',4);g.append('title');return g;});
 $('#globe').classList.toggle('has-selection',!!selectedLocation);pins.classed('selected',d=>d.key===selectedLocation).classed('spotlight',d=>d.key===spotlight).sort((a,b)=>(a.key===selectedLocation||a.key===spotlight)-(b.key===selectedLocation||b.key===spotlight)||a.tier-b.tier);
 pins.select('.pin-pulse').attr('stroke',d=>d.color);pins.select('.pin-ring').attr('r',d=>8+Math.min(d.count,8)*1.2).attr('fill',d=>d.color);pins.select('.pin-core').attr('r',d=>3+Math.min(d.count,8)*.35).attr('fill',d=>d.color);pins.select('text').text(d=>d.city);
 pins.attr('aria-label',d=>`${d.city}, ${d.country}: ${d.count} tournament${d.count===1?'':'s'} (${[...d.categories].join(', ')}). ${d.key===selectedLocation?'Selected. Activate again to show all cities.':'Filter by this city.'}`).on('click',(e,d)=>{e.stopPropagation();selectCity(d.key===selectedLocation?'':d.key);}).on('keydown',(e,d)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();selectCity(d.key===selectedLocation?'':d.key);}});
 pins.select('title').text(d=>`${d.city}, ${d.country} · ${d.count} event${d.count===1?'':'s'} · ${[...d.categories].join(', ')}`);draw();
}
function draw(){
 if(!worldReady)return;
 if(scale>=DETAIL_SCALE)loadDetail();
 projection.rotate(rotation).scale(scale);landLayer.datum(scale>=DETAIL_SCALE&&detailLand?detailLand:coarseLand);
 ocean.attr('d',path);gridLayer.attr('d',path);landLayer.attr('d',path);
 const center=[-rotation[0],-rotation[1]],labels=scale>=LABEL_SCALE;
 markerLayer.selectAll('g.marker').each(function(d){const back=d3.geoDistance([d.lng,d.lat],center)>Math.PI/2,p=projection([d.lng,d.lat]);this.setAttribute('transform',`translate(${p[0]},${p[1]})`);if(back)this.setAttribute('display','none');else this.removeAttribute('display');this.setAttribute('tabindex',back?-1:0);this.querySelector('text').setAttribute('display',labels||d.key===selectedLocation||d.key===spotlight?'inline':'none');});
 $('#zoom-level').textContent=scale<WORLD_SCALE*1.5?'World':scale<LABEL_SCALE?'Region':'City';
}
$('#map-clear').onclick=()=>selectCity('');
$('#zoom-in').onclick=()=>zoomBy(1.8);$('#zoom-out').onclick=()=>zoomBy(1/1.8);$('#reset-globe').onclick=()=>{spotlight='';updateMap();flyTo(12,24,WORLD_SCALE);};
$('#close-dialog').onclick=()=>$('#details').close();$('#details').addEventListener('click',e=>{if(e.target===$('#details')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#more').onclick=()=>{limit+=24;renderCards();};
$('#reset').onclick=()=>{$('#search').value='';$('#from').value=today;['to','country','setting'].forEach(k=>$('#'+k).value='');categories=[];$$('input[name=surface]').forEach(i=>i.checked=false);$('input[name=tour][value=""]').checked=true;$('#cancelled').checked=false;$('#sort').value='date';selectedLocation='';spotlight='';update();};
function focusResults(){if(groups.length&&worldReady){const center=d3.geoCentroid({type:'MultiPoint',coordinates:groups.map(g=>[g.lng,g.lat])});flyTo(center[0],Math.max(-45,Math.min(45,center[1])),Math.min(scale,WORLD_SCALE));}}
$$('.filters input,.filters select,#sort').forEach(el=>el.addEventListener(el.id==='search'?'input':'change',()=>{update();if(el.id==='country'||el.id==='search')focusResults();}));
$$('.date-presets button').forEach(b=>b.onclick=()=>{const r=b.dataset.range;$('#from').value=today;$('#to').value=r==='week'?addDays(weekStart(today),6):r==='4w'?addDays(today,27):addDays(today,90);update();});
async function init(){
 try{
 try{snapshot=await json('https://raw.githubusercontent.com/omarbizid/itf-calendar-feasibility/main/data/itf-calendar.json');if(!Array.isArray(snapshot.tournaments))throw new Error('Invalid data');}catch{snapshot=await json('./data/itf-calendar.json');fallback=true;}
 if(!Array.isArray(snapshot.tournaments)||!snapshot.checkedAt)throw new Error('Invalid calendar');
 events=snapshot.tournaments.filter(t=>t.startDate&&t.endDate&&t.tournamentName);
 $('#total').textContent=events.length.toLocaleString();$('#freshness').textContent='Updated '+dateFull(snapshot.checkedAt);
 $('#coverage').textContent=`Calendar window: ${dateFull(snapshot.dateFrom)} – ${dateFull(snapshot.dateTo)}. Future events appear as published by ITF.`;
 if(fallback||Date.now()-new Date(snapshot.checkedAt).getTime()>48*3600000){$('#notice').hidden=false;$('#notice').textContent=`Showing the calendar last updated ${dateFull(snapshot.checkedAt)}${fallback?' from the saved website snapshot':''}. The latest refresh could not be confirmed. Verify changes with ITF.`;}
 for(const [id,field] of [['country','hostNation']]){for(const v of [...new Set(events.map(t=>t[field]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))){const o=document.createElement('option');o.value=v;o.textContent=v;$('#'+id).append(o);}}
 restore();update(true,false);
 try{let locationData;try{locationData=await json('https://raw.githubusercontent.com/omarbizid/itf-calendar-feasibility/main/locations.json');}catch{locationData=await json('./locations.json');}locations=locationData.locations||{};}catch{$('#mapped').textContent='City coordinates unavailable';}
 try{setupGlobe(await json('./world.json'));}catch{$('#map-error').hidden=false;$('#map-error').textContent='The globe could not load. All tournaments are still available in the list below.';}
 update(true,false);
 const shared=groups.find(g=>g.key===selectedLocation);if(shared)flyTo(shared.lng,shared.lat,CITY_SCALE,1800);
 }catch{ $('#freshness').textContent='Calendar unavailable';$('#result-message').textContent='We could not load the calendar. Check your connection and try again.';$('#cards').innerHTML='<div class="empty-state"><h3>The calendar is taking a break.</h3><p>Please reload, or browse the official ITF calendar linked below.</p><button class="more" id="retry">Try again</button></div>';$('#retry').onclick=()=>location.reload();$('#mapped').textContent='Data unavailable';}
}
document.body.classList.add('filters-collapsed');
$('#toggle-filters').onclick=()=>{const collapsed=document.body.classList.toggle('filters-collapsed');$('#toggle-filters').setAttribute('aria-expanded',String(!collapsed));$('#toggle-filters').innerHTML=`Filters & search <span aria-hidden="true">${collapsed?'＋':'−'}</span>`;};
init();
