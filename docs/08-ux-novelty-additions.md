# ProperData — UX Novelty Additions

**The principle:** PMF doesn't come from feature parity with PropertyPal. It comes from making subscribers say *"I had no idea you could even know that."* This document identifies eleven additional public data sources that create genuine "wow moments" — and turns each one into a specific product feature that competitors can't replicate without years of data integration work.

**Date:** April 2026

---

## Why this matters now

The 20+ sources already mapped (PPR, RTB, BER, ePlanning, RZLT, OPW flood, Census, etc.) cover the **financial intelligence** layer — what something costs, what it yields, what grants apply. That's the rational case for subscribing.

The sources in this document cover the **lived experience** layer — what it's actually like to live there, what you're not being told, what could affect you decades from now. That's the emotional case for sharing, the "did you know?" hook that drives word-of-mouth, and the differentiator that no scraped-listing competitor can match.

These aren't add-ons. They're the moments where the product stops feeling like a property database and starts feeling like having a quietly informed friend who has read every government register so you don't have to.

---

## Tier 1 — Highest impact, must build

These four sources solve genuine information gaps that cost Irish buyers real money or real health every year. They are also legally clean, free, and addressable at the per-property level.

### 1. EPA Radon Risk Map

**The data:** The EPA published a high-resolution radon risk map in May 2022 based on indoor measurements from over 31,910 homes plus geological information. It's searchable by Eircode and address. 170,000 Irish homes are predicted to be at risk from radon — an increase of 45,000 from the previous estimate. Radon is linked to ~350 lung cancer cases in Ireland every year. Available as open data via data.gov.ie and EPA Maps.

**Why it's a "wow":** Most Irish homebuyers have heard of radon vaguely but cannot tell you whether the property they're looking at is in a high-risk area. Building Regulations TGD-C requires a radon-resisting membrane in homes built in High Radon Areas from 1 October 2023 — but for the millions of pre-2023 homes, it's caveat emptor. The information is genuinely consequential, free to access, and almost universally absent from the buying conversation.

**Product feature:** "Radon Risk: 12% — your area has a 1-in-8 probability of indoor radon above the reference level (200 Bq/m³). Properties built before May 2022 have no required mitigation. Cost to test: ~€50. Cost to remediate if elevated: €500-2,500." Then deeper context: "Of the 8 PPR sales in this area in the past year, 3 properties were built before 1990 — older homes show higher radon concentrations because of construction methods."

**The killer line for content marketing:** *"170,000 Irish homes are exposed to a cancer-causing gas. ProperData tells you if yours is one of them."*

### 2. SEAI Solar Map + PVGIS roof-level potential

**The data:** SEAI's Solar Map and the EU's PVGIS (Photovoltaic Geographical Information System) provide per-location solar yield in kWh/kWp. Ireland ranges from 817 kWh/kWp in Donegal to 965 kWh/kWp in Wexford — an 18% spread. Combined with the property address, roof orientation (estimable from satellite imagery via Google or open imagery), and the SEAI solar grant rules (€1,800 max grant, €700/kWp up to 2kWp then €200/kWp up to 4kWp), you can compute the realistic financial case for solar PV on any specific property.

**Why it's a "wow":** The existing solar calculators (PureVolt, EnergyEfficiency.ie, Solar Path) all serve installers. They want a quote. ProperData doesn't sell installations — it computes the honest economic case for a property as part of evaluating it for purchase. "If you buy this property and install 4kWp of solar, your annual generation would be 3,660 kWh, your bill savings would be €1,150/year, and after the €1,800 SEAI grant your net payback period is 6.2 years." Nobody tells buyers this *before* the purchase decision.

**Product feature:** Embedded in every property analysis. The grant calculator gains a new line item: "Solar PV potential: 4kWp system, €1,800 SEAI grant, payback 6.2 years, lifetime savings €18,400." For investor personas: "Adds €18K to discounted cash flow over 25 years, raising effective yield from 5.2% to 5.7%."

### 3. Mica/Defective Concrete Blocks risk geography

