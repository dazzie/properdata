# Sprint 3 — Content Pipeline + Substack Launch

**Goal**: Automated weekly newsletter pipeline. Data flows from the database through the draft writer agent to a Substack-ready markdown draft. Three launch pieces establish the brand. Founding member sign-ups begin.

**Estimated time**: 8–10 days.

**Prerequisites**: Sprint 2 complete. `town_metrics` materialised view refreshing daily. At least 3 towns with sufficient PPR data for meaningful weekly commentary. Draft writer prompt exists (`packages/agents/prompts/draft-writer.md`).

---

## Task 3.1 — Implement `draftWeeklyPulse()` agent function

Add the typed wrapper to `packages/agents/src/index.ts`, following the same `runAgent()` pattern as the Sprint 2 agents.

```typescript
export interface WeeklyPulseInput {
  week_ending: string;
  towns: Array<{
    name: string;
    county: string;
    metrics: {
      median_price_12m: number | null;
      median_price_3m: number | null;
      yoy_change_pct: number | null;
      sales_count_90d: number;
    };
    notable_sales: Array<{
      address: string;  // street + town only, no house number
      price: number;
      date: string;
      property_type: string | null;
      is_new: boolean;
    }>;
  }>;
  grant_updates: string | null;
  regulatory_context: string | null;
}

export interface WeeklyPulseResult {
  markdown: string;
  suggested_subject: string;
  word_count: number;
  sections: string[];
}
```

The function:
1. Calls `runAgent({ promptName: 'draft-writer', model: 'sonnet', input, maxTokens: 4096 })`
2. Parses the markdown output (not JSON — this agent returns prose)
3. Extracts the subject line from the first `#` heading
4. Counts words
5. Returns the structured result

**Test**: With fixture town data for Mullingar, the agent returns 600–1,000 words of markdown with the correct sections (What sold, The number, etc.).

---

## Task 3.2 — Build weekly pulse data assembler

Create `packages/db/src/queries/weekly-pulse.ts` that assembles the `WeeklyPulseInput` from database state.

```typescript
export async function assembleWeeklyPulseData(
  weekEnding: string,
  townSlugs?: string[],
): Promise<WeeklyPulseInput>;
```

Logic:
- Query `town_metrics` for each active town (or specified slugs)
- Query `sales` for the past 7 days in each town (for `notable_sales`)
- Strip house numbers from addresses before returning (privacy)
- Query `grant_schemes` for any with `updated_at` in the past 7 days (for `grant_updates`)
- Default `townSlugs` to all active towns if not specified

**Test**: With real database, returns well-formed `WeeklyPulseInput` with town data populated.

---

## Task 3.3 — Wire `/api/cron/weekly-pulse` route

The cron entry already exists in `vercel.json` (Sundays 14:00 UTC). Build the handler at `apps/web/app/api/cron/weekly-pulse/route.ts`.

The handler:
1. Verifies `CRON_SECRET` auth (same pattern as `ppr-ingest` and `metrics-refresh`)
2. Calls `assembleWeeklyPulseData()` for the current week
3. Calls `draftWeeklyPulse()` with the assembled data
4. Stores the draft in the `events` table with `event_type: 'weekly_pulse_draft'` and the markdown + subject in the payload
5. Optionally sends a Slack notification (task 3.4) that the draft is ready for review
6. Returns success metadata

Runtime considerations:
- `maxDuration: 120` (Sonnet draft generation may take 20–30s)
- Log the word count and section list for observability

**Test**: Trigger locally via `curl http://localhost:3000/api/cron/weekly-pulse -H "Authorization: Bearer $CRON_SECRET"`. Verify the event is created and the markdown is readable.

---

## Task 3.4 — Slack notification on draft ready

When the weekly pulse draft is generated, notify the operator that it's ready for review.

Options (in order of simplicity):
1. **Slack incoming webhook** — simplest. Create a webhook URL for a `#properdata-drafts` channel. POST the subject line + word count + a link to review. No library needed, just a `fetch()` call.
2. **Email via Resend** — if Slack isn't set up yet, send an email to the operator.

Implementation:
- Add `SLACK_WEBHOOK_URL` to `.env.example`
- Create a small utility in `packages/shared/src/notify.ts`:
  ```typescript
  export async function notifyDraftReady(opts: {
    subject: string;
    wordCount: number;
    weekEnding: string;
  }): Promise<void>;
  ```
- Call it from the weekly-pulse cron handler after storing the draft
- Fail silently if the webhook URL isn't configured (don't break the cron)

**Test**: With webhook URL set, Slack message appears in channel. Without it, cron completes without error.

---

## Task 3.5 — Chart rendering pipeline

Generate static chart images for newsletter embedding. Use server-side SVG generation (no Python dependency — keep the stack Node-only for Vercel).

Approach: use **Vega-Lite** specs rendered to SVG via `vega` + `vega-lite` + `vega-node` (or the `canvas`-less SVG output mode).

Create `packages/agents/src/charts.ts`:

```typescript
export interface ChartSpec {
  type: 'price_trend' | 'town_comparison' | 'property_type_mix';
  title: string;
  caption: string;
  data: Record<string, unknown>[];
}

export async function renderChart(spec: ChartSpec): Promise<Buffer>;
```

