# Grant Intelligence Layer — Architecture Addendum

**Product:** ProperData
**Scope:** Data pipeline, agent design, MCP tools, and product integration for Irish property grants
**Date:** March 2026
**Parent docs:** Agentic Architecture Spec, Agentic Capabilities Spec

---

## 1. Why this is a killer feature

Nobody is computing the total grant picture for a specific property transaction. The information exists across 6+ government sources, each with different eligibility rules, scheme interactions, and recent changes. A buyer looking at a D-rated 3-bed in Mullingar for €310K would need to visit SEAI, Citizens Information, Revenue, their local authority, and the RTB to understand their full support picture. Even then, the interaction rules (which grants stack, which caps reduce when combined) require domain expertise to model correctly.

The ProperData grant agent does this in seconds, for any property, personalised to the subscriber's profile (FTB, investor, landlord, welfare recipient). This is the feature that turns a data product into a decision tool.

---

## 2. Grant taxonomy — what exists as of March 2026

### 2.1 Energy efficiency grants (SEAI — national, no regional variation)

| Grant | Max amount | Eligibility | Key conditions | Source |
|---|---|---|---|---|
| **Attic insulation** | €800–€2,000 (by dwelling type) | Property built before 2011 | Increased Feb 2026. FTBs get higher fixed rate. | SEAI Better Energy Homes |
| **Cavity wall insulation** | €700–€1,800 (by dwelling type) | Property built before 2011 | Increased Feb 2026. Second wall measure now allowed. | SEAI Better Energy Homes |
| **External wall insulation** | €3,000–€8,000 (by dwelling type) | Property built before 2011 | Highest cost measure. | SEAI Better Energy Homes |
| **Internal wall insulation** | €1,500–€4,500 (by dwelling type) | Property built before 2011 | | SEAI Better Energy Homes |
| **Floor insulation** | €3,500 (houses) | Property built before 2011 | | SEAI Better Energy Homes |
| **Heat pump system** | €12,500 | Property built before 2021 | New combined grant from Feb 2026: €6,500 pump + €2,000 radiators + €4,000 renewable bonus | SEAI Better Energy Homes |
| **Heating controls** | €700 | Property built before 2011 | | SEAI Better Energy Homes |
| **Solar PV** | €1,800 (€900 per kWp up to 2kWp) | Property built before 2021 | Export tariff also available for surplus electricity | SEAI Solar PV |
| **Solar thermal** | €1,200 | Property built before 2011 | | SEAI Better Energy Homes |
| **Windows and doors** | €4,000 windows + €1,600 doors | Property built before 2011 | NEW from March 2026. Requires building fabric to meet minimum standard. | SEAI Better Energy Homes |
| **BER assessment** | €50 | After any grant-funded upgrade | | SEAI Better Energy Homes |
| **One Stop Shop (full retrofit)** | Varies (avg €26,000 grant on €56,000 cost) | Property must reach BER B2+ | Grant deducted upfront. Managed service. 24 registered providers. | SEAI National Home Energy Upgrade |
| **Warmer Homes Scheme** | 100% funded | Low-income (qualifying welfare payments) | Free full upgrade. 24-26 month wait. Attic/cavity now available immediately via enhanced grants. | SEAI Warmer Homes |
| **Traditional Homes** | Varies | Property built before 1940 | Specialist measures for solid masonry. Conservation-sensitive. | SEAI One Stop Shop |
| **Home Energy Upgrade Loan** | €5,000–€75,000 at 2.99% | Must be linked to SEAI grant achieving 20%+ improvement | AIB, Bank of Ireland, PTSB, Avant Money, credit unions | SEAI / participating lenders |
| **Landlord retrofit tax deduction** | €10,000 per property (max 3 properties) | Landlord, net of SEAI grant | Deductible from rental income. Covers 2026-2028. | Revenue |

### 2.2 Vacancy and dereliction grants (local authority administered)

