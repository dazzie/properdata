import 'server-only';
import proj4 from 'proj4';

// EPSG:29903 — Irish National Grid (TM65). Used by ESDS/CFRAM layers.
proj4.defs(
  'EPSG:29903',
  '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 +ellps=mod_airy +towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 +units=m +no_defs',
);

// EPSG:2157 — Irish Transverse Mercator (ITM). Used by NIFM/NCFHM layers.
proj4.defs(
  'EPSG:2157',
  '+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=0.99982 +x_0=600000 +y_0=750000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
);

export interface FloodZoneHit {
  source: 'fluvial' | 'coastal' | 'pluvial';
  returnPeriod: number;
  dataset: 'cfram' | 'nifm' | 'ncfhm';
  studyName: string | null;
}

export interface FloodRiskResult {
  riskCategory: 'high' | 'medium' | 'low' | 'none';
  inFloodZone: boolean;
  zones: FloodZoneHit[];
  summary: string;
  context: string;
  recommendation: string;
}

const OPW_WFS = 'https://www.floodinfo.ie/geoserver/wfs';

interface FloodLayer {
  typeName: string;
  srs: 'EPSG:29903' | 'EPSG:2157';
  source: FloodZoneHit['source'];
  returnPeriod: number;
  dataset: FloodZoneHit['dataset'];
}

const LAYERS: FloodLayer[] = [
  { typeName: 'esds_floodmaps:ext_f_c_0100', srs: 'EPSG:29903', source: 'fluvial', returnPeriod: 100, dataset: 'cfram' },
  { typeName: 'esds_floodmaps:ext_f_c_1000', srs: 'EPSG:29903', source: 'fluvial', returnPeriod: 1000, dataset: 'cfram' },
  { typeName: 'esds_floodmaps:ext_c_c_0200', srs: 'EPSG:29903', source: 'coastal', returnPeriod: 200, dataset: 'cfram' },
  { typeName: 'esds_floodmaps:ext_c_c_1000', srs: 'EPSG:29903', source: 'coastal', returnPeriod: 1000, dataset: 'cfram' },
  { typeName: 'esds_floodmaps:ext_p_c_0100', srs: 'EPSG:29903', source: 'pluvial', returnPeriod: 100, dataset: 'cfram' },
  { typeName: 'nifm:ext_f_c_0100', srs: 'EPSG:2157', source: 'fluvial', returnPeriod: 100, dataset: 'nifm' },
  { typeName: 'ncfhm:ext_c_c_0200', srs: 'EPSG:2157', source: 'coastal', returnPeriod: 200, dataset: 'ncfhm' },
];

async function queryLayer(
  layer: FloodLayer,
  lng: number,
  lat: number,
): Promise<FloodZoneHit | null> {
  const [x, y] = proj4('EPSG:4326', layer.srs, [lng, lat]);
  if (x == null || y == null) return null;

  const buffer = 25;
  const bbox = `${x - buffer},${y - buffer},${x + buffer},${y + buffer},${layer.srs}`;

  const params = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: layer.typeName,
    outputFormat: 'application/json',
    maxFeatures: '1',
    srsName: layer.srs,
    BBOX: bbox,
    propertyName: 'uuid,s,pppp,proj_name',
  });

  try {
    const res = await fetch(`${OPW_WFS}?${params}`, {
      headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      totalFeatures: number;
      features: Array<{ properties: Record<string, string | null> }>;
    };

    if (data.totalFeatures === 0 || !data.features?.length) return null;

    return {
      source: layer.source,
      returnPeriod: layer.returnPeriod,
      dataset: layer.dataset,
      studyName: data.features[0]?.properties?.proj_name ?? null,
    };
  } catch {
    return null;
  }
}

function categorise(zones: FloodZoneHit[]): FloodRiskResult['riskCategory'] {
  const has100yr = zones.some((z) => z.source === 'fluvial' && z.returnPeriod <= 100);
  const has200yr = zones.some((z) => z.source === 'coastal' && z.returnPeriod <= 200);
  const hasPluvial100 = zones.some((z) => z.source === 'pluvial' && z.returnPeriod <= 100);
  if (has100yr || has200yr) return 'high';
  if (hasPluvial100) return 'medium';
  if (zones.length > 0) return 'low';
  return 'none';
}

function buildSummary(zones: FloodZoneHit[], risk: FloodRiskResult['riskCategory']): string {
  if (zones.length === 0) {
    return 'This property is not within any mapped OPW flood zone (fluvial, coastal, or pluvial).';
  }
  const parts: string[] = [];
  const fluvial = zones.filter((z) => z.source === 'fluvial');
  const coastal = zones.filter((z) => z.source === 'coastal');
  const pluvial = zones.filter((z) => z.source === 'pluvial');
  if (fluvial.length > 0) {
    const periods = fluvial.map((z) => `1-in-${z.returnPeriod} year`).join(' and ');
    parts.push(`fluvial (river) ${periods} flood zone`);
  }
  if (coastal.length > 0) {
    const periods = coastal.map((z) => `1-in-${z.returnPeriod} year`).join(' and ');
    parts.push(`coastal ${periods} flood zone`);
  }
  if (pluvial.length > 0) {
    parts.push('pluvial (surface water) 1-in-100 year flood zone');
  }
  return `This property is within a ${parts.join(' and a ')}. Risk category: ${risk}.`;
}

function buildContext(zones: FloodZoneHit[]): string {
  if (zones.length === 0) {
    return 'OPW CFRAM, NIFM, and NCFHM flood mapping checked. No flood extent polygons intersect this location. Note: pluvial (surface water) mapping may not cover all areas.';
  }
  const datasets = [...new Set(zones.map((z) => z.dataset))];
  const studies = [...new Set(zones.map((z) => z.studyName).filter(Boolean))];
  let ctx = `Source: OPW ${datasets.map((d) => d.toUpperCase()).join(' / ')} flood mapping.`;
  if (studies.length > 0) ctx += ` Study area: ${studies.join(', ')}.`;
  ctx += ' Flood zones indicate areas at risk of flooding based on hydrological modelling. Actual flood risk depends on local defences, drainage, and ground conditions.';
  return ctx;
}

function buildRecommendation(risk: FloodRiskResult['riskCategory']): string {
  if (risk === 'high') {
    return 'Property is in a high-probability flood zone. Obtain a site-specific flood risk assessment. Expect higher insurance premiums or difficulty obtaining flood cover. Check if flood defence works (FRS) protect this area.';
  }
  if (risk === 'medium') {
    return 'Property is in a moderate flood risk zone. Check local drainage infrastructure and history of surface water flooding. Consider a professional flood risk assessment.';
  }
  if (risk === 'low') {
    return 'Property is in a low-probability flood zone (1-in-1000 year or greater). Standard insurance should be available. No immediate action required but awareness is recommended.';
  }
  return 'No flood risk identified in OPW mapping. Standard insurance applies. Verify on floodinfo.ie for the most up-to-date data.';
}

export async function getFloodRisk(opts: {
  lat: number;
  lng: number;
}): Promise<FloodRiskResult> {
  const results = await Promise.all(
    LAYERS.map((layer) => queryLayer(layer, opts.lng, opts.lat)),
  );

  const zones = results.filter((r): r is FloodZoneHit => r !== null);
  const riskCategory = categorise(zones);

  return {
    riskCategory,
    inFloodZone: zones.length > 0,
    zones,
    summary: buildSummary(zones, riskCategory),
    context: buildContext(zones),
    recommendation: buildRecommendation(riskCategory),
  };
}
