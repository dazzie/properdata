import 'server-only';
import {
  findComparableCandidates,
  findActiveGrantSchemes,
  findRentBenchmark,
  getRadonRisk,
  getSolarPotential,
  getWalkabilityScore,
  getDcbRisk,
  getFloodRisk,
  getNoiseExposure,
  getAirQuality,
  getMicroclimate,
  type ComparableTarget,
  type RadonRiskResult,
  type SolarPotentialResult,
  type WalkabilityResult,
  type DcbRiskResult,
  type FloodRiskResult,
  type NoiseResult,
  type AirQualityResult,
  type MicroclimateResult,
} from '@properdata/db';
import {
  comparableAnalysis,
  grantCalculator,
  yieldAnalysis,
  DEFAULT_COST_ASSUMPTIONS,
  type ComparableAnalysisInput,
  type GrantCalculatorInput,
  type GrantSchemeInput,
  type YieldAnalysisInput,
  type ComparableAnalysisResult,
  type GrantCalculationResult,
  type YieldAnalysisResult,
} from '@properdata/agents';
import type { PropertyAttributes, BuyerContext } from '@properdata/shared';

export interface AnalyseRequest {
  address?: string;
  location?: { lat: number; lng: number };
  county: string;
  eircodeRoutingKey?: string;
  propertyType?: PropertyAttributes['propertyType'];
  bedrooms?: number;
  purchasePrice: number;
  berRating?: string;
  yearBuilt?: number;
  isVacant?: boolean;
  vacantSinceYear?: number;
  isDerelict?: boolean;
  buyer: BuyerContext;
  costOverrides?: Partial<typeof DEFAULT_COST_ASSUMPTIONS>;
}

export interface AnalyseResponse {
  comparable: ComparableAnalysisResult;
  grants: GrantCalculationResult;
  yield?: YieldAnalysisResult;
  radon?: RadonRiskResult;
  solar?: SolarPotentialResult;
  walkability?: WalkabilityResult;
  dcb?: DcbRiskResult;
  flood?: FloodRiskResult;
  noise?: NoiseResult;
  airQuality?: AirQualityResult;
  microclimate?: MicroclimateResult;
  metadata: {
    elapsedMs: number;
    agentCalls: number;
    estimatedCost: number;
    from_cache: boolean;
  };
}

const ESTIMATED_COST_PER_AGENT_CALL = 0.036;
const LEGAL_FEES_DEFAULT = 2500;

export function computeStampDuty(purchasePrice: number): number {
  if (purchasePrice <= 1_000_000) return Math.round(purchasePrice * 0.01);
  return Math.round(10_000 + (purchasePrice - 1_000_000) * 0.02);
}

