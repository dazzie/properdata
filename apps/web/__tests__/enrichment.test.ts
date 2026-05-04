import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// 1. DCB Risk — pure logic, no external deps
// ---------------------------------------------------------------------------

const { getDcbRisk } = await import('../../../packages/db/src/queries/dcb-risk');

describe('getDcbRisk', () => {
  it('returns high risk for scheme county in peak build years', () => {
    const result = getDcbRisk({ county: 'Donegal', yearBuilt: 2003 });
    expect(result.riskLevel).toBe('high');
    expect(result.isAffectedCounty).toBe(true);
    expect(result.grantEligible).toBe(true);
    expect(result.grantDetails).toContain('€420,000');
  });

  it('returns low risk for scheme county post-2010', () => {
    const result = getDcbRisk({ county: 'Mayo', yearBuilt: 2015 });
    expect(result.riskLevel).toBe('low');
    expect(result.grantEligible).toBe(true);
  });

  it('returns medium risk for at-risk county in peak build years', () => {
    const result = getDcbRisk({ county: 'Galway', yearBuilt: 1995 });
    expect(result.riskLevel).toBe('medium');
    expect(result.isAffectedCounty).toBe(true);
    expect(result.grantEligible).toBe(false);
  });

  it('returns none for unaffected county', () => {
    const result = getDcbRisk({ county: 'Westmeath', yearBuilt: 2005 });
    expect(result.riskLevel).toBe('none');
    expect(result.isAffectedCounty).toBe(false);
    expect(result.grantEligible).toBe(false);
    expect(result.grantDetails).toBeNull();
  });

  it('handles missing build year for scheme county', () => {
    const result = getDcbRisk({ county: 'Sligo' });
    expect(result.riskLevel).toBe('medium');
    expect(result.isAffectedCounty).toBe(true);
    expect(result.grantEligible).toBe(true);
  });

  it('handles missing build year for at-risk county', () => {
    const result = getDcbRisk({ county: 'Roscommon' });
    expect(result.riskLevel).toBe('low');
    expect(result.isAffectedCounty).toBe(true);
    expect(result.grantEligible).toBe(false);
  });

  it.each([
    ['Donegal'],
    ['Mayo'],
    ['Clare'],
    ['Limerick'],
    ['Sligo'],
  ])('%s is a scheme county', (county) => {
    const result = getDcbRisk({ county, yearBuilt: 2000 });
    expect(result.grantEligible).toBe(true);
  });

  it.each([
    ['Galway'],
    ['Roscommon'],
    ['Leitrim'],
    ['Tipperary'],
    ['Cork'],
  ])('%s is an at-risk county', (county) => {
    const result = getDcbRisk({ county, yearBuilt: 2000 });
    expect(result.isAffectedCounty).toBe(true);
    expect(result.grantEligible).toBe(false);
  });

  it('returns medium for scheme county pre-1980', () => {
    const result = getDcbRisk({ county: 'Donegal', yearBuilt: 1975 });
    expect(result.riskLevel).toBe('medium');
  });

  it('boundary: 1980 is in peak risk window', () => {
    const result = getDcbRisk({ county: 'Donegal', yearBuilt: 1980 });
    expect(result.riskLevel).toBe('high');
  });

  it('boundary: 2010 is in peak risk window', () => {
    const result = getDcbRisk({ county: 'Donegal', yearBuilt: 2010 });
    expect(result.riskLevel).toBe('high');
  });

  it('boundary: 2011 is outside peak risk window', () => {
    const result = getDcbRisk({ county: 'Donegal', yearBuilt: 2011 });
    expect(result.riskLevel).toBe('low');
  });
});

// ---------------------------------------------------------------------------
// 2. Irish Grid coordinate conversion — pure math
// ---------------------------------------------------------------------------

const { wgs84ToIrishGrid } = await import('../../../packages/db/src/queries/radon');

