import 'server-only';
import { wgs84ToIrishGrid } from './radon';

export interface NoiseExposure {
  source: 'road' | 'rail' | 'airport' | 'industry';
  timeIndicator: 'Lden' | 'Lnight';
  dbRange: string;
  dbLow: number;
  dbHigh: number | null;
  sourceType: string;
}

export interface NoiseResult {
  hasData: boolean;
  ldenMax: number | null;
  lnightMax: number | null;
  category: 'high' | 'moderate' | 'low' | 'quiet';
  exposures: NoiseExposure[];
  summary: string;
  context: string;
  whoGuidance: string;
}

const EPA_WFS = 'https://gis.epa.ie/geoserver/EPA/ows';

interface NoiseLayer {
  typeName: string;
  source: NoiseExposure['source'];
  timeIndicator: 'Lden' | 'Lnight';
}

const LAYERS: NoiseLayer[] = [
  { typeName: 'EPA:Noise_R4_Road_National_Lden', source: 'road', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Road_National_Lnight', source: 'road', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Road_Agglomerations_Lden', source: 'road', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Road_Agglomerations_Lnight', source: 'road', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Rail_National_Lden', source: 'rail', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Rail_National_Lnight', source: 'rail', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Rail_Agglomerations_Lden', source: 'rail', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Rail_Agglomerations_Lnight', source: 'rail', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Airport_National_Lden', source: 'airport', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Airport_National_Lnight', source: 'airport', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Airport_Agglomerations_Lden_Test', source: 'airport', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Airport_Agglomerations_Lnight', source: 'airport', timeIndicator: 'Lnight' },
  { typeName: 'EPA:Noise_R4_Industry_Agglomerations_Lden', source: 'industry', timeIndicator: 'Lden' },
  { typeName: 'EPA:Noise_R4_Industry_Agglomerations_Lnight', source: 'industry', timeIndicator: 'Lnight' },
];

function parseDbRange(dbValue: string): { low: number; high: number | null } {
  if (dbValue.startsWith('>')) {
    return { low: parseInt(dbValue.replace(/[^0-9]/g, ''), 10), high: null };
  }
  const match = dbValue.match(/(\d+)-(\d+)/);
  if (match) {
    return { low: parseInt(match[1]!, 10), high: parseInt(match[2]!, 10) };
  }
  return { low: 0, high: null };
}

async function queryNoiseLayer(
  layer: NoiseLayer,
  easting: number,
  northing: number,
): Promise<NoiseExposure | null> {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: layer.typeName,
    outputFormat: 'application/json',
    count: '1',
    CQL_FILTER: `INTERSECTS(Shape,POINT(${easting} ${northing}))`,
    propertyName: 'dB_Value,Type',
  });

  try {
    const res = await fetch(`${EPA_WFS}?${params}`, {
      headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      features?: Array<{ properties: { dB_Value: string; Type: string } }>;
    };

    if (!data.features?.length) return null;

    const feat = data.features[0]!;
    const { low, high } = parseDbRange(feat.properties.dB_Value);

    return {
      source: layer.source,
      timeIndicator: layer.timeIndicator,
      dbRange: feat.properties.dB_Value,
      dbLow: low,
      dbHigh: high,
      sourceType: feat.properties.Type,
    };
  } catch {
    return null;
  }
}

const SOURCE_LABELS: Record<NoiseExposure['source'], string> = {
  road: 'road traffic',
  rail: 'railway',
  airport: 'aircraft',
  industry: 'industrial',
};

function dbToDescription(db: number): string {
  if (db >= 75) return 'equivalent to standing next to a busy motorway';
  if (db >= 70) return 'equivalent to a vacuum cleaner at 3 metres';
  if (db >= 65) return 'equivalent to a loud conversation';
  if (db >= 60) return 'equivalent to a busy restaurant';
  if (db >= 55) return 'equivalent to background office chatter';
  if (db >= 50) return 'equivalent to moderate rainfall';
  if (db >= 45) return 'equivalent to a quiet suburb';
  return 'very quiet';
}

