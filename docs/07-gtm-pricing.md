# Go-to-Market and Pricing Strategy v2

**Product:** The Midlands Property Analyst
**Revision:** 2.0 — Public data foundation, partnership-ready architecture
**Date:** March 2026
**Supersedes:** GTM v1.0

---

## 1. Strategic reframe — what changed

The v1 strategy assumed scraping Daft.ie and MyHome.ie as primary data sources. Legal analysis identified material risk: both platforms explicitly prohibit scraping in their ToS, enforceable under Irish contract law and potentially the EU Database Directive's sui generis right. Building a revenue-generating SaaS product on scraped data creates risk that grows with commercial success.

This v2 strategy is built entirely on legally clean public data sources with a clear path to commercial data partnerships once traction is proven. The constraint is also a positioning advantage: "Every number in our analysis comes from verified public records — not scraped asking prices" is a trust signal that differentiates against any future competitor who cuts corners.

### Data foundation (v2)

| Source | What it gives us | Legal status |
|---|---|---|
| Property Price Register | Every residential sale price since 2010 | Statutory public register, free CSV, no restrictions |
| CSO StatBank | House price index, population, employment, completions | Government open data, free API |
| RTB/ESRI Rent Index | Actual rents paid (not asking), county-level | Public research, free quarterly data |
| ePlanning / National Planning Map | All planning applications, geocoded, 10-year history | Statutory public registers |
| SEAI BER Research Tool | Energy ratings, updated nightly, anonymised bulk data | Open data, free with registration |
| data.gov.ie | Various open datasets including BER, CSO, local authority | Open licence |
| GeoDirectory | Geocoding, vacancy data, building use | Commercial licence (€2-5K/yr) |

### What we don't have (and how we work around it)

| Missing data point | Source it would come from | Workaround |
|---|---|---|
| Asking prices | Daft / MyHome | PPR gives sold prices. Sold prices > asking prices for investment analysis. Position this as a feature: "We track what properties actually sold for, not what agents hoped for." |
| Time on market | Daft / MyHome | Not available from public sources. Exclude from initial product. Add when partnership secured. |
| Active listing counts | Daft / MyHome | Use planning grants + commencement notices as a forward supply indicator instead. Different metric, arguably more useful for investors. |
| Property photos/descriptions | Daft / MyHome | Link out to Daft/MyHome for property detail. Our value is analysis, not listings. |
| Asking rents | Daft / Rent.ie | RTB data gives actual registered rents — more accurate than asking. Position as advantage: "Based on what tenants actually pay, not what landlords advertise." |

---

## 2. Repositioned value proposition

### v1 positioning (deprecated)
"Data-driven property intelligence covering listings, sales, rentals, and planning across the Irish Midlands."

### v2 positioning
**"The only Irish property research built entirely on verified transaction data — not scraped asking prices."**

This reframe turns a constraint into a moat. The product narrative becomes:

*"When you read that house prices in Mullingar are 'around €350K,' that number usually comes from asking prices on listings sites — what sellers hope to get. We use something better: the Property Price Register, which records what buyers actually paid. Combined with the RTB's data on what tenants actually pay in rent (not advertised rents), SEAI's building energy data, and the complete planning pipeline from every local authority, we give you the full picture of what's really happening in Irish property markets — with every number traceable to a verified public source."*

This positioning:
- Differentiates immediately from anyone aggregating Daft/MyHome data
- Builds trust with a sceptical audience (property buyers are inherently wary of estate agent spin)
- Creates a defensible brand identity around data integrity
- Is 100% true and legally clean

---

## 3. Product definition — what we actually ship

### 3.1 Free tier — "The hook"

| Content | Frequency | Data source | Description |
|---|---|---|---|
| Weekly market pulse | Sunday PM | PPR + CSO | Headline transaction data: notable sales, town medians, price momentum. 500 words. |
| Monthly town deep-dive | Monthly | PPR + RTB + BER + ePlanning | One town per month. Comprehensive: prices, yields (using RTB actual rents), BER premium analysis, planning pipeline, affordability calc. 2,000+ words with charts. |
| Regulatory alerts | As needed | Gov.ie, RTB, Revenue | Plain-English explainers on policy changes (RZLT, HAP thresholds, RPZ rules, March 2026 rent reforms). |

