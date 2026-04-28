# ProperData — Master Product Summary v2

**"Property intelligence, properly verified"**
**Version:** 2.0 — Complete public data inventory + regulatory + monetisable extensions
**Date:** April 2026

---

## The one-paragraph pitch

ProperData is Ireland's first AI-powered property intelligence platform built entirely on verified public data. It cross-references 20+ government data sources — the Property Price Register, Commercial Leases Register, RTB rental data, SEAI energy ratings, OPW flood maps, national planning database, RZLT zoned land maps, Census demographics, LPT valuation bands, Tailte Éireann land registry, PSRA agent register, transport timetables, broadband coverage data, school quality metrics, Irish Water capacity data, crime statistics, and 15+ government grant schemes — into actionable, personalised intelligence for buyers, investors, and property professionals. A network of specialised AI agents continuously monitors these data streams and proactively surfaces insights to subscribers based on their specific situation. No scraped data, no estate agent spin — just verified public records, cross-referenced and computed in ways nobody else offers.

---

## 1. The problem

Ireland's property market outside Dublin is experiencing the fastest price growth nationally (~15% YoY in the Midlands as of early 2026), yet there is no dedicated, data-driven intelligence product covering this market. The information a buyer, investor, or professional needs to make a €300K+ decision is fragmented across 20+ government sources, each with different formats, update frequencies, and access methods. Nobody is cross-referencing property transactions with energy ratings, planning applications, grant eligibility, flood risk, school quality, broadband availability, zoned land tax exposure, commercial lease comparables, agent performance data, and commute times into a single, personalised assessment.

ProperData computes all of this in seconds, for any property, personalised to the subscriber's specific situation.

---

## 2. Complete data inventory — every public source mapped

### 2.1 Core transaction data

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **Property Price Register (PSRA)** | Every residential sale since 2010: price, date, address, new/second-hand | Updated ~weekly, 777K+ records | Free CSV download | Statutory public register | Comparable analysis, price trends, town medians |
| **PSRA Commercial Leases Register** | Every commercial lease since 2010: address, date, term, rent payable, capital contributions, rent review frequency, break clauses | Updated weekly | Free search + Excel/PDF download | Statutory public register | Commercial yield benchmarking, mixed-use investment analysis, ground floor retail health indicator for towns |
| **CSO RPPI** | National and regional house price indices (Dublin, ex-Dublin, national), new vs existing, FTB vs non-FTB transaction volumes | Monthly (~2 month lag), Feb 2026 published 15 Apr 2026 | Free JSON API (StatBank) | Government open data | Macro price context, transaction volume trends |
| **Revenue stamp duty data** | Transaction volumes, values, buyer types (FTB, former owner-occupier, non-occupier) by county, new vs existing | Published with CSO RPPI monthly | Revenue/CSO | Government open data | Investor activity tracking, FTB market share, demand segmentation |

### 2.2 Rental and tenancy data

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **RTB/ESRI Rent Index** | Actual rents paid on registered tenancies, county-level, new vs existing, standardised monthly rents | Quarterly (~6 month lag), Q4 2025 published Mar 2026 | Free downloadable dataset | Public research | Verified yield calculations, rental trend analysis |
| **RTB Profile of Register** | Total registered tenancies (243,598 private), landlord counts, Notice of Termination data, dispute data | Quarterly | Free PDF + data | Public research | Landlord exit velocity, supply-side signals, dispute risk by area |
| **RTB Determination Orders** | Published decisions on landlord-tenant disputes | Ongoing | Free searchable register on rtb.ie | Statutory public register | Regulatory risk indicators, case law for landlord subscribers |

