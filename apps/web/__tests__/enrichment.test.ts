import { describe, it, expect, vi, beforeEach } from 'vitest';

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
