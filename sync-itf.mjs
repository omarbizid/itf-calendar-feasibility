import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { validateApiResponse } from './calendar.mjs';

export function importWindow(now = new Date()) {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return { dateFrom: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
    dateTo: new Date(Date.UTC(y, m + 6, 0)).toISOString().slice(0, 10) };
}

export async function collectCircuit(circuit, window, request = fetch, delay = pause, allowEmpty = false) {
  const records = new Map();
  let expected;
  let skip = 0;
  for (let page = 0; page < 100; page++) {
    const url = new URL('https://www.itftennis.com/tennis/api/TournamentApi/GetCalendar');
    url.search = new URLSearchParams({ circuitCode: circuit, searchString: '', skip: String(skip), take: '100',
      nationCodes: '', zoneCodes: '', ...window, indoorOutdoor: '', categories: '', isOrderAscending: 'true',
      orderField: 'startDate', surfaceCodes: '', singlesDrawFormat: '' }).toString();
    const response = await request(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    if (allowEmpty && skip === 0 && response.status === 200 && contentType.includes('application/json')) {
      const candidate = JSON.parse(body);
      if (candidate.totalItems === 0 && Array.isArray(candidate.items) && candidate.items.length === 0) return [];
    }
    const data = validateApiResponse(response.status, contentType, body);
    if (expected !== undefined && expected !== data.totalItems) throw new Error(`${circuit}: total changed during pagination`);
    expected = data.totalItems;
    for (const item of data.items) {
      const id = item.tournamentKey || item.id;
      if (!id || !item.startDate || !item.endDate || !item.hostNation || !(item.tournamentName || item.name)) throw new Error(`${circuit}: incomplete event schema`);
      const key = `${circuit}:${id}`;
      if (records.has(key)) throw new Error(`${circuit}: repeated event during pagination: ${key}, offset ${skip}`);
      // Keep source fields; UI mapping and venue coordinates are a separate step.
      const record = { circuit };
      for (const field of ['id','tournamentKey','tournamentName','name','dates','startDate','endDate','location',
        'hostNation','hostNationCode','category','prizeMoney','surfaceDesc','surfaceCode',
        'indoorOrOutDoor','tourStatusCode','tourStatusDesc','tournamentLink','hospitality']) {
        record[field] = item[field] ?? null;
      }
      records.set(key, record);
    }
    skip += data.items.length;
    if (skip > expected) throw new Error(`${circuit}: more records than reported`);
    if (skip === expected) return [...records.values()];
    await delay(1500);
  }
  throw new Error(`${circuit}: pagination limit exceeded`);
}

export function validateReplacement(previous, next) {
  if (!previous || previous.dateFrom !== next.dateFrom) return;
  for (const circuit of ['MT', 'WT']) {
    const oldCount = previous.tournaments.filter(t => t.circuit === circuit).length;
    const newCount = next.tournaments.filter(t => t.circuit === circuit).length;
    if (oldCount && newCount < oldCount * 0.7) throw new Error(`${circuit}: suspicious drop from ${oldCount} to ${newCount}; preserving previous data`);
  }
}

async function main() {
  const window = importWindow();
  const tournaments = [];
  for (const circuit of ['MT', 'WT']) {
    const byId = new Map();
    const first = new Date(`${window.dateFrom}T00:00:00Z`);
    for (let offset = 0; offset < 6; offset++) {
      const year = first.getUTCFullYear(), month = first.getUTCMonth() + offset;
      const monthWindow = {
        dateFrom: new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10),
        dateTo: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10)
      };
      const rows = await collectCircuit(circuit, monthWindow, fetch, pause, offset > 0);
      console.log(`${circuit}: ${rows.length} rows for ${monthWindow.dateFrom}`);
      for (const row of rows) byId.set(`${circuit}:${row.tournamentKey || row.id}`, row);
      await pause(1500);
    }
    console.log(`${circuit}: ${byId.size} unique events`);
    tournaments.push(...byId.values());
  }
  const next = { schemaVersion: 1, checkedAt: new Date().toISOString(), ...window,
    source: 'https://www.itftennis.com', tournaments };
  let previous;
  try { previous = JSON.parse(await readFile('data/itf-calendar.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  validateReplacement(previous, next);
  await mkdir('data', { recursive: true });
  await writeFile('data/itf-calendar.json.tmp', JSON.stringify(next, null, 2) + '\n');
  await rename('data/itf-calendar.json.tmp', 'data/itf-calendar.json');
  console.log(`Validated snapshot saved: ${tournaments.length} events`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
