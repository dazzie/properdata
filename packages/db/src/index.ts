export { db, type Database } from './client';
export * from './schema';
export { sql } from 'drizzle-orm';
export {
  findComparableCandidates,
  type ComparableTarget,
  type ComparableCandidate,
  type PropertyType,
} from './queries/comparables';
export {
  findActiveGrantSchemes,
  type ActiveGrantScheme,
} from './queries/grants';
export {
  findRentBenchmark,
  type RtbRentRow,
} from './queries/rents';
export {
  assembleWeeklyPulseData,
  type WeeklyPulseData,
} from './queries/weekly-pulse';
export {
  berPremiumByTown,
  berDistributionByTown,
  type BerPremiumBand,
  type BerDistribution,
} from './queries/ber-analysis';
export {
  getAnomalyMetrics,
  getActiveTownIds,
  type TownMetricsSnapshot,
} from './queries/anomalies';
export {
  getRadonRisk,
  wgs84ToIrishGrid,
  type RadonRiskResult,
} from './queries/radon';
export {
  getSolarPotential,
  calculateSeaiSolarGrant,
  type SolarPotentialResult,
} from './queries/solar';
export {
  getWalkabilityScore,
  type WalkabilityResult,
  type AmenityCount,
} from './queries/walkability';
export {
  getDcbRisk,
  type DcbRiskResult,
} from './queries/dcb-risk';
export {
  getFloodRisk,
  type FloodRiskResult,
  type FloodZoneHit,
} from './queries/flood-risk';
export {
  lookupBerByRoutingKey,
  type BerLookupResult,
} from './queries/ber-lookup';
export {
  getNoiseExposure,
  type NoiseResult,
  type NoiseExposure,
} from './queries/noise';
export {
  getAirQuality,
  type AirQualityResult,
  type AirQualityStation,
  type AirQualityReading,
} from './queries/air-quality';
export {
  getMicroclimate,
  type MicroclimateResult,
  type ClimateNormals,
} from './queries/microclimate';