### 2.3 Property attributes and energy

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **SEAI BER Research Tool** | Anonymised BER ratings, ~75% of full dataset, dwelling type, floor area, heating system, wall/roof type | Updated nightly | Free (registration) + data.gov.ie | Open data | BER premium analysis, retrofit ROI, energy cost estimation |
| **SEAI BER Public Register** | Individual property BER lookup by BER number or MPRN | Real-time | Free search | Public register | Per-property BER verification (requires BER number) |
| **SEAI Retrofit Statistics** | County-level grant uptake: applications, completions, average grant, average cost, heat pumps installed, scheme type | Annual (published in SEAI annual report appendices) | Free PDF | Public research | Grant absorption rate, retrofit market maturity by county |

### 2.4 Planning and land use

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **ePlanning portals** | All planning applications, grants, refusals, conditions per local authority | Real-time | Free web (structured HTML) | Statutory public | Planning pipeline tracker, supply forecasting |
| **National Planning Application Map** | 10 years of geocoded planning applications nationally | Ongoing | Free ArcGIS viewer / REST API | Government open data | Spatial planning analysis, proximity alerts |
| **RZLT maps** | All land zoned and serviced for residential development, identified by local authorities, liable for 3% annual tax | Annual final maps published 31 Jan 2026; draft 2027 maps published 1 Feb 2026 | Free maps on each local authority website | Statutory public | Development pressure indicator, future supply signal, investment opportunity identification |
| **Local authority development plans** | Zoning maps, specific local area plans, density requirements | Per plan cycle (6-year) | Free on LA websites | Public | Zoning context for any property, strategic planning intelligence |
| **An Bord Pleanála / An Coimisiún Pleanála** | Strategic Housing Development decisions, Large-scale Residential Development decisions, planning appeals | Ongoing | Free searchable register | Statutory public | Major development tracking, appeal outcomes |

### 2.5 Property ownership and registration

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **Tailte Éireann / LandDirect** | Land Register folios: ownership details, folio numbers, mapped boundaries, mortgages, burdens, rights of way. Covers ~90% of Irish land. | Current | Public register, €5 per folio inspection via landdirect.ie, business accounts available | Statutory public (fees apply) | Ownership verification, mortgage status, boundary mapping |
| **Registry of Deeds** | Unregistered property transactions (~10% of land) | Current | Searchable via Tailte Éireann | Statutory public (fees apply) | Historical ownership chains for older properties |
| **Tailte Éireann mapping data** | OSi national mapping, LiDAR data | Current | GeoHive (geohive.ie), some data under Creative Commons | Government open data / commercial | High-resolution terrain and building footprint data |

### 2.6 Tax and valuation

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **Revenue LPT valuation bands** | LPT bands by property, local authority adjustment factors (±15%), LPT calculator | Current (2026-2030 cycle based on Nov 2025 valuations) | Free online calculator, local authority adjustment rates published | Revenue public data | Automatic LPT calculation in total cost of ownership |
| **Revenue LPT guidance per Small Area** | Average LPT valuation band per Small Area (~50-200 properties each, 18,900 nationally) | Updated per valuation cycle | Revenue online valuation guidance tool | Public guidance | Area-level price validation, cross-reference with PPR |
| **RZLT liability** | 3% of market value on zoned, serviced, undeveloped land | Annual (from Feb 2026) | Revenue + local authority maps | Statutory | Cost modelling for land purchases, development site analysis |
| **Stamp duty rates and reliefs** | Residential 1%/2%/6% tiers, 15% bulk purchase rate, farm consolidation relief, residential development refund scheme | Current | Revenue.ie | Public | Transaction cost calculator, investor bulk purchase threshold analysis |

