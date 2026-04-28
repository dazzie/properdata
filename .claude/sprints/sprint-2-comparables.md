# Sprint 2 — Comparables, Grants, and Yield

**Goal**: First analytical outputs flowing. Given a property (address or coordinates), produce a comparable analysis, a grant package, and a yield estimate. These are the analyses that drive all subscriber-facing intelligence.

**Estimated time**: 5-7 days.

**Prerequisites**: Sprint 1 complete. PPR data loaded. RTB Rent Index data loaded (subset is fine for now — quarterly county-level). Grant schemes seeded.

---

## Task 2.1 — PostGIS comparable candidate query

Build a Drizzle/SQL query in `packages/db/src/queries/comparables.ts` that takes a target property and returns 20-30 candidate comparable sales for the agent to analyse.

```typescript
export async function findComparableCandidates(target: {
  location: { lng: number; lat: number };
  propertyType?: PropertyType;
  maxRadiusMeters?: number;
  maxAgeMonths?: number;
}): Promise<ComparableCandidate[]>;
```

Logic:
- Use `ST_DWithin(location::geography, target::geography, radius_meters)` for spatial filter
- Default radius: 1500m (urban) or 5000m (rural) — detect from town_metrics density
- Default age: 18 months
- Filter by `property_type` if provided (match exactly, or fall back to similar types — semi/terrace are interchangeable)
- Order by `ST_Distance(location, target) + (months_old * weight)` so nearby + recent rank highest
- Limit to 30 candidates (the agent will narrow further)

**Test**: Given Mullingar coordinates, query returns 20-30 sales clustered around that point.

---

## Task 2.2 — Implement `comparableAnalysis()` agent function

Wire up `runAgent()` with the `comparable-analysis` prompt.

```typescript
export async function comparableAnalysis(input: {
  target: PropertyAttributes;
  candidates: ComparableCandidate[];
}): Promise<ComparableAnalysisResult>;
```

The function:
1. Calls `runAgent({ promptName: 'comparable-analysis', model: 'sonnet', expectJson: true, input: JSON.stringify(input) })`
2. Validates the response shape (Zod schema)
3. Returns the typed result

**Test**: With known fixture inputs (a property and 20 candidates), the agent returns a fair value range that makes statistical sense (within ±10% of the median candidate price for high-confidence cases).

---

## Task 2.3 — Implement `grantCalculator()` agent function

Wire up `runAgent()` with the `grant-calculator` prompt.

```typescript
export async function grantCalculator(input: {
  property: PropertyAttributes;
  buyer: BuyerContext;
}): Promise<GrantCalculationResult>;
```

The function:
1. Loads active grant schemes from the database (cache in Upstash for 1 hour)
2. Passes them in the agent input alongside the property and buyer context
3. Calls `runAgent` with the grant-calculator prompt
4. Validates response

**Test**: For a vacant property scenario in Mullingar, FTB buyer, BER D2:
- Should return Croí Cónaithe Vacant Grant as `definite`
- Should exclude HTB (mutual exclusivity with Croí Cónaithe Vacant)
- Should include applicable SEAI grants as `probable` (subject to BER assessment)
- Total should be in the €60K-€73K range

---

## Task 2.4 — Implement `yieldAnalysis()` agent function

Wire up `runAgent()` with the `yield-analysis` prompt.

Critically: query the `rtb_rents` table for the relevant county/property type/quarter and provide that to the agent. **Never let the agent invent rent figures.**

```typescript
export async function yieldAnalysis(input: {
  property: PropertyAttributes;
  rentBenchmark: RentBenchmark;  // from rtb_rents query
  costAssumptions?: Partial<CostAssumptions>;  // override defaults
  buyer: BuyerContext;
}): Promise<YieldAnalysisResult>;
```

**Test**: For a €310K 3-bed semi in Westmeath at default cost assumptions:
- Agent should return gross yield ~6%, net yield 3-4%, after-tax yield 2-3%
- Cost breakdown should be itemised
- Disclaimer must be present in narrative

---

## Task 2.5 — `/api/property/analyse` endpoint

Public endpoint (rate-limited) that runs all three analyses for a given input.

```typescript
POST /api/property/analyse
{
  "address": "string" | { "lat": number, "lng": number },
  "propertyType"?: "semi_detached" | ...,
  "bedrooms"?: number,
  "purchasePrice": number,
  "buyer": { "buyerType": "first_time_buyer", ... }
}
```

Response:
```typescript
{
  "comparable": ComparableAnalysisResult,
  "grants": GrantCalculationResult,
  "yield"?: YieldAnalysisResult,  // only if buyer is non_occupier
  "metadata": { "elapsedMs": number, "agentCalls": number, "estimatedCost": number }
}
```

Auth: free tier gets 5 calls/day; Insider tier gets unlimited (per `docs/07-gtm-pricing.md`).

**Test**: POST with a known address; full response in <30 seconds.

---

## Task 2.6 — Response caching

Cache `/api/property/analyse` responses in Upstash Redis:
- Key: hash of (address, propertyType, bedrooms, purchasePrice, buyerType)
- TTL: 24 hours
- Cache hit returns immediately; miss runs the full pipeline

This dramatically reduces AI cost when subscribers re-query the same property.

**Test**: Second identical request to the endpoint returns in <100ms with `from_cache: true` flag.

---

## Task 2.7 — Integration test

Write `apps/web/__tests__/property-analyse.test.ts` that exercises the full path:
1. Seed a known property + comparables in a test database
2. POST to `/api/property/analyse`
3. Assert key fields in the response
4. Assert disclaimers are present
5. Assert no full addresses appear in narratives

This is the regression suite for the analytical core. Runs on every CI build.

---

## Done when

- [ ] PostGIS comparable query returns sensible results
- [ ] All three agents (comparable, grant, yield) produce well-formed JSON
- [ ] `/api/property/analyse` returns full results in <30s
- [ ] Response caching works
- [ ] Integration test passes
- [ ] All outputs include the right disclaimers
- [ ] Manual spot-check: 5 different test properties produce sensible numbers

Once complete, move to `sprint-3-content-pipeline.md` (to be written from `docs/03-solo-architecture.md` § Sprint 3).