| Grant | Max amount | Eligibility | Key conditions | Source |
|---|---|---|---|---|
| **Vacant Property Refurbishment** | €50,000 | Property vacant 2+ years | Owner-occupier or rental. Max 2 grants per applicant. | Croí Cónaithe (Towns) Fund |
| **Derelict Property Refurbishment** | €70,000 | Property structurally unsound + vacant 2+ years | Requires independent building survey | Croí Cónaithe (Towns) Fund |
| **Vacant Above the Shop** | TBC (expected 2026) | Vacant space above commercial premises | Conversion to residential. Additional €5,000 for expert advice. | Croí Cónaithe (extension) |
| **Ready to Build Scheme** | Discounted serviced sites | Self-builders in towns/villages | Local authority makes sites available at below market | Croí Cónaithe (Towns) Fund |
| **Island property supplement** | +20% on Croí Cónaithe grants | Properties on qualifying offshore islands | | Croí Cónaithe |

### 2.3 Purchase support schemes (national)

| Scheme | Max support | Eligibility | Key conditions | Source |
|---|---|---|---|---|
| **Help to Buy** | €30,000 (10% of purchase price) | FTB, new build or self-build, ≤€500K | Tax rebate (Income Tax + DIRT, last 4 years). Extended to Dec 2029. | Revenue |
| **First Home Scheme** | Up to 30% shared equity (20% if combined with HTB) | FTB, borrowing at max capacity | Price ceilings by area (€500K Dublin, €450K Galway, etc.). Reviewed every 6 months. | First Home Scheme DAC |
| **Local Authority Affordable Purchase** | Below-market sale price | Income-qualifying households | Council-built homes. 120+ delivered in Westmeath to date. | Local authorities |
| **Defective Concrete Blocks** | Up to 100% remediation cost | Homes affected by defective blocks (mainly NW Ireland) | Can be combined with SEAI energy grants. | Dept of Housing |
| **Repair and Leasing Scheme** | Loan up to €80,000 | Property vacant 1+ year | Owner repairs, leases to council for 5-25 years for social housing. | Local authorities |

### 2.4 Regional and special grants

| Grant | Max amount | Eligibility | Key conditions | Source |
|---|---|---|---|---|
| **Housing Adaptation Grant (older people)** | €30,000 (up to 95% of cost) | Aged 66+, means-tested | Adaptations for ageing in place | Local authority |
| **Housing Aid for Older People** | €8,000 (up to 100% of cost) | Aged 66+, means-tested | Basic repairs (roof, wiring, plumbing) | Local authority |
| **Mobility Aids Grant** | €6,000 (up to 100% of cost) | Mobility-impaired, means-tested | Ramps, grab-rails, level-access shower | Local authority |
| **Community Energy Grants** | Varies | Community groups | Aggregated projects across a community | SEAI Community |
| **Solar for business** | Up to €2,400 per kWp | Commercial properties | | SEAI Non-Domestic |

---

## 3. Data sources and ingestion

### 3.1 Source mapping

| Data point | Source | Access | Update frequency | Ingestion method |
|---|---|---|---|---|
| SEAI grant amounts and eligibility rules | seai.ie/grants, citizensinformation.ie | Public web | On policy change (tracked) | Regulatory agent monitors pages for changes |
| SEAI retrofit statistics (county-level) | SEAI annual/quarterly reports, SEAI GIS dashboard | Public PDF + dashboard | Quarterly / annual | n8n workflow: download PDF, agent extracts county data |
| SEAI BER ratings (property-level) | SEAI BER Research Tool | Free (registration required) | Nightly | n8n workflow: bulk download Excel, parse, Postgres upsert |
| Croí Cónaithe grant rules | citizensinformation.ie, local authority pages | Public web | On policy change | Regulatory agent monitors |
| Croí Cónaithe local authority contacts | Each LA website | Public web | Annually | Manual seed, agent-assisted updates |
| Help to Buy / First Home Scheme rules | revenue.ie, firsthomescheme.ie | Public web | On policy change | Regulatory agent monitors |
| First Home Scheme price ceilings | firsthomescheme.ie | Public web | Every 6 months | Scheduled check, alert on change |
| LA Affordable Purchase schemes | Each LA housing dept | Public web | As schemes launch | Planning agent cross-references |
| GeoDirectory vacancy data | GeoDirectory | Commercial licence | Quarterly | API or bulk file, Postgres upsert |
| RZLT maps | Local authority RZLT pages | Public web | Annual (April deadline for submissions) | n8n workflow: download maps, extract parcel data |

