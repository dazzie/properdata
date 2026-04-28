# Agentic operation guide

This document explains how to drive ProperData development as an autonomous Claude Code loop. Read this once at the start of a session; the rest of the project is structured to be self-driving from there.

## The loop

```
   ┌──────────────────────────────────────────────────────────────┐
   │                                                              │
   │   1. Read TASKS.md → find next [ ] task                      │
   │   2. Read the linked sprint file for full context            │
   │   3. Implement the task                                      │
   │   4. Run: pnpm typecheck && pnpm test (when tests exist)     │
   │   5. If green: commit with conventional message              │
   │   6. Mark [x] in TASKS.md, update "Now working on:" pointer  │
   │   7. Go to 1                                                 │
   │                                                              │
   └──────────────────────────────────────────────────────────────┘
```

Tasks are sized to take **5-30 minutes each**. A task that takes longer should be split before starting. A task that takes less than 5 minutes is probably a sub-step of something larger — group it.

## How to start a session

Open this directory and run:

```bash
claude
```

Then prompt:

```
Read AGENTIC.md, CLAUDE.md, and TASKS.md. Show me the next 3 tasks in priority order
and tell me which you'd start with and why.
```

Once you're aligned on the next task, say:

```
Go.
```

Claude Code will work autonomously through the task. After each task it will:
- Update TASKS.md
- Run typecheck and tests
- Commit (if you've enabled auto-commit)
- Pause for the next "Go" or proceed if you've used `--auto-accept`

## Conventions Claude Code must follow

These are enforced by the sub-agents in `.claude/agents/` — they trigger on the relevant changes.

**Code conventions** (see `CLAUDE.md` for full list):
- TypeScript strict, no `any` without justification
- Drizzle ORM for DB access (no raw SQL except spatial queries)
- AI calls go through `packages/agents/`, never direct from API routes
- Server-only code uses `import 'server-only'`
- All cron handlers verify `Authorization: Bearer ${CRON_SECRET}`

**Compliance non-negotiables**:
- No scraping of Daft, MyHome, or commercial property listing sites — ever
- New data sources must be on the approved public-data list (see `docs/01-master-summary.md`)
- Subscriber-facing analytical content includes the relevant disclaimer from `packages/shared/src/disclaimers.ts`
- No financial advice — always "the data suggests" / "the comparables indicate", never "you should buy"
- No reproducing >15 words from any single source verbatim

**Commit conventions**:
- `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`
- One task per commit. Don't bundle.
- Reference the task ID: `feat: implement PPR CSV download (T1.1)`

## Sub-agents available

Claude Code sub-agents live in `.claude/agents/`. They are auto-invoked by Claude Code on relevant changes, or you can summon one explicitly:

```
> Use the data-source-validator to check if I can add the EPA radon map.
```

| Sub-agent | When it triggers |
|---|---|
| `data-source-validator` | Adding a new data source. Verifies licence + listing-site rule. |
| `compliance-reviewer` | Subscriber-facing analytical output, agent prompts, public content. |
| `prompt-engineer` | Edits to files in `packages/agents/prompts/`. |
| `schema-reviewer` | Edits to `packages/db/src/schema.ts` or migrations. |
| `cost-watcher` | New SaaS service, new AI call pattern, new cron job. |

## When Claude Code should pause and ask

The loop is autonomous **except** for these gates, which require explicit human confirmation:

1. **Adding a new SaaS dependency** (paid or free). Check `cost-watcher`.
2. **Adding a new data source.** Even if it appears in the approved list — ambiguity here is expensive.
3. **Modifying disclaimers** in `packages/shared/src/disclaimers.ts`.
4. **Modifying the listing-site prohibition** in CLAUDE.md or this file. (Do not.)
5. **Database schema changes that drop columns or tables.** Additive changes are fine; destructive ones need confirmation.
6. **Running the full PPR backfill** (`scripts/backfill-ppr.ts`) — this is a 20-40 minute operation that hits the live PPR site.
7. **Production deployments.** Vercel previews are fine; promoting to production requires confirmation.

Claude Code should explicitly say "Pausing for confirmation: [reason]" and wait for a green light.

## How to add a new sprint

When the current sprint is complete:

```
> Read sprint-N.md and the completed work. Generate sprint-(N+1).md based on the
  remaining tasks in docs/03-solo-architecture.md, sized appropriately for solo work.
  Use the same structure as existing sprint files.
```

The `sprint-planner` workflow (informal — there's no dedicated sub-agent yet) reads the architecture doc and produces the next set of atomic tasks.

## How to handle blockers

If Claude Code encounters something it cannot resolve in the current task:

1. **Don't power through with workarounds** — that's how technical debt accrues silently.
2. Mark the task `[blocked]` in TASKS.md with a one-line reason.
3. Log a `BLOCKER:` comment in the relevant code file with what was needed.
4. Move to the next task.
5. Surface the blocker in your next status update to the human operator.

Blockers usually fall into one of three categories:
- **External**: API key needed, external service down, data not yet published. Action: human acquires the resource.
- **Architectural**: a decision is needed that affects multiple downstream tasks. Action: read the architecture doc; if still unclear, escalate.
- **Compliance**: doing the obvious thing would violate a rule. Action: invoke `compliance-reviewer`; if still unclear, escalate.

## What "done" looks like

A task is done when:
- [ ] Code is implemented to spec
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes (where tests exist for this module)
- [ ] Code is committed with a conventional message
- [ ] TASKS.md reflects the new state
- [ ] The success criteria in the sprint file are met

A sprint is done when all its tasks are checked off and the sprint's "Done when" checklist is satisfied.

## Notes for the human operator

- **Watch the first task closely.** Once you've seen Claude Code complete one task correctly, the rest of the sprint is usually safe to autopilot.
- **Auto-accept mode is fine for green-field code.** It is not fine for migrations, deployments, or anything in `packages/shared/src/disclaimers.ts`.
- **The agent prompts in `packages/agents/prompts/` are the product's IP.** Edit them carefully and review every change.
- **The architecture doc (`docs/03-solo-architecture.md`) is the source of truth for stack decisions.** If Claude Code wants to introduce something not in there, it should explicitly justify why.
