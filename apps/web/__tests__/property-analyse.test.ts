import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Mock modules before importing the route
// ---------------------------------------------------------------------------

vi.mock('server-only', () => ({}));

const mockFindComparableCandidates = vi.fn();
const mockFindActiveGrantSchemes = vi.fn();
const mockFindRentBenchmark = vi.fn();

vi.mock('@properdata/db', () => ({
  findComparableCandidates: (...args: unknown[]) => mockFindComparableCandidates(...args),
  findActiveGrantSchemes: (...args: unknown[]) => mockFindActiveGrantSchemes(...args),
  findRentBenchmark: (...args: unknown[]) => mockFindRentBenchmark(...args),
  getRadonRisk: vi.fn().mockResolvedValue(null),
  getSolarPotential: vi.fn().mockResolvedValue(null),
  getWalkabilityScore: vi.fn().mockResolvedValue(null),
  getDcbRisk: vi.fn().mockReturnValue({ riskLevel: 'none', isAffectedCounty: false, context: '', grantEligible: false, grantDetails: null, recommendation: '' }),
}));

const mockComparableAnalysis = vi.fn();
const mockGrantCalculator = vi.fn();
const mockYieldAnalysis = vi.fn();

vi.mock('@properdata/agents', () => ({
  comparableAnalysis: (...args: unknown[]) => mockComparableAnalysis(...args),
  grantCalculator: (...args: unknown[]) => mockGrantCalculator(...args),
  yieldAnalysis: (...args: unknown[]) => mockYieldAnalysis(...args),
  DEFAULT_COST_ASSUMPTIONS: {
    void_weeks: 4,
    management_fee_percent: 10,
    insurance_annual: 500,
    lpt_annual: 495,
    maintenance_percent: 1,
    rtb_registration: 40,
    accountant_fees: 300,
    marginal_tax_rate: 52,
    mortgage_interest_annual: 0,
  },
}));

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  })),
}));

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const FIXTURE_CANDIDATES = [
  {
    id: 1,
    saleDate: '2025-11-15',
    price: 295000,
    addressNormalised: '12 Grange Drive, Mullingar',
    addressRaw: '12 Grange Drive, Mullingar, Co. Westmeath',
    county: 'Westmeath',
    eircode: 'N91AB12',
    propertyType: 'semi_detached',
    isNew: false,
    description: 'Second-Hand Dwelling house /Apartment',
    distanceMeters: 450,
    monthsAgo: 5,
  },
  {
    id: 2,
    saleDate: '2025-09-20',
    price: 310000,
    addressNormalised: '8 Willowbrook, Mullingar',
    addressRaw: '8 Willowbrook, Mullingar, Co. Westmeath',
    county: 'Westmeath',
    eircode: 'N91CD34',
    propertyType: 'semi_detached',
    isNew: false,
    description: 'Second-Hand Dwelling house /Apartment',
    distanceMeters: 800,
    monthsAgo: 7,
  },
];

const FIXTURE_COMPARABLE_RESULT = {
  estimated_value: 305000,
  confidence: 'medium' as const,
  comparables_used: [
    {
      address: '12 Grange Drive, Mullingar',
      sale_date: '2025-11-15',
      price: 295000,
      distance_meters: 450,
      weight: 'high' as const,
      rationale: 'Closest comparable, similar type, sold 5 months ago.',
    },
  ],
  comparables_excluded: [],
  narrative:
    'Based on these comparables, the data suggests a fair value of approximately €305,000 for a 3-bed semi-detached in this area of Mullingar. The comparable market activity points to a range of €290,000 to €320,000.',
};

const FIXTURE_GRANT_RESULT = {
  total_grants_low: 8500,
  total_grants_high: 18800,
  applicable_schemes: [
    {
      code: 'SEAI_HEAT_PUMP',
      name: 'SEAI Heat Pump Grant',
      amount_low: 6500,
      amount_high: 6500,
      eligibility_status: 'probable' as const,
      rationale: 'Property BER D2 likely qualifies for heat pump upgrade.',
      conditions: ['Subject to BER survey confirming current rating'],
      stacking_notes: null,
    },
  ],
  excluded_schemes: [
    {
      code: 'HTB',
      reason: 'Not a new build — Help to Buy applies only to new builds or self-builds.',
    },
  ],
  net_acquisition_cost: {
    purchase_price: 310000,
    total_grants_central: 13650,
    stamp_duty: 3100,
    estimated_legal_fees: 2000,
    effective_cost: 301450,
  },
  narrative:
    'Eligibility is determined by the relevant scheme administrator based on documentation submitted at application. This estimate reflects publicly available rules as of 2026-04-30 and should be confirmed with SEAI before relying on it for a purchase decision.',
};