### 3.2 Schema additions

```sql
-- Grant scheme definitions (reference data, manually maintained)
CREATE TABLE grant_schemes (
    id              SERIAL PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL, -- e.g. 'seai_attic', 'croi_vacant', 'htb'
    name            TEXT NOT NULL,
    category        TEXT NOT NULL, -- 'energy', 'vacancy', 'purchase', 'adaptation', 'community'
    provider        TEXT NOT NULL, -- 'SEAI', 'Local Authority', 'Revenue', 'First Home DAC'
    max_amount      NUMERIC(10,2),
    amount_varies_by TEXT, -- 'dwelling_type', 'income', 'fixed', 'property_value'
    eligibility_rules JSONB NOT NULL, -- structured eligibility criteria
    stacks_with     TEXT[], -- codes of schemes this can be combined with
    conflicts_with  TEXT[], -- codes of schemes this cannot be combined with
    cap_when_combined JSONB, -- e.g. {"htb+fhs": {"fhs_max_pct": 20}}
    effective_from  DATE NOT NULL,
    effective_to    DATE, -- null = currently active
    source_url      TEXT NOT NULL,
    notes           TEXT,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Grant amount lookup by dwelling type (for SEAI grants that vary)
CREATE TABLE grant_amounts (
    id              SERIAL PRIMARY KEY,
    scheme_id       INTEGER REFERENCES grant_schemes(id),
    dwelling_type   TEXT NOT NULL, -- 'detached', 'semi', 'mid_terrace', 'apartment'
    amount          NUMERIC(10,2) NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE
);

-- First Home Scheme price ceilings by area
CREATE TABLE fhs_price_ceilings (
    id              SERIAL PRIMARY KEY,
    area            TEXT NOT NULL, -- 'Dublin City', 'Galway County', 'Westmeath', etc.
    ceiling         NUMERIC(10,2) NOT NULL,
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    next_review     DATE
);

-- SEAI retrofit statistics by county (from annual reports)
CREATE TABLE retrofit_stats (
    id              SERIAL PRIMARY KEY,
    county          TEXT NOT NULL,
    year            INTEGER NOT NULL,
    scheme          TEXT NOT NULL, -- 'BEH', 'OSS', 'Warmer Homes', 'Solar PV', 'Community'
    applications    INTEGER,
    completions     INTEGER,
    total_grant_paid NUMERIC(12,2),
    avg_grant       NUMERIC(10,2),
    avg_cost        NUMERIC(10,2),
    heat_pumps_installed INTEGER,
    avg_ber_improvement TEXT, -- e.g., 'D1 → B2'
    UNIQUE(county, year, scheme)
);

-- Materialised view: per-property grant eligibility estimate
-- (computed when a subscriber queries a specific property)
-- Not pre-computed — calculated on demand by the grant agent
```

### 3.3 Eligibility rules as structured data

The grant eligibility rules are encoded as JSONB so the grant agent can evaluate them programmatically:

```json
{
  "scheme": "seai_heat_pump",
  "rules": {
    "property_built_before": "2021-01-01",
    "owner_types": ["owner_occupier", "landlord"],
    "requires_ber_assessment": true,
    "requires_technical_assessment": false,
    "excluded_if": ["already_received_heat_pump_grant"],
    "amount_logic": {
      "base": 6500,
      "central_heating_upgrade": 2000,
      "renewable_heat_bonus": 4000,
      "renewable_bonus_condition": "replacing_fossil_fuel_system",
      "max_total": 12500
    }
  }
}
```

