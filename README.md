# ProperData

> Property intelligence, properly verified.

Irish property analytics built on verified public data and AI agents. See `docs/01-master-summary.md` for the full product overview.

## Quick start

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env.local
# Fill in DATABASE_URL (Neon) and ANTHROPIC_API_KEY at minimum

# Generate database
pnpm --filter @properdata/db generate
pnpm --filter @properdata/db migrate

# Run dev server
pnpm dev
```

The app runs at `http://localhost:3000`.

## Project status

Sprint 0 (Foundation). See `.claude/sprints/` for current and upcoming work.

## Working with Claude Code

This project is set up for Claude Code. Run `claude` in this directory to get started — it will read `CLAUDE.md` for context.

The current sprint is in `.claude/sprints/sprint-0-foundation.md`. Each sprint has a checklist of atomic tasks Claude Code can pick up.

## Documentation

All planning documents are in `docs/`:

- `01-master-summary.md` — what we're building and why
- `03-solo-architecture.md` — technical architecture and infrastructure
- `06-business-milestones.md` — SaaS metrics and targets
- See `CLAUDE.md` for the complete documentation index

## Repository structure

- `apps/web/` — Next.js application (web + API + cron)
- `packages/db/` — Database schema and queries (Drizzle + PostGIS)
- `packages/agents/` — AI agent implementations and prompts
- `packages/scrapers/` — Data ingestion pipelines
- `packages/shared/` — Shared types and utilities

## Compliance

This product processes Irish property data under GDPR. See `docs/05-compliance.md` before adding any new data source or processing activity.
