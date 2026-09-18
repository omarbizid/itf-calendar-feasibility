import test from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, normalizeRow, validateApiResponse } from './calendar.mjs';

const nevers = {
  name: 'M25 NEVERS', date: '14 Sep to 20 Sep 2026', country: 'France', city: 'Nevers', category: 'M25',
  prizeMoney: '$30,000', surface: 'Indoor - Hard', status: 'Live',
  href: '/en/tournament/m25-nevers/fra/2026/m-itf-fra-2026-015/'
};
test('observed Nevers row preserves identity and separates surface/environment', () => {
  const row = normalizeRow(nevers, 'men');
  assert.equal(row.sourceId, 'm-itf-fra-2026-015');
  assert.equal(row.startDate, '2026-09-14');
  assert.equal(row.endDate, '2026-09-20');
  assert.equal(row.environment, 'indoor');
  assert.equal(row.surface, 'hard');
  assert.equal(row.prizeMoneyText, '$30,000');
  assert.equal(row.coordinates, null);
});
test('cancelled record can be retained without a source link', () => {
  const row = normalizeRow({ ...nevers, name: 'M15 NAKHON PATHOM (CANCELLED - MOVED TO NONTHABURI)', city: 'Nakhon Pathom', country: 'Thailand', category: 'M15', prizeMoney: '$15,000', surface: 'Outdoor - Hard', status: 'Cancelled', date: '31 Aug to 06 Sep 2026', href: null }, 'men');
  assert.equal(row.status, 'cancelled');
  assert.equal(row.sourceId, null);
  assert.match(row.recordKey, /^unlinked:/);
});
test('blank status is not invented as confirmed or registration open', () => {
  assert.equal(normalizeRow({ ...nevers, status: '' }, 'men').status, 'unspecified');
});
test('dates handle year boundaries and reject malformed calendar dates', () => {
  assert.deepEqual(dateRange('28 Dec to 03 Jan 2027'), {startDate:'2026-12-28',endDate:'2027-01-03'});
  assert.throws(() => dateRange('31 Feb to 03 Mar 2026'));
  assert.throws(() => dateRange('20 Sep 2026 to 14 Sep 2026'));
});
test('reject missing core fields and unrelated links', () => {
  assert.throws(() => normalizeRow({ ...nevers, href: 'https://example.com/event' }, 'men'));
  assert.throws(() => normalizeRow({ ...nevers, city: '' }, 'men'));
});
test('200 HTML protection response must never count as a successful update', () => {
  assert.throws(() => validateApiResponse(200, 'text/html', '<html><script src="/_Incapsula_Resource"></script></html>'), /Expected JSON/);
});
test('empty or changed API schemas are inconclusive; reject them', () => {
  assert.throws(() => validateApiResponse(200, 'application/json', '{"items":[],"totalItems":0}'));
  assert.throws(() => validateApiResponse(200, 'application/json', '{"results":[]}'));
  assert.throws(() => validateApiResponse(403, 'application/json', '{}'));
});