function categorise(ldenMax: number | null, lnightMax: number | null): NoiseResult['category'] {
  if ((ldenMax ?? 0) >= 70 || (lnightMax ?? 0) >= 60) return 'high';
  if ((ldenMax ?? 0) >= 60 || (lnightMax ?? 0) >= 50) return 'moderate';
  if ((ldenMax ?? 0) >= 55 || (lnightMax ?? 0) >= 45) return 'low';
  return 'quiet';
}

function buildSummary(exposures: NoiseExposure[], ldenMax: number | null, lnightMax: number | null): string {
  if (exposures.length === 0) {
    return 'This property is outside the mapped strategic noise areas. Ambient noise is expected to be below 55 dB Lden — comparable to a quiet residential area.';
  }

  const ldenExposures = exposures.filter((e) => e.timeIndicator === 'Lden');
  const sources = [...new Set(ldenExposures.map((e) => SOURCE_LABELS[e.source]))];

  const parts: string[] = [];
  if (ldenMax != null) {
    parts.push(`Noise level: ${ldenMax}+ dB Lden (${dbToDescription(ldenMax)})`);
  }
  if (lnightMax != null) {
    parts.push(`${lnightMax}+ dB Lnight`);
  }
  if (sources.length > 0) {
    parts.push(`Primary source: ${sources.join(', ')}`);
  }

  return parts.join('. ') + '.';
}

function buildContext(exposures: NoiseExposure[]): string {
  if (exposures.length === 0) {
    return 'EPA Round 4 Strategic Noise Maps (2021 traffic data, published under EU Environmental Noise Directive) checked across road, rail, airport, and industrial layers. No noise contours intersect this location.';
  }
  const datasets = [...new Set(exposures.map((e) => e.source))];
  return `Source: EPA Round 4 Strategic Noise Maps (2021 traffic data). Mapped noise sources at this location: ${datasets.map((d) => SOURCE_LABELS[d]).join(', ')}. Noise contours represent modelled exposure — actual levels depend on building orientation, glazing, and local screening.`;
}

function buildWhoGuidance(ldenMax: number | null, lnightMax: number | null): string {
  const parts: string[] = [];

  if (lnightMax != null && lnightMax >= 40) {
    parts.push(
      `Night noise of ${lnightMax}+ dB exceeds the WHO night-time guideline of 40 dB Lnight and may affect sleep quality for noise-sensitive occupants.`,
    );
  }
  if (ldenMax != null && ldenMax >= 53) {
    parts.push(
      `Day-evening-night noise of ${ldenMax}+ dB exceeds the WHO guideline of 53 dB Lden for road traffic, above which adverse health effects begin.`,
    );
  }

  if (parts.length === 0) {
    return 'Noise exposure is within WHO recommended guidelines for both daytime and night-time.';
  }
  return parts.join(' ');
}

export async function getNoiseExposure(opts: {
  lat: number;
  lng: number;
}): Promise<NoiseResult> {
  const { x, y } = wgs84ToIrishGrid(opts.lng, opts.lat);

  const results = await Promise.all(
    LAYERS.map((layer) => queryNoiseLayer(layer, x, y)),
  );

  const exposures = results.filter((r): r is NoiseExposure => r !== null);

  const ldenValues = exposures
    .filter((e) => e.timeIndicator === 'Lden')
    .map((e) => e.dbLow);
  const lnightValues = exposures
    .filter((e) => e.timeIndicator === 'Lnight')
    .map((e) => e.dbLow);

  const ldenMax = ldenValues.length > 0 ? Math.max(...ldenValues) : null;
  const lnightMax = lnightValues.length > 0 ? Math.max(...lnightValues) : null;

  const category = categorise(ldenMax, lnightMax);

  return {
    hasData: exposures.length > 0,
    ldenMax,
    lnightMax,
    category,
    exposures,
    summary: buildSummary(exposures, ldenMax, lnightMax),
    context: buildContext(exposures),
    whoGuidance: buildWhoGuidance(ldenMax, lnightMax),
  };
}