**Why people subscribe for free:** The monthly town deep-dive is the flagship. Nobody else publishes a 2,000-word data-backed profile of Mullingar's property market. It's the kind of content that gets shared in WhatsApp groups of people house-hunting in the area.

### 3.2 Insider tier — €15/month or €129/year

| Content | Frequency | Data source | Description |
|---|---|---|---|
| Full PPR transaction analysis | Weekly | PPR | Every sale in covered towns: price, address, new/second-hand, with AI-computed comparable assessment. Not just a list — each sale contextualised against recent comps. |
| Yield calculator reports | Monthly | PPR + RTB | Town-by-town gross and net yield estimates using PPR purchase prices and RTB actual rents. Includes cost breakdown (management fees, insurance, void, LPT). |
| Planning pipeline tracker | Fortnightly | ePlanning + National Planning Map | New applications, grants, refusals. Focused on residential schemes of 5+ units. Includes map view. |
| BER premium analysis | Monthly | SEAI + PPR | What energy-efficient homes command over poorly rated ones, by town. Actionable for buyers weighing renovation vs new-build. |
| Town ranking index | Quarterly | All sources | Composite score: price momentum, yield, supply pipeline, affordability, commute, BER profile. The flagship analytical product. |
| Subscriber Q&A | Ongoing | N/A | Curated responses to subscriber questions. Published as a weekly digest. |

**Pricing rationale — why €15/month (up from €12 in v1):** The product is now positioned as verified data analysis, not a listings aggregator. This commands a slight premium. €15/month is still in the "no-brainer" zone for someone making a €300K+ purchase decision. The annual price at €129 (effective €10.75/month, 28% discount) is the primary conversion target.

**What's different from v1:** No asking prices, no active listing counts, no time-on-market data. Instead, the product leads with what public data does better: actual transaction prices, actual rents paid, energy efficiency analysis, and planning supply intelligence. These are metrics that listings sites don't offer.

### 3.3 Professional tier — €49/month or €449/year

| Content | Frequency | Data source | Description |
|---|---|---|---|
| Everything in Insider | As above | As above | Full access to all analytical content |
| Branded PDF reports | On-demand | All sources | Town reports with agent/firm branding. Formatted for client presentations. |
| CSV data exports | Monthly | PPR + RTB + BER + ePlanning | Raw data tables for covered towns. Agents can import into their own tools. |
| AI analyst (Phase 3) | Unlimited | All sources via MCP | Natural language queries against the property database. |
| API access | Ongoing | All sources | 1,000 requests/day. Programmatic access to all derived metrics. |
| Priority support | Ongoing | N/A | Direct email, 24hr response SLA. |

**Pricing rationale — why €49/month (up from €39 in v1):** The professional tier is stronger in v2 because the data is legally unimpeachable. An auctioneer handing a branded report to a vendor needs to know the numbers are defensible. "Based on Property Price Register data and RTB registered tenancies" is a credibility statement that "based on scraped Daft data" never could be. The premium is justified.

### 3.4 Enterprise tier — custom (€500-2,000/month)

Unchanged from v1. API access, white-label reports, MCP server, bulk data feeds. Targeted at fintechs, mortgage brokers, and large agency groups.

---

## 4. Pricing architecture

### 4.1 Tier comparison

```
FREE                    INSIDER                 PROFESSIONAL
€0                      €15/mo | €129/yr        €49/mo | €449/yr
                        (€10.75/mo effective)   (€37.42/mo effective)

Weekly pulse (summary)  Weekly pulse (full)      Everything in Insider
Monthly town profile    Full PPR analysis        Branded PDF reports
Regulatory alerts       Yield calculator         CSV data exports
                        Planning tracker         AI analyst (Phase 3)
                        BER premium analysis     API access (1K/day)
                        Town rankings            Priority support
                        Subscriber Q&A
                        Price alerts
```

### 4.2 Founding member programme

First 100 paid subscribers: **€89/year** (vs €129 standard). Locked for life. Includes:
- "Founding Member" designation
- Quarterly Zoom AMA with the analyst
- Input into coverage expansion priorities (which towns to add next)
- Early access to Phase 3 tools (AI analyst, API)

### 4.3 Break-even analysis (revised)