### 2.7 Regulatory and agent data

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **PSRA Register of Licensed Property Services Providers** | Every licensed auctioneer, estate agent, letting agent, and management agent: name, address, licence number, type (A/B/C/D), expiry, suspension status | Updated weekly, downloadable PDF/Excel | Free download | Statutory public register | Agent verification, market coverage analysis, "find a licensed agent" feature, suspended agent alerts |
| **PSRA Sanctions & Prosecutions** | Published sanctions, fines (up to €250K), licence revocations for improper conduct | Ongoing | Free on psr.ie | Public register | Agent trust scoring, consumer protection alerts |
| **RTB registered landlords** | Aggregate data on landlord registrations, tenancy types | Quarterly | Published in RTB reports | Public | Landlord density by area, BTL market composition |
| **Law Society Solicitor Register** | All practising solicitors with practising certificates | Current | Free search on lawsociety.ie | Public register | "Find a property solicitor" feature for subscribers |

### 2.8 Environmental and infrastructure

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **OPW Flood Maps** | Flood extent (1%, 0.5%, 0.1% AEP), hazard maps, risk maps, past flood events for 300 communities | Updated periodically | Open Spatial Data Portal (Creative Commons) | Government open data | Flood risk scoring, insurance cost estimation, risk-adjusted yield |
| **OPW LiDAR data** | High-resolution 3D terrain data covering urban and coastal areas | Released as open data | Creative Commons via GSI Open Topographic Data Viewer | Government open data | Terrain analysis, flood modelling enhancement |
| **Irish Water capacity** | Water supply and wastewater capacity registers by area | Periodic | Published capacity data | Public | Development feasibility indicator, supply constraint identification |
| **ComReg / SIRO / NBI** | Broadband coverage by address, fibre availability, National Broadband Plan rollout status | Current | Public coverage maps and checkers | Public | Digital commuter score, broadband availability flag per property |
| **EPA data** | Air quality, water quality, licensed waste facilities, IPPC facilities | Ongoing | Free via EPA maps and data | Public | Environmental quality indicator for area profiles |

### 2.9 Demographic, social, and amenity data

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **Census 2022 (CSO)** | Population, age structure, household composition, nationality, commuting patterns, income bands, tenure, housing stock age — by Electoral Division and Small Area | Census 2022 | Free StatBank API | Government open data | Demographic momentum score, demand forecasting, affordability context |
| **CSO Crime Statistics** | Recorded crime by Garda division/district | Quarterly | Free StatBank API | Government open data | Area safety indicator for town profiles |
| **Department of Education** | School locations, pupil-teacher ratios, enrolment, DEIS status, Tusla inspection reports | Annual | Public data | Government open data | School proximity premium analysis, family-buyer relevance |
| **Pobal HP Deprivation Index** | Affluence/deprivation scoring by Small Area, combining demographics, social class, employment | Census-linked | Free via maps.pobal.ie | Public | Area socioeconomic profiling, cross-reference with price trends |
| **Irish Rail / TFI** | Train timetables, bus routes, Journey Planner API | Current | Public timetables | Public | Commute time calculation, transport premium analysis |
| **HSE / Health Atlas** | GP, hospital, pharmacy, and health service locations | Current | Public data | Public | Healthcare accessibility for area profiles |

### 2.10 Grant and support scheme data