describe('wgs84ToIrishGrid', () => {
  it('converts Mullingar coordinates accurately', () => {
    const { x, y } = wgs84ToIrishGrid(-7.3398, 53.5253);
    expect(x).toBeGreaterThan(240000);
    expect(x).toBeLessThan(246000);
    expect(y).toBeGreaterThan(251000);
    expect(y).toBeLessThan(257000);
  });

  it('converts Dublin coordinates accurately', () => {
    const { x, y } = wgs84ToIrishGrid(-6.2603, 53.3498);
    expect(x).toBeGreaterThan(313000);
    expect(x).toBeLessThan(319000);
    expect(y).toBeGreaterThan(231000);
    expect(y).toBeLessThan(237000);
  });

  it('converts Cork coordinates accurately', () => {
    const { x, y } = wgs84ToIrishGrid(-8.4756, 51.8985);
    expect(x).toBeGreaterThan(163000);
    expect(x).toBeLessThan(169000);
    expect(y).toBeGreaterThan(69000);
    expect(y).toBeLessThan(75000);
  });

  it('converts Galway coordinates accurately', () => {
    const { x, y } = wgs84ToIrishGrid(-9.0568, 53.2707);
    expect(x).toBeGreaterThan(127000);
    expect(x).toBeLessThan(133000);
    expect(y).toBeGreaterThan(222000);
    expect(y).toBeLessThan(228000);
  });

  it('returns integer values', () => {
    const { x, y } = wgs84ToIrishGrid(-7.3398, 53.5253);
    expect(Number.isInteger(x)).toBe(true);
    expect(Number.isInteger(y)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. SEAI Solar Grant calculation — pure math
// ---------------------------------------------------------------------------

const { calculateSeaiSolarGrant } = await import('../../../packages/db/src/queries/solar');

describe('calculateSeaiSolarGrant', () => {
  it('calculates grant for 1 kWp system', () => {
    expect(calculateSeaiSolarGrant(1)).toBe(700);
  });

  it('calculates grant for 2 kWp system', () => {
    expect(calculateSeaiSolarGrant(2)).toBe(1400);
  });

  it('calculates grant for 3 kWp system', () => {
    expect(calculateSeaiSolarGrant(3)).toBe(1600);
  });

  it('calculates grant for 4 kWp system (max)', () => {
    expect(calculateSeaiSolarGrant(4)).toBe(1800);
  });

  it('caps grant at 4 kWp even for larger systems', () => {
    expect(calculateSeaiSolarGrant(6)).toBe(1800);
    expect(calculateSeaiSolarGrant(10)).toBe(1800);
  });

  it('handles fractional kWp', () => {
    expect(calculateSeaiSolarGrant(1.5)).toBe(1050);
  });

  it('handles 2.5 kWp crossing tier boundary', () => {
    expect(calculateSeaiSolarGrant(2.5)).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// 4. Radon risk — mocked EPA WFS response
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();

describe('getRadonRisk (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns high risk for 1-in-5 area', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              Risk: 'About 1 in 5 homes in this area is likely to have high radon levels',
            },
          },
        ],
      }),
    });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskPercent).toBe(20);
    expect(result.riskCategory).toBe('high');
    expect(result.riskDescription).toContain('1-in-5');
    expect(result.context).toContain('High Radon Area');
  });

  it('returns medium risk for 1-in-10 area', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              Risk: 'About 1 in 10 homes in this area is likely to have high radon levels',
            },
          },
        ],
      }),
    });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskPercent).toBe(10);
    expect(result.riskCategory).toBe('medium');
  });

  it('returns low risk for 1-in-20 area', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              Risk: 'About 1 in 20 homes in this area is likely to have high radon levels',
            },
          },
        ],
      }),
    });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskPercent).toBe(5);
    expect(result.riskCategory).toBe('low');
  });

  it('returns unknown when no features returned', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [] }),
    });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskCategory).toBe('unknown');
    expect(result.riskDescription).toContain('Outside EPA');
  });

  it('returns unknown when EPA service is down', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskCategory).toBe('unknown');
    expect(result.riskDescription).toContain('temporarily unavailable');
  });

  it('returns unknown for non-200 response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });

    expect(result.riskCategory).toBe('unknown');
  });

  it('always includes test cost', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ features: [] }),
    });

    const { getRadonRisk } = await import('../../../packages/db/src/queries/radon');
    const result = await getRadonRisk({ lat: 53.5, lng: -7.3 });
    expect(result.testCost).toContain('€50');
  });
});

