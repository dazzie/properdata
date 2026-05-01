'use client';

import { useState, useCallback, type FormEvent } from 'react';

// ---------------------------------------------------------------------------
// Types mirroring the API response
// ---------------------------------------------------------------------------

interface ComparableUsed {
  address: string;
  sale_date: string;
  price: number;
  distance_meters: number;
  weight: string;
  rationale: string;
}

interface ComparableResult {
  fair_value_low: number;
  fair_value_high: number;
  fair_value_central: number;
  confidence: string;
  comparables_used: ComparableUsed[];
  narrative: string;
}

interface GrantScheme {
  code: string;
  name: string;
  amount_low: number;
  amount_high: number;
  eligibility_status: string;
  rationale: string;
  conditions: string[];
}

interface GrantResult {
  total_grants_low: number;
  total_grants_high: number;
  applicable_schemes: GrantScheme[];
  net_acquisition_cost: {
    purchase_price: number;
    total_grants_central: number;
    stamp_duty: number;
    estimated_legal_fees: number;
    effective_cost: number;
  };
  narrative: string;
}

interface YieldResult {
  property: { estimated_rent_monthly: number; rent_data_source: string };
  yields: {
    gross_yield_annual: number;
    net_yield_annual: number;
    tax_adjusted_yield: number;
  };
  narrative: string;
}

interface RadonResult {
  riskPercent: number;
  riskCategory: string;
  riskDescription: string;
  context: string;
  testCost: string;
  remediationCost: string;
}

interface SolarResult {
  annualYieldKwh: number;
  yieldPerKwp: number;
  systemSizeKwp: number;
  monthlyBreakdown: Array<{ month: number; yieldKwh: number }>;
  financial: {
    systemCostEstimate: number;
    seaiGrant: number;
    netCost: number;
    annualSavings: number;
    paybackYears: number;
    lifetimeSavings25yr: number;
  };
  context: string;
}

interface AmenityCount {
  category: string;
  count: number;
  nearest: number | null;
}

interface WalkabilityResult {
  score: number;
  label: string;
  amenities: AmenityCount[];
  summary: string;
  context: string;
}

interface DcbResult {
  riskLevel: string;
  isAffectedCounty: boolean;
  context: string;
  grantEligible: boolean;
  grantDetails: string | null;
  recommendation: string;
}

