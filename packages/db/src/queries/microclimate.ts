import 'server-only';

export interface ClimateNormals {
  meanTemp: number;
  rainfall: number;
  sunHours: number | null;
  windSpeed: number | null;
  frostDays: number | null;
}

export interface MicroclimateResult {
  station: {
    name: string;
    distanceKm: number;
    height: number;
  };
  normals: ClimateNormals;
  nationalComparison: {
    tempVsNational: string;
    rainfallVsNational: string;
    sunVsNational: string | null;
    windVsNational: string | null;
  };
  summary: string;
  context: string;
  retrofitNote: string;
}

interface StationMeta {
  id: number;
  name: string;
  lat: number;
  lng: number;
  height: number;
}

const STATIONS: StationMeta[] = [
  { id: 175, name: 'Phoenix Park', lat: 53.364, lng: -6.350, height: 48 },
  { id: 275, name: 'Mace Head', lat: 53.326, lng: -9.901, height: 21 },
  { id: 375, name: 'Oak Park', lat: 52.861, lng: -6.915, height: 62 },
  { id: 518, name: 'Shannon Airport', lat: 52.690, lng: -8.918, height: 15 },
  { id: 532, name: 'Dublin Airport', lat: 53.428, lng: -6.241, height: 71 },
  { id: 575, name: 'Moore Park', lat: 52.164, lng: -8.264, height: 46 },
  { id: 675, name: 'Ballyhaise', lat: 54.051, lng: -7.310, height: 78 },
  { id: 775, name: 'Sherkin Island', lat: 51.476, lng: -9.428, height: 21 },
  { id: 875, name: 'Mullingar', lat: 53.537, lng: -7.362, height: 101 },
  { id: 1075, name: 'Roches Point', lat: 51.793, lng: -8.244, height: 40 },
  { id: 1175, name: 'Newport', lat: 53.924, lng: -9.573, height: 22 },
  { id: 1275, name: 'Markree', lat: 54.175, lng: -8.456, height: 34 },
  { id: 1375, name: 'Dunsany', lat: 53.516, lng: -6.660, height: 83 },
  { id: 1475, name: 'Gurteen', lat: 53.035, lng: -8.009, height: 75 },
  { id: 1575, name: 'Malin Head', lat: 55.372, lng: -7.339, height: 20 },
  { id: 1775, name: 'Johnstown Castle', lat: 52.298, lng: -6.497, height: 62 },
  { id: 1875, name: 'Athenry', lat: 53.289, lng: -8.786, height: 40 },
  { id: 1975, name: 'Mt Dillon', lat: 53.727, lng: -7.981, height: 39 },
  { id: 2075, name: 'Finner', lat: 54.494, lng: -8.243, height: 33 },
  { id: 2175, name: 'Claremorris', lat: 53.711, lng: -8.993, height: 68 },
  { id: 2275, name: 'Valentia', lat: 51.938, lng: -10.241, height: 24 },
  { id: 2375, name: 'Belmullet', lat: 54.228, lng: -10.007, height: 9 },
  { id: 3723, name: 'Casement', lat: 53.306, lng: -6.439, height: 91 },
  { id: 3904, name: 'Cork Airport', lat: 51.847, lng: -8.486, height: 155 },
  { id: 4935, name: 'Knock Airport', lat: 53.906, lng: -8.817, height: 201 },
];

// National 1981–2010 averages (Met Éireann published values)
const NATIONAL_AVG: ClimateNormals = {
  meanTemp: 9.8,
  rainfall: 1230,
  sunHours: 1450,
  windSpeed: 17,
  frostDays: 40,
};

const normalsCache = new Map<number, ClimateNormals>();

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearest(lat: number, lng: number): { station: StationMeta; distanceKm: number } {
  let best = STATIONS[0]!;
  let bestDist = Infinity;

  for (const s of STATIONS) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }

  return { station: best, distanceKm: Math.round(bestDist * 10) / 10 };
}

