# ITF calendar feasibility

Prototype for a worldwide ITF tournament globe with filters and a $0 operating budget.

**Hosted access test passed on 18 September 2026.** Both men's and women's calendar requests returned JSON from GitHub's standard Ubuntu runners, without ITF accounts, cookies or paid data services.

| September 2026 | Records fetched in test | Total reported by ITF |
| --- | ---: | ---: |
| Men's World Tennis Tour | 2 | 72 |
| Women's World Tennis Tour | 2 | 65 |

[View the successful workflow run](https://github.com/omarbizid/itf-calendar-feasibility/actions/runs/35355077313).

All seven validation tests passed in both jobs. This is a small access test, not a completed importer or website. Daily updates are not enabled. Full pagination, API field values, coordinate lookup and sustained reliability still need validation; data reuse terms are separate from technical access.

Requires Node.js 22 or newer. No package installation is needed.

```sh
npm test
npm run probe
```

`ITF_MONTH` selects YYYY-MM and `ITF_CIRCUIT` selects MT or WT. The probe makes one two-record request and writes response metadata to `reports/itf-probe.json`.

See [PLAN.md](PLAN.md) for verified findings and the proposed daily update design.