interface AnalyseResponse {
  comparable: ComparableResult;
  grants: GrantResult;
  yield?: YieldResult;
  radon?: RadonResult;
  solar?: SolarResult;
  walkability?: WalkabilityResult;
  dcb?: DcbResult;
  metadata: {
    elapsedMs: number;
    agentCalls: number;
    estimatedCost: number;
    from_cache: boolean;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COUNTIES = [
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway',
  'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick',
  'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath',
  'Wexford', 'Wicklow',
];

const PRESETS: Array<{
  label: string;
  values: Record<string, string | number>;
}> = [
  {
    label: 'Mullingar Semi-D (Owner)',
    values: {
      address: '25 Rathgowan, Mullingar, Co. Westmeath',
      county: 'Westmeath',
      propertyType: 'semi_detached',
      bedrooms: 3,
      purchasePrice: 310000,
      berRating: 'D2',
      yearBuilt: 2005,
      lat: 53.5253,
      lng: -7.3398,
      buyerType: 'former_owner_occupier',
      intendedUse: 'owner_occupier',
    },
  },
  {
    label: 'Donegal Bungalow (FTB)',
    values: {
      address: '12 Shore Rd, Buncrana, Co. Donegal',
      county: 'Donegal',
      propertyType: 'bungalow',
      bedrooms: 3,
      purchasePrice: 195000,
      berRating: 'E1',
      yearBuilt: 1998,
      lat: 55.1364,
      lng: -7.4531,
      buyerType: 'first_time_buyer',
      intendedUse: 'owner_occupier',
    },
  },
  {
    label: 'Dublin Apartment (Investor)',
    values: {
      address: '14 Grand Canal Dock, Dublin 2',
      county: 'Dublin',
      propertyType: 'apartment',
      bedrooms: 2,
      purchasePrice: 450000,
      berRating: 'B2',
      yearBuilt: 2018,
      lat: 53.3389,
      lng: -6.2284,
      buyerType: 'non_occupier',
      intendedUse: 'rental',
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(n: number): string {
  return '€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const LOADING_STEPS = [
  'Querying PPR comparable sales...',
  'Running radon, solar & walkability checks...',
  'AI valuation analysis in progress...',
  'Calculating grant eligibility...',
  'Computing yield & cost model...',
  'Assembling report...',
  'Nearly there...',
];

function riskColor(level: string): string {
  if (level === 'high') return '#dc2626';
  if (level === 'medium') return '#d97706';
  if (level === 'low') return '#16a34a';
  return '#6b7280';
}

function walkabilityColor(score: number): string {
  if (score >= 70) return '#16a34a';
  if (score >= 50) return '#65a30d';
  if (score >= 25) return '#d97706';
  return '#dc2626';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalysePage() {
  const [form, setForm] = useState({
    address: '',
    county: 'Westmeath',
    propertyType: 'semi_detached',
    bedrooms: '3',
    purchasePrice: '310000',
    berRating: 'D2',
    yearBuilt: '',
    lat: '',
    lng: '',
    buyerType: 'former_owner_occupier',
    intendedUse: 'owner_occupier',
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyseResponse | null>(null);

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setForm({
      address: String(preset.values.address ?? ''),
      county: String(preset.values.county ?? 'Westmeath'),
      propertyType: String(preset.values.propertyType ?? 'semi_detached'),
      bedrooms: String(preset.values.bedrooms ?? ''),
      purchasePrice: String(preset.values.purchasePrice ?? ''),
      berRating: String(preset.values.berRating ?? ''),
      yearBuilt: String(preset.values.yearBuilt ?? ''),
      lat: String(preset.values.lat ?? ''),
      lng: String(preset.values.lng ?? ''),
      buyerType: String(preset.values.buyerType ?? 'former_owner_occupier'),
      intendedUse: String(preset.values.intendedUse ?? 'owner_occupier'),
    });
    setResult(null);
    setError(null);
  };

  const submit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setLoadingStep(0);
      setError(null);
      setResult(null);

      const stepTimer = setInterval(() => {
        setLoadingStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1));
      }, 8000);

      const body: Record<string, unknown> = {
        county: form.county,
        purchasePrice: Number(form.purchasePrice),
        buyer: { buyerType: form.buyerType, intendedUse: form.intendedUse },
      };
      if (form.address) body.address = form.address;
      if (form.propertyType) body.propertyType = form.propertyType;
      if (form.bedrooms) body.bedrooms = Number(form.bedrooms);
      if (form.berRating) body.berRating = form.berRating;
      if (form.yearBuilt) body.yearBuilt = Number(form.yearBuilt);
      if (form.lat && form.lng) {
        body.location = { lat: Number(form.lat), lng: Number(form.lng) };
      }

      try {
        const res = await fetch('/api/property/analyse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
        setResult(data as AnalyseResponse);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        clearInterval(stepTimer);
        setLoading(false);
      }
    },
    [form],
  );

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <header style={S.header}>
        <a href="/" style={S.logo}>ProperData</a>
        <h1 style={S.h1}>Property Analyser</h1>
        <p style={S.subtitle}>
          Enter a property to get AI-powered comparable valuation, grant eligibility, radon risk,
          solar potential, walkability score, and more.
        </p>
      </header>

      {/* Presets */}
      <div style={S.presets}>
        <span style={S.presetsLabel}>Quick fill:</span>
        {PRESETS.map((p) => (
          <button key={p.label} onClick={() => applyPreset(p)} style={S.presetBtn}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={submit} style={S.form}>
        <div style={S.grid}>
          <label style={S.field}>
            <span style={S.label}>Address</span>
            <input style={S.input} value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="25 Rathgowan, Mullingar" />
          </label>
          <label style={S.field}>
            <span style={S.label}>County *</span>
            <select style={S.select} value={form.county} onChange={(e) => set('county', e.target.value)}>
              {COUNTIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={S.field}>
            <span style={S.label}>Property type</span>
            <select style={S.select} value={form.propertyType} onChange={(e) => set('propertyType', e.target.value)}>
              <option value="detached">Detached</option>
              <option value="semi_detached">Semi-Detached</option>
              <option value="terraced">Terraced</option>
              <option value="apartment">Apartment</option>
              <option value="duplex">Duplex</option>
              <option value="bungalow">Bungalow</option>
            </select>
          </label>
          <label style={S.field}>
            <span style={S.label}>Bedrooms</span>
            <input style={S.input} type="number" min={1} max={10} value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
          </label>
          <label style={S.field}>
            <span style={S.label}>Purchase price * (€)</span>
            <input style={S.input} type="number" min={1} value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} required />
          </label>
          <label style={S.field}>
            <span style={S.label}>BER rating</span>
            <input style={S.input} value={form.berRating} onChange={(e) => set('berRating', e.target.value)} placeholder="e.g. D2" />
          </label>
          <label style={S.field}>
            <span style={S.label}>Year built</span>
            <input style={S.input} type="number" min={1800} max={2026} value={form.yearBuilt} onChange={(e) => set('yearBuilt', e.target.value)} placeholder="e.g. 2005" />
          </label>
          <label style={S.field}>
            <span style={S.label}>Buyer type *</span>
            <select style={S.select} value={form.buyerType} onChange={(e) => set('buyerType', e.target.value)}>
              <option value="first_time_buyer">First-Time Buyer</option>
              <option value="former_owner_occupier">Former Owner-Occupier</option>
              <option value="non_occupier">Investor / Non-Occupier</option>
            </select>
          </label>
          <label style={S.field}>
            <span style={S.label}>Intended use *</span>
            <select style={S.select} value={form.intendedUse} onChange={(e) => set('intendedUse', e.target.value)}>
              <option value="owner_occupier">Owner-Occupier</option>
              <option value="rental">Rental</option>
              <option value="mixed">Mixed</option>
            </select>
          </label>
        </div>

        <details style={S.locationDetails}>
          <summary style={S.locationSummary}>Location coordinates (enables radon, solar, walkability)</summary>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <label style={{ ...S.field, flex: 1 }}>
              <span style={S.label}>Latitude</span>
              <input style={S.input} type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="53.5253" />
            </label>
            <label style={{ ...S.field, flex: 1 }}>
              <span style={S.label}>Longitude</span>
              <input style={S.input} type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="-7.3398" />
            </label>
          </div>
        </details>

        <button type="submit" disabled={loading} style={{ ...S.submit, ...(loading ? S.submitDisabled : {}) }}>
          {loading ? 'Analysing...' : 'Analyse Property'}
        </button>
      </form>

      {/* Error */}
      {error && <div style={S.error}>{error}</div>}

      {/* Loading indicator */}
      {loading && (
        <div style={S.loadingWrap}>
          <div style={S.spinner} />
          <div style={S.loadingText}>{LOADING_STEPS[loadingStep]}</div>
          <div style={S.loadingSteps}>
            {LOADING_STEPS.map((step, i) => (
              <div key={i} style={{ ...S.stepDot, background: i <= loadingStep ? '#1D9E75' : '#d0d0d0' }} />
            ))}
          </div>
          <div style={S.loadingHint}>This takes about a minute — we&apos;re running 3 AI agents and querying multiple data sources.</div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div style={S.results}>
          {/* Metadata bar */}
          <div style={S.meta}>
            {result.metadata.from_cache && <span style={S.cacheBadge}>cached</span>}
            <span>{result.metadata.elapsedMs.toLocaleString()}ms</span>
            <span>{result.metadata.agentCalls} AI agent calls</span>
            <span>~${result.metadata.estimatedCost.toFixed(3)} cost</span>
          </div>

          {/* Enrichment cards */}
          <div style={S.cardGrid}>
            {/* Walkability */}
            {result.walkability && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <span style={S.cardIcon}>🚶</span>
                  <span style={S.cardTitle}>Walkability</span>
                </div>
                <div style={{ ...S.bigNumber, color: walkabilityColor(result.walkability.score) }}>
                  {result.walkability.score}<span style={S.bigUnit}>/100</span>
                </div>
                <div style={S.cardLabel}>{result.walkability.label}</div>
                <div style={S.amenityGrid}>
                  {result.walkability.amenities
                    .filter((a) => a.count > 0)
                    .map((a) => (
                      <div key={a.category} style={S.amenityRow}>
                        <span style={S.amenityName}>{a.category}</span>
                        <span style={S.amenityVal}>
                          {a.count}{a.nearest ? ` (${a.nearest}m)` : ''}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Radon */}
            {result.radon && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <span style={S.cardIcon}>☢️</span>
                  <span style={S.cardTitle}>Radon Risk</span>
                </div>
                <div style={{ ...S.bigNumber, color: riskColor(result.radon.riskCategory) }}>
                  {result.radon.riskPercent}%
                </div>
                <div style={{ ...S.cardLabel, color: riskColor(result.radon.riskCategory) }}>
                  {result.radon.riskCategory.toUpperCase()} RISK
                </div>
                <p style={S.cardText}>{result.radon.riskDescription}</p>
                <p style={S.cardMuted}>{result.radon.context}</p>
                <div style={S.cardFooter}>
                  <span>Test: {result.radon.testCost}</span>
                  <span>Fix: {result.radon.remediationCost}</span>
                </div>
              </div>
            )}

            {/* Solar */}
            {result.solar && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <span style={S.cardIcon}>☀️</span>
                  <span style={S.cardTitle}>Solar Potential</span>
                </div>
                <div style={{ ...S.bigNumber, color: '#d97706' }}>
                  {result.solar.annualYieldKwh.toLocaleString()}<span style={S.bigUnit}> kWh/yr</span>
                </div>
                <div style={S.cardLabel}>{result.solar.yieldPerKwp} kWh/kWp ({result.solar.systemSizeKwp}kWp system)</div>

                <div style={S.solarGrid}>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>System cost</span>
                    <span style={S.solarVal}>{eur(result.solar.financial.systemCostEstimate)}</span>
                  </div>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>SEAI grant</span>
                    <span style={{ ...S.solarVal, color: '#16a34a' }}>-{eur(result.solar.financial.seaiGrant)}</span>
                  </div>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>Net cost</span>
                    <span style={S.solarVal}>{eur(result.solar.financial.netCost)}</span>
                  </div>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>Annual savings</span>
                    <span style={{ ...S.solarVal, color: '#16a34a' }}>{eur(result.solar.financial.annualSavings)}/yr</span>
                  </div>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>Payback</span>
                    <span style={S.solarVal}>{result.solar.financial.paybackYears} years</span>
                  </div>
                  <div style={S.solarItem}>
                    <span style={S.solarLabel}>25-year savings</span>
                    <span style={{ ...S.solarVal, color: '#16a34a', fontWeight: 700 }}>{eur(result.solar.financial.lifetimeSavings25yr)}</span>
                  </div>
                </div>

                {result.solar.monthlyBreakdown.length > 0 && (
                  <div style={S.chartWrap}>
                    <div style={S.barChart}>
                      {result.solar.monthlyBreakdown.map((m) => {
                        const max = Math.max(...result.solar!.monthlyBreakdown.map((b) => b.yieldKwh));
                        const pct = max > 0 ? (m.yieldKwh / max) * 100 : 0;
                        return (
                          <div key={m.month} style={S.barCol}>
                            <div style={{ ...S.bar, height: `${pct}%` }} title={`${m.yieldKwh} kWh`} />
                            <span style={S.barLabel}>{MONTH_NAMES[m.month - 1]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DCB / Mica */}
            {result.dcb && (
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <span style={S.cardIcon}>🧱</span>
                  <span style={S.cardTitle}>Defective Blocks (Mica)</span>
                </div>
                <div style={{ ...S.bigNumber, color: riskColor(result.dcb.riskLevel) }}>
                  {result.dcb.riskLevel.toUpperCase()}
                </div>
                <p style={S.cardText}>{result.dcb.context}</p>
                <p style={S.cardMuted}>{result.dcb.recommendation}</p>
                {result.dcb.grantEligible && result.dcb.grantDetails && (
                  <div style={{ ...S.cardFooter, flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>Grant eligible</span>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>{result.dcb.grantDetails}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Comparable valuation */}
          <div style={S.section}>
            <h2 style={S.sectionTitle}>Comparable Valuation</h2>
            <div style={S.valuationBar}>
              <div style={S.valRange}>
                <span style={S.valEndpoint}>{eur(result.comparable.fair_value_low)}</span>
                <div style={S.valCentral}>
                  <span style={S.valCentralLabel}>Fair value</span>
                  <span style={S.valCentralNum}>{eur(result.comparable.fair_value_central)}</span>
                </div>
                <span style={S.valEndpoint}>{eur(result.comparable.fair_value_high)}</span>
              </div>
              <span style={S.confidence}>Confidence: {result.comparable.confidence}</span>
            </div>
            <p style={S.narrative}>{result.comparable.narrative}</p>

            {result.comparable.comparables_used.length > 0 && (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Address</th>
                      <th style={S.th}>Date</th>
                      <th style={S.th}>Price</th>
                      <th style={S.th}>Distance</th>
                      <th style={S.th}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparable.comparables_used.map((c, i) => (
                      <tr key={i} style={S.tr}>
                        <td style={S.td}>{c.address}</td>
                        <td style={S.td}>{c.sale_date}</td>
                        <td style={{ ...S.td, fontWeight: 600 }}>{eur(c.price)}</td>
                        <td style={S.td}>{c.distance_meters != null ? `${c.distance_meters.toLocaleString()}m` : '—'}</td>
                        <td style={S.td}>{c.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Grants */}
          <div style={S.section}>
            <h2 style={S.sectionTitle}>Grant Eligibility</h2>
            <div style={S.grantSummary}>
              <div>
                <span style={S.grantRange}>{eur(result.grants.total_grants_low)} – {eur(result.grants.total_grants_high)}</span>
                <span style={S.grantLabel}> potential grants</span>
              </div>
              {result.grants.net_acquisition_cost && (
                <div style={S.grantCost}>
                  Effective cost: <strong>{eur(result.grants.net_acquisition_cost.effective_cost)}</strong>
                </div>
              )}
            </div>
            {result.grants.applicable_schemes.map((s) => (
              <div key={s.code} style={S.schemeCard}>
                <div style={S.schemeName}>{s.name}</div>
                <div style={S.schemeAmount}>{eur(s.amount_low)}{s.amount_high !== s.amount_low ? ` – ${eur(s.amount_high)}` : ''}</div>
                <div style={S.schemeStatus}>{s.eligibility_status}</div>
                <p style={S.schemeRationale}>{s.rationale}</p>
              </div>
            ))}
            <p style={S.narrative}>{result.grants.narrative}</p>
          </div>

          {/* Yield (if present) */}
          {result.yield && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>Rental Yield Analysis</h2>
              <div style={S.yieldGrid}>
                <div style={S.yieldCard}>
                  <span style={S.yieldNum}>{result.yield.yields.gross_yield_annual}%</span>
                  <span style={S.yieldLabel}>Gross yield</span>
                </div>
                <div style={S.yieldCard}>
                  <span style={S.yieldNum}>{result.yield.yields.net_yield_annual}%</span>
                  <span style={S.yieldLabel}>Net yield</span>
                </div>
                <div style={S.yieldCard}>
                  <span style={S.yieldNum}>{result.yield.yields.tax_adjusted_yield}%</span>
                  <span style={S.yieldLabel}>After tax</span>
                </div>
                <div style={S.yieldCard}>
                  <span style={S.yieldNum}>{eur(result.yield.property.estimated_rent_monthly)}</span>
                  <span style={S.yieldLabel}>Est. monthly rent</span>
                </div>
              </div>
              <p style={S.narrative}>{result.yield.narrative}</p>
            </div>
          )}

          {/* Disclaimer */}
          <div style={S.disclaimer}>
            This analysis is generated by AI using verified public data sources and is provided for informational
            purposes only. It does not constitute financial, legal, or property advice. Grant eligibility is
            determined by the relevant scheme administrator. Consult a qualified professional before making
            property decisions.
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 960,
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
  },
  header: { marginBottom: '1.5rem' },
  logo: { fontSize: '0.85rem', color: '#666', textDecoration: 'none', fontWeight: 500 },
  h1: { fontSize: '2rem', fontWeight: 700, margin: '0.5rem 0 0.25rem' },
  subtitle: { fontSize: '0.95rem', color: '#666', margin: 0 },

  presets: { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' as const },
  presetsLabel: { fontSize: '0.8rem', color: '#999', fontWeight: 500 },
  presetBtn: {
    padding: '0.375rem 0.75rem', fontSize: '0.8rem', fontWeight: 500,
    background: '#f5f5f5', border: '1px solid #e0e0e0', borderRadius: '6px',
    cursor: 'pointer', fontFamily: 'inherit',
  },

  form: {
    background: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '10px',
    padding: '1.25rem', marginBottom: '1.5rem',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.75rem',
  },
  field: { display: 'flex', flexDirection: 'column' as const, gap: '0.25rem' },
  label: { fontSize: '0.75rem', fontWeight: 600, color: '#555', textTransform: 'uppercase' as const, letterSpacing: '0.03em' },
  input: {
    padding: '0.5rem 0.625rem', fontSize: '0.9rem', border: '1px solid #d0d0d0',
    borderRadius: '6px', fontFamily: 'inherit', outline: 'none',
  },
  select: {
    padding: '0.5rem 0.625rem', fontSize: '0.9rem', border: '1px solid #d0d0d0',
    borderRadius: '6px', fontFamily: 'inherit', outline: 'none', background: '#fff',
  },
  locationDetails: { marginTop: '0.75rem' },
  locationSummary: { fontSize: '0.8rem', color: '#1D9E75', cursor: 'pointer', fontWeight: 500 },
  submit: {
    marginTop: '1rem', padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 600,
    color: '#fff', background: '#1D9E75', border: 'none', borderRadius: '8px',
    cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  },
  submitDisabled: { background: '#93d5b9', cursor: 'not-allowed' },

  loadingWrap: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: '3rem 1rem', marginBottom: '1.5rem',
  },
  spinner: {
    width: 40, height: 40, border: '4px solid #e5e5e5', borderTopColor: '#1D9E75',
    borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem',
  },
  loadingText: { fontSize: '1rem', fontWeight: 600, color: '#333', marginBottom: '1rem', textAlign: 'center' as const },
  loadingSteps: { display: 'flex', gap: '6px', marginBottom: '1rem' },
  stepDot: { width: 8, height: 8, borderRadius: '50%', transition: 'background 0.3s' },
  loadingHint: { fontSize: '0.8rem', color: '#999', textAlign: 'center' as const, maxWidth: 400 },

  error: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
    padding: '1rem', color: '#991b1b', marginBottom: '1rem',
  },

  results: {},
  meta: {
    display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#999',
    padding: '0.5rem 0', marginBottom: '1rem', borderBottom: '1px solid #eee', flexWrap: 'wrap' as const,
  },
  cacheBadge: {
    background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px',
    fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' as const,
  },

  // Enrichment cards
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem', marginBottom: '2rem',
  },
  card: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    padding: '1.25rem', display: 'flex', flexDirection: 'column' as const,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' },
  cardIcon: { fontSize: '1.25rem' },
  cardTitle: { fontSize: '0.9rem', fontWeight: 700, color: '#333' },
  bigNumber: { fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 },
  bigUnit: { fontSize: '1rem', fontWeight: 500 },
  cardLabel: { fontSize: '0.8rem', fontWeight: 600, color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase' as const },
  cardText: { fontSize: '0.82rem', color: '#444', lineHeight: 1.5, margin: '0.25rem 0' },
  cardMuted: { fontSize: '0.78rem', color: '#888', lineHeight: 1.5, margin: '0.25rem 0', flex: 1 },
  cardFooter: {
    display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#666',
    borderTop: '1px solid #f0f0f0', marginTop: '0.75rem', paddingTop: '0.5rem',
  },

  amenityGrid: { marginTop: '0.5rem' },
  amenityRow: {
    display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0',
    fontSize: '0.78rem', borderBottom: '1px solid #f5f5f5',
  },
  amenityName: { color: '#555' },
  amenityVal: { fontWeight: 600, color: '#333', fontVariantNumeric: 'tabular-nums' },

  solarGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem',
    margin: '0.75rem 0',
  },
  solarItem: { display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.2rem 0' },
  solarLabel: { color: '#666' },
  solarVal: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' },

  chartWrap: { marginTop: '0.5rem', borderTop: '1px solid #f0f0f0', paddingTop: '0.5rem' },
  barChart: { display: 'flex', gap: '2px', height: 60, alignItems: 'flex-end' },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', background: '#fbbf24', borderRadius: '2px 2px 0 0', minHeight: 2 },
  barLabel: { fontSize: '0.55rem', color: '#999', marginTop: '2px' },

  // Sections
  section: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    padding: '1.25rem', marginBottom: '1rem',
  },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem' },
  narrative: { fontSize: '0.85rem', color: '#555', lineHeight: 1.6, margin: '0.5rem 0 0' },

  valuationBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: '0.5rem' },
  valRange: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '0.75rem 1rem',
  },
  valEndpoint: { fontSize: '0.9rem', color: '#555', fontWeight: 500 },
  valCentral: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center' },
  valCentralLabel: { fontSize: '0.65rem', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' as const },
  valCentralNum: { fontSize: '1.5rem', fontWeight: 800, color: '#15803d' },
  confidence: { fontSize: '0.8rem', color: '#888' },

  grantSummary: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap' as const, marginBottom: '0.75rem' },
  grantRange: { fontSize: '1.25rem', fontWeight: 700, color: '#16a34a' },
  grantLabel: { fontSize: '0.9rem', color: '#555' },
  grantCost: { fontSize: '0.85rem', color: '#555' },
  schemeCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '0.75rem', marginBottom: '0.5rem',
  },
  schemeName: { fontWeight: 600, fontSize: '0.85rem' },
  schemeAmount: { fontSize: '1rem', fontWeight: 700, color: '#16a34a' },
  schemeStatus: { fontSize: '0.7rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' as const },
  schemeRationale: { fontSize: '0.78rem', color: '#666', margin: '0.25rem 0 0' },

  yieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '0.75rem' },
  yieldCard: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    background: '#f9fafb', borderRadius: '8px', padding: '0.75rem',
  },
  yieldNum: { fontSize: '1.5rem', fontWeight: 800, color: '#1D9E75' },
  yieldLabel: { fontSize: '0.7rem', color: '#888', fontWeight: 500, textTransform: 'uppercase' as const, textAlign: 'center' as const },

  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.82rem' },
  th: {
    textAlign: 'left' as const, padding: '0.5rem 0.625rem', borderBottom: '2px solid #e5e5e5',
    fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase' as const, color: '#888',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '0.4rem 0.625rem', verticalAlign: 'top' as const },

  disclaimer: {
    fontSize: '0.72rem', color: '#999', lineHeight: 1.6, marginTop: '1.5rem',
    padding: '1rem', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee',
  },
};
