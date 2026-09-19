# ITF calendar feasibility

Prototype for a worldwide ITF tournament globe with filters and a $0 operating budget.

**Hosted access test passed on 18 September 2026.** Both men's and women's calendar requests returned JSON from GitHub's standard Ubuntu runners, without ITF accounts, cookies or paid data services.

| September 2026 | Records fetched in test | Total reported by ITF |
| --- | ---: | ---: |
| Men's World Tennis Tour | 2 | 72 |
| Women's World Tennis Tour | 2 | 65 |

[View the successful workflow run](https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35355077313).

**Daily imports are enabled.** The first scheduled import succeeded on 19 September 2026, saving 412 unique tournaments (210 men's, 202 women's) after all 13 tests passed. It queried September 2026 through February 2027; future months contain only events ITF has published so far.

[Successful daily run](https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35432967008) · [Latest calendar data](data/itf-calendar.json)

The workflow is scheduled daily at 04:17 UTC. GitHub may delay scheduled jobs; this run completed at 08:48 UTC. The importer requests each month separately, follows pagination, deduplicates overlapping events and preserves the previous snapshot on validation failure. No ITF account or paid service is used. The globe website, coordinate lookup and sustained reliability remain to be implemented or validated; data reuse terms are separate from technical access.

Requires Node.js 22 or newer. No package installation is needed.

```sh
npm test
npm run probe
node sync-itf.mjs
```

`ITF_MONTH` selects YYYY-MM and `ITF_CIRCUIT` selects MT or WT. The probe makes one two-record request and writes response metadata to `reports/itf-probe.json`.

See [PLAN.md](PLAN.md) for verified findings and remaining website work.