export async function runPropertyAnalysis(
  req: AnalyseRequest,
  startTime: number,
): Promise<AnalyseResponse> {
  const property: PropertyAttributes = {
    address: req.address,
    county: req.county,
    location: req.location,
    propertyType: req.propertyType,
    bedrooms: req.bedrooms,
    purchasePrice: req.purchasePrice,
    berRating: req.berRating,
    yearBuilt: req.yearBuilt,
    isVacant: req.isVacant,
    vacantSinceYear: req.vacantSinceYear,
    isDerelict: req.isDerelict,
  };

  const comparableTarget: ComparableTarget = {
    county: req.county,
    location: req.location,
    eircodeRoutingKey: req.eircodeRoutingKey,
    propertyType: req.propertyType === 'unknown' ? undefined : req.propertyType,
  };

  const runYield = req.buyer.intendedUse === 'rental' || req.buyer.intendedUse === 'mixed';

  const [candidates, schemes, rentRow] = await Promise.all([
    findComparableCandidates(comparableTarget),
    findActiveGrantSchemes(),
    runYield ? findRentBenchmark({ county: req.county, bedrooms: req.bedrooms }) : null,
  ]);

  const comparableInput: ComparableAnalysisInput = {
    target: property,
    candidates: candidates.map((c) => ({
      address: c.addressNormalised ?? c.addressRaw,
      sale_date: c.saleDate,
      price: c.price,
      distance_meters: c.distanceMeters,
      property_type: c.propertyType,
      is_new: c.isNew,
      description: c.description,
      months_ago: c.monthsAgo,
    })),
  };

  const grantInput: GrantCalculatorInput = {
    property,
    buyer: req.buyer,
    available_schemes: schemes.map(
      (s): GrantSchemeInput => ({
        code: s.code,
        name: s.name,
        provider: s.provider,
        category: s.category,
        max_amount: s.maxAmount,
        description: s.description,
        eligibility_rules: s.eligibilityRules,
      }),
    ),
  };

  let yieldInput: YieldAnalysisInput | null = null;
  if (runYield && rentRow?.standardisedMonthlyRent) {
    yieldInput = {
      property,
      rent_benchmark: {
        monthly_rent: rentRow.standardisedMonthlyRent,
        source: `RTB ${rentRow.quarter}, ${rentRow.county}${rentRow.bedrooms ? `, ${rentRow.bedrooms}-bed` : ''}${rentRow.propertyType ? `, ${rentRow.propertyType}` : ''}, new tenancies`,
        confidence: rentRow.sampleSize && rentRow.sampleSize >= 30 ? 'high' : 'medium',
      },
      cost_assumptions: { ...DEFAULT_COST_ASSUMPTIONS, ...req.costOverrides },
      buyer: req.buyer,
    };
  }

  const agentPromises: [
    Promise<ComparableAnalysisResult>,
    Promise<GrantCalculationResult>,
    Promise<YieldAnalysisResult> | Promise<null>,
  ] = [
    comparableAnalysis(comparableInput),
    grantCalculator(grantInput),
    yieldInput ? yieldAnalysis(yieldInput) : Promise.resolve(null),
  ];

  const hasLocation = req.location?.lat && req.location?.lng;
  const loc = hasLocation ? { lat: req.location!.lat, lng: req.location!.lng } : null;

  const enrichmentPromises = {
    radon: loc ? getRadonRisk(loc).catch(() => null) : Promise.resolve(null),
    solar: loc ? getSolarPotential(loc).catch(() => null) : Promise.resolve(null),
    walkability: loc ? getWalkabilityScore(loc).catch(() => null) : Promise.resolve(null),
    dcb: Promise.resolve(getDcbRisk({ county: req.county, yearBuilt: req.yearBuilt })),
    flood: loc ? getFloodRisk(loc).catch(() => null) : Promise.resolve(null),
    noise: loc ? getNoiseExposure(loc).catch(() => null) : Promise.resolve(null),
    airQuality: loc ? getAirQuality(loc).catch(() => null) : Promise.resolve(null),
    microclimate: loc ? getMicroclimate(loc).catch(() => null) : Promise.resolve(null),
  };

  const [
    [comparableResult, grantResult, yieldResult],
    radonResult,
    solarResult,
    walkabilityResult,
    dcbResult,
    floodResult,
    noiseResult,
    airQualityResult,
    microclimateResult,
  ] = await Promise.all([
    Promise.all(agentPromises),
    enrichmentPromises.radon,
    enrichmentPromises.solar,
    enrichmentPromises.walkability,
    enrichmentPromises.dcb,
    enrichmentPromises.flood,
    enrichmentPromises.noise,
    enrichmentPromises.airQuality,
    enrichmentPromises.microclimate,
  ]);

  const agentCalls = yieldResult ? 3 : 2;

  const stampDuty = computeStampDuty(req.purchasePrice);
  const legalFees = grantResult.net_acquisition_cost?.estimated_legal_fees ?? LEGAL_FEES_DEFAULT;
  const centralGrants = grantResult.net_acquisition_cost?.total_grants_central ?? 0;
  grantResult.net_acquisition_cost = {
    purchase_price: req.purchasePrice,
    stamp_duty: stampDuty,
    estimated_legal_fees: legalFees,
    total_grants_central: centralGrants,
    effective_cost: req.purchasePrice + stampDuty + legalFees - centralGrants,
  };

  return {
    comparable: comparableResult,
    grants: grantResult,
    ...(yieldResult ? { yield: yieldResult } : {}),
    ...(radonResult ? { radon: radonResult } : {}),
    ...(solarResult ? { solar: solarResult } : {}),
    ...(walkabilityResult ? { walkability: walkabilityResult } : {}),
    ...(dcbResult.riskLevel !== 'none' ? { dcb: dcbResult } : {}),
    ...(floodResult ? { flood: floodResult } : {}),
    ...(noiseResult?.hasData ? { noise: noiseResult } : {}),
    ...(airQualityResult ? { airQuality: airQualityResult } : {}),
    ...(microclimateResult ? { microclimate: microclimateResult } : {}),
    metadata: {
      elapsedMs: Date.now() - startTime,
      agentCalls,
      estimatedCost: agentCalls * ESTIMATED_COST_PER_AGENT_CALL,
      from_cache: false,
    },
  };
}