| Cost component | Monthly |
|---|---|
| PostgreSQL (managed — Railway/Neon) | €25 |
| n8n (self-hosted on Railway) | €15 |
| API server (Railway/Fly.io) | €15 |
| Redis (cache) | €5 |
| Claude API (agents) | €10 |
| GeoDirectory licence (amortised) | €30 |
| Eircode/Autoaddress lookups | €10 |
| Domain + DNS | €2 |
| Substack (10% of paid revenue) | Variable |
| Stripe fees (3% of paid revenue) | Variable |
| **Fixed costs** | **~€112/month** |

**Break-even:** 8 Insider subscribers (monthly) or 11 Insider subscribers (annual). This is trivially achievable.

**Target unit economics:**

| Metric | Insider (annual) | Pro (annual) |
|---|---|---|
| Revenue | €129/year | €449/year |
| Substack take (10%) | €12.90 | €44.90 |
| Stripe (3%) | €3.87 | €13.47 |
| Net revenue | €112.23/year | €390.63/year |
| Expected lifetime | 2.5 years | 3 years |
| LTV | €280.58 | €1,171.89 |
| Target CAC | <€35 | <€100 |
| LTV:CAC | 8:1 | 11.7:1 |

---

## 5. Go-to-market strategy

### 5.1 Phase 1 — Audience building (Months 1-3)

**Goal:** 500 free subscribers, brand established, data pipelines automated.

#### 5.1.1 Launch content — the "verified data" trilogy

Three launch pieces, all published in Week 1, all designed to establish the brand positioning around verified transaction data:

**Piece 1: "What Mullingar houses actually sold for in the last 12 months"**

Pull every PPR sale in Mullingar for the trailing 12 months. Compute median by beds, by property type, by new/second-hand. Chart the price trend. Cross-reference with BER data to show the energy efficiency premium. Compare to RTB actual rents to compute verified yield.

This is the prototype issue. It demonstrates the entire analytical methodology in a single piece. Nobody else has published this for Mullingar — or any Midlands town.

**Piece 2: "The asking price illusion: why Irish property data is broken"**

A provocative, data-backed argument that asking prices (the basis of most property "research") are systematically misleading. Use PPR data to show that Midlands properties routinely sell at different levels to asking. Argue that verified transaction data from the PPR is the only reliable basis for property decisions. This is the brand manifesto — it explains why the product exists and why the "public data only" approach is actually superior.

This piece is designed for virality on Irish property Twitter and Reddit. It challenges the conventional wisdom and positions the publication as the data-integrity alternative.

**Piece 3: "Ireland's hidden property hotspot: why the Midlands is outperforming Dublin"**

The macro story. Use CSO RPPI data to show ~15% Midlands growth vs ~6% Dublin. Use PPR to show the absolute price differential (€328K Mullingar vs €495K Dublin median). Use RTB data to show rental yields of 5-7% in the Midlands vs 3-4% in Dublin. Use ePlanning to show the supply pipeline. Use CSO population data to show inward migration.

This is the "hook" piece that draws national attention to a regional story. It's the content that gets picked up by Irish media because it's a genuine data-driven insight that challenges the Dublin-centric narrative.

#### 5.1.2 Distribution channels

**Twitter/X — primary growth engine**

Strategy unchanged from v1, but with sharper positioning:
- Weekly data thread (Sunday evening): "This week in Midlands property — verified PPR data 🧵"
- Every data point carries a source attribution: "Source: Property Price Register, sale registered 15 Mar 2026"
- Data card format: branded image with single stat + source citation
- Engage with every property tweet with a data correction or addition: "Actually, the PPR shows the median in Mullingar is €328K — based on 199 verified sales in 2025"
- Target engagement with Ronan Lyons, Lorcan Sirr, John McCartney, Irish property journalists

**Reddit r/irishpersonalfinance — secondary growth engine**

Strategy unchanged from v1. Post genuine analysis as text posts. The "verified data" angle plays extremely well here — this community is allergic to estate agent spin and hungry for rigorous analysis.

Key thread concepts:
- "I analysed every PPR sale in Mullingar for the last 12 months — here's the real picture"
- "What rental yields actually look like in Midlands towns (using RTB actual rent data, not Daft asking prices)"
- "The BER premium in Westmeath: how much more do energy-efficient homes sell for?"

**LinkedIn — professional seeding**

- Publish the monthly town deep-dive as a LinkedIn article
- Target connection requests to Midlands auctioneers, solicitors, and mortgage brokers
- The "verified data" positioning resonates strongly with professionals who need defensible numbers

