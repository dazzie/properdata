# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# ProperData

AI-powered Irish property intelligence built entirely on verified public data. Cross-references 20+ government data sources (PPR, RTB, SEAI BER, OPW flood maps, ePlanning, Census, RZLT maps, PSRA registers, EPA radon/noise/air, and 15+ grant schemes) into personalised intelligence for buyers, investors, and property professionals. Solo-operator architecture; cloud-first; serverless wherever possible.

## Status

**Sprint 0** (Foundation). See `.claude/sprints/sprint-0-foundation.md` for current work.

After Sprint 0, work proceeds through Sprints 1-7 in `.claude/sprints/`.

## How to drive development

This project is set up for an autonomous Claude Code loop. Two files orchestrate it:

- **`AGENTIC.md`** — the operation guide. Read this first. Explains the loop, conventions, and when to pause for confirmation.
- **`TASKS.md`** — the running task list with the current work pointer. Update this as tasks are completed.

Sub-agents in `.claude/agents/` review specific kinds of changes:
- `data-source-validator` — verifies new data sources are on the public-data approved list
- `compliance-reviewer` — checks subscriber-facing outputs for GDPR/AI Act/financial-advice compliance
- `prompt-engineer` — reviews changes to agent prompts in `packages/agents/prompts/`
- `schema-reviewer` — reviews database schema and migration changes
- `cost-watcher` — flags cost implications of new dependencies and AI usage

## The non-negotiable rule

**No scraping of Daft, MyHome, or any commercial property listing site, ever.** This is a compliance requirement, not a preference. Every data source in this product must be one of:

1. A statutory public register (PPR, PSRA registers, Tailte Éireann, RTB)
2. Government open data (CSO, SEAI BER, OPW, EPA, RZLT maps)
3. EU INSPIRE Directive open data (radon, noise, air quality)
4. A commercially licensed dataset (GeoDirectory, Eircode/Autoaddress)

If asked to add a data source, verify it falls into one of these categories before writing any ingestion code. The "verified public data" positioning is both the marketing strategy and the legal moat.

See `docs/05-compliance.md` for full GDPR, EU AI Act, and financial advice regulation notes.

## Architecture at a glance

- **Database**: Neon Postgres (serverless, scale-to-zero) with PostGIS + pgvector extensions
- **App + API**: Next.js 15 on Vercel (serverless functions, edge where useful)
- **Cron / orchestration**: Vercel Cron for Phase 1 → n8n Cloud for Phase 2 if needed
- **AI**: Anthropic API. Haiku for normalisation/classification/orchestration; Sonnet for analysis/drafting
- **Auth**: Clerk (Phase 3 onwards)
- **Cache**: Upstash Redis (free tier)
- **Storage**: Cloudflare R2 (PDFs, charts, exports)
- **Newsletter**: Substack (Phase 1-2) → Resend (Phase 3)
- **Scraping** (planning portals only): Browserless.io
- **Monitoring**: Sentry + Vercel Analytics
- **Monorepo**: Turborepo + pnpm workspaces

Phase 1 infrastructure cost target: ~$15/month total. Break-even at 8 paid subscribers.

Full architecture rationale: `docs/03-solo-architecture.md`.

## Repository structure

```
properdata/
├── apps/
│   └── web/                       # Next.js app (web + API + cron jobs)
│       └── app/api/cron/          # Vercel cron handlers
├── packages/
│   ├── db/                        # Drizzle schema + queries (PostGIS)
│   ├── agents/                    # AI agent implementations
│   │   ├── src/                   # TypeScript agent code
│   │   └── prompts/               # System prompts as markdown
│   ├── scrapers/                  # Data ingestion (PPR, BER, ePlanning, etc.)
│   └── shared/                    # Shared types and utilities
├── docs/                          # Planning documents (read these for context)
├── .claude/
│   └── sprints/                   # Sprint task lists for Claude Code
└── scripts/                       # One-off scripts and seeders
```

## Documentation in `docs/`

When you need context on *why* a decision was made or *what* the product is supposed to do, read these:

- `01-master-summary.md` — Product overview, complete data inventory, full feature list
- `02-personas.md` — 10 user personas with sizing, willingness-to-pay, lifecycle
- `03-solo-architecture.md` — Cloud architecture, build sequence, costs by phase
- `04-grant-layer.md` — All 15+ grant schemes, stacking rules, eligibility logic
- `05-compliance.md` — GDPR, EU AI Act, financial advice boundary, copyright
- `06-business-milestones.md` — SaaS metrics, go/no-go gates, revenue targets
- `07-gtm-pricing.md` — Pricing tiers, GTM phases, channel strategy
- `08-ux-novelty-additions.md` — Tier 1-3 data source enrichments (radon, solar, walkability, etc.)
- `09-agentic-architecture.md` — Original detailed agent architecture
- `10-agentic-capabilities.md` — Semantic search, proactive intelligence, MCP plans

