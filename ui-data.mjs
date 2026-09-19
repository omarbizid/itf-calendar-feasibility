export const normalize=s=>String(s||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\(cancelled\)/g,'').replace(/[^a-z0-9]/g,'');
export const locationKey=t=>t.hostNationCode+'|'+normalize(t.location);
export const isCancelled=t=>/cancel/i.test([t.tourStatusDesc,t.tourStatusCode,t.location,t.tournamentName].join(' '));
export function filterEvents(events,filters){
 const q=normalize(filters.search);
 return events.filter(t=>(!q||normalize([t.location,t.hostNation,t.tournamentName,t.category].join(' ')).includes(q))&&
 (!filters.tour||t.circuit===filters.tour)&&(!filters.country||t.hostNation===filters.country)&&
 (!filters.category||t.category===filters.category)&&(!filters.setting||t.indoorOrOutDoor===filters.setting)&&
 (!filters.from||t.endDate.slice(0,10)>=filters.from)&&(!filters.to||t.startDate.slice(0,10)<=filters.to)&&
 (!filters.surfaces?.length||filters.surfaces.includes(t.surfaceDesc))&&(filters.cancelled||!isCancelled(t))&&
 (!filters.location||locationKey(t)===filters.location));
}
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