| Source | Data | Freshness | Access | Legal status | Product use |
|---|---|---|---|---|---|
| **SEAI energy grants** | 15+ schemes: attic/wall/floor insulation, heat pump (€12,500), solar PV, windows/doors (new Mar 2026), heating controls, One Stop Shop, Warmer Homes | Updated on policy change (most recently Feb-Mar 2026) | Public (seai.ie, citizensinformation.ie) | Public | Grant package calculator, retrofit ROI |
| **Croí Cónaithe** | Vacant (€50K) and derelict (€70K) property grants, Ready to Build, Vacant Above the Shop (expected 2026) | Updated on policy change | Public (gov.ie, LA websites) | Public | Vacancy opportunity index, grant-adjusted acquisition cost |
| **Revenue Help to Buy** | Up to €30K (10% of purchase price) tax rebate for FTBs, new build/self-build, extended to Dec 2029 | Current | Public (revenue.ie) | Public | FTB support calculation, new-build incentive modelling |
| **First Home Scheme** | Shared equity up to 30% (20% if combined with HTB), price ceilings by area, reviewed every 6 months | Biannual ceiling review | Public (firsthomescheme.ie) | Public | Affordability modelling for FTBs |
| **LA Affordable Purchase** | Below-market council-built homes, 120+ delivered in Westmeath to date | Per scheme | Public (LA websites) | Public | Alternative acquisition pathway intelligence |
| **Landlord retrofit tax deduction** | €10K per property (max 3 properties), deductible from rental income, 2026-2028 | Current | Revenue.ie | Public | Investor yield optimisation, tax-adjusted return modelling |
| **Residential Development Stamp Duty Refund** | Refund of up to two-thirds of stamp duty on non-residential land developed for housing, extended to 2030 | Current | Revenue.ie | Public | Developer-focused intelligence, land acquisition analysis |
| **Housing adaptation grants** | Older people (€30K), mobility aids (€6K), housing aid (€8K), means-tested | Current | LA websites | Public | Ageing-in-place advisory, niche subscriber segment |
| **Home Energy Upgrade Loan** | €5K-€75K at 2.99%, government-backed, linked to SEAI grants | Current | SEAI/participating lenders | Public | Financing layer in retrofit ROI model |
| **Defective Concrete Blocks** | Up to 100% remediation cost (mainly NW Ireland) | Current | Gov.ie | Public | Region-specific structural risk flag |

### 2.11 Commercial licensed data

| Source | Data | Freshness | Access | Cost | Product use |
|---|---|---|---|---|---|
| **GeoDirectory** | Address-level geocoding, building use classification, vacancy data (residential + commercial) | Quarterly | Commercial API/bulk file | ~€2-5K/year | Geocoding, vacancy opportunity index, town vitality scoring |
| **Eircode / Autoaddress** | Address-to-coordinate mapping, routing key data | Current | Commercial API | ~€0.05-0.15/lookup | Per-property geocoding |

---

## 3. What the product does — feature inventory

### 3.1 Core analysis (PPR + RTB + BER)

| Feature | Description | Data sources |
|---|---|---|
| **Comparable analysis** | For any property, find the most relevant PPR sales by PostGIS proximity, recency, beds, and type. AI-powered assessment of fair value. | PPR + PostGIS |
| **Verified yield calculation** | Gross and net rental yield using actual RTB rents (not asking rents). Full cost model: mortgage, management, insurance, void, LPT, maintenance. | PPR + RTB + Revenue LPT |
| **BER premium analysis** | Quantify the price premium that A/B-rated homes command over D/E-rated equivalents, by town. | PPR + SEAI BER |
| **Price trend and momentum** | Town-level median prices, 3-month vs 12-month rolling, YoY change, acceleration/deceleration signals. | PPR |
| **Transaction cost calculator** | Stamp duty (1%/2%/6% tiers), solicitor fees, surveyor, valuation — the full acquisition cost. | Revenue stamp duty rates |

### 3.2 Grant intelligence (SEAI + Croí Cónaithe + Revenue + FHS)

| Feature | Description | Data sources |
|---|---|---|
| **Grant package calculator** | Total available support for any property scenario, across all 15+ schemes, with stacking rules and eligibility verification via BER history. | SEAI + Croí Cónaithe + Revenue + FHS + BER |
| **Grant-adjusted value** | Purchase price minus all available grants = effective acquisition cost. The metric nobody else computes. | All grant sources + PPR |
| **Retrofit ROI calculator** | Net investment in energy upgrades vs BER premium on resale. Typical return: 250-300%. | SEAI grants + PPR BER premium data |
| **Grant absorption rate** | % of eligible housing stock per town that has claimed available grants. Reveals underserved markets. | SEAI stats + Census housing stock |
| **Vacancy opportunity index** | Cross-reference vacancy data, BER ratings, PPR prices, and Croí Cónaithe + SEAI stacking to identify grant arbitrage opportunities. | GeoDirectory + BER + PPR + grant schemes |
| **Total unclaimed grant opportunity per town** | Headline figure: "Mullingar has €55.5M in unclaimed property grants." Media-bait content. | SEAI stats + Census + GeoDirectory |