```json
{
  "scheme": "croi_vacant",
  "rules": {
    "property_vacant_years_min": 2,
    "owner_types": ["owner_occupier", "landlord"],
    "intended_use": ["principal_residence", "rental"],
    "max_grants_per_applicant": 2,
    "max_rental_grants": 1,
    "derelict_supplement": {
      "condition": "structurally_unsound",
      "requires": "independent_building_survey",
      "max_amount": 70000
    },
    "island_supplement": {
      "condition": "qualifying_offshore_island",
      "multiplier": 1.2
    },
    "standard_max": 50000,
    "administered_by": "local_authority",
    "stacks_with": ["seai_attic", "seai_cavity", "seai_heat_pump", "seai_solar_pv", "seai_windows"]
  }
}
```

---

## 4. Grant intelligence agent

### 4.1 System prompt

```
You are a grant eligibility and optimisation agent for Irish property transactions.

Given a property profile and a subscriber profile, you compute the TOTAL
available grant and support picture — across SEAI energy grants, Croí Cónaithe
vacancy grants, Revenue tax schemes, and purchase support schemes.

CRITICAL RULES:
1. Only include grants the subscriber is actually eligible for based on their
   declared profile (FTB, investor, landlord, age, income level).
2. Model grant stacking correctly:
   - Help to Buy + First Home Scheme can be combined, but FHS max drops
     from 30% to 20% when combined with HTB.
   - SEAI grants stack with each other (attic + walls + heat pump + solar).
   - SEAI grants stack with Croí Cónaithe.
   - Landlord retrofit tax deduction is NET of SEAI grant received.
3. BER rating is the key driver for energy grants. A D-rated property has
   the most grant headroom. An A-rated property has almost none.
4. Property age matters: built before 2011 for most SEAI grants, before
   2021 for heat pump and solar.
5. Always compute TWO figures:
   - "Available grants" — what they can actually claim
   - "Effective acquisition cost" — purchase price minus all available supports
6. Flag any upcoming changes (scheme reviews, new grants expected, FHS
   ceiling reviews) that could affect timing decisions.

OUTPUT FORMAT:
Return a structured JSON with:
- grant_breakdown: array of applicable grants with amount and conditions
- total_grants: sum of all available grants
- effective_cost: purchase price - total grants
- tax_benefits: any ongoing tax advantages (landlord deduction, etc.)
- stacking_notes: any interaction effects between combined schemes
- timing_advice: any upcoming changes that affect when to act
- narrative: 3-4 sentence plain-English summary
```

### 4.2 MCP tool definition

```typescript
{
  name: 'calculate_grant_package',
  description: `Calculate the total available grant and support package for a
specific property transaction. Combines SEAI energy grants, Croí Cónaithe
vacancy grants, Help to Buy, First Home Scheme, and landlord tax reliefs
into a single comprehensive assessment. Returns individual grant amounts,
total support available, effective acquisition cost, and a narrative summary.
This is the tool to use when a subscriber asks "What grants can I get?" or
"What's the real cost of this property after supports?"`,
  inputSchema: {
    type: 'object',
    properties: {
      purchase_price: {
        type: 'number',
        description: 'Expected purchase price in euros'
      },
      town: { type: 'string' },
      county: { type: 'string' },
      property_type: {
        type: 'string',
        enum: ['detached', 'semi_detached', 'mid_terrace', 'end_terrace', 'apartment', 'bungalow']
      },
      beds: { type: 'number' },
      year_built: { type: 'number', description: 'Year property was originally built' },
      current_ber: {
        type: 'string',
        description: 'Current BER rating (A1-G)',
        enum: ['A1','A2','A3','B1','B2','B3','C1','C2','C3','D1','D2','E1','E2','F','G']
      },
      is_vacant: { type: 'boolean', description: 'Has the property been vacant 2+ years?' },
      is_derelict: { type: 'boolean', description: 'Is the property structurally unsound?' },
      current_heating: {
        type: 'string',
        enum: ['oil', 'gas', 'solid_fuel', 'electric', 'heat_pump', 'none'],
        description: 'Current heating system type'
      },
      subscriber_profile: {
        type: 'object',
        properties: {
          is_ftb: { type: 'boolean', description: 'First-time buyer' },
          is_landlord: { type: 'boolean' },
          household_income: { type: 'number' },
          on_welfare: { type: 'boolean', description: 'In receipt of qualifying welfare payments' },
          age_over_66: { type: 'boolean' },
          existing_properties: { type: 'number', description: 'Number of properties already owned' },
          previous_seai_grants: {
            type: 'array',
            items: { type: 'string' },
            description: 'Codes of SEAI grants previously received for this property'
          }
        }
      }
    },
    required: ['purchase_price', 'town', 'county', 'property_type', 'current_ber']
  }
}
```

