# Tasks

The running to-do list. Top of the file is highest priority. Tasks are checked `[x]` when complete and `[blocked]` with a reason when stuck.

**Now working on:** Sprint 0 — Task 0.5 (deploy to Vercel)

**Last updated:** 2026-04-27

---

## Sprint 0 — Foundation

See `.claude/sprints/sprint-0-foundation.md` for full task detail and success criteria.

- [x] 0.1 — Run `pnpm install`; verify `pnpm typecheck` passes
- [x] 0.2 — Create Neon project (eu-west-2); enable PostGIS, pgvector, citext, pg_trgm
- [x] 0.3 — Run `pnpm --filter @properdata/db generate` then `migrate`; apply `0001_town_metrics.sql`
- [x] 0.4 — Implement `packages/db/src/seed.ts` with 3 towns + 15+ grant schemes
- [ ] 0.5 — Deploy to Vercel; verify `/api/health` returns 200
- [ ] 0.6 — Set up Sentry; verify a test error reports correctly
- [ ] 0.7 — Verify cron auth works locally and in production

---

## Sprint 1 — PPR Pipeline

See `.claude/sprints/sprint-1-ppr-pipeline.md`.

- [ ] 1.1 — Implement `downloadPprCsv()` (handle Windows-1252 encoding)
- [ ] 1.2 — Implement `parsePprCsv()` (papaparse with PPR quirks)
- [ ] 1.3 — Implement `computePprUid()` (SHA-256 of date|address|price)
- [ ] 1.4 — Implement `findNewRows()` (diff against existing `ppr_uid`)
- [ ] 1.5 — Wire up `normaliseSale()` agent batch processing
- [ ] 1.6 — Implement `insert with onConflictDoNothing()`
- [ ] 1.7 — Implement top-level `ingestPpr()` orchestration
- [ ] 1.8 — Wire to `/api/cron/ppr-ingest` route
- [ ] 1.9 — Implement `scripts/backfill-ppr.ts` and run historical backfill (CONFIRM BEFORE RUNNING)
- [ ] 1.10 — Refresh `town_metrics` and verify outputs sensibly

---

## Sprint 2 — Comparables and grants (web-facing analytics)

See `.claude/sprints/sprint-2-comparables.md`.

- [ ] 2.1 — Build PostGIS spatial query for candidate comparables
- [ ] 2.2 — Implement `comparableAnalysis()` agent function
- [ ] 2.3 — Implement `grantCalculator()` agent function
- [ ] 2.4 — Implement `yieldAnalysis()` agent function (uses RTB data)
- [ ] 2.5 — Wire up `/api/property/analyse` endpoint (authenticated)
- [ ] 2.6 — Add basic API response caching (Upstash)
- [ ] 2.7 — Write integration test with fixture property

---

## Sprint 3 — Content pipeline + Substack launch

See `docs/03-solo-architecture.md` § "Build sequence" Sprint 3.

- [ ] 3.1 — Implement `draftWeekly()` agent function
- [ ] 3.2 — Wire `/api/cron/weekly-pulse` to generate Sunday draft
- [ ] 3.3 — Implement chart rendering (Mapbox + Vega-Lite or chart-as-SVG)
- [ ] 3.4 — Set up Substack publication; configure Slack notification on draft ready
- [ ] 3.5 — Write 3 launch pieces:
  - "What Mullingar houses actually sold for"
  - "The asking price illusion"
  - "Ireland's hidden property hotspot"
- [ ] 3.6 — Set up Substack landing page with founding member pricing
- [ ] 3.7 — Configure subscribe form on properdata.ie

---

## Sprint 4+ — UX novelty additions

See `docs/08-ux-novelty-additions.md` for tier breakdown and implementation priority.

**Tier 1 (highest impact):**
- [ ] 4.1 — Ingest EPA Radon Risk Map; per-address risk lookup
- [ ] 4.2 — Ingest SEAI Solar Map / PVGIS data; per-property solar potential
- [ ] 4.3 — Walkability scoring via OpenStreetMap (15-min isochrones)
- [ ] 4.4 — DCB / Mica risk geography flagging

**Tier 2 (lifestyle):**
- [ ] 4.5 — EPA Strategic Noise Maps integration
- [ ] 4.6 — EPA Air Quality monitoring station data
- [ ] 4.7 — Met Éireann microclimate normals

**Tier 3 (investor / pro):**
- [ ] 4.8 — TII traffic counts integration
- [ ] 4.9 — CRO + RBO ownership cross-reference
- [ ] 4.10 — Light pollution / VIIRS data

---

## Backlog (no sprint assigned yet)

- [ ] BER ingestion pipeline (SEAI BER Research Tool, monthly cron)
- [ ] ePlanning portal scraping (per-council, Browserless-based)
- [ ] CSO StatBank ingestion (RPPI, transaction volumes)
- [ ] RTB Rent Index quarterly ingestion
- [ ] Anomaly detection across all metrics
- [ ] Regulatory monitor (page hash diffing)
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
