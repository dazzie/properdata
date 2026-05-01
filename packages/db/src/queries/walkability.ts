import 'server-only';

export interface AmenityCount {
  category: string;
  count: number;
  nearest: number | null; // distance in meters
}

export interface WalkabilityResult {
  score: number; // 0-100
  label: string; // 'Very Walkable' | 'Walkable' | 'Somewhat Walkable' | 'Car-Dependent'
  amenities: AmenityCount[];
  summary: string;
  context: string;
}

// Overpass API — public, no key required
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// Amenity categories and their scoring weights
const CATEGORIES: Array<{
  name: string;
  overpassQuery: string;
  weight: number;
  maxScore: number;
  familyWeight?: number;
  commuterWeight?: number;
  retireeWeight?: number;
}> = [
  { name: 'Supermarkets', overpassQuery: 'node["shop"="supermarket"]', weight: 15, maxScore: 2, familyWeight: 15, commuterWeight: 10, retireeWeight: 15 },
  { name: 'Shops', overpassQuery: 'node["shop"]', weight: 10, maxScore: 10, familyWeight: 8, commuterWeight: 8, retireeWeight: 10 },
  { name: 'Primary schools', overpassQuery: 'nwr["amenity"="school"]["isced:level"~"1|0"]', weight: 10, maxScore: 2, familyWeight: 20, commuterWeight: 2, retireeWeight: 2 },
  { name: 'Schools (all)', overpassQuery: 'nwr["amenity"="school"]', weight: 8, maxScore: 3, familyWeight: 15, commuterWeight: 3, retireeWeight: 3 },
  { name: 'GPs/Clinics', overpassQuery: 'node["amenity"~"doctors|clinic"]', weight: 10, maxScore: 2, familyWeight: 10, commuterWeight: 5, retireeWeight: 18 },
  { name: 'Pharmacies', overpassQuery: 'node["amenity"="pharmacy"]', weight: 8, maxScore: 2, familyWeight: 8, commuterWeight: 5, retireeWeight: 15 },
  { name: 'Pubs/Restaurants', overpassQuery: 'node["amenity"~"pub|bar|restaurant|cafe"]', weight: 8, maxScore: 10, familyWeight: 5, commuterWeight: 10, retireeWeight: 8 },
  { name: 'Bus stops', overpassQuery: 'node["highway"="bus_stop"]', weight: 10, maxScore: 5, familyWeight: 8, commuterWeight: 15, retireeWeight: 10 },
  { name: 'Train stations', overpassQuery: 'nwr["railway"="station"]["train"="yes"]', weight: 8, maxScore: 1, familyWeight: 5, commuterWeight: 20, retireeWeight: 5 },
  { name: 'Parks/Playgrounds', overpassQuery: 'nwr["leisure"~"park|playground"]', weight: 8, maxScore: 3, familyWeight: 12, commuterWeight: 5, retireeWeight: 10 },
  { name: 'Post offices', overpassQuery: 'node["amenity"="post_office"]', weight: 5, maxScore: 1, familyWeight: 3, commuterWeight: 2, retireeWeight: 8 },
];

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getLabel(score: number): string {
  if (score >= 70) return 'Very Walkable';
  if (score >= 50) return 'Walkable';
  if (score >= 25) return 'Somewhat Walkable';
  return 'Car-Dependent';
}

/**
 * Compute walkability score for a location using OSM amenity data.
 *
 * Queries the Overpass API for amenities within 1.5km (walking distance),
 * with train stations checked within 5km.
 */
