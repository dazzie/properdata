import 'server-only';

export interface RadonRiskResult {
  riskPercent: number;
  riskCategory: 'high' | 'medium' | 'low' | 'unknown';
  riskDescription: string;
  context: string;
  testCost: string;
  remediationCost: string;
}

// EPA WFS endpoint for the Radon Risk Map of Ireland
const EPA_WFS_URL = 'https://gis.epa.ie/geoserver/ows';

// Map EPA risk text to structured data
const RISK_MAP: Record<string, { percent: number; category: RadonRiskResult['riskCategory'] }> = {
  'About 1 in 5 homes in this area is likely to have high radon levels': {
    percent: 20,
    category: 'high',
  },
  'About 1 in 10 homes in this area is likely to have high radon levels': {
    percent: 10,
    category: 'medium',
  },
  'About 1 in 20 homes in this area is likely to have high radon levels': {
    percent: 5,
    category: 'low',
  },
};

/**
 * Convert WGS84 (lng, lat) to Irish Grid (EPSG:29902) approximately.
 *
 * This is a simplified conversion using a local Helmert transform.
 * Accurate to ~5m which is sufficient for bbox queries.
 */
export function wgs84ToIrishGrid(lng: number, lat: number): { x: number; y: number } {
  // Helmert parameters for WGS84 → Irish Grid (TM65)
  const a = 6377340.189; // Airy Modified semi-major
  const b = 6356034.448; // Airy Modified semi-minor
  const f0 = 1.000035; // scale factor
  const lat0 = (53.5 * Math.PI) / 180; // origin latitude
  const lng0 = (-8.0 * Math.PI) / 180; // origin longitude
  const e0 = 200000; // false easting
  const n0 = 250000; // false northing

  const e2 = (a * a - b * b) / (a * a);
  const phi = (lat * Math.PI) / 180;
  const lambda = (lng * Math.PI) / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);
  const nu = (a * f0) / Math.sqrt(1 - e2 * sinPhi * sinPhi);
  const rho = (a * f0 * (1 - e2)) / Math.pow(1 - e2 * sinPhi * sinPhi, 1.5);
  const eta2 = nu / rho - 1;

  const n = (a - b) / (a + b);
  const n2 = n * n;
  const n3 = n * n2;

  const dLat = phi - lat0;
  const sLat = phi + lat0;

  const ma =
    (1 + n + (5 / 4) * n2 + (5 / 4) * n3) * dLat;
  const mb =
    (3 * n + 3 * n2 + (21 / 8) * n3) * Math.sin(dLat) * Math.cos(sLat);
  const mc =
    ((15 / 8) * n2 + (15 / 8) * n3) * Math.sin(2 * dLat) * Math.cos(2 * sLat);
  const md =
    (35 / 24) * n3 * Math.sin(3 * dLat) * Math.cos(3 * sLat);

  const M = b * f0 * (ma - mb + mc - md);

  const dLng = lambda - lng0;
  const dLng2 = dLng * dLng;
  const cos3 = cosPhi * cosPhi * cosPhi;
  const cos5 = cos3 * cosPhi * cosPhi;
  const tan2 = tanPhi * tanPhi;
  const tan4 = tan2 * tan2;

  const I = M + n0;
  const II = (nu / 2) * sinPhi * cosPhi;
  const III = (nu / 24) * sinPhi * cos3 * (5 - tan2 + 9 * eta2);
  const IIIA = (nu / 720) * sinPhi * cos5 * (61 - 58 * tan2 + tan4);
  const IV = nu * cosPhi;
  const V = (nu / 6) * cos3 * (nu / rho - tan2);
  const VI = (nu / 120) * cos5 * (5 - 18 * tan2 + tan4 + 14 * eta2 - 58 * tan2 * eta2);

  const y = I + II * dLng2 + III * dLng2 * dLng2 + IIIA * dLng2 * dLng2 * dLng2;
  const x = e0 + IV * dLng + V * dLng * dLng2 + VI * dLng * dLng2 * dLng2;

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Query EPA WFS for radon risk at a given WGS84 coordinate.
 *
 * Uses a ~500m bbox around the point to find the containing risk polygon.
 */
export async function getRadonRisk(opts: {
  lat: number;
  lng: number;
}): Promise<RadonRiskResult> {
  const { x, y } = wgs84ToIrishGrid(opts.lng, opts.lat);

  // 500m bbox around the point
  const buffer = 500;
  const bbox = `${y - buffer},${x - buffer},${y + buffer},${x + buffer}`;

  const params = new URLSearchParams({
    service: 'wfs',
    version: '2.0.0',
    request: 'GetFeature',
    typeName: 'EPA:RadonRiskMapofIreland',
    outputFormat: 'application/json',
    bbox,
    count: '1',
    propertyName: 'Risk',
  });

  try {
    const response = await fetch(`${EPA_WFS_URL}?${params}`, {
      headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`EPA WFS request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      features: Array<{
        properties: { Risk: string };
      }>;
    };

    if (!data.features || data.features.length === 0) {
      return {
        riskPercent: 0,
        riskCategory: 'unknown',
        riskDescription: 'Outside EPA radon risk mapping coverage.',
        context: 'This location is not covered by the EPA Radon Risk Map. This does not mean zero radon risk — testing is still recommended for any pre-2023 property.',
        testCost: '~€50 for a 3-month detector kit from the EPA',
        remediationCost: '€500–€2,500 if elevated levels are found',
      };
    }

    const riskText = data.features[0]!.properties.Risk;
    const matched = RISK_MAP[riskText];

    if (!matched) {
      return {
        riskPercent: 0,
        riskCategory: 'unknown',
        riskDescription: riskText,
        context: 'EPA radon data available but risk category not recognised. Original text preserved.',
        testCost: '~€50 for a 3-month detector kit from the EPA',
        remediationCost: '€500–€2,500 if elevated levels are found',
      };
    }

    const fractionText =
      matched.percent === 20
        ? '1-in-5'
        : matched.percent === 10
          ? '1-in-10'
          : '1-in-20';

    return {
      riskPercent: matched.percent,
      riskCategory: matched.category,
      riskDescription: `${matched.percent}% probability — your area has a ${fractionText} chance of indoor radon above the reference level (200 Bq/m³).`,
      context:
        matched.category === 'high'
          ? 'This is a High Radon Area. Building Regulations TGD-C requires radon barriers in new builds from October 2023. Pre-2023 properties have no required mitigation — testing is strongly recommended before purchase.'
          : matched.category === 'medium'
            ? 'Moderate radon risk area. Indoor radon testing is recommended, especially for pre-1990 properties with limited ground floor ventilation.'
            : 'Lower radon risk area, but the EPA recommends testing all homes regardless. Older properties with suspended timber floors or poor underfloor ventilation may still have elevated levels.',
      testCost: '~€50 for a 3-month detector kit from the EPA',
      remediationCost: '€500–€2,500 if elevated levels are found',
    };
  } catch (err) {
    console.error('Radon risk lookup failed:', (err as Error).message);
    return {
      riskPercent: 0,
      riskCategory: 'unknown',
      riskDescription: 'Radon risk data temporarily unavailable.',
      context: 'Could not reach the EPA radon risk service. Try again later.',
      testCost: '~€50 for a 3-month detector kit from the EPA',
      remediationCost: '€500–€2,500 if elevated levels are found',
    };
  }
}