**SEO — long-term compounding**

Every town profile becomes a permanent page. Target:
- "Mullingar property prices 2026" — zero competition
- "Westmeath house prices" — minimal competition
- "Mullingar rental yield" — literally nobody is targeting this
- "Athlone property market" — same story

The SEO play is stronger in v2 because the content is structured data (PPR-sourced price tables, BER analysis, planning data) which Google loves to index and surface in featured snippets.

**Podcast outreach**

Irish property podcasts are actively seeking data-backed guests:
- The Property Panel
- Irish Property Podcast
- AskPaul
- The Week in Housing (academic, but influential)

Pitch: "I've built automated analysis of every property sale in the Irish Midlands using the PPR, RTB data, and ePlanning. I can give your listeners the real numbers on what's happening in Ireland's fastest-growing property market."

#### 5.1.3 Phase 1 targets

| Metric | Month 1 | Month 2 | Month 3 |
|---|---|---|---|
| Free subscribers | 100 | 250 | 500 |
| Twitter followers | 50 | 150 | 350 |
| Email open rate | 55%+ | 48%+ | 43%+ |
| Town profiles published | 3 (launch) | 5 | 7 |
| PPR pipeline operational | ✓ | | |
| RTB data integrated | | ✓ | |
| ePlanning pipeline operational | | | ✓ |
| BER cross-referencing live | | ✓ | |

### 5.2 Phase 2 — Monetisation (Months 4-9)

**Goal:** 150 paid subscribers, €2,000+ MRR, Pro tier validated.

#### 5.2.1 Paywall activation (Month 4)

After 500+ free subscribers with 40%+ open rate, launch Insider tier.

**Soft paywall model:** Free readers get the weekly pulse (summary + headline stats). The full PPR transaction analysis, yield calculations, BER premium data, planning tracker, and town rankings move behind the paywall.

**Key conversion content — the "what's behind the paywall" preview:**

Each free weekly pulse includes a teaser of the paid content:

*"This week in Mullingar: 7 sales registered on the PPR, median €342K. The standout: a 3-bed semi at Lakepoint sold for €395K — 16% above the area median. Insider subscribers: see the full comparable analysis showing why this sale signals a premium pocket forming around the lake end of town, plus this week's yield calculation update and 3 new planning grants. [Unlock full analysis →]"*

The tease must be specific enough to demonstrate value but incomplete enough to drive conversion.

#### 5.2.2 Founding member launch sequence

**Week -1 (before paywall goes live):**
Email to all free subscribers: "Next Sunday, I'm launching the paid tier. Here's exactly what Insider subscribers will get that free readers won't. [Full feature breakdown]. The first 100 subscribers get Founding Member pricing at €89/year — locked for life. This rate won't be available again."

**Launch day:**
Full email with pricing, founding member offer, and the complete paid edition unlocked for 24 hours. "Read this week's full issue now — this is what every Sunday will look like for Insider subscribers."

**Week +1:**
Twitter thread: "I launched a paid property research product last week. Here's exactly what 500+ free readers told me they wanted to pay for, and what the data says about whether it's worth it." (Meta-transparency about the business — builds trust.)

**Week +2:**
"30 founding member spots remaining" urgency email.

#### 5.2.3 Pro tier launch (Month 6)

Direct outreach to property professionals in covered counties. This is a hand-sell, not a marketing funnel.

**Step 1:** Compile list of every active PSRA-registered auctioneer/agent in Westmeath, Offaly, Laois, Longford. Cross-reference with Law Society solicitor register for property-active practices.

**Step 2:** Send personalised email with a sample branded PDF report for their specific town:

*"[Agent name] — I've built automated property market analysis for Mullingar using Property Price Register data, RTB rental data, and SEAI energy ratings. Attached is a sample report for Mullingar that you could hand to a vendor at your next valuation appointment. Every number is sourced from verified public records.*

*I'm offering a 30-day free trial of our Professional tier, which includes branded reports with your agency logo, CSV data exports, and weekly transaction analysis for all Midlands towns. Would you be open to trying it?"*

**Step 3:** Follow up with a phone call within 3 days. This is a market of ~200 professionals across four counties. Personal outreach is feasible and dramatically more effective than digital marketing for B2B conversion.

**Target:** 10 Pro subscribers by Month 9 (€490/month).