// ---------------------------------------------------------------------------
// 5. Solar potential — mocked PVGIS response
// ---------------------------------------------------------------------------

describe('getSolarPotential (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  const PVGIS_RESPONSE = {
    outputs: {
      totals: {
        fixed: { E_y: 3620, 'H(i)_y': 1100 },
      },
      monthly: {
        fixed: [
          { month: 1, E_m: 120 },
          { month: 2, E_m: 180 },
          { month: 3, E_m: 290 },
          { month: 4, E_m: 380 },
          { month: 5, E_m: 420 },
          { month: 6, E_m: 430 },
          { month: 7, E_m: 400 },
          { month: 8, E_m: 370 },
          { month: 9, E_m: 310 },
          { month: 10, E_m: 220 },
          { month: 11, E_m: 140 },
          { month: 12, E_m: 100 },
        ],
      },
    },
  };

  it('returns correct annual yield', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => PVGIS_RESPONSE,
    });

    const { getSolarPotential } = await import('../../../packages/db/src/queries/solar');
    const result = await getSolarPotential({ lat: 53.5, lng: -7.3, systemSizeKwp: 4 });

    expect(result.annualYieldKwh).toBe(3620);
    expect(result.yieldPerKwp).toBe(905);
    expect(result.systemSizeKwp).toBe(4);
  });

  it('returns 12-month breakdown', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => PVGIS_RESPONSE,
    });

    const { getSolarPotential } = await import('../../../packages/db/src/queries/solar');
    const result = await getSolarPotential({ lat: 53.5, lng: -7.3 });

    expect(result.monthlyBreakdown).toHaveLength(12);
    expect(result.monthlyBreakdown[0]!.month).toBe(1);
  });

  it('calculates correct financials for 4 kWp', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => PVGIS_RESPONSE,
    });

    const { getSolarPotential } = await import('../../../packages/db/src/queries/solar');
    const result = await getSolarPotential({ lat: 53.5, lng: -7.3, systemSizeKwp: 4 });

    expect(result.financial.systemCostEstimate).toBe(6000);
    expect(result.financial.seaiGrant).toBe(1800);
    expect(result.financial.netCost).toBe(4200);
    expect(result.financial.annualSavings).toBeGreaterThan(0);
    expect(result.financial.paybackYears).toBeGreaterThan(0);
    expect(result.financial.lifetimeSavings25yr).toBeGreaterThan(0);
  });

  it('uses fallback yield when PVGIS fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const { getSolarPotential } = await import('../../../packages/db/src/queries/solar');
    const result = await getSolarPotential({ lat: 53.5, lng: -7.3 });

    expect(result.yieldPerKwp).toBe(900);
    expect(result.annualYieldKwh).toBe(3600);
    expect(result.monthlyBreakdown).toHaveLength(0);
    expect(result.context).toContain('Irish average');
  });

  it('defaults to 4 kWp when systemSize not specified', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => PVGIS_RESPONSE,
    });

    const { getSolarPotential } = await import('../../../packages/db/src/queries/solar');
    const result = await getSolarPotential({ lat: 53.5, lng: -7.3 });

    expect(result.systemSizeKwp).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 6. Walkability — mocked Overpass response
// ---------------------------------------------------------------------------