### 3.3 Planning and supply intelligence (ePlanning + RZLT + Irish Water)

| Feature | Description | Data sources |
|---|---|---|
| **Planning pipeline tracker** | All applications, grants, refusals in covered areas, classified by residential unit count, geocoded. | ePlanning + National Planning Map |
| **Supply pressure score** | Forward-looking: planning grants + commencements + RZLT map pressure + RTB NoT velocity. | ePlanning + RZLT + RTB |
| **RZLT development pressure indicator** | Which towns have the most RZLT-liable land? Where is the tax creating build-or-sell pressure? | RZLT maps + Irish Water capacity |
| **Infrastructure constraint flag** | Does Irish Water have capacity to support new development? No capacity = constrained supply = existing stock appreciation. | Irish Water capacity register |

### 3.4 Area intelligence (Census + schools + broadband + flood + crime + transport)

| Feature | Description | Data sources |
|---|---|---|
| **Town DNA profile** | Comprehensive per-town profile: demographics, economy, transport, broadband, schools, flood risk, BER stock, planning, prices, yield, grants. | All sources combined |
| **Digital commuter score** | Composite: broadband speed + commute time + rail access + co-working. The metric for Dublin workers considering a move. | ComReg + Irish Rail/TFI + Census |
| **School proximity premium** | Price differential for properties near highly-rated primary schools. | PPR + DoE school data |
| **Flood risk discount** | How much less do flood-zone properties sell for vs comparable properties outside? Insurance cost impact on yield. | PPR + OPW flood maps |
| **Demographic momentum** | Population growth, age profile shift, commuter increase, nationality diversification — by Electoral Division. | Census 2022 |
| **Deprivation/affluence context** | Pobal HP Index cross-referenced with price trends — are prices leading or lagging socioeconomic indicators? | Pobal + PPR |

### 3.5 Professional and commercial intelligence

| Feature | Description | Data sources |
|---|---|---|
| **Commercial lease benchmarking** | Rent per sqm for commercial premises by town — context for mixed-use investment and ground-floor retail health. | PSRA Commercial Leases Register |
| **Agent performance intelligence** | Number of licensed agents per town, licence types, sanctions history. "Is my agent properly licensed?" verification. | PSRA PSP Register |
| **Solicitor finder** | Licensed property solicitors in subscriber's area, cross-referenced with Law Society register. | Law Society register |
| **Branded PDF reports** | Agent/firm-branded town reports for client presentations. Every number sourced from public records. | All sources |
| **CSV/API data exports** | Raw data tables for covered towns — importable into agents' and brokers' own tools. | All sources |

### 3.6 Total cost of ownership — the number that actually matters

For any property, the agent computes the full monthly cost of living there:
- Mortgage repayments (at current rates, adjusted for borrowing capacity and deposit)
- Stamp duty (amortised or one-off)
- LPT (using Revenue valuation bands + local authority adjustment factor)
- Home insurance (flood-risk-adjusted estimate)
- BER-estimated energy costs (pre- and post-retrofit scenarios)
- Commute costs (fuel or rail/bus pass, based on actual timetables)
- Management fees (if apartment)
- Maintenance reserve (1% of value/year)
- Childcare (if family profile, using local rates)

Nobody in Ireland computes this. Mortgage calculators give the repayment. Insurance sites give the premium. Energy sites estimate bills. ProperData assembles the complete picture.

---

## 4. Proprietary signals — intelligence that doesn't exist anywhere else