const FIXTURE_YIELD_RESULT = {
  property: {
    purchase_price: 310000,
    estimated_rent_monthly: 1580,
    rent_data_source: 'RTB Q4 2025, Westmeath, 3-bed, new tenancies',
    rent_confidence: 'high' as const,
  },
  yields: {
    gross_yield_annual: 6.1,
    net_yield_annual: 3.6,
    tax_adjusted_yield: 2.5,
  },
  cost_breakdown_annual: {
    rental_income_gross: 18960,
    void_allowance: 1460,
    rental_income_effective: 17500,
    letting_management_fees: 1750,
    insurance_landlord: 420,
    lpt: 495,
    maintenance_reserve: 3100,
    rtb_registration: 40,
    accountant_fees: 300,
    total_costs: 6105,
  },
  tax_position: {
    marginal_rate_assumed: 52,
    rental_income_taxable: 6585,
    tax_payable: 3424,
    landlord_retrofit_deduction_applied: null,
    after_tax_income: 7961,
  },
  acquisition: {
    purchase_price: 310000,
    stamp_duty: 3100,
    legal_fees: 2000,
    valuation_survey: 400,
    available_grants_value: 0,
    total_acquisition_cost: 315500,
    effective_capital_invested: 315500,
  },
  narrative:
    'Yield estimates are based on the most recent RTB Rent Index data and standard cost assumptions. Actual yield will depend on tenancy outcomes, expense levels, and tax circumstances specific to the investor. Consult a qualified tax advisor before making investment decisions.',
};