#### 5.2.4 Partnership outreach (concurrent with Phase 2)

With 150+ paid subscribers and a proven product, approach Daft and MyHome for a data partnership from a position of strength:

*"We're the Midlands Property Analyst — 2,000 subscribers, 150 paying, covering 10+ towns. Our readers are exactly your target audience: active property buyers and investors in the Midlands. Currently our analysis is built entirely on PPR, RTB, and public data. Adding your listings data would let us offer asking-vs-sold analysis and active stock tracking, with every listing linking directly to your platform. We're proposing a data partnership: we'd pay for structured access to Midlands listings data, and every property reference in our analysis would deep-link to your site. You gain targeted, high-intent referral traffic from exactly the audience that converts to property enquiries."*

This pitch is dramatically stronger than approaching cold at Month 0 with no audience and no revenue.

#### 5.2.5 Phase 2 targets

| Metric | Month 4 | Month 6 | Month 9 |
|---|---|---|---|
| Free subscribers | 700 | 1,200 | 2,000 |
| Insider paid | 20 | 65 | 120 |
| Pro paid | 0 | 5 | 10 |
| MRR | €300 | €1,220 | €2,290 |
| Towns covered | 6 | 8 | 10 |
| Data partnership outreach | — | Initiated | In negotiation |

### 5.3 Phase 3 — Product expansion (Months 10-18)

**Goal:** 500+ paid subscribers, €6,000+ MRR, web app, API/MCP live.

#### 5.3.1 Web app launch

Town explorer with interactive map. Personalised dashboards. Interactive yield calculator (ungated — lead magnet). AI analyst chat for Insider and Pro tiers.

The web app is the platform that listings data plugs into when a partnership is secured. The architecture is partnership-ready: a data source abstraction layer means adding Daft/MyHome data is a configuration change, not an architectural change.

#### 5.3.2 MCP server launch

Expose all property intelligence tools via MCP. This is the forward-positioning play:
- Subscriber agents can query the property database conversationally
- External AI agents can access via authenticated MCP
- Daft/MyHome partnership pitch includes: "We'll help you build an MCP server for your data — AI agents are going to access property data whether platforms like it or not. Better to control the access pattern and monetise it."

#### 5.3.3 Geographic expansion

| Phase | Towns | Coverage |
|---|---|---|
| Launch (M1) | Mullingar, Athlone, Tullamore | 3 towns |
| Expansion 1 (M3) | Longford, Portlaoise, Birr | 6 towns |
| Expansion 2 (M6) | Carlow, Kilkenny, Navan, Maynooth | 10 towns |
| Expansion 3 (M9) | Enfield, Edenderry, Roscommon, Ballinasloe | 14 towns |
| Phase 3 (M12) | Full commuter belt | 25+ towns |
| National (M18) | Cork, Galway, Limerick suburbs | 50+ towns |

Each town addition is low-cost: add to `towns` table, let the PPR/BER/ePlanning pipelines auto-ingest, refresh materialised views. The agentic pipeline handles town-level analysis generation automatically.

#### 5.3.4 Listings data integration (when partnership secured)

When a Daft or MyHome partnership is finalised, the product gains:
- Asking-vs-sold gap analysis (asking price from partner, sold price from PPR)
- Active stock counts per town
- Time-on-market tracking
- Property description and photo linking (deep-link to partner site)
- Listing alert notifications for subscribers

This becomes a premium feature layer — potentially a new tier or an Insider upsell at €5/month.

---

## 6. Revenue projections (revised)

### 6.1 Conservative scenario (public data only, no partnership)

| Month | Free subs | Insider | Pro | MRR | ARR |
|---|---|---|---|---|---|
| 3 | 500 | 0 | 0 | €0 | €0 |
| 6 | 1,200 | 65 | 5 | €1,220 | €14,640 |
| 9 | 2,000 | 120 | 10 | €2,290 | €27,480 |
| 12 | 3,500 | 200 | 20 | €3,980 | €47,760 |
| 18 | 6,000 | 400 | 40 | €7,960 | €95,520 |
| 24 | 10,000 | 700 | 80 | €14,420 | €173,040 |

### 6.2 Accelerated scenario (partnership secured at Month 9)

