# Agentic Capabilities, Persona Architecture, and Real-Time Differentiators

**Product:** ProperData / Gable
**Version:** 2.0
**Date:** March 2026

---

## 1. The agentic thesis

The US property platforms (Redfin, Homes.com, Zillow) are converging on conversational AI layered on listings search. That is a better UI for the same product — filtering active listings. Our product has no listings data. What we have is the full analytical context around verified transactions, actual rents, energy performance, and future supply. The agentic layer does not replace search — it replaces the analysis a buyer or investor would need an accountant, surveyor, or consultant to do. The question is not "can the agent find me a house?" but "can the agent tell me whether this house is a good decision?"

---

## 2. Personas

### P1 — The Dublin escapee (first-time buyer)
Dual-income couple, €80-120K household, late 20s to early 40s, renting in Dublin at €2,000+/month, priced out at €475K+ median, considering commuter towns. Anxious, frustrated, time-poor. Decision journey: Is this town liveable → Can we afford it → Is this property fairly priced → What will it be worth → What is the total cost of ownership. They cannot systematically compare towns on data, calculate whether the saving vs Dublin is real after commute costs, or know if a specific asking price is fair based on verified sold prices.

### P2 — The diaspora investor
Irish abroad (US, UK, Australia, Middle East), age 35-55, income €100K+, wants rental yield plus appreciation. Interested but nervous due to high information asymmetry. Decision journey: Where should I invest → What can I buy for my budget → What is the rental income (actual, not advertised) → What is the tax treatment → Who manages it → What is happening to my investment. They cannot run yield calculations using actual rental data, track their investment over time, or compare investment towns systematically.

### P3 — The Midlands property professional
Auctioneer, solicitor, mortgage broker, small developer, AHB employee in covered counties. Busy, practical, commercially focused. Needs data to win business and advise clients credibly. Decision journey (agent example): Client calls for valuation → What have comparables sold for → What asking price to advise → Preparing a market report → Monitoring the market. They cannot generate branded comp reports automatically, track planning systematically, or access weekly market digests without manual research.

### P4 — The existing landlord
Owns 1-5 properties in the Midlands, age 40-65, many "accidental landlords." Stressed by regulatory burden, considering exit. Decision journey: Is my property still a good investment → What would I get if I sold → Hold or exit under new rules → What is happening in my area → Am I charging the right rent. They cannot benchmark their portfolio against the market, get automated alerts, or model sell-vs-hold scenarios with actual tax calculations.

### P5 — The policy researcher / journalist (bonus)
Housing policy researchers (ESRI, UCD), journalists (Irish Times, Examiner), planners, politicians, NGOs. Needs clean, queryable data for reports and articles. Low direct revenue but enormous earned media value. If Ronan Lyons cites ProperData in a Daft report, the brand awareness exceeds any paid marketing.

---

## 3. Agentic capabilities mapped to personas

### 3.1 Semantic property search (natural language over verified data)

Subscribers ask questions in natural language. The agent interprets intent, queries PostGIS, runs calculations, and returns data-backed narrative answers. Unlike Redfin/Zillow (which search active listings), our system searches verified transactions, actual rents, energy data, and planning records. The output is analytical intelligence, not a list of properties to view.

Example queries by persona:
- P1: "What can I get for €320K in Mullingar?" → PPR query for all sales ≤330K last 18 months, grouped by type/beds, with narrative context
- P2: "Compare yield in Athlone vs Tullamore for a 3-bed" → PPR medians + RTB rents + computed yield, side-by-side
- P3: "What did 3-bed semis in Rathgowan sell for this year?" → Spatial query within estate boundary, with comparison to town median
- P4: "Is my rental yield still competitive?" → Portfolio recalculation using latest RTB data, flagging underperformance
- P5: "How many homes approved in Westmeath this quarter?" → Planning database aggregate with town breakdown

Implementation: Intent classifier (Haiku) → Tool selection and parameter extraction → MCP tool execution (PostGIS queries) → Result synthesis (Sonnet) → Narrative answer with source citations and follow-up suggestions.

