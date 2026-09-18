// Pass this function to a supported read-only DOM evaluation on the loaded calendar.
// Selectors were inspected on the public September 2026 men's calendar.
export function extractCalendarRows() {
  return Array.from(document.querySelectorAll('tr[class^="whatson-table__tournament"]')).map(row => {
    const text = selector => row.querySelector(selector)?.textContent.trim() || '';
    return {
      name: text('td.name .short'),
      href: row.querySelector('td.name a[href^="/en/tournament/"]')?.getAttribute('href') || null,
      date: text('td.date span.date'), country: text('td.hostname span.hostname'),
      city: text('td.location span.location'), category: text('td.category span.category'),
      prizeMoney: text('td.prize-money span.prize-money'),
      surface: text('td.surface span.surface'), status: text('td.status span.status')
    };
  });
}