const FIXTURE_GRANT_SCHEMES = [
  {
    code: 'SEAI_HEAT_PUMP',
    name: 'SEAI Heat Pump Grant',
    provider: 'SEAI',
    category: 'energy',
    maxAmount: 6500,
    description: 'Air-to-water heat pump installation grant',
    eligibilityRules: { propertyType: ['detached', 'semi_detached', 'terraced'] },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/property/analyse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  address: '25 Rathgowan, Mullingar, Co. Westmeath',
  county: 'Westmeath',
  propertyType: 'semi_detached',
  bedrooms: 3,
  purchasePrice: 310000,
  berRating: 'D2',
  buyer: {
    buyerType: 'former_owner_occupier',
    intendedUse: 'owner_occupier',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Route import must be after mocks are registered
const { POST } = await import('../app/api/property/analyse/route');

describe('POST /api/property/analyse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindComparableCandidates.mockResolvedValue(FIXTURE_CANDIDATES);
    mockFindActiveGrantSchemes.mockResolvedValue(FIXTURE_GRANT_SCHEMES);
    mockFindRentBenchmark.mockResolvedValue(null);
    mockComparableAnalysis.mockResolvedValue(FIXTURE_COMPARABLE_RESULT);
    mockGrantCalculator.mockResolvedValue(FIXTURE_GRANT_RESULT);
    mockYieldAnalysis.mockResolvedValue(FIXTURE_YIELD_RESULT);
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it('rejects missing county', async () => {
    const { county: _, ...body } = BASE_BODY;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/county/i);
  });

  it('rejects missing purchasePrice', async () => {
    const { purchasePrice: _, ...body } = BASE_BODY;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/purchasePrice/i);
  });

  it('rejects invalid buyerType', async () => {
    const body = { ...BASE_BODY, buyer: { buyerType: 'alien', intendedUse: 'owner_occupier' } };
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/buyerType/i);
  });

  it('rejects missing buyer', async () => {
    const { buyer: _, ...body } = BASE_BODY;
    const res = await POST(makeRequest(body));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/buyer/i);
  });

  // -------------------------------------------------------------------------
  // Owner-occupier flow (comparable + grants, no yield)
  // -------------------------------------------------------------------------

  it('returns comparable and grant results for owner-occupier', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.comparable).toBeDefined();
    expect(json.grants).toBeDefined();
    expect(json.yield).toBeUndefined();
    expect(json.metadata.agentCalls).toBe(2);
    expect(json.metadata.from_cache).toBe(false);
  });

  it('returns correct comparable structure', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    expect(json.comparable.estimated_value).toBeTypeOf('number');
    expect(json.comparable.estimated_value).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(json.comparable.confidence);
    expect(json.comparable.narrative).toBeTypeOf('string');
    expect(json.comparable.narrative.length).toBeGreaterThan(0);
  });

  it('returns correct grant structure', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    expect(json.grants.total_grants_low).toBeTypeOf('number');
    expect(json.grants.total_grants_high).toBeTypeOf('number');
    expect(json.grants.applicable_schemes).toBeInstanceOf(Array);
    expect(json.grants.net_acquisition_cost).toBeDefined();
    expect(json.grants.narrative).toBeTypeOf('string');
  });

  it('computes stamp duty at 1% and reconciles effective cost', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();
    const nac = json.grants.net_acquisition_cost;

    expect(nac.stamp_duty).toBe(Math.round(BASE_BODY.purchasePrice * 0.01));
    expect(nac.purchase_price).toBe(BASE_BODY.purchasePrice);
    expect(nac.effective_cost).toBe(
      nac.purchase_price + nac.stamp_duty + nac.estimated_legal_fees - nac.total_grants_central,
    );
  });

  // -------------------------------------------------------------------------
  // Investor flow (all three agents)
  // -------------------------------------------------------------------------

  it('includes yield analysis for rental intent', async () => {
    mockFindRentBenchmark.mockResolvedValue({
      quarter: 'Q4 2025',
      county: 'Westmeath',
      propertyType: null,
      bedrooms: 3,
      isNewTenancy: true,
      standardisedMonthlyRent: 1580,
      sampleSize: 45,
    });

    const body = {
      ...BASE_BODY,
      buyer: { buyerType: 'non_occupier', intendedUse: 'rental' },
    };
    const res = await POST(makeRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.yield).toBeDefined();
    expect(json.yield.yields.gross_yield_annual).toBeTypeOf('number');
    expect(json.yield.yields.net_yield_annual).toBeTypeOf('number');
    expect(json.yield.yields.tax_adjusted_yield).toBeTypeOf('number');
    expect(json.metadata.agentCalls).toBe(3);
  });

  it('skips yield when no RTB rent data available', async () => {
    mockFindRentBenchmark.mockResolvedValue(null);

    const body = {
      ...BASE_BODY,
      buyer: { buyerType: 'non_occupier', intendedUse: 'rental' },
    };
    const res = await POST(makeRequest(body));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.yield).toBeUndefined();
    expect(json.metadata.agentCalls).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Disclaimers
  // -------------------------------------------------------------------------

  it('grant narrative contains disclaimer language', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    const narrative: string = json.grants.narrative;
    expect(
      narrative.includes('scheme administrator') || narrative.includes('publicly available rules'),
    ).toBe(true);
  });

  it('comparable narrative avoids financial advice', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    const narrative: string = json.comparable.narrative;
    const banned = ['you should', 'I recommend', 'good buy', 'great investment'];
    for (const phrase of banned) {
      expect(narrative.toLowerCase()).not.toContain(phrase);
    }
  });

  // -------------------------------------------------------------------------
  // No raw addresses in narrative
  // -------------------------------------------------------------------------

  it('does not leak full raw addresses in comparable narrative', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    const narrative: string = json.comparable.narrative;
    for (const c of FIXTURE_CANDIDATES) {
      expect(narrative).not.toContain(c.addressRaw);
    }
  });

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  it('returns metadata with timing and cost', async () => {
    const res = await POST(makeRequest(BASE_BODY));
    const json = await res.json();

    expect(json.metadata.elapsedMs).toBeTypeOf('number');
    expect(json.metadata.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(json.metadata.estimatedCost).toBeTypeOf('number');
    expect(json.metadata.estimatedCost).toBeGreaterThan(0);
    expect(json.metadata.from_cache).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Agent inputs
  // -------------------------------------------------------------------------

  it('passes correct target to comparable analysis', async () => {
    await POST(makeRequest(BASE_BODY));

    expect(mockComparableAnalysis).toHaveBeenCalledOnce();
    const input = mockComparableAnalysis.mock.calls[0]?.[0];
    expect(input.target.county).toBe('Westmeath');
    expect(input.target.purchasePrice).toBe(310000);
    expect(input.candidates).toHaveLength(2);
  });

  it('passes grant schemes to grant calculator', async () => {
    await POST(makeRequest(BASE_BODY));

    expect(mockGrantCalculator).toHaveBeenCalledOnce();
    const input = mockGrantCalculator.mock.calls[0]?.[0];
    expect(input.available_schemes).toHaveLength(1);
    expect(input.available_schemes[0].code).toBe('SEAI_HEAT_PUMP');
    expect(input.buyer.buyerType).toBe('former_owner_occupier');
  });
});