describe('getWalkabilityScore (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  type OsmElement = { lat: number; lon: number; tags: Record<string, string> };
  const makeOverpassResponse = (elements: OsmElement[]) => ({
    ok: true,
    json: async () => ({ elements }),
  });

  it('returns high score for area rich in amenities', async () => {
    const elements: OsmElement[] = [
      { lat: 53.526, lon: -7.340, tags: { shop: 'supermarket' } },
      { lat: 53.525, lon: -7.339, tags: { shop: 'convenience' } },
      { lat: 53.524, lon: -7.338, tags: { shop: 'butcher' } },
      { lat: 53.527, lon: -7.341, tags: { amenity: 'school' } },
      { lat: 53.523, lon: -7.337, tags: { amenity: 'doctors' } },
      { lat: 53.526, lon: -7.342, tags: { amenity: 'pharmacy' } },
      { lat: 53.525, lon: -7.336, tags: { amenity: 'pub' } },
      { lat: 53.524, lon: -7.335, tags: { amenity: 'restaurant' } },
      { lat: 53.528, lon: -7.343, tags: { highway: 'bus_stop' } },
      { lat: 53.529, lon: -7.344, tags: { railway: 'station', train: 'yes' } },
      { lat: 53.522, lon: -7.334, tags: { leisure: 'park' } },
      { lat: 53.521, lon: -7.333, tags: { amenity: 'post_office' } },
    ];
    mockFetch.mockResolvedValueOnce(makeOverpassResponse(elements));

    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const result = await getWalkabilityScore({ lat: 53.5253, lng: -7.3398 });

    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.label).toMatch(/Walkable|Somewhat Walkable/);
    expect(result.amenities.length).toBe(11);
  });

  it('returns zero score for area with no amenities', async () => {
    mockFetch.mockResolvedValueOnce(makeOverpassResponse([]));

    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const result = await getWalkabilityScore({ lat: 53.5253, lng: -7.3398 });

    expect(result.score).toBe(0);
    expect(result.label).toBe('Car-Dependent');
    expect(result.amenities.every((a) => a.count === 0)).toBe(true);
  });

  it('computes nearest distance correctly', async () => {
    const elements = [
      { lat: 53.5253, lon: -7.3398, tags: { shop: 'supermarket' } },
      { lat: 53.526, lon: -7.340, tags: { shop: 'supermarket' } },
    ];
    mockFetch.mockResolvedValueOnce(makeOverpassResponse(elements));

    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const result = await getWalkabilityScore({ lat: 53.5253, lng: -7.3398 });

    const supermarkets = result.amenities.find((a) => a.category === 'Supermarkets');
    expect(supermarkets).toBeDefined();
    expect(supermarkets!.count).toBe(2);
    expect(supermarkets!.nearest).toBeLessThan(5);
  });

  it('commuter persona scores transit higher than family persona', async () => {
    const elements: OsmElement[] = [
      { lat: 53.526, lon: -7.340, tags: { railway: 'station', train: 'yes' } },
      { lat: 53.525, lon: -7.339, tags: { highway: 'bus_stop' } },
    ];

    mockFetch.mockResolvedValueOnce(makeOverpassResponse(elements));
    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const commuter = await getWalkabilityScore({
      lat: 53.5253,
      lng: -7.3398,
      persona: 'commuter',
    });

    mockFetch.mockResolvedValueOnce(makeOverpassResponse(elements));
    const family = await getWalkabilityScore({
      lat: 53.5253,
      lng: -7.3398,
      persona: 'family',
    });

    expect(commuter.score).toBeGreaterThan(family.score);
  });

  it('returns graceful fallback when Overpass is down', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const result = await getWalkabilityScore({ lat: 53.5, lng: -7.3 });

    expect(result.score).toBe(0);
    expect(result.label).toBe('Unknown');
    expect(result.summary).toContain('unavailable');
  });

  it('includes summary text with amenity counts', async () => {
    const elements: OsmElement[] = [
      { lat: 53.526, lon: -7.340, tags: { shop: 'supermarket' } },
      { lat: 53.525, lon: -7.339, tags: { amenity: 'pharmacy' } },
    ];
    mockFetch.mockResolvedValueOnce(makeOverpassResponse(elements));

    const { getWalkabilityScore } = await import('../../../packages/db/src/queries/walkability');
    const result = await getWalkabilityScore({ lat: 53.5253, lng: -7.3398 });

    expect(result.summary).toContain('Within 1.5km');
    expect(result.summary).toContain('supermarket');
  });
});

// ---------------------------------------------------------------------------
// 7. Noise exposure — mocked EPA WFS response
// ---------------------------------------------------------------------------