| Signal | Inputs | What it reveals |
|---|---|---|
| **Heat score** (per town, weekly) | PPR velocity + planning apps + BER assessment rate + RTB NoT rate | Market activity level — are things accelerating or cooling? |
| **Value gap** (per town, quarterly) | PPR prices + BER + planning + commute + Census | Which areas are underpriced relative to fundamentals? |
| **Supply pressure** (per town, monthly) | Planning grants + commencements + RZLT + RTB NoT + Irish Water capacity | How much new supply is coming and when? |
| **Digital commuter score** (per town) | Broadband + commute + rail + co-working | How viable for a remote/hybrid Dublin worker? |
| **Grant opportunity** (per town, quarterly) | SEAI stats + Census housing stock + GeoDirectory vacancy + BER distribution | How much unclaimed grant money is sitting here? |
| **Grant-adjusted acquisition cost** (per property) | PPR + all grants + BER | What's the real cost after all supports? |
| **Retrofit ROI** (per property) | SEAI grants + BER premium + PPR comps | What return does a grant-funded retrofit generate? |
| **Flood risk discount** (per area) | OPW flood maps + PPR | What's the price impact of being in/out of flood zones? |
| **School proximity premium** (per area) | DoE data + PPR | What's the premium for being near good schools? |
| **Vacancy opportunity index** (per town) | GeoDirectory + BER + PPR + Croí Cónaithe + SEAI | Where do grants + vacancy + low prices create investment arbitrage? |
| **RZLT pressure index** (per town) | RZLT maps + Irish Water capacity + planning pipeline | Where is the tax forcing development — and what does that mean for supply? |
| **Agent density index** (per town) | PSRA PSP register + PPR transaction volume | How competitive is the agent market? Are there underserved areas? |
| **Commercial lease health** (per town) | PSRA Commercial Leases Register | Is the ground-floor economy healthy? (Vacancy = declining town; new leases = growing town) |

---

## 5. Agentic architecture — how the agents work

### 5.1 The inversion: push, not search

ProperData inverts the traditional property search model. Subscribers don't search — specialised AI agents continuously monitor all 20+ data streams and proactively push personalised intelligence based on the subscriber's declared intent and watched areas.

### 5.2 Agent network

| Agent | Role | Model | Trigger |
|---|---|---|---|
| **Orchestrator** | Routes events to specialist agents | Haiku | Every event |
| **Normalisation** | Cleans and geocodes raw PPR/planning/BER data | Haiku | New data ingested |
| **Comparable** | PostGIS comp analysis with AI assessment | Sonnet | New PPR sale, subscriber query |
| **Yield** | Verified yield using RTB actual rents + full cost model | Sonnet | RTB data, subscriber query |
| **Grant** | Total grant package with stacking, eligibility, and BER verification | Sonnet | Subscriber query, grant rule change |
| **Planning** | Classifies and geocodes planning applications | Haiku | New ePlanning data |
| **Anomaly** | Detects statistically unusual market signals | Haiku | Weekly metrics refresh |
| **Regulatory monitor** | Scans government sources for policy changes daily | Haiku | Daily |
| **Draft writer** | Generates personalised newsletter sections | Sonnet | Weekly (Sunday) |
| **Subscriber** | Natural language queries via MCP tools | Sonnet | Subscriber interaction |
| **Social writer** | Twitter threads and LinkedIn posts | Haiku | Post-publication |

### 5.3 Persona-aware behaviour

| Profile | Agent behaviour |
|---|---|
| **Buying** | Comps fire on every new PPR sale. Affordability modelling. Grant calculator. Planning alerts for nearby grants. School/broadband/commute context. |
| **Investing** | Yield runs weekly. Grant-adjusted ROI. RZLT exposure. RTB NoT signals. Tax-optimised return modelling (landlord deduction). |
| **Selling** | Comp tracking as pricing signal. Planning context for demand impact. BER upgrade ROI before sale. |
| **Watching** | Portfolio tracking. Quarterly valuation updates. Regulatory radar. LPT/RZLT monitoring. |
| **Professional** | All-town coverage. Branded report generation. Agent licence verification. Commercial lease benchmarking. |