async function fetchNormals(station: StationMeta): Promise<ClimateNormals> {
  const cached = normalsCache.get(station.id);
  if (cached) return cached;

  const url = `https://clidata.met.ie/cli/climate_data/webdata/mly${station.id}.csv`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`Met Éireann CSV fetch failed: ${res.status}`);
  }

  const text = await res.text();
  const lines = text.split('\n');

  // CSV format: year, month, meant, maxtp, mintp, mnmax, mnmin, rain, gmin, wdsp, maxgt, sun
  // Skip header lines (first ~6 lines contain station metadata)
  let dataStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.match(/^\s*\d{4}/)) {
      dataStartIdx = i;
      break;
    }
  }

  const yearlyData = new Map<
    number,
    { temps: number[]; rains: number[]; suns: number[]; winds: number[]; mnmins: number[] }
  >();

  for (let i = dataStartIdx; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const cols = line.split(',').map((c) => c.trim());
    if (cols.length < 8) continue;

    const year = parseInt(cols[0]!, 10);
    if (isNaN(year) || year < 1991 || year > 2020) continue;

    const meant = parseFloat(cols[2]!);
    const rain = parseFloat(cols[7]!);
    const mnmin = cols.length > 6 ? parseFloat(cols[6]!) : NaN;
    const wdsp = cols.length > 9 ? parseFloat(cols[9]!) : NaN;
    const sun = cols.length > 11 ? parseFloat(cols[11]!) : NaN;

    if (!yearlyData.has(year)) {
      yearlyData.set(year, { temps: [], rains: [], suns: [], winds: [], mnmins: [] });
    }
    const d = yearlyData.get(year)!;

    if (!isNaN(meant)) d.temps.push(meant);
    if (!isNaN(rain)) d.rains.push(rain);
    if (!isNaN(sun)) d.suns.push(sun);
    if (!isNaN(wdsp)) d.winds.push(wdsp);
    if (!isNaN(mnmin)) d.mnmins.push(mnmin);
  }

  const allTemps: number[] = [];
  const allRains: number[] = [];
  const allSuns: number[] = [];
  const allWinds: number[] = [];
  let totalEstFrostDays = 0;
  let yearCount = 0;

  for (const [, d] of yearlyData) {
    if (d.temps.length >= 10) allTemps.push(d.temps.reduce((a, b) => a + b, 0) / d.temps.length);
    if (d.rains.length >= 10) allRains.push(d.rains.reduce((a, b) => a + b, 0));
    if (d.suns.length >= 10) allSuns.push(d.suns.reduce((a, b) => a + b, 0));
    if (d.winds.length >= 10) allWinds.push(d.winds.reduce((a, b) => a + b, 0) / d.winds.length);
    if (d.mnmins.length >= 10) {
      yearCount++;
      for (const mnmin of d.mnmins) {
        // Estimate air frost days from mean daily minimum temperature.
        // Based on normal distribution of daily temps around monthly mean
        // (σ ≈ 3°C for Irish climate). Calibrated against Met Éireann
        // published 30-year frost day averages.
        if (mnmin <= -2) totalEstFrostDays += 20;
        else if (mnmin <= 0) totalEstFrostDays += 14;
        else if (mnmin <= 1) totalEstFrostDays += 10;
        else if (mnmin <= 2) totalEstFrostDays += 7;
        else if (mnmin <= 3) totalEstFrostDays += 4;
        else if (mnmin <= 4) totalEstFrostDays += 2;
        else if (mnmin <= 5) totalEstFrostDays += 1;
      }
    }
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  const meanTemp = avg(allTemps);
  const rainfall = avg(allRains);
  const sunHours = avg(allSuns);
  const windSpeedKnots = avg(allWinds);
  // Convert knots to km/h
  const windSpeed = windSpeedKnots != null ? Math.round(windSpeedKnots * 1.852 * 10) / 10 : null;
  const frostDays = yearCount > 0 ? Math.round(totalEstFrostDays / yearCount) : null;

  const normals: ClimateNormals = {
    meanTemp: meanTemp != null ? Math.round(meanTemp * 10) / 10 : NATIONAL_AVG.meanTemp,
    rainfall: rainfall != null ? Math.round(rainfall) : NATIONAL_AVG.rainfall,
    sunHours: sunHours != null ? Math.round(sunHours) : null,
    windSpeed,
    frostDays,
  };

  normalsCache.set(station.id, normals);
  return normals;
}

