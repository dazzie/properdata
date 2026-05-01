# Tasks

The running to-do list. Top of the file is highest priority. Tasks are checked `[x]` when complete and `[blocked]` with a reason when stuck.

**Now working on:** Sprint 4 — Data Enrichment: BER, RTB, Anomalies

**Last updated:** 2026-04-30

---

## Sprint 0 — Foundation

See `.claude/sprints/sprint-0-foundation.md` for full task detail and success criteria.

- [x] 0.1 — Run `pnpm install`; verify `pnpm typecheck` passes
- [x] 0.2 — Create Neon project (eu-west-2); enable PostGIS, pgvector, citext, pg_trgm
- [x] 0.3 — Run `pnpm --filter @properdata/db generate` then `migrate`; apply `0001_town_metrics.sql`
- [x] 0.4 — Implement `packages/db/src/seed.ts` with 3 towns + 15+ grant schemes
- [x] 0.5 — Deploy to Vercel; verify `/api/health` returns 200
- [x] 0.6 — Set up Sentry; verify a test error reports correctly
- [x] 0.7 — Verify cron auth works locally and in production

---

## Sprint 1 — PPR Pipeline *(complete)*

See `.claude/sprints/sprint-1-ppr-pipeline.md`.

- [x] 1.1 — Implement `downloadPprCsv()` (handle Windows-1252 encoding)
- [x] 1.2 — Implement `parsePprCsv()` (papaparse with PPR quirks)
- [x] 1.3 — Implement `computePprUid()` (SHA-256 of date|address|price)
- [x] 1.4 — Implement `findNewRows()` (diff against existing `ppr_uid`)
- [x] 1.5 — Wire up `normaliseSale()` agent batch processing
- [x] 1.6 — Implement `insert with onConflictDoNothing()`
- [x] 1.7 — Implement top-level `ingestPpr()` orchestration
- [x] 1.8 — Wire to `/api/cron/ppr-ingest` route
- [x] 1.9 — Run historical backfill (~773k rows ingested; AI normalisation ~99.7%+)
- [x] 1.10 — Verify data outputs (county stats, year trends, median prices all sensible)
- [x] 1.10b — Refresh `town_metrics` materialized view (Neon upgraded; refresh applied)

---

## Sprint 2 — Comparables and grants (web-facing analytics)

See `.claude/sprints/sprint-2-comparables.md`.

- [x] 2.1 — Build PostGIS spatial query for candidate comparables
- [x] 2.2 — Implement `comparableAnalysis()` agent function
- [x] 2.3 — Implement `grantCalculator()` agent function
- [x] 2.4 — Implement `yieldAnalysis()` agent function (uses RTB data)
- [x] 2.5 — Wire up `/api/property/analyse` endpoint
- [x] 2.6 — Add basic API response caching (Upstash Redis, 24h TTL)
- [x] 2.7 — Write integration test with fixture property (15 tests, vitest)

---

## Sprint 3 — Content pipeline + Substack launch

See `.claude/sprints/sprint-3-content-pipeline.md`.

- [x] 3.1 — Implement `draftWeeklyPulse()` agent function (Sonnet, markdown output)
- [x] 3.2 — Build weekly pulse data assembler (`assembleWeeklyPulseData()`)
- [x] 3.3 — Wire `/api/cron/weekly-pulse` route (assemble → draft → store → notify)
- [x] 3.4 — Slack notification on draft ready (incoming webhook)
- [x] 3.5 — Chart rendering pipeline (Vega-Lite SVG, brand colours, 3 chart types)
- [x] 3.6–3.8 — Launch piece generator script (`scripts/generate-launch-piece.ts 1|2|3`)
- [x] 3.9 — Substack publication setup (assets generated: about page, welcome email, checklist)
- [x] 3.10 — Landing page subscribe form (email capture → subscribers table)

---

## Sprint 4 — Data Enrichment: BER, RTB, Anomalies

See `.claude/sprints/sprint-4-data-enrichment.md`.

- [x] 4.1 — BER data ingestion pipeline (SEAI BER Research Tool, monthly cron)
- [x] 4.2 — BER premium analysis query (cross-reference BER ratings with PPR sales)
- [x] 4.3 — RTB Rent Index ingestion (quarterly data → `rtb_rents` table)
- [x] 4.4 — Regulatory monitor cron (page hash diffing, Regulatory Monitor Agent)
- [x] 4.5 — Anomaly detector agent + weekly cron
- [x] 4.6 — Expand coverage to 6 towns (add Longford, Portlaoise, Carrick-on-Shannon)
- [x] 4.7 — Enrich weekly pulse with BER, anomaly, and regulatory data

---

## Sprint 5+ — UX novelty additions

See `docs/08-ux-novelty-additions.md` for tier breakdown and implementation priority.

**Tier 1 (highest impact):**
- [ ] 5.1 — Ingest EPA Radon Risk Map; per-address risk lookup
- [ ] 5.2 — Ingest SEAI Solar Map / PVGIS data; per-property solar potential
- [ ] 5.3 — Walkability scoring via OpenStreetMap (15-min isochrones)
- [ ] 5.4 — DCB / Mica risk geography flagging

**Tier 2 (lifestyle):**
- [ ] 5.5 — EPA Strategic Noise Maps integration
- [ ] 5.6 — EPA Air Quality monitoring station data
- [ ] 5.7 — Met Éireann microclimate normals

**Tier 3 (investor / pro):**
- [ ] 5.8 — TII traffic counts integration
- [ ] 5.9 — CRO + RBO ownership cross-reference
- [ ] 5.10 — Light pollution / VIIRS data

---

## Backlog (no sprint assigned yet)

- [ ] ePlanning portal scraping (per-council, Browserless-based)
- [ ] CSO StatBank ingestion (RPPI, transaction volumes)
- [ ] Stripe billing integration (Phase 3, when moving off Substack)
- [ ] Clerk auth integration (Phase 3)
- [ ] MCP server for property intelligence (per docs/10-agentic-capabilities.md)
- [ ] UK Land Registry pipeline (international expansion Phase 4)

---

## Decisions needed (from human operator)

- [ ] Confirm domain: properdata.ie? Alternative?
- [ ] Confirm Neon region: eu-west-2 (London) or eu-central-1 (Frankfurt)?
- [ ] Confirm initial covered towns: Mullingar / Athlone / Tullamore — or expand to include Mullingar / Longford / Carrick-on-Shannon for Midlands focus?
- [ ] Trademark filing timing — before launch or after Month 6?
- [ ] Limited company formation — solicitor preference?

---

## Completed

(Items move here when checked off and at least one commit references them.)

- **Sprint 1 — PPR pipeline:** national PPR ingest, agent normalisation, verification, `town_metrics` refresh on upgraded Neon (~700MB DB). Sprint closed 2026-04-28.
- **Sprint 2 — Comparables and grants:** PostGIS comparable query, `comparableAnalysis()` + `grantCalculator()` + `yieldAnalysis()` agent wrappers, `/api/property/analyse` orchestrating endpoint, Upstash Redis caching (24h TTL), 15-test vitest integration suite. Sprint closed 2026-04-30.
- **Sprint 3 — Content pipeline + Substack launch:** `draftWeeklyPulse()` agent, `assembleWeeklyPulseData()` query, `/api/cron/weekly-pulse` route, Slack notifications, Vega-Lite chart rendering (3 chart types), launch piece generator (3 pieces drafted), Substack setup assets, landing page subscribe form. Sprint closed 2026-04-30.
