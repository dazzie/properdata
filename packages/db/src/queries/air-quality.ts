import 'server-only';

export interface AirQualityStation {
  name: string;
  code: string;
  distanceKm: number;
  lat: number;
  lng: number;
}

export interface AirQualityReading {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  recordedAt: string;
}

export interface AirQualityResult {
  station: AirQualityStation;
  aqih: number | null;
  aqihLabel: string;
  currentReading: AirQualityReading | null;
  avg24h: {
    pm25: number | null;
    pm10: number | null;
  };
  modelledZone: {
    pm25Range: string | null;
    pm10Range: string | null;
    no2Range: string | null;
  };
  summary: string;
  context: string;
  healthAdvice: string;
}

const MONITORS_URL = 'https://airquality.ie/assets/php/get-monitors.php';
const EPA_WFS = 'https://gis.epa.ie/geoserver/EPA/ows';

interface MonitorResponse {
  monitor_id: number;
  label: string;
  location: string;
  latitude: string;
  longitude: string;
  code: string;
  latest_reading?: {
    recorded_at: string;
    pm2_5: number | null;
    pm10: number | null;
    no2: number | null;
    o3: number | null;
    so2: number | null;
  };
  latest_averages?: {
    pm10?: { value: number };
    pm2_5?: { value: number };
  };
  current_rating: string | null;
}

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

function aqihToLabel(aqih: number): string {
  if (aqih <= 3) return 'Good';
  if (aqih <= 6) return 'Fair';
  if (aqih <= 9) return 'Poor';
  return 'Very Poor';
}

async function fetchNearestMonitor(
  lat: number,
  lng: number,
): Promise<{ station: AirQualityStation; monitor: MonitorResponse } | null> {
  try {
    const res = await fetch(MONITORS_URL, {
      headers: {
        'User-Agent': 'ProperData/1.0 (property intelligence)',
        Referer: 'https://airquality.ie/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const monitors = (await res.json()) as MonitorResponse[];
    if (!monitors?.length) return null;

    let nearest: MonitorResponse | null = null;
    let nearestDist = Infinity;

    for (const m of monitors) {
      const mLat = parseFloat(m.latitude);
      const mLng = parseFloat(m.longitude);
      if (isNaN(mLat) || isNaN(mLng)) continue;
      const dist = haversineKm(lat, lng, mLat, mLng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = m;
      }
    }

    if (!nearest) return null;

    return {
      station: {
        name: nearest.location,
        code: nearest.code,
        distanceKm: Math.round(nearestDist * 10) / 10,
        lat: parseFloat(nearest.latitude),
        lng: parseFloat(nearest.longitude),
      },
      monitor: nearest,
    };
  } catch {
    return null;
  }
}

interface WfsZoneResult {
  pm25Range: string | null;
  pm10Range: string | null;
  no2Range: string | null;
}

async function queryModelledZone(lat: number, lng: number): Promise<WfsZoneResult> {
  const result: WfsZoneResult = { pm25Range: null, pm10Range: null, no2Range: null };

  const layers = [
    { typeName: 'EPA:AIR_PM2_5', key: 'pm25Range' as const },
    { typeName: 'EPA:AIR_PM10', key: 'pm10Range' as const },
    { typeName: 'EPA:AIR_NO2', key: 'no2Range' as const },
  ];

  const queries = layers.map(async (layer) => {
    try {
      const params = new URLSearchParams({
        service: 'WFS',
        version: '1.0.0',
        request: 'GetFeature',
        typeName: layer.typeName,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        CQL_FILTER: `INTERSECTS(the_geom,POINT(${lng} ${lat}))`,
        maxFeatures: '1',
        propertyName: 'Range',
      });

      const res = await fetch(`${EPA_WFS}?${params}`, {
        headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        features?: Array<{ properties: { Range: string } }>;
      };

      if (data.features?.length) {
        result[layer.key] = data.features[0]!.properties.Range;
      }
    } catch {
      // modelled zone query failed — non-critical
    }
  });

  await Promise.all(queries);
  return result;
}

function buildSummary(
  station: AirQualityStation,
  aqih: number | null,
  aqihLabel: string,
  avg24h: { pm25: number | null; pm10: number | null },
): string {
  const parts: string[] = [];

  if (aqih != null) {
    parts.push(`Air quality: AQIH ${aqih} (${aqihLabel}) at ${station.name} (${station.distanceKm}km away)`);
  } else {
    parts.push(`Nearest monitoring station: ${station.name} (${station.distanceKm}km away)`);
  }

  if (avg24h.pm25 != null) {
    const whoStatus = avg24h.pm25 <= 15 ? 'within' : 'exceeds';
    parts.push(`24h average PM2.5: ${avg24h.pm25} µg/m³ (${whoStatus} WHO guideline of 15 µg/m³)`);
  }
  if (avg24h.pm10 != null) {
    const whoStatus = avg24h.pm10 <= 45 ? 'within' : 'exceeds';
    parts.push(`24h average PM10: ${avg24h.pm10} µg/m³ (${whoStatus} WHO guideline of 45 µg/m³)`);
  }

  return parts.join('. ') + '.';
}

function buildHealthAdvice(aqih: number | null): string {
  if (aqih == null) return 'Air quality data temporarily unavailable. Check airquality.ie for current conditions.';
  if (aqih <= 3) return 'Air quality is good. No health precautions needed. Ideal for outdoor activities.';
  if (aqih <= 6) return 'Air quality is fair. Unusually sensitive people should consider limiting prolonged outdoor exertion.';
  if (aqih <= 9)
    return 'Air quality is poor. People with heart or respiratory conditions should reduce prolonged outdoor exertion. General population should limit extended outdoor activities.';
  return 'Air quality is very poor. Everyone should reduce outdoor physical activity. People with respiratory or heart conditions should avoid outdoor exertion.';
}

export async function getAirQuality(opts: {
  lat: number;
  lng: number;
}): Promise<AirQualityResult | null> {
  const [monitorResult, modelledZone] = await Promise.all([
    fetchNearestMonitor(opts.lat, opts.lng),
    queryModelledZone(opts.lat, opts.lng),
  ]);

  if (!monitorResult) return null;

  const { station, monitor } = monitorResult;
  const aqih = monitor.current_rating ? parseInt(monitor.current_rating, 10) : null;
  const aqihLabel = aqih != null ? aqihToLabel(aqih) : 'Unknown';

  const currentReading: AirQualityReading | null = monitor.latest_reading
    ? {
        pm25: monitor.latest_reading.pm2_5,
        pm10: monitor.latest_reading.pm10,
        no2: monitor.latest_reading.no2,
        o3: monitor.latest_reading.o3,
        so2: monitor.latest_reading.so2,
        recordedAt: monitor.latest_reading.recorded_at,
      }
    : null;

  const avg24h = {
    pm25: monitor.latest_averages?.pm2_5?.value ?? null,
    pm10: monitor.latest_averages?.pm10?.value ?? null,
  };

  return {
    station,
    aqih,
    aqihLabel,
    currentReading,
    avg24h,
    modelledZone,
    summary: buildSummary(station, aqih, aqihLabel, avg24h),
    context: `Source: EPA Air Quality Monitoring Network (airquality.ie). Station: ${station.name} (${station.code}), ${station.distanceKm}km from property. Modelled concentration zones from EPA 2017 national assessment. AQIH scale: 1-3 Good, 4-6 Fair, 7-9 Poor, 10 Very Poor.`,
    healthAdvice: buildHealthAdvice(aqih),
  };
}
