import { mkdir, writeFile } from 'node:fs/promises';
import { validateApiResponse } from './calendar.mjs';

const month = process.env.ITF_MONTH || new Date().toISOString().slice(0, 7);
const circuit = process.env.ITF_CIRCUIT || 'MT';
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !['MT', 'WT'].includes(circuit)) throw new Error('Invalid probe configuration');
const [year, m] = month.split('-').map(Number);
const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
const url = new URL('https://www.itftennis.com/tennis/api/TournamentApi/GetCalendar');
url.search = new URLSearchParams({
  circuitCode: circuit, searchString: '', skip: '0', take: '2', nationCodes: '', zoneCodes: '',
  dateFrom: `${month}-01`, dateTo: `${month}-${lastDay}`, indoorOutdoor: '', categories: '',
  isOrderAscending: 'true', orderField: 'startDate', surfaceCodes: '', singlesDrawFormat: ''
}).toString();
const report = { checkedAt: new Date().toISOString(), url: url.href, success: false };
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json' } });
  report.httpStatus = response.status;
  report.contentType = response.headers.get('content-type') || '';
  const data = validateApiResponse(response.status, report.contentType, await response.text());
  report.success = true;
  report.totalItems = data.totalItems;
  report.sampleCount = data.items.length;
  report.itemFields = Object.keys(data.items[0]);
  // Do not store/publish a whole calendar or treat this probe as a production sync.
} catch (error) {
  report.error = error.message;
  process.exitCode = 1;
}
await mkdir('reports', { recursive: true });
await writeFile('reports/itf-probe.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
