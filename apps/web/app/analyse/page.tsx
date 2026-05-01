'use client';

import { useState, useCallback, useRef, useEffect, type FormEvent } from 'react';

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

interface SearchResult {
  id: number;
  sale_date: string;
  price: string;
  address_raw: string;
  address_normalised: string | null;
  county: string;
  eircode: string | null;
  property_type: string | null;
  is_new: boolean;
  description: string | null;
  lat: number | null;
  lng: number | null;
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

function eur(n: number | null | undefined): string {
  if (n == null) return '—';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ address_search: q, limit: '10' });
        const res = await fetch(`/api/property/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.rows ?? []);
          setSearchOpen(true);
        }
      } catch {
        // silently fail search
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  const nominatimSearch = useCallback(async (q: string) => {
    const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'ie' });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': 'ProperData/1.0' },
    });
    if (res.ok) {
      const results = await res.json();
      if (results.length > 0) {
        return { lat: String(results[0].lat), lng: String(results[0].lon) };
      }
    }
    return null;
  }, []);

  const geocodeAddress = useCallback(async (address: string, county: string) => {
    try {
      // 1. Try full address
      const full = await nominatimSearch(`${address}, ${county}, Ireland`);
      if (full) return full;

      // 2. Strip house number, try estate/road + town + county
      const stripped = address.replace(/^\d+\s*/, '');
      if (stripped !== address) {
        const estate = await nominatimSearch(`${stripped}, ${county}, Ireland`);
        if (estate) return estate;
      }

      // 3. Extract town from address (last part before Co./County) and search town + county
      const parts = address.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const town = parts.find((p) => !p.match(/^\d/) && !p.match(/^Co\.?\s/i));
        if (town) {
          const townResult = await nominatimSearch(`${town}, ${county}, Ireland`);
          if (townResult) return townResult;
        }
      }

      // 4. Last resort: just the county
      const countyResult = await nominatimSearch(`${county}, Ireland`);
      if (countyResult) return countyResult;
    } catch {
      // geocoding is best-effort
    }
    return null;
  }, [nominatimSearch]);

  const selectProperty = useCallback(async (p: SearchResult) => {
    setSearchQuery(p.address_normalised ?? p.address_raw);
    setSearchOpen(false);
    setResult(null);
    setError(null);

    let lat = p.lat != null ? String(p.lat) : '';
    let lng = p.lng != null ? String(p.lng) : '';

    setForm({
      address: p.address_normalised ?? p.address_raw,
      county: p.county || 'Westmeath',
      propertyType: p.property_type ?? 'unknown',
      bedrooms: '',
      purchasePrice: String(Math.round(Number(p.price))),
      berRating: '',
      yearBuilt: '',
      lat,
      lng,
      buyerType: 'former_owner_occupier',
      intendedUse: 'owner_occupier',
    });

    if (!lat || !lng) {
      setGeocoding(true);
      const geo = await geocodeAddress(
        p.address_normalised ?? p.address_raw,
        p.county,
      );
      setGeocoding(false);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        setForm((f) => ({ ...f, lat, lng }));
      }
    }
  }, [geocodeAddress]);

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

      {/* Property search */}
      <div ref={searchRef} style={S.searchWrap}>
        <label style={S.field}>
          <span style={S.label}>Search PPR sales to auto-fill</span>
          <div style={S.searchInputWrap}>
            <input
              style={S.searchInput}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Type an address, e.g. Rathgowan Mullingar..."
            />
            {searching && <span style={S.searchSpinner} />}
          </div>
        </label>
        {searchOpen && searchResults.length > 0 && (
          <div style={S.dropdown}>
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                style={S.dropdownItem}
                onClick={() => selectProperty(r)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span style={S.dropdownAddress}>{r.address_normalised ?? r.address_raw}</span>
                <span style={S.dropdownMeta}>
                  {eur(Number(r.price))} &middot; {r.county} &middot; {r.sale_date}
                  {r.property_type && r.property_type !== 'unknown' ? ` · ${r.property_type.replace('_', '-')}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
        {searchOpen && searchResults.length === 0 && !searching && (
          <div style={S.dropdown}>
            <div style={S.dropdownEmpty}>No matching sales found</div>
          </div>
        )}
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

        <details style={S.locationDetails} open={!!(form.lat && form.lng)}>
          <summary style={S.locationSummary}>
            Location coordinates (enables radon, solar, walkability)
            {geocoding && <span style={S.geocodingBadge}>geocoding...</span>}
            {!geocoding && form.lat && form.lng && <span style={S.coordsBadge}>coordinates set</span>}
            {!geocoding && !form.lat && !form.lng && <span style={S.noCoordsHint}>no coordinates — enrichments will be skipped</span>}
          </summary>
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

      {/* Results — Decision Cards */}
      {result && (
        <div style={S.results}>
          {/* Metadata bar */}
          <div style={S.meta}>
            {result.metadata.from_cache && <span style={S.cacheBadge}>cached</span>}
            <span>{result.metadata.elapsedMs.toLocaleString()}ms</span>
            <span>{result.metadata.agentCalls} AI agents</span>
            <span>~${result.metadata.estimatedCost.toFixed(3)}</span>
          </div>

          {/* Executive summary strip */}
          <div style={S.execSummary}>
            <div style={S.execItem}>
              <span style={S.execLabel}>Fair Value</span>
              <span style={S.execValue}>{eur(result.comparable.fair_value_central)}</span>
              <span style={S.execSub}>{result.comparable.confidence} confidence</span>
            </div>
            <div style={S.execItem}>
              <span style={S.execLabel}>Grant Upside</span>
              <span style={{ ...S.execValue, color: '#16a34a' }}>{eur(result.grants.total_grants_high)}</span>
              <span style={S.execSub}>{result.grants.applicable_schemes?.length ?? 0} schemes</span>
            </div>
            {result.grants.net_acquisition_cost && (
              <div style={S.execItem}>
                <span style={S.execLabel}>Effective Cost</span>
                <span style={S.execValue}>{eur(result.grants.net_acquisition_cost.effective_cost)}</span>
                <span style={S.execSub}>after grants + fees</span>
              </div>
            )}
            {result.yield && (
              <div style={S.execItem}>
                <span style={S.execLabel}>Net Yield</span>
                <span style={{ ...S.execValue, color: '#1D9E75' }}>{result.yield.yields.net_yield_annual}%</span>
                <span style={S.execSub}>{result.yield.yields.tax_adjusted_yield}% after tax</span>
              </div>
            )}
          </div>

          {/* Decision Cards */}
          <div style={S.decisionGrid}>

            {/* 1. Valuation */}
            <div style={S.dCard}>
              <div style={S.dCardHead}>
                <div style={S.dCardIcon}>1</div>
                <div>
                  <div style={S.dCardTitle}>Valuation</div>
                  <div style={S.dCardHeadline}>
                    {eur(result.comparable.fair_value_low)} – {eur(result.comparable.fair_value_high)}
                  </div>
                </div>
                <div style={{ ...S.confidenceBadge, background: result.comparable.confidence === 'high' ? '#dcfce7' : result.comparable.confidence === 'medium' ? '#fef9c3' : '#fee2e2', color: result.comparable.confidence === 'high' ? '#166534' : result.comparable.confidence === 'medium' ? '#854d0e' : '#991b1b' }}>
                  {result.comparable.confidence}
                </div>
              </div>
              <div style={S.dCardBody}>
                <div style={S.valBar}>
                  <span style={S.valBarEnd}>{eur(result.comparable.fair_value_low)}</span>
                  <div style={S.valBarFill}>
                    <div style={S.valBarCenter}>{eur(result.comparable.fair_value_central)}</div>
                  </div>
                  <span style={S.valBarEnd}>{eur(result.comparable.fair_value_high)}</span>
                </div>
              </div>
              <details style={S.expandable}>
                <summary style={S.expandSummary}>View {result.comparable.comparables_used?.length ?? 0} comparables and analysis</summary>
                <div style={S.expandContent}>
                  {result.comparable.comparables_used?.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={S.table}>
                        <thead>
                          <tr>
                            <th style={S.th}>Address</th>
                            <th style={S.th}>Date</th>
                            <th style={S.th}>Price</th>
                            <th style={S.th}>Dist.</th>
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
                  <p style={S.narrative}>{result.comparable.narrative}</p>
                </div>
              </details>
            </div>

            {/* 2. Grant Opportunity */}
            <div style={S.dCard}>
              <div style={S.dCardHead}>
                <div style={S.dCardIcon}>2</div>
                <div>
                  <div style={S.dCardTitle}>Grant Opportunity</div>
                  <div style={{ ...S.dCardHeadline, color: '#16a34a' }}>
                    {eur(result.grants.total_grants_low)} – {eur(result.grants.total_grants_high)}
                  </div>
                </div>
                <div style={{ ...S.confidenceBadge, background: '#dcfce7', color: '#166534' }}>
                  {result.grants.applicable_schemes?.length ?? 0} schemes
                </div>
              </div>
              <div style={S.dCardBody}>
                {result.grants.net_acquisition_cost && (
                  <div style={S.effectiveCost}>
                    <div style={S.costRow}>
                      <span>Purchase price</span><span>{eur(result.grants.net_acquisition_cost.purchase_price)}</span>
                    </div>
                    <div style={S.costRow}>
                      <span>Stamp duty + legal</span><span>{eur((result.grants.net_acquisition_cost.stamp_duty ?? 0) + (result.grants.net_acquisition_cost.estimated_legal_fees ?? 0))}</span>
                    </div>
                    <div style={{ ...S.costRow, color: '#16a34a' }}>
                      <span>Grants (est.)</span><span>-{eur(result.grants.net_acquisition_cost.total_grants_central)}</span>
                    </div>
                    <div style={{ ...S.costRow, fontWeight: 700, borderTop: '2px solid #e5e5e5', paddingTop: '0.375rem', marginTop: '0.25rem' }}>
                      <span>Effective cost</span><span>{eur(result.grants.net_acquisition_cost.effective_cost)}</span>
                    </div>
                  </div>
                )}
              </div>
              <details style={S.expandable}>
                <summary style={S.expandSummary}>View grant-by-grant breakdown</summary>
                <div style={S.expandContent}>
                  {result.grants.applicable_schemes?.map((s) => (
                    <div key={s.code} style={S.schemeCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={S.schemeName}>{s.name}</span>
                        <span style={S.schemeAmount}>{eur(s.amount_low)}{s.amount_high !== s.amount_low ? ` – ${eur(s.amount_high)}` : ''}</span>
                      </div>
                      <div style={S.schemeStatus}>{s.eligibility_status}</div>
                      <p style={S.schemeRationale}>{s.rationale}</p>
                      {s.conditions?.length > 0 && (
                        <ul style={S.conditionList}>
                          {s.conditions.map((cond, ci) => <li key={ci} style={S.conditionItem}>{cond}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                  <p style={S.narrative}>{result.grants.narrative}</p>
                </div>
              </details>
            </div>

            {/* 3. Risk Flags */}
            {(result.radon || result.dcb) && (
              <div style={S.dCard}>
                <div style={S.dCardHead}>
                  <div style={S.dCardIcon}>3</div>
                  <div>
                    <div style={S.dCardTitle}>Risk Flags</div>
                    <div style={S.dCardHeadline}>
                      {[
                        result.radon ? `Radon: ${result.radon.riskCategory}` : null,
                        result.dcb ? `DCB: ${result.dcb.riskLevel}` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {(() => {
                    const worst = result.radon?.riskCategory === 'high' || result.dcb?.riskLevel === 'high' ? 'high'
                      : result.radon?.riskCategory === 'medium' || result.dcb?.riskLevel === 'medium' ? 'medium' : 'low';
                    return (
                      <div style={{ ...S.confidenceBadge, background: worst === 'high' ? '#fee2e2' : worst === 'medium' ? '#fef9c3' : '#dcfce7', color: worst === 'high' ? '#991b1b' : worst === 'medium' ? '#854d0e' : '#166534' }}>
                        {worst} risk
                      </div>
                    );
                  })()}
                </div>
                <div style={S.dCardBody}>
                  <div style={S.riskGrid}>
                    {result.radon && (
                      <div style={S.riskItem}>
                        <div style={{ ...S.riskBadge, background: riskColor(result.radon.riskCategory) }}>{result.radon.riskPercent}%</div>
                        <div>
                          <div style={S.riskName}>Radon</div>
                          <div style={S.riskSub}>{result.radon.riskCategory} risk</div>
                        </div>
                      </div>
                    )}
                    {result.dcb && (
                      <div style={S.riskItem}>
                        <div style={{ ...S.riskBadge, background: riskColor(result.dcb.riskLevel) }}>{result.dcb.riskLevel.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={S.riskName}>Defective Blocks</div>
                          <div style={S.riskSub}>{result.dcb.isAffectedCounty ? 'Affected county' : 'Not in affected area'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <details style={S.expandable}>
                  <summary style={S.expandSummary}>View risk detail and remediation</summary>
                  <div style={S.expandContent}>
                    {result.radon && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Radon</div>
                        <p style={S.cardText}>{result.radon.riskDescription}</p>
                        <p style={S.cardMuted}>{result.radon.context}</p>
                        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', color: '#555', marginTop: '0.5rem' }}>
                          <span>Test cost: {result.radon.testCost}</span>
                          <span>Remediation: {result.radon.remediationCost}</span>
                        </div>
                      </div>
                    )}
                    {result.dcb && (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Defective Concrete Blocks</div>
                        <p style={S.cardText}>{result.dcb.context}</p>
                        <p style={S.cardMuted}>{result.dcb.recommendation}</p>
                        {result.dcb.grantEligible && result.dcb.grantDetails && (
                          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '6px', fontSize: '0.8rem' }}>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>Grant eligible: </span>
                            <span style={{ color: '#555' }}>{result.dcb.grantDetails}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            {/* 4. Retrofit / Solar */}
            {result.solar && (
              <div style={S.dCard}>
                <div style={S.dCardHead}>
                  <div style={S.dCardIcon}>4</div>
                  <div>
                    <div style={S.dCardTitle}>Retrofit & Solar</div>
                    <div style={S.dCardHeadline}>
                      {result.solar.annualYieldKwh.toLocaleString()} kWh/yr
                    </div>
                  </div>
                  <div style={{ ...S.confidenceBadge, background: '#fef9c3', color: '#854d0e' }}>
                    {result.solar.financial.paybackYears}yr payback
                  </div>
                </div>
                <div style={S.dCardBody}>
                  <div style={S.solarSummaryGrid}>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>System</span>
                      <span style={S.solarSummaryVal}>{result.solar.systemSizeKwp}kWp</span>
                    </div>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>Cost</span>
                      <span style={S.solarSummaryVal}>{eur(result.solar.financial.systemCostEstimate)}</span>
                    </div>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>SEAI Grant</span>
                      <span style={{ ...S.solarSummaryVal, color: '#16a34a' }}>-{eur(result.solar.financial.seaiGrant)}</span>
                    </div>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>Net Cost</span>
                      <span style={{ ...S.solarSummaryVal, fontWeight: 700 }}>{eur(result.solar.financial.netCost)}</span>
                    </div>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>Annual Saving</span>
                      <span style={{ ...S.solarSummaryVal, color: '#16a34a' }}>{eur(result.solar.financial.annualSavings)}</span>
                    </div>
                    <div style={S.solarSummaryItem}>
                      <span style={S.solarSummaryLabel}>25yr Return</span>
                      <span style={{ ...S.solarSummaryVal, color: '#16a34a', fontWeight: 700 }}>{eur(result.solar.financial.lifetimeSavings25yr)}</span>
                    </div>
                  </div>
                </div>
                <details style={S.expandable}>
                  <summary style={S.expandSummary}>View monthly generation profile</summary>
                  <div style={S.expandContent}>
                    {result.solar.monthlyBreakdown.length > 0 && (
                      <div style={S.chartWrap}>
                        <div style={S.barChart}>
                          {result.solar.monthlyBreakdown.map((m) => {
                            const max = Math.max(...result.solar!.monthlyBreakdown.map((b) => b.yieldKwh));
                            const pct = max > 0 ? (m.yieldKwh / max) * 100 : 0;
                            return (
                              <div key={m.month} style={S.barCol}>
                                <div style={S.barValue}>{m.yieldKwh}</div>
                                <div style={{ ...S.bar, height: `${pct}%` }} title={`${m.yieldKwh} kWh`} />
                                <span style={S.barLabel}>{MONTH_NAMES[m.month - 1]}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <p style={S.cardMuted}>{result.solar.context}</p>
                  </div>
                </details>
              </div>
            )}

            {/* 5. Location & Walkability */}
            {result.walkability && (
              <div style={S.dCard}>
                <div style={S.dCardHead}>
                  <div style={S.dCardIcon}>5</div>
                  <div>
                    <div style={S.dCardTitle}>Location & Walkability</div>
                    <div style={S.dCardHeadline}>
                      {result.walkability.score}/100 — {result.walkability.label}
                    </div>
                  </div>
                  <div style={{ ...S.walkScore, color: walkabilityColor(result.walkability.score) }}>
                    {result.walkability.score}
                  </div>
                </div>
                <div style={S.dCardBody}>
                  <p style={S.cardText}>{result.walkability.summary}</p>
                </div>
                <details style={S.expandable}>
                  <summary style={S.expandSummary}>View amenity breakdown</summary>
                  <div style={S.expandContent}>
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
                    <p style={S.cardMuted}>{result.walkability.context}</p>
                  </div>
                </details>
              </div>
            )}

            {/* 6. Rental Yield (conditional) */}
            {result.yield && (
              <div style={S.dCard}>
                <div style={S.dCardHead}>
                  <div style={S.dCardIcon}>6</div>
                  <div>
                    <div style={S.dCardTitle}>Rental Yield</div>
                    <div style={S.dCardHeadline}>
                      {result.yield.yields.net_yield_annual}% net · {eur(result.yield.property.estimated_rent_monthly)}/mo
                    </div>
                  </div>
                </div>
                <div style={S.dCardBody}>
                  <div style={S.yieldGrid}>
                    <div style={S.yieldCard}>
                      <span style={S.yieldNum}>{result.yield.yields.gross_yield_annual}%</span>
                      <span style={S.yieldLabel}>Gross</span>
                    </div>
                    <div style={S.yieldCard}>
                      <span style={S.yieldNum}>{result.yield.yields.net_yield_annual}%</span>
                      <span style={S.yieldLabel}>Net</span>
                    </div>
                    <div style={S.yieldCard}>
                      <span style={S.yieldNum}>{result.yield.yields.tax_adjusted_yield}%</span>
                      <span style={S.yieldLabel}>After tax</span>
                    </div>
                    <div style={S.yieldCard}>
                      <span style={S.yieldNum}>{eur(result.yield.property.estimated_rent_monthly)}</span>
                      <span style={S.yieldLabel}>Monthly rent</span>
                    </div>
                  </div>
                  <p style={{ ...S.cardMuted, fontSize: '0.72rem', marginTop: '0.25rem' }}>
                    Source: {result.yield.property.rent_data_source}
                  </p>
                </div>
                <details style={S.expandable}>
                  <summary style={S.expandSummary}>View yield analysis and assumptions</summary>
                  <div style={S.expandContent}>
                    <p style={S.narrative}>{result.yield.narrative}</p>
                  </div>
                </details>
              </div>
            )}

          </div>

          {/* Disclaimer */}
          <div style={S.disclaimer}>
            This analysis is generated by AI using verified public data sources (PPR, RTB, SEAI, EPA, OSM).
            It does not constitute financial, legal, or property advice. Grant eligibility is determined by
            the relevant scheme administrator. Comparable valuations reflect market data, not recommendations.
            Consult a qualified professional before making property decisions.
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

  searchWrap: { position: 'relative' as const, marginBottom: '1rem' },
  searchInputWrap: { position: 'relative' as const },
  searchInput: {
    width: '100%', padding: '0.75rem 1rem', fontSize: '1rem', border: '2px solid #1D9E75',
    borderRadius: '10px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' as const,
    background: '#fff',
  },
  searchSpinner: {
    position: 'absolute' as const, right: 12, top: '50%', transform: 'translateY(-50%)',
    width: 18, height: 18, border: '2px solid #e5e5e5', borderTopColor: '#1D9E75',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
  dropdown: {
    position: 'absolute' as const, top: '100%', left: 0, right: 0, zIndex: 50,
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)', marginTop: '4px', maxHeight: 360,
    overflowY: 'auto' as const,
  },
  dropdownItem: {
    display: 'flex', flexDirection: 'column' as const, width: '100%', textAlign: 'left' as const,
    padding: '0.75rem 1rem', border: 'none', borderBottom: '1px solid #f0f0f0',
    background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
  },
  dropdownAddress: { fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' },
  dropdownMeta: { fontSize: '0.78rem', color: '#888', marginTop: '2px' },
  dropdownEmpty: { padding: '1rem', fontSize: '0.85rem', color: '#999', textAlign: 'center' as const },

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
  locationSummary: { fontSize: '0.8rem', color: '#1D9E75', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' as const },
  geocodingBadge: {
    fontSize: '0.7rem', color: '#d97706', background: '#fffbeb', padding: '1px 8px',
    borderRadius: '4px', fontWeight: 600, animation: 'spin 1.5s linear infinite',
  },
  coordsBadge: {
    fontSize: '0.7rem', color: '#16a34a', background: '#f0fdf4', padding: '1px 8px',
    borderRadius: '4px', fontWeight: 600,
  },
  noCoordsHint: {
    fontSize: '0.7rem', color: '#dc2626', fontWeight: 500,
  },
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
    padding: '0.5rem 0', marginBottom: '0.75rem', borderBottom: '1px solid #eee', flexWrap: 'wrap' as const,
  },
  cacheBadge: {
    background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px',
    fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' as const,
  },

  // Executive summary strip
  execSummary: {
    display: 'flex', gap: '1px', background: '#e5e5e5', borderRadius: '12px',
    overflow: 'hidden', marginBottom: '1.25rem',
  },
  execItem: {
    flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: '1rem 0.5rem', background: '#fff', minWidth: 0,
  },
  execLabel: { fontSize: '0.65rem', fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  execValue: { fontSize: '1.35rem', fontWeight: 800, color: '#1a1a1a', marginTop: '0.125rem' },
  execSub: { fontSize: '0.7rem', color: '#aaa', marginTop: '0.125rem' },

  // Decision cards
  decisionGrid: { display: 'flex', flexDirection: 'column' as const, gap: '0.75rem' },
  dCard: {
    background: '#fff', border: '1px solid #e5e5e5', borderRadius: '10px',
    overflow: 'hidden',
  },
  dCardHead: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0',
  },
  dCardIcon: {
    width: 28, height: 28, borderRadius: '50%', background: '#1D9E75', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
  },
  dCardTitle: { fontSize: '0.72rem', fontWeight: 600, color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
  dCardHeadline: { fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' },
  confidenceBadge: {
    marginLeft: 'auto', padding: '0.25rem 0.625rem', borderRadius: '20px',
    fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' as const, flexShrink: 0,
  },
  dCardBody: { padding: '0.75rem 1.25rem' },

  // Expandable detail
  expandable: { borderTop: '1px solid #f0f0f0' },
  expandSummary: {
    padding: '0.625rem 1.25rem', fontSize: '0.78rem', fontWeight: 600, color: '#1D9E75',
    cursor: 'pointer', listStyle: 'none' as const,
  },
  expandContent: { padding: '0 1.25rem 1rem' },

  // Valuation bar
  valBar: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
    padding: '0.5rem 0.75rem',
  },
  valBarEnd: { fontSize: '0.82rem', color: '#666', fontWeight: 500, whiteSpace: 'nowrap' as const },
  valBarFill: { flex: 1, height: 6, background: 'linear-gradient(90deg, #bbf7d0, #16a34a)', borderRadius: 3, position: 'relative' as const, display: 'flex', justifyContent: 'center' },
  valBarCenter: { position: 'absolute' as const, top: -20, fontSize: '0.85rem', fontWeight: 800, color: '#15803d' },

  // Effective cost breakdown
  effectiveCost: { fontSize: '0.85rem' },
  costRow: { display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', color: '#444' },

  // Risk flags
  riskGrid: { display: 'flex', gap: '1.5rem', flexWrap: 'wrap' as const },
  riskItem: { display: 'flex', alignItems: 'center', gap: '0.625rem' },
  riskBadge: {
    width: 36, height: 36, borderRadius: '50%', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
  },
  riskName: { fontSize: '0.85rem', fontWeight: 600, color: '#333' },
  riskSub: { fontSize: '0.75rem', color: '#888' },

  // Solar summary grid
  solarSummaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem',
  },
  solarSummaryItem: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    padding: '0.5rem', background: '#fafafa', borderRadius: '6px',
  },
  solarSummaryLabel: { fontSize: '0.65rem', fontWeight: 600, color: '#888', textTransform: 'uppercase' as const },
  solarSummaryVal: { fontSize: '0.95rem', fontWeight: 700, color: '#333', fontVariantNumeric: 'tabular-nums' },

  // Walk score circle
  walkScore: { marginLeft: 'auto', fontSize: '1.75rem', fontWeight: 800, flexShrink: 0 },

  // Chart
  chartWrap: { marginBottom: '0.5rem' },
  barChart: { display: 'flex', gap: '3px', height: 80, alignItems: 'flex-end' },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', background: '#fbbf24', borderRadius: '2px 2px 0 0', minHeight: 2 },
  barValue: { fontSize: '0.55rem', color: '#666', marginBottom: '2px' },
  barLabel: { fontSize: '0.6rem', color: '#999', marginTop: '3px' },

  // Shared
  cardText: { fontSize: '0.82rem', color: '#444', lineHeight: 1.5, margin: '0.25rem 0' },
  cardMuted: { fontSize: '0.78rem', color: '#888', lineHeight: 1.5, margin: '0.25rem 0' },
  narrative: { fontSize: '0.85rem', color: '#555', lineHeight: 1.6, margin: '0.5rem 0 0' },

  // Grant schemes
  schemeCard: {
    background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px',
    padding: '0.75rem', marginBottom: '0.5rem',
  },
  schemeName: { fontWeight: 600, fontSize: '0.85rem' },
  schemeAmount: { fontSize: '0.95rem', fontWeight: 700, color: '#16a34a' },
  schemeStatus: { fontSize: '0.65rem', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' as const, marginTop: '0.125rem' },
  schemeRationale: { fontSize: '0.78rem', color: '#666', margin: '0.25rem 0 0' },
  conditionList: { margin: '0.375rem 0 0', paddingLeft: '1.25rem' },
  conditionItem: { fontSize: '0.75rem', color: '#666', lineHeight: 1.5 },

  // Amenities
  amenityGrid: {},
  amenityRow: {
    display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0',
    fontSize: '0.8rem', borderBottom: '1px solid #f5f5f5',
  },
  amenityName: { color: '#555' },
  amenityVal: { fontWeight: 600, color: '#333', fontVariantNumeric: 'tabular-nums' },

  // Yield
  yieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' },
  yieldCard: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
    background: '#f9fafb', borderRadius: '8px', padding: '0.625rem',
  },
  yieldNum: { fontSize: '1.35rem', fontWeight: 800, color: '#1D9E75' },
  yieldLabel: { fontSize: '0.65rem', color: '#888', fontWeight: 500, textTransform: 'uppercase' as const, textAlign: 'center' as const },

  // Table
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8rem' },
  th: {
    textAlign: 'left' as const, padding: '0.5rem 0.5rem', borderBottom: '2px solid #e5e5e5',
    fontWeight: 600, fontSize: '0.68rem', textTransform: 'uppercase' as const, color: '#888',
  },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '0.375rem 0.5rem', verticalAlign: 'top' as const },

  disclaimer: {
    fontSize: '0.72rem', color: '#999', lineHeight: 1.6, marginTop: '1.25rem',
    padding: '1rem', background: '#fafafa', borderRadius: '8px', border: '1px solid #eee',
  },
};