**The data:** The Defective Concrete Blocks (DCB) Grant Scheme covers properties in counties Donegal, Mayo, Clare, and Limerick (with extensions to others). The Department of Housing publishes the geographic boundaries; affected properties can claim up to 100% remediation costs. Critically, the *risk* of mica is broader than the *grant scheme* — properties built with affected blocks exist in counties that haven't yet been included.

**Why it's a "wow":** This is one of the highest-stakes pieces of property due diligence in Ireland. A €350K home with mica is potentially worth €0 without remediation, and remediation costs €100-300K+. Buyers in affected counties currently have no automated way to assess risk on a specific property — they rely on engineers' reports after they've already gone sale agreed. ProperData can flag risk based on county, build year (1980s-2010s especially), and quarry source data where available, alongside a grant-eligibility assessment if the worst happens.

**Product feature:** A risk-flag on every property in affected counties: "DCB risk indicator: Medium. Property was built 2003 in Donegal. ~4,200 properties in this Eircode area have applied to the DCB scheme. Recommend independent engineer's structural assessment before purchase. If affected, scheme covers up to 100% of remediation costs (current cap: €420K)." For diaspora buyers and returning emigrants who don't have local knowledge, this single flag could prevent catastrophic financial loss.

### 4. Walkability and 15-minute neighbourhood scoring

**The data:** OpenStreetMap (OSM) provides comprehensive amenity data — every shop, school, pub, GP surgery, park, bus stop, and supermarket in Ireland is mapped, geocoded, and openly licensed under the Open Database License. Combined with road network routing data, this enables a per-property walkability score: how many essential amenities are within a 15-minute walk?

**Why it's a "wow":** Walk Score (US) and Walkonomics (UK) have proven this is a metric people care about, but no Irish equivalent exists at scale. The "15-minute city" concept is increasingly relevant to Irish buyers — particularly Dublin escapees who don't want to lose all the amenity convenience of urban living. A walkability score per property converts an emotional concern ("but is there *anything* there?") into a concrete number with a transparent methodology.

**Product feature:** "Walkability: 72/100. Within 1km: 4 shops, 2 primary schools, 3 pubs, 1 GP surgery, 1 supermarket, 6 bus stops. The nearest secondary school is 2.3km. The nearest train station is 1.8km." For different personas, the relevant amenities differ — for families, schools and parks weight higher; for retirees, GPs and pharmacies; for Dublin escapees, train stations and broadband — so the agent personalises which amenities are highlighted.

---

## Tier 2 — Lifestyle and quality-of-life additions

These three sources don't drive primary purchase decisions, but they create the "ProperData knew about that?" moments that build subscriber loyalty and shareability.

### 5. EPA Strategic Noise Maps

**The data:** Round 4 strategic noise maps (representing 2021 traffic data, published per the EU Environmental Noise Directive) cover the Dublin, Cork, and Limerick agglomerations plus all major roads, rail lines, and airports nationally. Maps are presented as Lden (24-hour weighted average) and Lnight (night-time) indicators in dB(A). 41% of the population in those three agglomerations is exposed to road traffic noise above the 55 dB Lden threshold. Available via EPA Maps and INSPIRE download services.

**Why it's a "wow":** Noise is one of the most under-discussed property characteristics. A quiet viewing on a Sunday afternoon doesn't reveal what Tuesday rush hour sounds like. Buyers discover this after moving in, when it's too late. Strategic noise maps let you check noise exposure *before* offering — and translate the dB number into a relatable description ("equivalent to a quiet office" / "equivalent to a busy restaurant").

**Product feature:** "Noise level: 58 dB Lden (moderate). Comparable to background office chatter. The M50 is 280m to the west, contributing approximately 8 dB to ambient noise. 47 dB Lnight, which exceeds the WHO night-time guideline of 40 dB and may affect sleep quality for noise-sensitive sleepers." For rural properties outside the noise-mapped zones: "Outside major-road noise mapping area; ambient noise expected to be below 40 dB Lden based on TII traffic count of XXX vehicles/day on the nearest road."

### 6. EPA Air Quality (Real-time + historical)