describe('getNoiseExposure (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  const emptyWfs = () => ({ ok: true, json: async () => ({ features: [] }) });

  const noiseFeature = (dbValue: string, type: string) => ({
    ok: true,
    json: async () => ({
      features: [{ properties: { dB_Value: dbValue, Type: type } }],
    }),
  });

  it('returns quiet when no layers intersect', async () => {
    mockFetch.mockResolvedValue(emptyWfs());
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.5, lng: -7.3 });

    expect(result.hasData).toBe(false);
    expect(result.category).toBe('quiet');
    expect(result.ldenMax).toBeNull();
    expect(result.lnightMax).toBeNull();
    expect(result.exposures).toHaveLength(0);
    expect(result.summary).toContain('outside the mapped');
  });

  it('categorises moderate road noise correctly', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('Road_National_Lden')) return noiseFeature('65-69dB', 'Motorway');
      return emptyWfs();
    });
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.35, lng: -6.26 });

    expect(result.hasData).toBe(true);
    expect(result.category).toBe('moderate');
    expect(result.ldenMax).toBe(65);
    expect(result.exposures).toHaveLength(1);
    expect(result.exposures[0]!.source).toBe('road');
    expect(result.exposures[0]!.dbRange).toBe('65-69dB');
  });

  it('categorises high noise from multiple sources', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('Road_National_Lden')) return noiseFeature('70-74dB', 'National Road');
      if (u.includes('Rail_National_Lnight')) return noiseFeature('55-59dB', 'Railway');
      return emptyWfs();
    });
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.35, lng: -6.26 });

    expect(result.hasData).toBe(true);
    expect(result.category).toBe('high');
    expect(result.ldenMax).toBe(70);
    expect(result.lnightMax).toBe(55);
    expect(result.exposures).toHaveLength(2);
  });

  it('parses >75dB format correctly', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('Road_Agglomerations_Lden')) return noiseFeature('>75dB', 'Major Road');
      return emptyWfs();
    });
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.35, lng: -6.26 });

    expect(result.ldenMax).toBe(75);
    expect(result.exposures[0]!.dbHigh).toBeNull();
    expect(result.category).toBe('high');
  });

  it('generates WHO guidance for exceeded thresholds', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('Road_National_Lden')) return noiseFeature('65-69dB', 'Road');
      if (u.includes('Road_National_Lnight')) return noiseFeature('50-54dB', 'Road');
      return emptyWfs();
    });
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.35, lng: -6.26 });

    expect(result.whoGuidance).toContain('WHO');
    expect(result.whoGuidance).toContain('53 dB Lden');
    expect(result.whoGuidance).toContain('40 dB Lnight');
  });

  it('within WHO guidelines when below thresholds', async () => {
    mockFetch.mockResolvedValue(emptyWfs());
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.5, lng: -7.3 });

    expect(result.whoGuidance).toContain('within WHO recommended guidelines');
  });

  it('degrades gracefully on complete service failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { getNoiseExposure } = await import('../../../packages/db/src/queries/noise');
    const result = await getNoiseExposure({ lat: 53.5, lng: -7.3 });

    expect(result.hasData).toBe(false);
    expect(result.category).toBe('quiet');
  });
});

// ---------------------------------------------------------------------------
// 8. Air quality — mocked airquality.ie + EPA WFS response
// ---------------------------------------------------------------------------