### 4.3 Example agent output

**Query:** "I'm a first-time buyer looking at a D1-rated 3-bed semi in Mullingar for €310K, built in 1995. It's been vacant for 3 years. Oil heating. What grants can I get?"

```json
{
  "grant_breakdown": [
    {
      "scheme": "Help to Buy",
      "amount": 30000,
      "conditions": "Must be new build or self-build — DOES NOT APPLY to this second-hand property",
      "eligible": false
    },
    {
      "scheme": "First Home Scheme",
      "amount": 0,
      "conditions": "Only available for new builds and specific qualifying properties. Check firsthomescheme.ie for current eligible properties in Westmeath.",
      "eligible": false,
      "note": "FHS expanded scope in 2026 — worth checking if this property qualifies under tenant purchase provisions"
    },
    {
      "scheme": "Croí Cónaithe Vacant Property Grant",
      "amount": 50000,
      "conditions": "Property vacant 3 years (meets 2-year minimum). Must be used as PPR or rental. Apply to Westmeath County Council.",
      "eligible": true
    },
    {
      "scheme": "SEAI Attic Insulation",
      "amount": 1300,
      "conditions": "Semi-detached rate. Property built 1995, eligible (before 2011).",
      "eligible": true
    },
    {
      "scheme": "SEAI Cavity Wall Insulation",
      "amount": 1200,
      "conditions": "Semi-detached rate.",
      "eligible": true
    },
    {
      "scheme": "SEAI Heat Pump System",
      "amount": 12500,
      "conditions": "Replacing oil heating with heat pump. Includes €4,000 renewable bonus for fossil fuel replacement.",
      "eligible": true
    },
    {
      "scheme": "SEAI Windows and Doors",
      "amount": 5600,
      "conditions": "€4,000 windows + €1,600 doors. Available from March 2026. Requires building fabric to meet minimum standard (attic + wall insulation achieves this).",
      "eligible": true
    },
    {
      "scheme": "SEAI Solar PV",
      "amount": 1800,
      "conditions": "Up to 2kWp system.",
      "eligible": true
    },
    {
      "scheme": "SEAI Heating Controls",
      "amount": 700,
      "conditions": "Smart heating controls.",
      "eligible": true
    },
    {
      "scheme": "SEAI BER Assessment",
      "amount": 50,
      "conditions": "Post-works BER.",
      "eligible": true
    },
    {
      "scheme": "Home Energy Upgrade Loan",
      "amount": null,
      "conditions": "Low-interest loan (2.99%) for €5,000-€75,000 to cover costs beyond grants. Available from AIB, BOI, PTSB.",
      "eligible": true,
      "type": "loan_not_grant"
    }
  ],
  "total_grants": 73150,
  "effective_cost": 236850,
  "stacking_notes": [
    "Croí Cónaithe (€50K) and all SEAI grants stack without reduction.",
    "Help to Buy does NOT apply — this is a second-hand property.",
    "First Home Scheme has limited applicability to second-hand vacant properties — verify with scheme directly.",
    "If the full SEAI package is implemented, the property should achieve BER B2 or better, qualifying for the One Stop Shop managed service (grants deducted upfront, reducing cash outlay)."
  ],
  "tax_benefits": [],
  "timing_advice": [
    "Windows and doors grant available from March 2026 — if purchasing now, wait to apply for this grant until March.",
    "FHS price ceilings next reviewed mid-2026 — Westmeath ceiling may change.",
    "SEAI grants for heat pump increased in Feb 2026 — the new €12,500 rate already applies."
  ],
  "narrative": "This vacant property is eligible for exceptional grant support totalling €73,150. The Croí Cónaithe vacant property grant (€50K) combined with a full SEAI energy retrofit package (€23,150) would bring the effective acquisition cost to approximately €237K — well below the Mullingar median of €328K. The property would emerge as a B2-rated, heat-pump-heated, solar-equipped home with a market value potentially 12-15% above comparable D-rated stock. The gap between effective cost (€237K) and post-retrofit value (estimated €355-375K) represents significant embedded equity."
}
```