**The data:** The EPA operates a national network of air quality monitoring stations measuring PM2.5, PM10, NO₂, SO₂, and O₃. Real-time and historical data are available via INSPIRE-compliant APIs. The Air Quality Index for Health (AQIH) is published nationally with daily updates.

**Why it's a "wow":** Air quality is a growing concern, particularly post-2020 (people who'd never thought about it now check it daily). For families with young children or anyone with respiratory conditions, knowing the typical air quality for an area is genuinely material. Solid-fuel burning in winter creates significant local pollution in many Irish towns — something rarely disclosed by estate agents.

**Product feature:** "Air quality: AQIH 3 (Good) at the nearest monitoring station (Mullingar, 2.1km). Winter average AQIH: 5 (Moderate) — consistent with solid-fuel domestic heating in the region. PM2.5 annual average: 8.2 μg/m³ (below WHO guideline of 5 μg/m³ but compliant with EU 2030 target of 10 μg/m³)." For asthmatic or family personas, this is decision-relevant; for everyone else, it's the kind of detail that makes the product feel comprehensive.

### 7. Light pollution / dark sky data

**The data:** GeoHive and Geological Survey Ireland publish light pollution data; Mayo's Dark Sky Park (the only IDA Gold Tier reserve in Ireland) and Kerry's International Dark-Sky Reserve set the benchmarks. Globally, NASA's VIIRS satellite imagery provides per-location light pollution measurements (Bortle scale or magnitude/arcsec²), freely available.

**Why it's a "wow":** Hard to articulate why this matters until someone moves from Dublin to a rural area and sees the Milky Way for the first time. For the Dublin escapee persona, "low light pollution — you can see the stars" is an emotional selling point that no spreadsheet captures. For diaspora returners coming back from London or New York, it's a genuine quality-of-life upgrade.

**Product feature:** Mostly emotional/contextual rather than analytical. "Light pollution: Bortle 3 (Rural sky) — the Milky Way is clearly visible, and you can see ~1,500 stars on a clear night vs ~200 in central Dublin. The nearest Dark Sky Reserve is 84km (Mayo)." Surface this in town profiles and rural property analyses; don't overweight it for urban properties.

---

## Tier 3 — Investor and professional intelligence

These four sources serve the Pro and Enterprise tiers — they're niche features that command premium pricing because they require integrating data that nobody else has connected.

### 8. CRO + Beneficial Ownership Register cross-reference

**The data:** The Companies Registration Office maintains records of every Irish-registered company including registered address. The Register of Beneficial Ownership (RBO) records ultimate beneficial owners of Irish companies. Cross-referencing these with property ownership data from Tailte Éireann (where available) reveals which properties are held by companies, partnerships, or institutional landlords vs individual owners.

**Why it's a "wow":** Property concentration in the hands of large institutional owners is one of the most politically charged issues in Irish property. Subscribers (especially landlords and tenants' rights advocates) want to know: how much of this development is owned by REITs or institutional investors? Are most of the rentals in Mullingar held by 5 large landlords or 500 small ones? Which Irish counties have the highest foreign-corporate ownership concentration? Nobody is publishing these numbers in an accessible form.

**Product feature (Pro/Enterprise):** "Ownership concentration: 73% of properties in this development are individually owned, 18% are owned by Irish-registered companies (top entity: Smith Properties Limited, owns 14 units), 9% are owned by foreign-domiciled entities. Average tenure for rental units: 4.2 years (above national average of 3.1 years), suggesting a stable landlord base." For Enterprise clients (banks, fintechs, journalists, policy researchers), this is genuinely scarce intelligence.

### 9. Met Éireann microclimate data

**The data:** Met Éireann publishes 30-year climate normals at over 100 weather stations covering rainfall, temperature, sun hours, wind speed, and frost days. Sun hours range from ~1,400/year in the northwest to over 1,650 in the southeast. Combined with topographic data from OPW LiDAR, you can interpolate microclimate characteristics for any specific location.