### 5.4 MCP as distribution channel

The property intelligence tools are exposed via MCP server for external AI agents. Any AI assistant with ProperData MCP tools connected becomes an Irish property expert backed by live public data.

---

## 6. Monetisable extensions — additional revenue streams from public data

### 6.1 "Find a Licensed Agent" tool (PSRA register)

A free tool (lead magnet) that lets anyone search for licensed auctioneers, estate agents, and letting agents by town, with licence verification, type, and sanctions history. Nobody offers a user-friendly version of the PSRA register. This drives traffic, builds brand trust, and funnels users to the paid subscription.

### 6.2 Commercial lease intelligence (PSRA Commercial Leases Register)

A separate product tier (or add-on) for commercial property investors and developers. The Commercial Leases Register contains every commercial lease since 2010 including rent, term, break clauses, and capital contributions. Cross-referenced with town demographics and residential data, this becomes a "town vitality indicator" — new commercial leases signal economic growth (which drives housing demand), while falling commercial rents signal economic weakness.

### 6.3 RZLT advisory service

Landowners with RZLT-liable land face a 3% annual tax from 2026. Many don't fully understand their options: develop, sell, apply for rezoning, or seek exemption. An advisory content tier or one-off consultation service using ProperData's planning pipeline data, Irish Water capacity data, and PPR comparable land values could charge €200-500 per assessment for landowners.

### 6.4 Conveyancing data pack (for solicitors)

A per-property report that assembles: PPR comparables, BER rating and history, flood risk assessment, planning pipeline nearby, RZLT exposure, LPT valuation context, and grant eligibility summary. Solicitors currently compile this manually from multiple sources. A subscription or per-report model (€15-25 per report) sold directly to conveyancing practices.

### 6.5 Mortgage broker intelligence pack

For mortgage brokers advising clients: affordability modelling (income × 3.5 LTI, 90% LTV for FTBs), town-by-town price analysis, grant-adjusted acquisition costs, total cost of ownership comparisons between candidate towns. White-labelled with broker branding. Subscription at €39-79/month per brokerage.

### 6.6 Insurance risk intelligence (OPW + BER)

Cross-referencing OPW flood maps with property locations to produce a risk profile that home insurance companies could integrate. Additionally, BER data indicating heating system type, insulation quality, and building age are all relevant to insurance underwriting. An API tier for insurtech companies.

### 6.7 Developer site assessment reports

For small-to-medium developers evaluating potential sites: RZLT status, Irish Water capacity, planning history for the site and adjacent land, PPR sold prices for comparable developments in the area, demographic demand modelling (Census), and school/transport amenity scoring. Premium one-off reports at €500-2,000 per assessment.

### 6.8 Local authority intelligence (white-label)

Local authorities need data to support housing strategies, development plan reviews, and RZLT mapping. ProperData's cross-referenced data (PPR + planning + vacancy + BER + Census) assembled into a town-level housing market assessment report is exactly what LA planning departments need and currently commission consultants to produce at €10-50K per study.

---

## 7. Pricing

| Tier | Price | Audience | Key features |
|---|---|---|---|
| **Free** | €0 | Everyone (top of funnel) | Weekly pulse summary, monthly town profile, regulatory alerts, "Find a Licensed Agent" tool |
| **Insider** | €15/month or €129/year | Buyers, investors, landlords | Full PPR analysis, yield calculator, grant package calculator, planning tracker, BER premium, town rankings, flood risk, school/broadband/commute context, personalised alerts |
| **Professional** | €49/month or €449/year | Auctioneers, solicitors, brokers | Everything in Insider + branded PDF reports, CSV exports, AI analyst chat, API access, commercial lease data, agent market analysis, conveyancing data packs, priority support |
| **Enterprise** | Custom (€500-2K/month) | Fintechs, banks, proptech, insurers, developers | Full API, white-label reports, MCP server access, bulk data feeds, SLA, developer site assessments |