---

## 5. Derived intelligence — what the grant data enables

### 5.1 "Grant-adjusted value" metric (new proprietary signal)

For every property (or town median), compute: **effective acquisition cost = purchase price - total available grants.**

This reframes the entire affordability picture. A D-rated vacant house at €310K with €73K in grants has an effective cost of €237K. That changes the yield calculation, the mortgage requirement, and the comparison against other towns.

No other Irish property product computes this.

### 5.2 "Retrofit ROI" analysis

For any property with a known BER rating, the agent can model:

```
D1-rated 3-bed semi in Mullingar

Retrofit cost estimate:
  Attic insulation:     €2,500 (grant: €1,300, net cost: €1,200)
  Cavity wall:          €2,000 (grant: €1,200, net cost: €800)
  Heat pump system:     €18,000 (grant: €12,500, net cost: €5,500)
  Windows:              €8,000 (grant: €4,000, net cost: €4,000)
  Solar PV:             €5,000 (grant: €1,800, net cost: €3,200)
  Controls:             €800 (grant: €700, net cost: €100)
  
  Total retrofit cost:  €36,300
  Total grants:         €21,500
  Net cost to owner:    €14,800

Post-retrofit BER:      B2 (estimated)
BER premium on resale:  +12-15% based on PPR analysis of BER premiums in Westmeath
Value uplift:           €37,200–€46,500 (on €310K base)

Retrofit ROI:           251–314% (€37-47K value gain on €14.8K net investment)

Annual energy saving:   €1,800–€2,400 estimated (oil → heat pump + solar)
Payback period:         6.2–8.2 years on net cost
```

This is the kind of analysis that makes a property investment newsletter indispensable. It's not "here's what things cost" — it's "here's the exact return on a specific upgrade path, net of grants, for this specific property type in this specific town."

### 5.3 "Vacancy opportunity" index (new proprietary signal)

Cross-reference:
- GeoDirectory vacancy data (which properties are vacant)
- BER Research Tool (what BER ratings exist for nearby properties)
- PPR sales (what similar properties sell for in the area)
- Croí Cónaithe eligibility (€50-70K grant if vacant 2+ years)
- SEAI grant stacking (additional €20K+ for energy retrofit)
- ePlanning (is the area getting new development — rising tide for values?)

Output: a per-town score indicating the density of vacant property opportunities where the grant-adjusted acquisition cost is significantly below market value. Towns with high vacancy, low base prices, strong grant stacking potential, and rising area values score highest.

This is a genuinely novel investment signal. It identifies the specific micro-opportunities where government policy (grants + RZLT pressure + vacancy taxes) is creating arbitrage.

### 5.4 County-level retrofit intelligence

SEAI publishes county-level scheme volumes in their annual report appendices, and the government supported 53,984 home energy upgrades in 2024, investing €1.2 billion across 186,000 homes since 2019.

Ingest the county-level data (applications, completions, average grant, average cost, heat pumps installed) and compute:

- **Retrofit rate per county:** What percentage of housing stock has been upgraded? (Low retrofit rate = more headroom for BER premium capture)
- **Grant utilisation rate:** Are homeowners in Westmeath claiming what they're entitled to? (Low utilisation = education opportunity = content angle)
- **One Stop Shop coverage:** How many registered providers serve each county? (Few providers = potential bottleneck for retrofit plans)
- **Warmer Homes wait time by area:** Where are the longest waits? (Relevant for welfare-qualifying subscribers)

