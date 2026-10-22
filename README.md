# ITF calendar feasibility

## Court Atlas website

The repository now includes a responsive static tournament globe and searchable calendar. Open `index.html` through a local web server (`node serve.mjs`) or deploy the repository root with GitHub Pages. No build step or paid API is required.

The site reads the current calendar and city cache directly from the repository's public raw files, so scheduled data commits reach visitors without a new Pages build. The deployed snapshot is a fallback and its original update timestamp remains visible. Filters cover dates (including events in progress, with this-week, four-week and three-month shortcuts), tour, country, surface, court setting, and cancellations. A level bar above the globe toggles one or more categories (M15, M25, W15 to W100) and shows live counts. Globe markers are coloured by the highest level in each city. Links such as `?categories=M25` open that view directly. Results can be grouped by week, sorted by city, or sorted by prize money. The globe zooms with the scroll wheel (after a click), pinch, double-click or the buttons, switching to detailed 50m borders and city names up close. Selecting a city flies to it; clicking empty globe, pressing Escape or "Show all cities" clears it. Each event's details include "Plan a swing": same-tour events within 800 km in the following four weeks. Individual events link to ITF and can be downloaded as calendar files. City markers are approximate; unresolved or ambiguous cities stay in the list.

`refresh-locations.mjs` enriches new city names using GeoNames on the daily runner, retaining the existing cache if enrichment fails. See [THIRD_PARTY.md](THIRD_PARTY.md) for credits. Run `node --test` for importer and UI data tests.

Prototype for a worldwide ITF tournament globe with filters and a $0 operating budget.

**Hosted access test passed on 18 September 2026.** Both men's and women's calendar requests returned JSON from GitHub's standard Ubuntu runners, without ITF accounts, cookies or paid data services.

| September 2026 | Records fetched in test | Total reported by ITF |
| --- | ---: | ---: |
| Men's World Tennis Tour | 2 | 72 |
| Women's World Tennis Tour | 2 | 65 |

[View the successful workflow run](https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35355077313).

**Daily imports are enabled.** The first scheduled import succeeded on 19 September 2026, saving 412 unique tournaments (210 men's, 202 women's) after all 13 tests passed. It queried September 2026 through February 2027; future months contain only events ITF has published so far.

[Successful daily run](https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35432967008) · [Latest calendar data](data/itf-calendar.json)

The workflow is scheduled daily at 04:17 UTC. GitHub may delay scheduled jobs; this run completed at 08:48 UTC. The importer requests each month separately, follows pagination, deduplicates overlapping events and preserves the previous snapshot on validation failure. No ITF account or paid service is used. The globe website and city coordinate matching are implemented. Sustained importer reliability remains to be validated; data reuse terms are separate from technical access.

Requires Node.js 22 or newer. No package installation is needed.

```sh
npm test
npm run probe
node sync-itf.mjs
```

`ITF_MONTH` selects YYYY-MM and `ITF_CIRCUIT` selects MT or WT. The probe makes one two-record request and writes response metadata to `reports/itf-probe.json`.

See [PLAN.md](PLAN.md) for verified findings and remaining website work.

