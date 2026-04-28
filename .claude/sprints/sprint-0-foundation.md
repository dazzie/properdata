# Sprint 0 — Foundation

**Goal**: Get the monorepo deployable, the database online, and the core skeleton in place so subsequent sprints can build features instead of scaffolding.

**Estimated time**: 2-3 days for a focused operator.

**Prerequisites**: Node.js 20+, pnpm 9+, a Neon account, an Anthropic API key, a Vercel account, a GitHub account.

---

## Task 0.1 — Install dependencies

```bash
pnpm install
```

**Success criteria**:
- `node_modules` populated in root and all packages
- No installation errors
- `pnpm typecheck` runs without errors (most files won't have content yet, but the type system should resolve)

---

## Task 0.2 — Set up Neon database

1. Create a project at https://console.neon.tech
2. Region: `eu-west-2` (London) for proximity to UK/Ireland users
3. Copy the connection string. Set as `DATABASE_URL` in `.env.local`
4. Also copy the direct (non-pooled) connection string. Set as `DIRECT_DATABASE_URL`
5. Enable extensions by running:
   ```bash
   psql $DIRECT_DATABASE_URL -f packages/db/migrations/0000_extensions.sql
   ```
6. Verify with:
   ```bash
   psql $DIRECT_DATABASE_URL -c "SELECT extname FROM pg_extension WHERE extname IN ('postgis', 'pgvector', 'citext', 'pg_trgm');"
   ```
   Expect 4 rows.

**Success criteria**: PostGIS, pgvector, citext, and pg_trgm extensions all installed in the Neon database.

---

## Task 0.3 — Generate and apply Drizzle migrations

```bash
pnpm --filter @properdata/db generate
```

This generates SQL migration files in `packages/db/migrations/`. Review them, then:

```bash
pnpm --filter @properdata/db migrate
```

Then apply the materialised view migration manually:

```bash
psql $DIRECT_DATABASE_URL -f packages/db/migrations/0001_town_metrics.sql
```

**Success criteria**:
- All tables exist in the database (verify with `\dt` in psql)
- `town_metrics` materialised view exists (verify with `\dm`)
- Spatial indexes exist on `towns.centroid`, `sales.location`, `planning_apps.location`

---

## Task 0.4 — Seed initial data

Create `packages/db/src/seed.ts` that populates:

1. **`towns` table** — initial 3 covered towns:
   - Mullingar (Westmeath) — centroid 53.5253, -7.3398
   - Athlone (Westmeath) — centroid 53.4239, -7.9407
   - Tullamore (Offaly) — centroid 53.2735, -7.4906

2. **`grant_schemes` table** — populate with the 15+ schemes documented in `docs/04-grant-layer.md`:
   - SEAI energy grants (10+ schemes)
   - Croí Cónaithe Vacant + Derelict
   - Help to Buy
   - First Home Scheme
   - Landlord retrofit deduction
   - Defective Concrete Blocks
   - Housing adaptation grants

Each grant scheme should populate the `eligibility_rules` jsonb column with structured eligibility logic the Grant Calculator agent can read.

**Run**:
```bash
pnpm --filter @properdata/db seed
```

**Success criteria**:
- 3 rows in `towns`
- 15+ rows in `grant_schemes` with realistic eligibility rules
- `SELECT name, max_amount FROM grant_schemes ORDER BY max_amount DESC` returns sensible data

---

## Task 0.5 — Deploy Next.js app to Vercel

1. Push the repo to GitHub (private, your account)
2. Create a new Vercel project, import the GitHub repo
3. Vercel auto-detects Next.js. Configure:
   - Root directory: `apps/web`
   - Build command: `pnpm turbo run build --filter=@properdata/web`
   - Install command: `pnpm install --frozen-lockfile`
4. Add environment variables in Vercel dashboard from `.env.example`:
   - `DATABASE_URL` (Neon connection)
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET` (generate with `openssl rand -hex 32`)
5. Deploy

**Success criteria**:
- Deployment succeeds
- `https://<your-project>.vercel.app/api/health` returns `{"status": "ok", ...}`
- The home page renders the placeholder ProperData landing

---

## Task 0.6 — Set up Sentry error monitoring

1. Create a project at https://sentry.io (free tier)
2. Add `@sentry/nextjs` initialization to `apps/web/instrumentation.ts`
3. Add `SENTRY_DSN` to Vercel environment variables
4. Test by throwing an error in a route and verifying it appears in Sentry

**Success criteria**: A test error in the deployed app appears in the Sentry dashboard.

---

## Task 0.7 — Verify cron secret works

Locally:
```bash
curl http://localhost:3000/api/cron/ppr-ingest
# Expect: 401 Unauthorized

curl http://localhost:3000/api/cron/ppr-ingest \
  -H "Authorization: Bearer $CRON_SECRET"
# Expect: 200 with placeholder response
```

In production (Vercel):
- Manually trigger the cron from the Vercel dashboard (Crons tab)
- Check the function logs — should return 200 with the placeholder result

**Success criteria**: Authentication works locally and in production. Vercel cron successfully invokes the endpoint.

---

## Done when

- [ ] `pnpm dev` runs the web app at localhost:3000
- [ ] `pnpm typecheck` passes across all packages
- [ ] Neon database has all extensions, tables, and the town_metrics materialised view
- [ ] `towns` and `grant_schemes` are seeded with initial data
- [ ] App is deployed to Vercel with a custom domain pointed at it (properdata.ie if available)
- [ ] Sentry is capturing errors
- [ ] Cron auth works in both dev and production

Once complete, move to `sprint-1-ppr-pipeline.md`.
