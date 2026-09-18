# ITF globe: data feasibility and first-release plan

Budget: $0 operating costs. Planning/prototype stage; no website or daily automation has been deployed.
Initial coverage: men's and women's professional ITF World Tennis Tour worldwide.

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

A direct two-record request without cookies returned HTTP 200 with text/html and an Incapsula protection script, not JSON. Therefore direct unattended collection remains unproven. Browser DOM extraction works in the current desktop session. Do not copy session cookies, solve challenges unattended, or equate desktop access with hosted-runner access.

## Prototype

- extract-rows.mjs: DOM extraction function based on inspected row markup.
- Its selectors were evaluated against all 72 displayed men's rows: zero missing required fields, six explicit cancellations, and zero non-cancelled rows missing tournament links. Women's markup has not yet been validated with this exact function.
- calendar.mjs: normalization of extracted fields plus strict API-response checking.
- probe-itf.mjs: a single bounded, 30-second, two-record HTTP probe. Saves metadata only, not a calendar dump.
- calendar.test.mjs: date boundaries, cancellation handling, data validation, and HTML protection-response regression checks.
- .github/workflows/itf-feasibility.yml: manually triggered test for MT and WT on a standard Ubuntu runner. No schedule or write permissions.

Run local validation with `npm test`. Run a permitted network probe with `npm run probe`.
All seven local tests passed; both script files passed Node syntax checks. The network result above was obtained using PowerShell; the Node probe and GitHub workflow have not yet run against the remote endpoint.

## Proposed daily update design (not implemented)

1. Refresh both tours over a rolling six-month window, once daily at 04:17 UTC.
2. Respect pagination using totalItems; deduplicate month-overlap records by verified tournament ID.
3. Cache details and venue coordinates; revisit upcoming event details for deadline or venue changes.
4. Keep source timestamps, explicit cancellations and pending review for ambiguous/unlinked changes.
5. Validate complete batches. Reject malformed dates, unknown schemas, protection pages and unexpected count drops. An empty result requires review, not deletion of previous records.
6. Publish validated data atomically, retaining the last good snapshot and per-source freshness. Report failure without advancing successful-update timestamps.
7. Static website loads the published files; globe/list and filters run in the visitor's browser.

Proposed infrastructure: Cloudflare Pages free hosting/subdomain, open-source Globe.GL, small static JSON files, and standard GitHub Actions runners in a public repository. Free-plan terms must still apply at deployment. No paid APIs, subscriptions or custom domain purchase.

## Remaining decision gates

- Run the manual probe in https://github.com/omarbizid/itf-calendar-feasibility to establish hosted access. Failure must remain a failure, not trigger protection bypasses.
- If JSON becomes available, inspect and validate real item fields before writing an API-to-website adapter. Current normalization handles browser-extracted rows only.
- If the endpoint remains inaccessible, evaluate an authorised browser/export route; do not promise reliable daily refreshes.
- ITF's website reuse terms remain relevant before public redistribution: https://www.itftennis.com/en/about-us/terms-conditions/ . Technical readability is not a reuse licence.
- Full website implementation and deployment remain outside this feasibility test.
