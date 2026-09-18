const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function iso(day, month, year) {
  const m = months.indexOf(month);
  const d = new Date(Date.UTC(Number(year), m, Number(day)));
  if (m < 0 || d.getUTCFullYear() !== Number(year) || d.getUTCMonth() !== m || d.getUTCDate() !== Number(day)) throw new Error('Invalid calendar date');
  return d.toISOString().slice(0, 10);
}

export function dateRange(text) {
  const match = text.trim().match(/^(\d{1,2}) ([A-Z][a-z]{2})(?: (\d{4}))? to (\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/);
  if (!match) throw new Error(`Unrecognised date range: ${text}`);
  const [, d1, m1, y1, d2, m2, y2] = match;
  const startYear = y1 ?? String(Number(y2) - (months.indexOf(m1) > months.indexOf(m2) ? 1 : 0));
  const startDate = iso(d1, m1, startYear);
  const endDate = iso(d2, m2, y2);
  if (startDate > endDate) throw new Error('Reversed date range');
  return { startDate, endDate };
}

// Receives only fields read from the public calendar table, not hidden app state.
export function normalizeRow(row, tour) {
  if (!['men', 'women'].includes(tour)) throw new Error('Unknown tour');
  for (const key of ['name', 'date', 'country', 'city', 'category', 'surface']) {
    if (!row[key]?.trim()) throw new Error(`Missing ${key}`);
  }
  const dates = dateRange(row.date);
  const cancelled = /cancelled/i.test(row.status || '') || /cancelled/i.test(row.name);
  let sourceUrl = null;
  let sourceId = null;
  if (row.href) {
    const url = new URL(row.href, 'https://www.itftennis.com');
    if (url.origin !== 'https://www.itftennis.com' || !url.pathname.startsWith('/en/tournament/')) throw new Error('Unexpected tournament link');
    sourceUrl = url.href;
    sourceId = url.pathname.split('/').filter(Boolean).at(-1);
  }
  if (!sourceId && !cancelled) throw new Error('Active tournament missing official link');
  const surface = row.surface.match(/^(Indoor|Outdoor)\s*-\s*(.+)$/i);
  if (!surface) throw new Error('Unknown surface format');
  return {
    sourceId,
    // Cancelled rows can have no link/ID. This key is provisional, not an ITF ID.
    recordKey: sourceId ?? `unlinked:${tour}:${row.category}:${row.country}:${row.city}:${dates.startDate}`,
    name: row.name.trim(), tour, ...dates,
    country: row.country.trim(), city: row.city.trim(), category: row.category.trim(),
    prizeMoneyText: row.prizeMoney?.trim() || null,
    environment: surface[1].toLowerCase(), surface: surface[2].trim().toLowerCase(),
    status: cancelled ? 'cancelled' : /live/i.test(row.status || '') ? 'live' : 'unspecified',
    sourceUrl, coordinates: null
  };
}

export function validateApiResponse(status, contentType, body) {
  if (status !== 200) throw new Error(`HTTP ${status}`);
  if (!contentType.toLowerCase().includes('application/json')) throw new Error('Expected JSON; received HTML or another content type. A protection page is not calendar data.');
  const data = JSON.parse(body);
  if (!data || !Array.isArray(data.items) || !Number.isInteger(data.totalItems) || data.totalItems < 0) throw new Error('Unexpected calendar response schema');
  if (!data.items.length) throw new Error('No records: inconclusive, do not replace an existing dataset');
  if (data.totalItems < data.items.length) throw new Error('Inconsistent record count');
  return data;
}
