# ITF globe: data feasibility and first-release plan

Budget: $0 operating costs. Daily import is active. Court Atlas now implements the globe, filters, tournament details and calendar export; GitHub Pages serves the static website from the repository root.
Initial coverage: men's and women's professional ITF World Tennis Tour worldwide.

## Daily import verified, 19 September 2026

Scheduled run https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35432967008 passed all 13 tests and saved data/itf-calendar.json: 412 unique events, comprising 210 MT and 202 WT. The query window is September 2026 through February 2027; unpublished future months can be empty. checkedAt is 2026-09-19T08:48:26.731Z.

The daily workflow runs at 04:17 UTC, subject to GitHub scheduling delays. It requests months separately, paginates, deduplicates tournamentKey across overlapping months, checks required fields and count consistency, and atomically replaces the snapshot only after validation. It rejects a count drop over 30% per circuit when comparing the same window start. It preserves explicit cancellation fields. Detail fetching, coordinates and the website adapter are not implemented.

An initial broad date-range import encountered repeated records during pagination. Monthly requests resolved that failure. The scheduled run verified the corrected importer end to end. Long-term reliability remains unproven.

## Hosted test result: passed, 18 September 2026

Repository: https://github.com/omarbizid/itf-calendar-feasibility
Run: https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35355077313
Commit tested: 92cd2d62caeff6e83cf1ef50d63f41bae226d8b1

Both standard Ubuntu runner jobs passed all seven tests and fetched HTTP 200 application/json from the ITF endpoint, without ITF login, cookies, API credentials or browser automation.
The men's response reported totalItems=72 and the women's totalItems=65 for September 2026; each request retrieved only two sample records. This initial test was followed by the successful daily import described above.
Returned item fields include tournamentName, location, category, prizeMoney, surfaceDesc, surfaceCode, tourStatusCode, tourStatusDesc, indoorOrOutDoor, hostNation, hostNationCode, venue, startDate, endDate, tournamentKey, tournamentLink and hospitality. Values still need inspection before implementing the API adapter.

The earlier local protection-page response below is historical evidence: access differs between the local environment and this hosted test.

## Verified on 18 September 2026

- Public men's September calendar: 72 event rows, including 6 cancellations.
- Public women's September calendar: 65 event rows, including 9 cancellations.
- No account was entered during inspection. These counts describe the displayed month, including overlapping weeks, not a guaranteed complete season.
- Calendar rows expose name, dates, country, city, category, prize money, indoor/outdoor, surface and status.
- M25 Nevers detail page exposes draw sizes, entry and withdrawal deadlines, qualifying dates, venue name and address. Do not assume every detail page has all fields.
- Its Google Maps link contains an address query, not verified coordinates. Geocoding is still needed; city-level markers must be labelled approximate.
- Cancelled records may have no event link. Do not invent an official ID or infer cancellation from a failed fetch.

Sources:
- https://www.itftennis.com/en/tournament-calendar/mens-world-tennis-tour-calendar/?categories=All&startdate=2026-09
- https://www.itftennis.com/en/tournament-calendar/womens-world-tennis-tour-calendar/?categories=All&startdate=2026-09
- https://www.itftennis.com/en/tournament/m25-nevers/fra/2026/m-itf-fra-2026-015/

## Public frontend data mechanism

The script loaded by the calendar at https://itftennis-ep.azureedge.net/media/assets/bundle.js?key=@assemblyVersion references:

`GET /tennis/api/TournamentApi/GetCalendar`

Parameters include circuitCode, searchString, skip, take, nationCodes, zoneCodes, dateFrom, dateTo, indoorOutdoor, categories, isOrderAscending, orderField, surfaceCodes and singlesDrawFormat.
Frontend code maps men's to MT and women's to WT and consumes items/totalItems.
This is a discovered website endpoint, not a documented or guaranteed public developer API.

A local direct two-record request without cookies returned HTTP 200 with text/html and an Incapsula protection script, not JSON. The subsequent hosted test above succeeded. Browser DOM extraction also works in the desktop session. Do not copy session cookies or solve challenges unattended.

## Prototype

- extract-rows.mjs: DOM extraction function based on inspected row markup.
- Its selectors were evaluated against all 72 displayed men's rows: zero missing required fields, six explicit cancellations, and zero non-cancelled rows missing tournament links. Women's markup has not yet been validated with this exact function.
- calendar.mjs: normalization of extracted fields plus strict API-response checking.
- probe-itf.mjs: a single bounded, 30-second, two-record HTTP probe. Saves metadata only, not a calendar dump.
- calendar.test.mjs: date boundaries, cancellation handling, data validation, and HTML protection-response regression checks.
- .github/workflows/itf-feasibility.yml: manually triggered test for MT and WT on a standard Ubuntu runner. No schedule or write permissions.

Run local validation with `npm test`. Run a permitted network probe with `npm run probe`.
All seven local tests passed; both script files passed Node syntax checks. All seven tests also passed in each hosted job. The Node probe succeeded for both circuits on GitHub; the earlier PowerShell probe encountered the local protection response.

## Target design (daily calendar import implemented; enrichment and website pending)

1. Refresh both tours over a rolling six-month window, once daily at 04:17 UTC.
2. Respect pagination using totalItems; deduplicate month-overlap records by verified tournament ID.
3. Cache details and venue coordinates; revisit upcoming event details for deadline or venue changes.
4. Keep source timestamps, explicit cancellations and pending review for ambiguous/unlinked changes.
5. Validate complete batches. Reject malformed dates, unknown schemas, protection pages and unexpected count drops. An empty result requires review, not deletion of previous records.
6. Publish validated data atomically, retaining the last good snapshot and per-source freshness. Report failure without advancing successful-update timestamps.
7. Static website loads the published files; globe/list and filters run in the visitor's browser.

Proposed infrastructure: Cloudflare Pages free hosting/subdomain, open-source Globe.GL, small static JSON files, and standard GitHub Actions runners in a public repository. Free-plan terms must still apply at deployment. No paid APIs, subscriptions or custom domain purchase.

## Remaining decision gates

- Hosted access and a complete scheduled import are established. Observe subsequent runs to assess sustained reliability.
- Inspect and validate real item values before writing an API-to-website adapter. Current normalization handles browser-extracted rows only.
- On future access failures preserve the last good snapshot; do not bypass protection or promise guaranteed refreshes.
- ITF's website reuse terms remain relevant before public redistribution: https://www.itftennis.com/en/about-us/terms-conditions/ . Technical readability is not a reuse licence.
- Full website implementation and deployment remain outside this feasibility test.