export async function getWalkabilityScore(opts: {
  lat: number;
  lng: number;
  persona?: 'family' | 'investor' | 'retiree' | 'commuter';
}): Promise<WalkabilityResult> {
  const { lat, lng } = opts;
  const persona = opts.persona ?? 'family';
  const radius = 1500; // 1.5km for most amenities
  const trainRadius = 5000; // 5km for train stations

  // Build Overpass query for all categories at once
  const queryParts = CATEGORIES.map((cat) => {
    const r = cat.name === 'Train stations' ? trainRadius : radius;
    return cat.overpassQuery.replace(/^(node|way|relation|nwr?)\[/, `$1(around:${r},${lat},${lng})[`);
  });

  const query = `[out:json][timeout:25];(${queryParts.join(';')};);out center;`;

  try {
    const body = new URLSearchParams({ data: query });
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'User-Agent': 'ProperData/1.0' },
      body,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Overpass API request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      elements: Array<{
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }>;
    };

    const elements = data.elements ?? [];

    // Categorise elements and compute distances
    const amenities: AmenityCount[] = [];
    let totalScore = 0;
    let totalWeight = 0;

    for (const cat of CATEGORIES) {
      const weightKey = `${persona}Weight` as keyof typeof cat;
      const weight = (cat[weightKey] as number | undefined) ?? cat.weight;
      totalWeight += weight;

      const matching = elements.filter((el) => {
        const tags = el.tags ?? {};
        if (cat.name === 'Supermarkets') return tags.shop === 'supermarket';
        if (cat.name === 'Shops') return !!tags.shop;
        if (cat.name === 'Primary schools') return tags.amenity === 'school';
        if (cat.name === 'Schools (all)') return tags.amenity === 'school';
        if (cat.name === 'GPs/Clinics') return tags.amenity === 'doctors' || tags.amenity === 'clinic';
        if (cat.name === 'Pharmacies') return tags.amenity === 'pharmacy';
        if (cat.name === 'Pubs/Restaurants') return ['pub', 'bar', 'restaurant', 'cafe'].includes(tags.amenity ?? '');
        if (cat.name === 'Bus stops') return tags.highway === 'bus_stop';
        if (cat.name === 'Train stations') return tags.railway === 'station';
        if (cat.name === 'Parks/Playgrounds') return tags.leisure === 'park' || tags.leisure === 'playground';
        if (cat.name === 'Post offices') return tags.amenity === 'post_office';
        return false;
      });

      const count = matching.length;

      // Find nearest
      let nearest: number | null = null;
      for (const el of matching) {
        const elLat = el.lat ?? el.center?.lat;
        const elLng = el.lon ?? el.center?.lon;
        if (elLat !== undefined && elLng !== undefined) {
          const dist = haversineDistance(lat, lng, elLat, elLng);
          if (nearest === null || dist < nearest) {
            nearest = dist;
          }
        }
      }

      // Score this category: min(count, maxScore) / maxScore * weight
      const categoryScore = Math.min(count, cat.maxScore) / cat.maxScore;
      totalScore += categoryScore * weight;

      amenities.push({
        category: cat.name,
        count,
        nearest: nearest !== null ? Math.round(nearest) : null,
      });
    }

    const score = Math.round((totalScore / totalWeight) * 100);
    const label = getLabel(score);

    const nonZero = amenities.filter((a) => a.count > 0);
    const summaryParts = nonZero
      .slice(0, 6)
      .map((a) => `${a.count} ${a.category.toLowerCase()}${a.nearest ? ` (nearest: ${a.nearest}m)` : ''}`);

    return {
      score,
      label,
      amenities,
      summary: `Within ${radius / 1000}km: ${summaryParts.join(', ')}.`,
      context: `Walkability score: ${score}/100 (${label}). ${persona === 'family' ? 'Weighted for family priorities (schools, parks, GPs).' : persona === 'commuter' ? 'Weighted for commuter priorities (train station, bus stops).' : persona === 'retiree' ? 'Weighted for retiree priorities (GPs, pharmacies, post offices).' : ''}`,
    };
  } catch (err) {
    console.error('Walkability query failed:', (err as Error).message);
    return {
      score: 0,
      label: 'Unknown',
      amenities: [],
      summary: 'Walkability data temporarily unavailable.',
      context: 'Could not reach the OpenStreetMap Overpass API. Try again later.',
    };
  }
}