**Why it's a "wow":** Two properties 5km apart can have meaningfully different microclimates — east-facing slopes get morning sun but cold mornings; sheltered valleys avoid wind exposure but can have frost pockets; coastal areas have milder winters but salt-laden air that affects building durability. This data exists but is never integrated into property analysis. For retrofit decisions specifically, prevailing wind direction matters enormously for insulation prioritisation and heat pump efficiency.

**Product feature:** "Microclimate: Sun hours 1,540/year (105% of national average). Average rainfall 980mm (88% of national average). Wind exposure: Moderate (annual mean 12 km/h, predominantly south-westerly). Frost days: 32/year. Climate suitability for heat pump: Excellent (mild winters and moderate humidity)." Tied directly to retrofit ROI: "Heat pump efficiency in this microclimate is ~10% higher than the national average, improving the SEAI grant payback by 4 months."

### 10. TII traffic counts

**The data:** Transport Infrastructure Ireland publishes Annual Average Daily Traffic (AADT) counts for all national roads as open data. For regional and local roads, local authorities publish counts intermittently. This converts the abstract "main road" into a specific number: 14,500 vehicles per day past this property's nearest junction.

**Why it's a "wow":** "It's a quiet road" is a property advert cliché. TII data lets you turn that into "1,200 vehicles per day on this road, vs the national average of 4,800 for similar regional roads — genuinely quiet" or "23,000 vehicles per day, you'll hear traffic constantly." Combined with EPA noise mapping, it produces a verified, defensible noise/traffic exposure score.

**Product feature:** "Road traffic: AADT 1,840 vehicles/day on R400 (the nearest road within 100m). 38% below the national regional-road average. Heavy goods vehicles: 4% (national average 8%). Compatible with descriptions of 'quiet road' from PPR sale listings."

### 11. Companies-owned and short-term-rental concentration

**The data:** Combining CRO data, Census 2022 vacancy/short-term rental indicators, and the Fáilte Ireland register of registered tourist accommodation reveals where short-term lets (Airbnb-style) are concentrated. The 2024 Short-Term Letting register, when fully operational, will provide direct property-level data.

**Why it's a "wow":** For long-term buyers in tourist areas (Galway, Kerry, Cork coastal towns, Dublin city centre), the share of properties operating as short-term lets is a major quality-of-life and community-character factor. For investors, it's a market-density signal — a town saturated with short-term lets has ceiling pricing because the marginal new entrant captures less. For policy researchers and councils, it's evidence base for regulatory decisions.

**Product feature:** "Short-term letting density: 14% of housing stock in this Eircode area is registered as short-term tourist accommodation (national average: 2.1%). This contributes to elevated property prices but also reduced long-term rental supply. Town has been added to the proposed RPZ extension areas under consideration in late 2026."

---

## How these sources reshape the product

The 20+ sources in the master summary establish *intelligence completeness* — every relevant financial fact is covered. The 11 sources in this document establish *experiential richness* — every reasonable question a thoughtful buyer might ask is answered.

The combined effect changes the product positioning. Rather than "we analyse property data," the proposition becomes:

*"For any Irish property, we tell you what it sold for, what comparable properties yield, what grants you can claim, what your total cost of ownership will be, what flood risk applies, what radon exposure to expect, how much solar your roof could generate, how loud the road will be at 3am, what the air quality is, who else owns property in this development, what climate this microregion has, and how walkable the neighbourhood actually is. All from verified public records, computed in seconds, personalised to your situation."*

That's not a property newsletter. That's a comprehensive property intelligence service that nobody — Daft, MyHome, Sherry FitzGerald, anyone — comes close to offering.

---

## Implementation priority

The order isn't accidental. It follows the **highest UX impact per implementation hour** principle.

