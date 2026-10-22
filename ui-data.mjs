export const normalize=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\(cancelled\)/g,'').replace(/[^a-z0-9]/g,'');
export const locationKey=t=>t.hostNationCode+'|'+normalize(t.location);
export const isCancelled=t=>/cancel/i.test([t.tourStatusDesc,t.tourStatusCode,t.location,t.tournamentName].join(' '));
export function filterEvents(events,filters){
 const q=normalize(filters.search);
 return events.filter(t=>(!q||normalize([t.location,t.hostNation,t.tournamentName,t.category].join(' ')).includes(q))&&
 (!filters.tour||t.circuit===filters.tour)&&(!filters.country||t.hostNation===filters.country)&&
 (!filters.category||t.category===filters.category)&&(!filters.categories?.length||filters.categories.includes(t.category))&&(!filters.setting||t.indoorOrOutDoor===filters.setting)&&
 (!filters.from||t.endDate.slice(0,10)>=filters.from)&&(!filters.to||t.startDate.slice(0,10)<=filters.to)&&
 (!filters.surfaces?.length||filters.surfaces.includes(t.surfaceDesc))&&(filters.cancelled||!isCancelled(t))&&
 (!filters.location||locationKey(t)===filters.location));
}
export const tierOf=category=>Number(String(category||'').match(/\d+/)?.[0])||0;
export const prizeValue=t=>Number(String(t.prizeMoney||'').replace(/[^0-9.]/g,''))||0;
export function weekStart(date){const d=new Date(date.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
export function categoryCounts(events){const counts=new Map();for(const t of events)if(t.category)counts.set(t.category,(counts.get(t.category)||0)+1);return counts;}
export function officialUrl(t){
 if(!t.tournamentLink)return null;
 try{const u=new URL(t.tournamentLink,'https://www.itftennis.com');return u.protocol==='https:'&&u.hostname==='www.itftennis.com'?u.href:null;}catch{return null;}
}
export function calendarText(t){
 const esc=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const day=s=>s.slice(0,10).replaceAll('-','');
 const end=new Date(t.endDate.slice(0,10)+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+1);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Court Atlas//ITF Calendar//EN','BEGIN:VEVENT',`UID:${esc(t.tournamentKey)}@court-atlas`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${day(t.startDate)}`,`DTEND;VALUE=DATE:${day(end.toISOString())}`,`SUMMARY:${esc(t.tournamentName)}`,`LOCATION:${esc(t.location+', '+t.hostNation)}`,`DESCRIPTION:${esc('Confirm dates and entry details with ITF. '+(officialUrl(t)||''))}`,isCancelled(t)?'STATUS:CANCELLED':'STATUS:CONFIRMED','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
export function distanceKm(a,b){const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLng=(b.lng-a.lng)*r,h=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;return 2*6371*Math.asin(Math.min(1,Math.sqrt(h)));}
// Events a player could chain after this one: same tour, later start within `days`, within `km` of this city.
export function nextNearby(t,events,locations,{days=28,km=800,max=6}={}){
 const from=locations[locationKey(t)];if(!from)return [];
 const start=t.startDate.slice(0,10),end=new Date(start+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+days);const last=end.toISOString().slice(0,10);
 return events.filter(o=>o!==t&&o.circuit===t.circuit&&!isCancelled(o)&&o.startDate.slice(0,10)>start&&o.startDate.slice(0,10)<=last&&locations[locationKey(o)])
  .map(o=>({event:o,km:Math.round(distanceKm(from,locations[locationKey(o)]))})).filter(x=>x.km<=km)
  .sort((a,b)=>a.event.startDate.localeCompare(b.event.startDate)||a.km-b.km).slice(0,max);
}