**Founding members** (first 100 paid): €89/year locked for life.

**Break-even**: 8 Insider subscribers. Infrastructure costs ~€112/month.

---

## 8. Revenue projections

### Conservative (public data only)

| Month | Free | Paid | MRR | ARR |
|---|---|---|---|---|
| 6 | 1,200 | 70 | €1,220 | €14,640 |
| 12 | 3,500 | 220 | €3,980 | €47,760 |
| 18 | 6,000 | 440 | €7,960 | €95,520 |
| 24 | 10,000 | 780 | €14,420 | €173,040 |

### With extensions (conveyancing packs, developer reports, enterprise API)

| Month | Subscription MRR | Extension MRR | Total MRR | Total ARR |
|---|---|---|---|---|
| 12 | €3,980 | €1,500 | €5,480 | €65,760 |
| 18 | €7,960 | €4,000 | €11,960 | €143,520 |
| 24 | €14,420 | €8,000 | €22,420 | €269,040 |

---

## 9. Go-to-market

### Phase 1 — Audience building (Months 1-3)

Launch three data-driven pieces: "What Mullingar houses actually sold for," "The asking price illusion," and "Ireland's hidden property hotspot." Distribution via Twitter/X data threads, Reddit r/irishpersonalfinance, LinkedIn, podcast guest appearances, and SEO via town-specific landing pages. Free "Find a Licensed Agent" tool as lead magnet.

Target: 500 free subscribers, 40%+ open rate.

### Phase 2 — Monetisation (Months 4-9)

Activate Insider tier with soft paywall. Founding member programme. Direct professional outreach to Midlands auctioneers and solicitors. Approach Daft/MyHome for data partnership from position of strength.

Target: 2,000 free, 120 Insider, 10 Pro, €2,290 MRR.

### Phase 3 — Product expansion (Months 10-18)

Web app with town explorer, AI analyst chat, and interactive tools. MCP server deployment. National expansion to 50+ towns. Enterprise partnerships. Monetisable extensions (conveyancing packs, developer reports).

Target: 6,000+ free, 400+ paid, €8,000+ MRR.

---

## 10. Competitive positioning

**What exists today**: Daft quarterly reports (national macro, free), Irish Times property section (Dublin-centric journalism), Savills/JLL research (institutional, commercial), r/irishpersonalfinance (community, anecdotal).

**What doesn't exist**: Town-level property intelligence cross-referencing 20+ public data sources. Grant-adjusted acquisition cost computation. Verified yield calculations using actual RTB rents. Flood-risk-adjusted yield. School proximity premium analysis. RZLT development pressure indicators. Commercial lease health scoring. AI-powered natural language queries against Irish property data. MCP-accessible Irish property intelligence.

**The moat**: 20+ automated data pipelines, PostGIS spatial database, agent orchestration with persona-aware routing, domain-specific prompt library, subscriber intelligence graph, and MCP distribution. Technically 6-12 months to replicate; the subscriber base that generates interaction data to improve the agents cannot be replicated at all.

---

## 11. The 30-second pitch

*"ProperData is Ireland's first AI-powered property intelligence built entirely on verified public records. We cross-reference 20+ government data sources — the Property Price Register, RTB rental data, SEAI energy ratings, OPW flood maps, RZLT land maps, the national planning database, Census demographics, broadband data, school quality metrics, and 15+ grant schemes — into personalised intelligence for buyers, investors, and professionals. Our AI agents compute what properties actually sold for, what tenants actually pay, what grants you're eligible for — up to €93,000 in combined support for the right property — what flood risk means for your insurance, how schools affect your home's value, and what it all costs to own. Every number traceable to a verified source. The product that pays for itself the first time it finds a grant you didn't know existed."*