| Month | Free subs | Insider | Pro | Enterprise | MRR | ARR |
|---|---|---|---|---|---|---|
| 12 | 5,000 | 350 | 35 | 2 | €7,525 | €90,300 |
| 18 | 10,000 | 700 | 60 | 5 | €15,000 | €180,000 |
| 24 | 20,000 | 1,500 | 120 | 10 | €35,280 | €423,360 |

The partnership scenario accelerates growth because listings data adds the "active market" layer (what's for sale right now) to the "historical analysis" layer (what has sold), making the product relevant to a much wider audience including casual browsers and early-stage searchers.

---

## 7. Retention strategy (revised for public data product)

### 7.1 The retention challenge without listings data

Without active listings, the product is strongest for investors and serious buyers — people who need analytical depth, not a browsing experience. This is a feature for retention: analytical subscribers are stickier than casual browsers because the value compounds over time (watching price momentum across quarters, tracking planning pipeline progression, monitoring yield shifts).

### 7.2 Retention mechanics

**The "property portfolio tracker" (Insider tier)**

Let subscribers log properties they own or are watching. Each logged property gets:
- Automated quarterly valuation update (based on PPR comps in the area)
- BER comparison (how does this property's energy rating compare to recent sales?)
- Planning activity alerts (any new applications within 1km?)
- Yield recalculation when new RTB data publishes

This creates a personalised, ongoing reason to stay subscribed well beyond the initial purchase decision.

**The "town watchlist" (Insider tier)**

Subscribers select 1-5 towns to watch. They receive personalised weekly digests covering only their watched towns. This personalisation increases relevance and reduces churn — you're not paying for Birr analysis when you only care about Mullingar.

**Annual review report (Pro tier)**

Every December, Pro subscribers receive a personalised "Year in Property" PDF:
- Every PPR sale in their watched towns for the year
- Price trend chart for their specific market segment
- Yield movement over the year
- Planning pipeline changes
- Regulatory changes that affected their market
- Forward-looking assessment for the coming year

This becomes a document they use for financial planning and tax preparation. It's the kind of thing that justifies the annual renewal on its own.

**Quarterly town ranking reveal (all tiers)**

The town ranking index is published quarterly with a countdown and teaser campaign:
- Week before: "Next week: the Q2 2026 Midlands Town Rankings. Which town just jumped 4 places?"
- Launch day: Free tier gets the top 3 towns with summary scores. Insider tier gets the full ranking with per-factor breakdowns and narrative.
- This creates a recurring event that drives engagement and social sharing.

### 7.3 Churn targets

| Tier | Expected monthly churn | Target by Month 12 |
|---|---|---|
| Insider (monthly) | 6-8% | 4-5% |
| Insider (annual) | 2-3% effective | 1.5-2% |
| Pro (monthly) | 4-5% | 2-3% |
| Pro (annual) | 1-2% effective | <1.5% |

---

## 8. Content calendar — first 12 weeks

### Weeks 1-2: Launch

| Day | Content | Channel | Tier |
|---|---|---|---|
| Mon W1 | "What Mullingar houses actually sold for" | Substack + Twitter thread | Free |
| Wed W1 | "The asking price illusion" | Substack + Reddit | Free |
| Fri W1 | "Ireland's hidden property hotspot" | Substack + LinkedIn | Free |
| Sun W1 | Weekly pulse #1 | Substack | Free |
| Sun W2 | Weekly pulse #2 | Substack | Free |
| Fri W2 | Twitter data card: Mullingar median price | Twitter | Free |

### Weeks 3-6: Cadence established

| Content | Frequency | Channel |
|---|---|---|
| Weekly pulse | Every Sunday | Substack |
| Twitter data thread | Every Sunday evening | Twitter |
| Reddit analysis post | Fortnightly | Reddit |
| LinkedIn article | Monthly | LinkedIn |
| Town profile: Athlone | Week 4 | Substack |
| Town profile: Tullamore | Week 6 | Substack |
| BER premium explainer | Week 5 | Substack |

### Weeks 7-10: Depth building

| Content | Channel |
|---|---|
| Town profile: Longford | Substack |
| "How to calculate rental yield using public data" (methodology piece) | Substack + Reddit |
| Planning pipeline explainer: what approved developments mean for prices | Substack |
| Town profile: Portlaoise | Substack |
| First podcast guest appearance | Podcast |
| Founding member pre-announcement | Substack email |

### Weeks 11-12: Monetisation prep

| Content | Channel |
|---|---|
| "What I've learned from 10 weeks of analysing Midlands property data" (retrospective) | Substack + Twitter + Reddit |
| Full sample paid edition unlocked for 48 hours | Substack |
| Founding member launch | Substack |
| Town profile: Birr | Substack |
| Pro tier sample report sent to 20 Midlands agents | Direct email |

---

## 9. Risk mitigation (revised)

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| PPR data lag (4-8 weeks) | Analysis feels stale | Medium | Frame as "verified" vs "real-time" trade-off. Supplement with planning data (real-time) and CSO monthly index. |
| RTB quarterly lag (~6 months) | Yield calcs use dated rents | Medium | Use RTB for baseline calibration, clearly date-stamp all yield figures. When partnership secured, supplement with current asking rents. |
| Low subscriber conversion | Revenue below targets | Medium | Validate with 3 months of free content. Adjust paywall positioning. Increase professional outreach if consumer demand is weak. |
| Competitor enters with scraped data | Faster, more "complete" product | Medium | Lean into verified-data positioning. Competitors using scraped data carry legal risk. Data integrity is the moat. |
| No data partnership materialises | Product remains public-data-only | Medium | The public-data product is viable standalone at lower growth. 80% of value, 0% of legal risk. |
| ePlanning portal structure changes | Scraper breaks | Low-Med | Use National Planning Map (ArcGIS) as fallback. Multiple council portals provide redundancy. |
| GeoDirectory licence cost increases | Geocoding budget grows | Low | Nominatim/OpenStreetMap as free fallback for basic geocoding. GeoDirectory primarily needed for vacancy data. |
| Single-person capacity | Can't cover more towns, answer subscriber queries | High | Automate maximally via agentic pipeline. Hire part-time at €6K MRR. |

---

## 10. Decision gates (revised)

| Gate | Timing | Criteria | Pass → | Fail → |
|---|---|---|---|---|
| Launch paid tier? | Month 3 | 400+ free subs, 40%+ open rate, 3+ town profiles | Activate Insider tier | Extend free phase, adjust content |
| Launch Pro tier? | Month 6 | 60+ Insider subs, 3+ professional enquiries | Launch Pro, begin agent outreach | Focus on Insider, defer Pro |
| Approach Daft/MyHome? | Month 6 | 1,000+ free subs, 50+ paid subs, established brand | Send partnership pitch | Wait until Month 9, build more traction |
| Build web app? | Month 9 | 150+ paid subs, €1,500+ MRR, 5+ Pro subs | Begin Phase 3 dev | Continue newsletter-only |
| Hire? | €6K MRR | Capacity limiting growth | Part-time editor/analyst (€2K/mo) | Automate more |
| Expand nationally? | Month 12 | 300+ paid subs, consistent growth, <5% churn | Add Cork, Galway, Limerick suburbs | Deepen Midlands coverage |
| Raise capital? | Month 18 | 500+ paid, €6K+ MRR, clear PMF | Consider seed/angel | Bootstrap, reduce burn |

---

## 11. Competitive positioning summary

| Competitor | What they offer | Our advantage |
|---|---|---|
| Daft.ie reports | National quarterly macro reports (Ronan Lyons) | Town-level granularity they don't offer. Weekly vs quarterly. |
| Irish Times property | Journalism, Dublin-focused | Data-driven, not narrative. Midlands coverage. Structured analysis vs articles. |
| Savills / JLL / CBRE | Institutional research, commercial focus | Residential focus. Consumer-accessible pricing. Regional not national. |
| PropertyData.co.uk | UK property analytics (the closest model) | Ireland-specific. They don't cover Ireland. We follow their playbook for a different market. |
| r/irishpersonalfinance | Free community discussion, anecdotal | Systematic, data-backed, weekly cadence. We're the source the community cites. |
| No direct Irish competitor | — | First mover in data-driven Irish regional property intelligence. The gap is real and nobody is filling it. |

---

## 12. The 30-second pitch

*"The Midlands Property Analyst is Ireland's first data-driven property research product built entirely on verified public records. We turn the Property Price Register, RTB rental data, SEAI energy ratings, and the national planning database into actionable intelligence for buyers, investors, and property professionals. Published weekly, covering every Midlands town, with every number traceable to a verified source. No scraped data, no estate agent spin — just what properties actually sold for, what tenants actually pay, and what's actually being built."*