describe('getAirQuality (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  const makeMonitors = (overrides: Record<string, unknown> = {}) => ({
    ok: true,
    json: async () => [
      {
        monitor_id: 1,
        label: 'Dublin Rathmines',
        location: 'Rathmines',
        latitude: '53.327',
        longitude: '-6.263',
        code: 'RATH',
        current_rating: '2',
        latest_reading: {
          recorded_at: '2026-05-03T10:00:00Z',
          pm2_5: 8,
          pm10: 15,
          no2: 20,
          o3: 40,
          so2: 2,
        },
        latest_averages: {
          pm2_5: { value: 10 },
          pm10: { value: 18 },
        },
        ...overrides,
      },
    ],
  });

  const emptyWfs = () => ({ ok: true, json: async () => ({ features: [] }) });

  const wfsZone = (range: string) => ({
    ok: true,
    json: async () => ({
      features: [{ properties: { Range: range } }],
    }),
  });

  it('returns good air quality result', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors')) return makeMonitors({ current_rating: '2' });
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result).not.toBeNull();
    expect(result!.aqih).toBe(2);
    expect(result!.aqihLabel).toBe('Good');
    expect(result!.station.name).toBe('Rathmines');
    expect(result!.healthAdvice).toContain('good');
  });

  it('returns fair air quality for AQIH 5', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors')) return makeMonitors({ current_rating: '5' });
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result!.aqih).toBe(5);
    expect(result!.aqihLabel).toBe('Fair');
    expect(result!.healthAdvice).toContain('sensitive');
  });

  it('returns poor air quality for AQIH 8', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors')) return makeMonitors({ current_rating: '8' });
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result!.aqih).toBe(8);
    expect(result!.aqihLabel).toBe('Poor');
    expect(result!.healthAdvice).toContain('respiratory');
  });

  it('includes modelled zone data when available', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors')) return makeMonitors();
      if (u.includes('AIR_PM2_5')) return wfsZone('0-10 µg/m³');
      if (u.includes('AIR_PM10')) return wfsZone('10-20 µg/m³');
      if (u.includes('AIR_NO2')) return wfsZone('5-15 µg/m³');
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result!.modelledZone.pm25Range).toBe('0-10 µg/m³');
    expect(result!.modelledZone.pm10Range).toBe('10-20 µg/m³');
    expect(result!.modelledZone.no2Range).toBe('5-15 µg/m³');
  });

  it('returns null when monitor API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result).toBeNull();
  });

  it('returns null when no monitors in response', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors')) return { ok: true, json: async () => [] };
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result).toBeNull();
  });

  it('includes 24h averages in summary', async () => {
    mockFetch.mockImplementation(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.includes('get-monitors'))
        return makeMonitors({
          latest_averages: { pm2_5: { value: 12 }, pm10: { value: 25 } },
        });
      return emptyWfs();
    });
    const { getAirQuality } = await import('../../../packages/db/src/queries/air-quality');
    const result = await getAirQuality({ lat: 53.35, lng: -6.26 });

    expect(result!.avg24h.pm25).toBe(12);
    expect(result!.avg24h.pm10).toBe(25);
    expect(result!.summary).toContain('12 µg/m³');
  });
});

// ---------------------------------------------------------------------------
// 9. Microclimate — mocked Met Éireann CSV response
// ---------------------------------------------------------------------------