function pctOfNational(value: number, national: number): string {
  const pct = Math.round((value / national) * 100);
  if (pct >= 105) return `${pct}% of national average`;
  if (pct <= 95) return `${pct}% of national average`;
  return 'near national average';
}

function windCategory(kmh: number): string {
  if (kmh >= 25) return 'Exposed';
  if (kmh >= 18) return 'Moderate';
  if (kmh >= 12) return 'Sheltered';
  return 'Very sheltered';
}

function buildSummary(normals: ClimateNormals, stationName: string): string {
  const parts: string[] = [];

  parts.push(`Sun hours: ${normals.sunHours ?? 'N/A'}/year (${normals.sunHours ? pctOfNational(normals.sunHours, NATIONAL_AVG.sunHours!) : 'data unavailable'})`);
  parts.push(`Rainfall: ${normals.rainfall}mm/year (${pctOfNational(normals.rainfall, NATIONAL_AVG.rainfall)})`);

  if (normals.windSpeed != null) {
    parts.push(
      `Wind exposure: ${windCategory(normals.windSpeed)} (annual mean ${normals.windSpeed} km/h)`,
    );
  }
  if (normals.frostDays != null) {
    parts.push(`Frost days: ~${normals.frostDays}/year`);
  }
  parts.push(`Mean temperature: ${normals.meanTemp}°C`);

  return parts.join('. ') + '.';
}

function buildRetrofitNote(normals: ClimateNormals): string {
  const parts: string[] = [];

  if (normals.windSpeed != null && normals.windSpeed >= 20) {
    parts.push(
      'Higher wind exposure increases heat loss — external wall insulation and draught sealing offer above-average savings here.',
    );
  }
  if (normals.meanTemp >= 10.5) {
    parts.push(
      'Milder winters improve heat pump efficiency. Air-source heat pump COP is likely above the national average at this location.',
    );
  } else if (normals.meanTemp <= 9.0) {
    parts.push(
      'Colder winters mean higher heating demand. Upgrade insulation before installing a heat pump to maximise savings.',
    );
  }
  if (normals.rainfall >= 1400) {
    parts.push(
      'High rainfall area — check roof condition and drainage before investing in other retrofit measures.',
    );
  }
  if (normals.sunHours != null && normals.sunHours >= 1500) {
    parts.push(
      'Above-average sunshine improves solar PV payback — a 4kWp system may return 5-10% more than the national estimate.',
    );
  }

  if (parts.length === 0) {
    return 'Standard retrofit assumptions apply for this microclimate. No significant climate-related adjustments needed.';
  }
  return parts.join(' ');
}

export async function getMicroclimate(opts: {
  lat: number;
  lng: number;
}): Promise<MicroclimateResult | null> {
  const { station, distanceKm } = findNearest(opts.lat, opts.lng);

  if (distanceKm > 80) return null;

  try {
    const normals = await fetchNormals(station);

    return {
      station: { name: station.name, distanceKm, height: station.height },
      normals,
      nationalComparison: {
        tempVsNational: pctOfNational(normals.meanTemp, NATIONAL_AVG.meanTemp),
        rainfallVsNational: pctOfNational(normals.rainfall, NATIONAL_AVG.rainfall),
        sunVsNational: normals.sunHours ? pctOfNational(normals.sunHours, NATIONAL_AVG.sunHours!) : null,
        windVsNational: normals.windSpeed
          ? pctOfNational(normals.windSpeed, NATIONAL_AVG.windSpeed!)
          : null,
      },
      summary: buildSummary(normals, station.name),
      context: `Source: Met Éireann 30-year climate normals (1991–2020) computed from ${station.name} synoptic station (${distanceKm}km from property, elevation ${station.height}m). Climate data is CC BY 4.0 licensed. Microclimate may vary based on elevation, aspect, shelter, and proximity to coast.`,
      retrofitNote: buildRetrofitNote(normals),
    };
  } catch {
    return null;
  }
}
