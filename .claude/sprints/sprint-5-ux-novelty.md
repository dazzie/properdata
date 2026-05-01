# Sprint 5 — UX Novelty: Radon, Solar, Mica, Walkability

**Goal**: Add four Tier 1 data sources that create "wow moments" — radon risk, solar potential, DCB/mica risk, and walkability scoring. These are the features that make ProperData feel fundamentally different from listing sites.

**Estimated time**: 6–8 days.

**Prerequisites**: Sprint 4 complete. 6 towns active. PPR data national. Property analysis endpoint live.

---

## Task 5.1 — EPA Radon Risk Map ingestion

Ingest the EPA's high-resolution radon risk map data. Published May 2022, based on 31,910+ indoor measurements. Available via data.gov.ie / EPA Maps as GeoJSON or via WMS/WFS.

Create `packages/scrapers/src/radon.ts`:

```typescript
export async function ingestRadonRisk(): Promise<{ inserted: number; skipped: number }>;
```

Schema: add `radon_risk` table:
- `id`, `grid_id` (unique identifier for the geographic unit)
- `geometry` (polygon — the grid cell or small area boundary)
- `risk_percent` (probability of indoor radon above 200 Bq/m³ reference level)
- `risk_category` ('high' | 'medium' | 'low')
- `measurement_count` (number of indoor measurements in the area)

Query function: `getRadonRisk({ lng, lat })` — ST_Contains point-in-polygon lookup.

Output format for property analysis: "Radon Risk: 12% — your area has a 1-in-8 probability of indoor radon above the reference level (200 Bq/m³)."

**Test**: For a Mullingar coordinate, returns a valid radon risk percentage.

---

## Task 5.2 — SEAI Solar / PVGIS potential

Compute per-location solar PV yield using PVGIS (EU open data) and integrate with the grant calculator.

Create `packages/db/src/queries/solar.ts`:

```typescript
export async function getSolarPotential(opts: {
  lat: number;
  lng: number;
  roofArea?: number;
  systemSizeKwp?: number;
}): Promise<SolarPotentialResult>;
```

Pipeline:
1. Call PVGIS API (`re.jrc.ec.europa.eu/api/v5_3/PVcalc`) with coordinates, optimal angle, crystalline silicon
2. Parse annual yield (kWh/kWp), monthly breakdown
3. Compute financial case: system cost, SEAI grant (€700/kWp up to 2kWp, €200/kWp 2-4kWp, max €2,400), bill savings at current electricity rate, payback period
4. Cache results by rounded coordinates (0.01° = ~1km precision)

No bulk ingestion needed — PVGIS is queried on-demand per property.

**Test**: For Mullingar coordinates, returns ~900 kWh/kWp annual yield, payback ~6-7 years.

---

## Task 5.3 — Walkability scoring via OpenStreetMap

Build a walkability score per property using OSM amenity data and PostGIS distance calculations.

Create `packages/db/src/queries/walkability.ts`:

```typescript
export async function getWalkabilityScore(opts: {
  lat: number;
  lng: number;
  persona?: 'family' | 'investor' | 'retiree' | 'commuter';
}): Promise<WalkabilityResult>;
```

Pipeline:
1. Ingest OSM amenity data for Ireland into a PostGIS `amenities` table (schools, shops, GPs, pharmacies, pubs, supermarkets, bus stops, train stations, parks)
2. For a given point, query amenities within 1km, 2km, 5km radii
3. Score 0-100 based on weighted counts per category
4. Persona-specific weighting (families: schools/parks heavy; commuters: train stations heavy)
5. Return breakdown: "Within 1km: 4 shops, 2 primary schools, 3 pubs, 1 GP, 1 supermarket, 6 bus stops"

Data source: Overpass API or Geofabrik Ireland extract (PBF → PostGIS via osm2pgsql).

Cron: monthly refresh of amenity data.

**Test**: Mullingar town centre scores 60+ (decent amenity access); rural townland scores < 30.

---

## Task 5.4 — DCB / Mica risk geography flagging

Flag properties in counties affected by defective concrete blocks (mica/pyrite).

Create `packages/db/src/queries/dcb-risk.ts`:

```typescript
export async function getDcbRisk(opts: {
  county: string;
  yearBuilt?: number;
}): Promise<DcbRiskResult>;
```

Implementation:
1. Hardcode affected counties: Donegal, Mayo, Clare, Limerick, Sligo (confirmed), plus at-risk counties
2. Risk scoring based on county + build year (1980s-2010s = highest risk)
3. Include DCB grant scheme details (up to 100% remediation, current cap €420K)
4. Reference the scheme's geographic extensions over time

No bulk data ingestion needed — this is a rule-based lookup using county and build year.

**Test**: Donegal property built 2003 returns "High" risk with grant eligibility details.

---

## Task 5.5 — Wire into property analysis endpoint

Update `/api/property/analyse` to include radon, solar, walkability, and DCB risk in the response.

Add optional fields to the `AnalyseResponse`:
- `radon_risk`: percentage, category, context
- `solar_potential`: yield, payback, grant, savings
- `walkability`: score, breakdown, persona-weighted
- `dcb_risk`: risk level, grant eligibility, recommendation

These run in parallel with existing comparable/grant/yield analysis.

**Test**: Full property analysis for a Mullingar address returns all four new data points.

---

## Done when

- [ ] Radon risk queryable by coordinates, returns percentage + category
- [ ] Solar potential returns yield, payback, and grant calculation per property
- [ ] Walkability score with amenity breakdown per property
- [ ] DCB/mica risk flagged for affected counties with grant details
- [ ] All four wired into the property analysis endpoint
- [ ] All queries have PostGIS spatial indexes where needed