### 3.2 Proactive intelligence agents (the real-time differentiator)

Instead of waiting for subscribers to ask, the system pushes intelligence when something actionable happens.

**PPR sale alerts (near real-time):** When new PPR data appears for a watched town, the agent detects new sales, runs automatic comparable analysis, classifies as routine/notable/anomalous, generates micro-analysis for notable sales, and pushes notification. Example: "New sale: 22 Greville Park, Mullingar — €330,396. This 3-bed semi sold at the median for the development. 5th sale at Greville Park this quarter, all €328-335K, suggesting price stability. BER A2. Gross yield estimate: 5.2%." No Irish property product does this — Daft sends listing alerts (asking prices), nobody sends verified sale alerts with instant comp analysis.

**Planning intelligence alerts:** When new planning grant or refusal for residential schemes (5+ units) appears, the agent geocodes the site, assesses impact (units, proximity to subscriber's area), and generates contextualised alert with supply implications.

**Regulatory change alerts:** Monitor gov.ie, RTB, Revenue, SEAI for property-relevant publications. Classify by affected persona. Generate plain-English summary with specific impact assessment. Example: the March 2026 rent reforms explained with personalised impact based on subscriber's portfolio.

**BER and energy cost intelligence:** Cross-reference new BER certificates with PPR sales. Compute and update BER premium metrics per town. Alert when premium shifts meaningfully. Example: "A/B-rated homes in Mullingar now sell for 21% more than D/E-rated — up from 14% a year ago."

### 3.3 Portfolio intelligence agent (P4 killer feature)

Subscribers log properties (address, purchase price, date, current rent, BER, mortgage). The system becomes their personal portfolio analyst:
- Valuation tracking: monthly recomputation using latest PPR comps within 3km
- Yield benchmarking: quarterly comparison of actual rent vs RTB town median
- Equity tracking: estimated value minus mortgage balance, monthly
- CGT scenario modelling: net proceeds if sold today, on-demand plus annually
- Hold-vs-sell signal: composite assessment using yield, appreciation trend, CGT position, and projected IRR
- Regulatory impact: automatic assessment of each property when rules change
- Annual portfolio review: full PDF with value, yield, equity, comps, planning, BER, regulatory changes, forward outlook

This creates permanent switching costs. The portfolio data accumulates, valuation history builds, annual reviews create a longitudinal record. Churning means losing that.

### 3.4 Conversational town comparison (P1 + P2 killer feature)

Guided conversation that helps buyers think through decisions systematically, not just side-by-side metrics. Example: "Deciding between Mullingar and Maynooth, both work in Dublin 2 days/week" → Agent pulls data for both towns (median prices, commute times, yields, pipeline, BER profiles), computes the price gap in monthly mortgage terms, quantifies the commute time trade-off, compares investment cases, and asks what to drill into next. This is the analysis a buyer currently gets from a financial advisor — the agent does it in 15 seconds backed by verified data.

### 3.5 Natural language report generation (P3 killer feature)

Professional subscribers request reports conversationally: "Generate a market report for Mullingar 3-bed semis, last 12 months, branded for Sherry FitzGerald Davitt & Davitt." Output: branded PDF with executive summary, PPR transaction table, median price trend chart, BER profile, yield estimate, planning pipeline, town ranking position, and source citations. An auctioneer walks into a valuation with this report — took 10 seconds to generate. Their competitor has a Daft printout.

### 3.6 Affordability scenario modeller (P1 killer feature)

Subscriber provides household income, deposit, FTB status, current rent, preferred towns (once — system remembers). Agent computes: max mortgage (Central Bank 3.5x LTI), max purchase price, what that buys per town (PPR data), monthly repayment vs current rent, total cost of ownership (mortgage + LPT + BER-adjusted energy + insurance), break-even analysis (when buying becomes cheaper than renting).

### 3.7 Semantic "what happened here?" search

Point at any address, Eircode, development name, or area. Agent geocodes input, runs spatial query for all PPR sales (configurable radius), pulls BER data, pulls planning applications within 1km, calculates area metrics, generates narrative summary. Example: "What's happened at Harbour Meadows?" → "7 sales in 3 months, all €337-344K, A2 rated, yield 4.7%. 2 additional planning applications within 500m for 34 further units."

---

## 4. Real-time differentiators — what nobody else offers

### 4.1 PPR velocity tracking
Monitor PPR update frequency per town as a market signal. If a town normally sees 15-20 sales/month and suddenly 35 appear in two weeks, that is a signal. Track registration velocity, flag deviations >1.5 standard deviations from 6-month rolling average, investigate clustering (one development or spread across town). A genuinely novel metric nobody is computing.

### 4.2 BER arbitrage detector
Cross-reference PPR sale prices with BER ratings to identify mispriced opportunities. If the BER premium in Mullingar is 21%, a D-rated property selling at only 10% discount represents potential value — retrofit to B2 (estimated €25-40K via SEAI grants) to unlock the full premium. Agent flags these automatically with retrofit cost estimates and post-retrofit value projections.

### 4.3 Forward supply pipeline intelligence
Track planning applications from submission through grant to commencement notice. Compute "supply pressure score" per town: residential units in pipeline at each stage as percentage of existing stock. A town with 500 units and 200 approved but uncommenced has different dynamics from one with 500 units and 20 in pipeline. Includes pipeline-to-stock ratio, estimated absorption timeline, and comparison across towns.

### 4.4 Market regime detection
Statistical analysis to detect when a local market shifts regime. Track three signals per town: PPR sale frequency (volume), PPR median price trajectory (price), planning pipeline progression (supply). Classify monthly: strong seller's market (rising prices + rising volume + low pipeline), late-cycle seller's (rising prices + falling volume), balanced/transitioning (flat prices + rising pipeline), buyer's market emerging (falling prices + high pipeline). The most sophisticated analytical capability — turns raw transaction data into a market-state indicator.

---

## 5. Capability-to-persona priority matrix

| Capability | P1 FTB | P2 Diaspora | P3 Professional | P4 Landlord | P5 Researcher |
|---|---|---|---|---|---|
| Semantic search | High | High | High | Medium | High |
| PPR sale alerts | High | Medium | High | High | Low |
| Planning alerts | Medium | Medium | High | High | Medium |
| Regulatory alerts | Medium | Medium | High | High | Medium |
| BER intelligence | High | Medium | Medium | Medium | High |
| Portfolio tracker | — | High | — | Critical | — |
| Town comparison | Critical | High | Medium | Low | Medium |
| Report generation | Low | Low | Critical | Low | High |
| Affordability model | Critical | Medium | Medium | — | Low |
| "What happened here?" | High | High | High | High | Medium |
| Supply pipeline | Medium | High | High | High | High |
| Market regime | Medium | High | Medium | High | High |
| BER arbitrage | Medium | High | Medium | Medium | Medium |
| PPR velocity | Low | Medium | High | Medium | High |

---

## 6. Phasing

**Phase 1 (Months 1-3):** Weekly pulse, static town profiles, basic PPR search, BER cross-reference.
**Phase 2 (Months 4-9):** PPR sale alerts, planning tracker, town comparison, affordability calculator, town ranking index.
**Phase 3 (Months 10-18):** Semantic search, portfolio tracker, conversational comparison, report generation, "what happened here?", supply pipeline, BER arbitrage, regulatory alerts.
**Phase 4 (Months 18+):** Market regime detection, PPR velocity, predictive pricing, MCP server, enterprise API.

---

## 7. Cost estimate

Total Phase 3 Claude API cost: approximately €40-65/month. Haiku handles classification, detection, and parsing. Sonnet handles narrative synthesis, analysis, and complex queries. The entire agentic capability stack costs less than a single professional subscriber pays.