Chart types for Phase 1:
1. **Price trend** — line chart of median price over last 12 months for a town
2. **Town comparison** — horizontal bar chart comparing median prices across covered towns
3. **Property type mix** — donut chart showing detached/semi/terraced/apartment split

Brand colours from the agentic architecture doc:
- Primary: `#1D9E75` (teal)
- Secondary: `#534AB7` (purple)
- Accent: `#D85A30` (coral)
- Neutral: `#888780` (grey)

Storage: upload rendered SVG/PNG to Cloudflare R2 (if configured) or serve from a Next.js API route as a fallback.

**Test**: Given fixture town metrics data, renders a price trend chart that is a valid SVG.

---

## Task 3.6 — Launch piece: "What Mullingar houses actually sold for"

Generate (with human editing) the first long-form Substack piece. This is a monthly deep-dive format, not a weekly pulse.

Content requirements:
- Query all PPR sales in Mullingar for the past 12 months
- Group by property type, show median prices, price range, notable sales
- Compare asking prices (if available from any public source) vs PPR sold prices
- Include 2–3 charts (price trend, property type mix, price distribution)
- 1,500–2,500 words
- Include the ProperData branding and disclaimer

Implementation:
- Create a one-off script `scripts/generate-launch-piece-1.ts` that:
  1. Assembles the data for Mullingar
  2. Calls the draft writer agent with a long-form prompt variant
  3. Renders accompanying charts
  4. Outputs the final markdown + chart file paths
- The operator reviews, edits, and publishes manually to Substack

**Test**: Script runs and produces a coherent markdown file + chart files.

---

## Task 3.7 — Launch piece: "The asking price illusion"

Second launch piece. An analysis piece showing the gap between asking prices and PPR sold prices.

Content requirements:
- National or Midlands-focused analysis
- Use PPR data to show median sold prices by county and property type
- Frame around the common buyer experience of relying on asking prices
- Show how ProperData's PPR-based analysis gives a more accurate picture
- Include chart: scatter or bar showing asking vs sold gap by town (data permitting)
- 1,000–1,500 words

Implementation: same script pattern as 3.6, with a different data assembly and prompt.

**Test**: Script runs and produces coherent markdown.

---

## Task 3.8 — Launch piece: "Ireland's hidden property hotspot"

Third launch piece. A data-driven story about an undervalued town based on cross-referencing PPR prices, yield potential, and grant stacking opportunities.

Content requirements:
- Pick the town from the data that shows the most interesting combination of: low median price, decent yield (if RTB data exists), high grant eligibility, and reasonable sales volume
- Show how grant stacking (e.g., Croí Cónaithe + SEAI) can reduce effective acquisition cost by 15–25%
- Include comparable analysis from the Sprint 2 agents
- Include chart: effective cost after grants vs purchase price
- 1,000–1,500 words

Implementation: same script pattern as 3.6 and 3.7.

**Test**: Script runs and produces coherent markdown.

---

## Task 3.9 — Substack publication setup

Manual/semi-automated setup tasks (operator-driven, Claude assists with configuration):

1. Create the Substack publication at `properdata.substack.com`
2. Configure branding: name ("ProperData"), tagline, logo, brand colours
3. Set up custom domain `properdata.ie` → Substack (if domain is confirmed)
4. Configure founding member pricing (€89/year or €9/month per `docs/07-gtm-pricing.md`)
5. Create the "About" page with the ProperData positioning
6. Configure the subscribe form embed code for `properdata.ie`
7. Publish the three launch pieces in sequence (1 per day or every 2 days)

This task is mostly human-driven. Claude can:
- Generate the About page copy
- Generate the subscribe form embed snippet for the Next.js landing page
- Draft the founding member welcome email

**Done when**: Publication is live, 3 pieces published, subscribe form works on the web app.

---

## Task 3.10 — Landing page subscribe form

Add a subscribe section to the web app landing page (`apps/web/app/page.tsx`).

Requirements:
- Email capture form that posts to the Substack subscribe endpoint (or stores in `subscribers` table for later connection)
- Brief value proposition copy above the form
- Mobile-responsive
- No auth required — this is a pre-paywall lead capture

Implementation:
- Add a `<section>` to the existing landing page
- Use a server action or API route to handle the form submission
- Store the email in the `subscribers` table with `tier: 'free'`, `status: 'active'`
- If `SUBSTACK_PUBLICATION_URL` is set, also POST to the Substack subscribe API

**Test**: Form renders, submission creates a subscriber record.

---

## Done when

- [ ] `draftWeeklyPulse()` agent produces well-formed newsletter markdown
- [ ] Weekly pulse cron assembles data and generates a draft automatically
- [ ] Draft is stored in the events table for review
- [ ] Slack/email notification fires when draft is ready
- [ ] At least one chart type renders correctly
- [ ] Three launch pieces are generated (human review before publishing)
- [ ] Substack publication is live with founding member pricing
- [ ] Landing page has a working subscribe form
- [ ] End-to-end: metrics refresh (06:00) → weekly pulse (14:00) → draft ready notification → human review → publish

Once complete, move to Sprint 4 (planning, BER, enrichment — see `docs/03-solo-architecture.md` § Sprint 4).