## Key environment variables

See `.env.example` for the full list. The minimum to run anything locally:

```
DATABASE_URL                       # Neon Postgres connection string
ANTHROPIC_API_KEY                  # Claude API access
```

For full functionality also: `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `SENTRY_DSN`, `UPSTASH_REDIS_URL`, `BROWSERLESS_TOKEN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.

## Common commands

```bash
pnpm install                              # Install all workspace dependencies
pnpm dev                                  # Run web app + all packages (localhost:3000)
pnpm build                                # Production build
pnpm typecheck                            # Type-check entire monorepo
pnpm lint                                 # ESLint (Next.js)
pnpm format                               # Prettier format all files

# Database (shortcuts for pnpm --filter @properdata/db <script>)
pnpm db:generate                          # Generate migration from schema changes
pnpm db:migrate                           # Apply migrations to DATABASE_URL
pnpm db:studio                            # Open Drizzle Studio (interactive DB browser)
pnpm db:seed                              # Seed towns + grant schemes

# Test a cron endpoint locally
curl http://localhost:3000/api/cron/ppr-ingest -H "Authorization: Bearer $CRON_SECRET"
```

Requires Node >=20 and pnpm >=9.

## Coding conventions

- **TypeScript strict mode** is non-negotiable. No `any`, no `// @ts-ignore` without a comment explaining why. `noUncheckedIndexedAccess` is enabled — always handle `undefined` when indexing arrays/objects.
- **Prettier** enforces: single quotes, semicolons, trailing commas, 100-char line width, 2-space indent.
- **Drizzle ORM** for all database access. No raw SQL except for PostGIS spatial queries that Drizzle can't express, and those go in `packages/db/src/queries/` with clear naming.
- **Server-only code** uses `import 'server-only'` to prevent accidental client bundling.
- **No client-side database access**. Ever. All DB queries go through `/api/` routes or Server Components.
- **Errors are logged to Sentry** in production. In development, throw and let it propagate.
- **Cron handlers** verify `Authorization: Bearer ${process.env.CRON_SECRET}` before doing anything. This prevents external triggering.
- **All AI calls** go through `packages/agents/`. Don't call the Anthropic SDK directly from API routes.
- **Costs matter.** Default to Haiku. Only escalate to Sonnet when the task genuinely requires it (multi-step reasoning, narrative generation, complex analysis). Each agent's model choice is documented in its prompt file.

## AI agents

Agent system prompts live in `packages/agents/prompts/` as markdown files. The TypeScript implementations in `packages/agents/src/` import the prompts as strings and wrap them with the Anthropic SDK.

**To add or modify an agent:**
1. Edit the markdown prompt in `packages/agents/prompts/`
2. Run the agent's eval suite (when one exists) to verify behavior
3. Commit the prompt change with a clear message describing the behavioral change

**Existing agents:**
- `normalise-sales` (Haiku) — cleans raw PPR records, extracts town/county
- `comparable-analysis` (Sonnet) — finds and ranks property comparables, generates narrative
- `grant-calculator` (Sonnet) — computes total grant package per property with stacking rules
- `yield-analysis` (Sonnet) — verified yield using RTB rents + full cost model
- `planning-parser` (Haiku) — extracts structured data from ePlanning HTML
- `anomaly-detector` (Haiku) — flags statistically unusual market signals
- `regulatory-monitor` (Haiku) — detects policy/grant changes from government pages
- `draft-writer` (Sonnet) — generates weekly newsletter content from data

## Compliance reminders

These appear elsewhere but bear repeating because they affect code:

1. **Property analysis is not financial advice.** Every analysis output must include the disclaimer from `packages/shared/src/disclaimers.ts`. The subscriber agent's system prompt has hard guardrails — don't weaken them.
2. **GDPR**: PPR addresses are personal data. The lawful basis is legitimate interest (public register data, processed for research/journalistic purposes). Document any new processing activity in the ROPA.
3. **AI Act transparency**: Any AI-generated subscriber-facing content must be flagged as such. Footer notice on newsletters, inline notice on AI analyst chat.
4. **Copyright**: Never reproduce more than ~15 words from any source verbatim. Paraphrase. Cite the source.

## When working on this project

- Default to public data sources from the approved list. If a new source is needed, verify the licence first.
- Keep infrastructure cost in mind. We have a $15/month target for Phase 1. Adding a new SaaS service requires justification.
- The architecture is optimised for a solo operator. Don't introduce complexity (microservices, separate deploy targets, custom infrastructure) without clear necessity.
- The product's defensibility is in the cross-source intelligence, not in any single feature. Strengthening the agents and the spatial database matters more than adding UI polish.

If you're unsure whether something fits the product's strategy, the answer is in `docs/01-master-summary.md`. If you're unsure about a technical decision, the answer is in `docs/03-solo-architecture.md`. If both are silent, ask.