describe('getMicroclimate (mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mockFetch);
  });

  // 12 months × 2 years in the 1991–2020 window
  // Cols: year,month,meant,maxtp,mintp,mnmax,mnmin,rain,gmin,wdsp,maxgt,sun
  const SAMPLE_CSV = [
    'Station: Test',
    'Height: 71m',
    'Year,Month,MeanT,MaxT,MinT,MnMax,MnMin,Rain,GMin,WdSp,MaxGt,Sun',
    '2010,1,5.0,8.0,2.0,7.0,2.5,90,0.1,12.0,15.0,50',
    '2010,2,5.5,8.5,2.5,7.5,3.0,75,0.5,11.0,14.0,65',
    '2010,3,7.0,10.0,4.0,9.0,4.5,70,1.0,13.0,16.0,100',
    '2010,4,9.0,12.5,5.5,11.0,6.0,55,2.0,11.5,14.5,140',
    '2010,5,11.0,14.5,7.5,13.0,8.0,60,4.0,10.0,13.0,170',
    '2010,6,13.5,17.0,10.0,15.5,10.5,65,6.0,9.5,12.0,160',
    '2010,7,15.0,18.5,11.5,17.0,12.0,70,7.0,9.0,11.5,140',
    '2010,8,14.5,18.0,11.0,16.5,11.5,80,6.5,10.0,13.0,130',
    '2010,9,12.5,16.0,9.0,14.5,9.5,75,4.5,11.0,14.0,110',
    '2010,10,9.5,13.0,6.0,11.5,7.0,85,2.5,12.5,15.5,90',
    '2010,11,6.5,9.5,3.5,8.5,4.0,95,0.5,13.0,16.5,60',
    '2010,12,4.5,7.5,1.5,6.5,2.0,100,0.0,14.0,17.0,45',
    '2011,1,5.2,8.2,2.2,7.2,2.7,88,0.2,12.2,15.2,52',
    '2011,2,5.7,8.7,2.7,7.7,3.2,73,0.6,11.2,14.2,67',
    '2011,3,7.2,10.2,4.2,9.2,4.7,68,1.2,13.2,16.2,102',
    '2011,4,9.2,12.7,5.7,11.2,6.2,53,2.2,11.7,14.7,142',
    '2011,5,11.2,14.7,7.7,13.2,8.2,58,4.2,10.2,13.2,172',
    '2011,6,13.7,17.2,10.2,15.7,10.7,63,6.2,9.7,12.2,162',
    '2011,7,15.2,18.7,11.7,17.2,12.2,68,7.2,9.2,11.7,142',
    '2011,8,14.7,18.2,11.2,16.7,11.7,78,6.7,10.2,13.2,132',
    '2011,9,12.7,16.2,9.2,14.7,9.7,73,4.7,11.2,14.2,112',
    '2011,10,9.7,13.2,6.2,11.7,7.2,83,2.7,12.7,15.7,92',
    '2011,11,6.7,9.7,3.7,8.7,4.2,93,0.7,13.2,16.7,62',
    '2011,12,4.7,7.7,1.7,6.7,2.2,98,0.2,14.2,17.2,47',
  ].join('\n');

  const csvResponse = () => ({ ok: true, text: async () => SAMPLE_CSV });

  it('computes climate normals from CSV data', async () => {
    mockFetch.mockResolvedValue(csvResponse());
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    const result = await getMicroclimate({ lat: 53.35, lng: -6.26 });

    expect(result).not.toBeNull();
    expect(result!.station.name).toBe('Phoenix Park');
    expect(result!.normals.meanTemp).toBeGreaterThan(5);
    expect(result!.normals.meanTemp).toBeLessThan(15);
    expect(result!.normals.rainfall).toBeGreaterThan(500);
    expect(result!.normals.sunHours).toBeGreaterThan(500);
    expect(result!.normals.windSpeed).toBeGreaterThan(0);
  });

  it('estimates frost days from mean minimum temperatures', async () => {
    mockFetch.mockResolvedValue(csvResponse());
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    const result = await getMicroclimate({ lat: 53.35, lng: -6.26 });

    // CSV mnmin ranges from 2.0 to 12.2; months with mnmin ≤ 5 contribute frost days
    expect(result!.normals.frostDays).toBeGreaterThan(0);
    expect(result!.normals.frostDays).toBeLessThan(100);
  });

  it('includes national comparison percentages', async () => {
    mockFetch.mockResolvedValue(csvResponse());
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    const result = await getMicroclimate({ lat: 53.35, lng: -6.26 });

    expect(result!.nationalComparison.tempVsNational).toMatch(/national average/);
    expect(result!.nationalComparison.rainfallVsNational).toMatch(/national average/);
  });

  it('includes retrofit note and source attribution', async () => {
    mockFetch.mockResolvedValue(csvResponse());
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    const result = await getMicroclimate({ lat: 53.35, lng: -6.26 });

    expect(result!.retrofitNote.length).toBeGreaterThan(0);
    expect(result!.context).toContain('Met Éireann');
    expect(result!.context).toContain('CC BY 4.0');
  });

  it('returns null when CSV fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    // Use Malin Head coords (station not yet in module cache)
    const result = await getMicroclimate({ lat: 55.37, lng: -7.34 });

    expect(result).toBeNull();
  });

  it('finds nearest station by haversine distance', async () => {
    mockFetch.mockResolvedValue(csvResponse());
    const { getMicroclimate } = await import('../../../packages/db/src/queries/microclimate');
    // Cork coords — nearest should be Cork Airport or Roches Point
    const result = await getMicroclimate({ lat: 51.9, lng: -8.47 });

    expect(result).not.toBeNull();
    expect(result!.station.distanceKm).toBeLessThan(20);
  });
});