| Sprint | Source | Effort | Why this order |
|---|---|---|---|
| Sprint 4 | EPA Radon Risk Map | 1 day | Free, well-documented, single GeoJSON ingestion. Single highest-impact addition; goes straight into the "wow" bucket. |
| Sprint 4 | SEAI Solar / PVGIS | 2-3 days | Per-county yields are static lookups; roof-level estimation needs Google Maps API or similar. Integrates directly with grant calculator. |
| Sprint 5 | Walkability via OSM | 3-4 days | OSM data extraction for Ireland is ~5GB; PostGIS routing for 15-min isochrones is well-established. Delivers a flagship metric per property. |
| Sprint 5 | DCB / Mica risk | 1-2 days | Geographic boundaries are public; build-year and county filtering is trivial. Critical for NW Ireland properties. |
| Sprint 6 | EPA Noise Maps | 2 days | INSPIRE GeoJSON download; spatial overlay against property location. Limited to mapped agglomerations + major roads. |
| Sprint 6 | EPA Air Quality | 1-2 days | Live API; fetch nearest station data per property. Annual averages for area context. |
| Sprint 7 | Met Éireann microclimate | 2-3 days | Static normals at 100+ stations; spatial interpolation for arbitrary points. Ties into retrofit ROI. |
| Sprint 7 | TII traffic counts | 1-2 days | Open data download; nearest-road join. Adds depth to noise scoring. |
| Phase 3+ | Light pollution | 1 day | NASA VIIRS data; static per-location lookup. Low priority but high emotional resonance for rural property analyses. |
| Phase 3+ | CRO + RBO ownership | 5-10 days | Bulk data downloads; entity resolution is non-trivial. Pro/Enterprise feature, build when there's revenue to justify. |
| Phase 3+ | Short-term letting density | 3-5 days | Awaits full operation of the 2024 register. Integrate when data quality is sufficient. |

Total Tier 1 + Tier 2 effort: approximately 12-18 working days spread across Sprints 4-7. This represents roughly 15% of the build effort already planned, and probably doubles the product's perceived value to subscribers and shareability potential.

---

## The compounding effect

Each source is individually valuable but the real PMF unlock is in the *combinations*:

- **Radon × build year × ventilation type** = "Pre-1990 homes in High Radon Areas without modern ventilation systems show 3.2x higher elevated readings"
- **Solar potential × roof orientation × current BER × electricity cost** = "Installing 4kWp here saves €1,150/year, payback 6.2 years, BER improves from D2 to C1"
- **Noise × Lnight × bedroom location** = "47 dB Lnight on the front facade; rear bedrooms typically experience 5-8 dB less"
- **Walkability × commute × broadband × schools** = "Composite Dublin-escapee score: 78/100"
- **Microclimate × heat pump efficiency × SEAI grant** = "Heat pump payback in this microclimate is 18 months faster than national average"
- **Mica risk × build year × DCB scheme eligibility** = "If affected, scheme covers €420K — but recommend engineer's report before purchase"

These cross-source signals are the proprietary intelligence layer. Individual data sources are public; the cross-referencing logic, the agent prompts that interpret them in plain English, and the persona-specific weighting are not. That's the moat that makes the product genuinely defensible — a competitor would need to re-derive every one of these connections.

---

## What this means for the pitch

Adding these eleven sources changes three specific things in how ProperData should be positioned:

**For investors:** The "regulatory tailwind" story strengthens. The EU EPBD mandates standardised EPC databases by May 2026, but it's just one of many open-data and INSPIRE-compliant directives. Strategic noise maps, air quality data, radon information, and solar potential are all required by EU directives and published as open data. The same architecture that ingests Irish data ingests Spanish, Portuguese, French, German, and Italian equivalents — all governed by the same EU directives. The expansion story is a configuration change, not a rebuild.

**For subscribers:** The product description becomes concrete and shareable. "We tell you the radon risk, solar potential, noise level, and 15-minute walkability score for any Irish property" is a complete sentence anyone can repeat to a friend. "We analyse property data" is forgettable.

**For content marketing:** Every source is an article. "170,000 Irish homes are at radon risk — is yours one of them?" "Where does the sun shine longest in Ireland?" "The 10 quietest streets in Dublin." "How much solar power could your roof actually generate?" Each piece is data-led, locally relevant, search-engine friendly, and impossible for a competitor to replicate without the underlying infrastructure. The content engine becomes substantially richer with the same editorial workload.