---

## 6. Product integration — where grants appear in the subscriber experience

### 6.1 Every comp analysis includes a grant sidebar

When the comp agent analyses a PPR sale or a subscriber queries a property, the grant agent automatically runs in parallel and appends:

```
COMPARABLE ANALYSIS: 14 College Hill, Mullingar
[... standard comp output ...]

GRANT ASSESSMENT:
This property (D1, built 1995) is eligible for up to €23,150 in 
SEAI energy grants if retrofitted to B2. Net retrofit cost estimated 
at €14,800. Post-retrofit BER premium could add €37-47K to value.

Effective acquisition cost at asking (€365K): €341,850 after SEAI grants.
If vacancy criteria met (2+ years): €291,850 after Croí Cónaithe + SEAI.
```

### 6.2 The weekly brief includes a "grant watch" section

For each subscriber's watched towns:
- Any SEAI scheme changes that took effect this week
- Croí Cónaithe update: number of grants approved in their county (from LA data)
- FHS ceiling review dates (flagged 4 weeks before review)
- New One Stop Shop providers registered in their area

### 6.3 The yield calculator is grant-aware

When the yield agent computes return for an investment property, it offers two scenarios:
1. **As-is yield:** Purchase at current price, rent at RTB median for current BER
2. **Post-retrofit yield:** Purchase at current price minus SEAI grants, retrofit to B2, rent at RTB median for B2+ properties (higher), plus landlord tax deduction of €10K

The delta between these two scenarios is often the difference between a marginal investment and a compelling one.

### 6.4 MCP tool: calculate_grant_package

External AI agents can call `calculate_grant_package` to compute the full grant picture for any property scenario. This is high-value intelligence that mortgage brokers, financial advisors, and estate agents would integrate into their own client workflows.

---

## 7. Data maintenance — keeping grants current

Grant rules change. The 2026 changes (increased insulation grants, new €12,500 heat pump, new windows/doors grant) landed in phases across February-March. The product needs to surface these changes before subscribers read about them in the paper.

### 7.1 Regulatory monitoring agent

A dedicated agent that monitors:
- seai.ie/grants (page change detection)
- citizensinformation.ie housing grants pages (page change detection)
- gov.ie housing press releases (RSS or page scan)
- Revenue.ie property-related guidance (page change detection)
- Oireachtas.ie (new statutory instruments related to housing/energy)
- firsthomescheme.ie (price ceiling updates)

**Implementation:** n8n workflow runs daily, fetches each URL, hashes the content, compares to previous hash. On change detection, the agent:
1. Extracts what changed (diff analysis)
2. Classifies the impact (which grant scheme, which subscriber profiles affected)
3. Updates the `grant_schemes` table
4. Generates a regulatory alert for affected subscribers
5. Flags for human review before publishing (editor confirms accuracy)

### 7.2 Change propagation

When a grant rule changes:
1. `grant_schemes` table is updated with new effective_from date
2. Previous rule gets an effective_to date (maintaining history)
3. All cached grant calculations are invalidated for affected property types
4. Affected subscribers receive a proactive alert within 48 hours
5. The weekly brief includes the change in the "grant watch" section

---

## 8. Implementation priority

| Priority | Capability | Complexity | Impact |
|---|---|---|---|
| **1** | Grant scheme reference data (seed all schemes) | Low | Foundation for everything |
| **2** | `calculate_grant_package` MCP tool | Medium | The "wow" feature — total grant picture per property |
| **3** | Grant-adjusted value in comp analysis | Low (once tool exists) | Reframes every transaction |
| **4** | Regulatory monitoring agent | Medium | Keeps data current, generates alert content |
| **5** | Retrofit ROI calculator | Medium | Compelling for investors and buyers |
| **6** | Vacancy opportunity index | High | Proprietary signal, requires GeoDirectory |
| **7** | County-level retrofit statistics | Low | Content for newsletter, town comparisons |
| **8** | Grant-aware yield calculator | Medium | Investment decision tool |
