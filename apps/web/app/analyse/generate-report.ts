import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// Types (mirror the API response)
// ---------------------------------------------------------------------------

interface ComparableUsed {
  address: string;
  sale_date: string;
  price: number;
  distance_meters: number;
  weight: string;
  rationale: string;
}

interface ComparableResult {
  estimated_value: number;
  confidence: string;
  comparables_used: ComparableUsed[];
  narrative: string;
}

interface GrantScheme {
  code: string;
  name: string;
  amount_low: number;
  amount_high: number;
  eligibility_status: string;
  rationale: string;
  conditions: string[];
}

interface GrantResult {
  total_grants_low: number;
  total_grants_high: number;
  applicable_schemes: GrantScheme[];
  net_acquisition_cost: {
    purchase_price: number;
    total_grants_central: number;
    stamp_duty: number;
    estimated_legal_fees: number;
    effective_cost: number;
  };
  narrative: string;
}

interface YieldResult {
  property: { estimated_rent_monthly: number; rent_data_source: string };
  yields: { gross_yield_annual: number; net_yield_annual: number; tax_adjusted_yield: number };
  narrative: string;
}

interface RadonResult {
  riskPercent: number;
  riskCategory: string;
  riskDescription: string;
  context: string;
  testCost: string;
  remediationCost: string;
}

interface SolarResult {
  annualYieldKwh: number;
  yieldPerKwp: number;
  systemSizeKwp: number;
  monthlyBreakdown: Array<{ month: number; yieldKwh: number }>;
  financial: {
    systemCostEstimate: number;
    seaiGrant: number;
    netCost: number;
    annualSavings: number;
    paybackYears: number;
    lifetimeSavings25yr: number;
  };
  context: string;
}

interface WalkabilityResult {
  score: number;
  label: string;
  amenities: Array<{ category: string; count: number; nearest: number | null }>;
  summary: string;
  context: string;
}

interface DcbResult {
  riskLevel: string;
  isAffectedCounty: boolean;
  context: string;
  grantEligible: boolean;
  grantDetails: string | null;
  recommendation: string;
}

interface FloodZoneHit {
  source: string;
  returnPeriod: number;
  dataset: string;
  studyName: string | null;
}

interface FloodResult {
  riskCategory: string;
  inFloodZone: boolean;
  zones: FloodZoneHit[];
  summary: string;
  context: string;
  recommendation: string;
}

interface NoiseResult {
  hasData: boolean;
  ldenMax: number | null;
  lnightMax: number | null;
  category: string;
  exposures: Array<{ source: string; timeIndicator: string; dbRange: string; dbLow: number; sourceType: string }>;
  summary: string;
  context: string;
  whoGuidance: string;
}

interface AirQualityResult {
  station: { name: string; code: string; distanceKm: number };
  aqih: number | null;
  aqihLabel: string;
  avg24h: { pm25: number | null; pm10: number | null };
  summary: string;
  context: string;
  healthAdvice: string;
}

interface MicroclimateResult {
  station: { name: string; distanceKm: number; height: number };
  normals: { meanTemp: number; rainfall: number; sunHours: number | null; windSpeed: number | null; frostDays: number | null };
  summary: string;
  context: string;
  retrofitNote: string;
}

interface AnalyseResponse {
  comparable: ComparableResult;
  grants: GrantResult;
  yield?: YieldResult;
  radon?: RadonResult;
  solar?: SolarResult;
  walkability?: WalkabilityResult;
  dcb?: DcbResult;
  flood?: FloodResult;
  noise?: NoiseResult;
  airQuality?: AirQualityResult;
  microclimate?: MicroclimateResult;
  metadata: { elapsedMs: number; agentCalls: number; estimatedCost: number; from_cache: boolean };
}

export interface ReportInput {
  address: string;
  county: string;
  propertyType: string;
  purchasePrice: number;
  berRating?: string;
  yearBuilt?: string;
  bedrooms?: string;
  buyerType: string;
  intendedUse: string;
  location?: { lat: number; lng: number };
  result: AnalyseResponse;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(n: number | null | undefined): string {
  if (n == null) return '-';
  return '€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

function negEur(n: number | null | undefined): string {
  if (n == null) return '-';
  return '-€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function sanitizeNarrative(text: string | null | undefined): string | null {
  if (!text) return null;
  let s = text;
  s = s.replace(/wait\s*[-—]\s*recalculat(ing|e)[^.]*\./gi, '');
  s = s.replace(/the JSON figure should be treated as[^.]*\./gi, '');
  s = s.replace(/let me (recalculate|reconsider|correct)[^.]*\./gi, '');
  s = s.replace(/actually,?\s*(I need to|let me)[^.]*\./gi, '');
  s = s.replace(/−/g, '-');
  s = s.replace(/[‐-―]/g, '-');
  s = s.replace(/\s{2,}/g, ' ');
  return s.trim() || null;
}

function isRadonUnknown(radon: RadonResult | undefined): boolean {
  if (!radon) return true;
  return radon.riskCategory === 'unknown' || (radon.riskPercent === 0 && radon.riskCategory !== 'low');
}

function radonSummary(radon: RadonResult | undefined): string {
  if (!radon) return 'Radon: not assessed (coordinates required).';
  if (isRadonUnknown(radon)) return 'Radon: unknown — outside EPA mapped coverage. In-home testing recommended.';
  return `Radon: ${radon.riskCategory} risk (${radon.riskPercent}% of homes in area exceed reference level).`;
}

interface CanonicalCosts {
  stampDuty: number;
  legalFees: number;
  totalFees: number;
  conservativeCost: number;
  centralGrantEstimate: number;
  baseCost: number;
  grantTotalHigh: number;
  croiHigh: number;
  energyHigh: number;
  upsideCost: number;
  bestCost: number;
}

function computeCanonicalCosts(input: ReportInput, grantCats: GrantCategory[]): CanonicalCosts {
  const { purchasePrice, result } = input;
  const nac = result.grants.net_acquisition_cost;
  const stampDuty = nac.stamp_duty;
  const legalFees = nac.estimated_legal_fees;
  const totalFees = stampDuty + legalFees;
  const conservativeCost = purchasePrice + totalFees;

  const centralGrantEstimate = nac?.total_grants_central ?? 0;
  const baseCost = conservativeCost - centralGrantEstimate;

  const grantTotalHigh = grantCats.reduce((s, c) => s + c.totalHigh, 0);

  const croiSchemes = (result.grants.applicable_schemes ?? []).filter(
    (s) => s.code?.includes('CROI') || s.name?.toLowerCase().includes('vacant') || s.name?.toLowerCase().includes('derelict'),
  );
  const croiHigh = croiSchemes.reduce((s, g) => s + (g.amount_high ?? 0), 0);
  const energyHigh = grantCats.find((c) => c.label.includes('Energy'))?.totalHigh ?? 0;
  const upsideCost = Math.max(0, conservativeCost - centralGrantEstimate - croiHigh);
  const bestCost = Math.max(0, conservativeCost - energyHigh - croiHigh);

  return { stampDuty, legalFees, totalFees, conservativeCost, centralGrantEstimate, baseCost, grantTotalHigh, croiHigh, energyHigh, upsideCost, bestCost };
}

function propertyTypeLabel(t: string): string {
  if (!t || t === 'unknown') return 'Unknown';
  return t.replace(/_/g, '-').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buyerTypeLabel(t: string): string {
  const map: Record<string, string> = {
    first_time_buyer: 'First-Time Buyer',
    former_owner_occupier: 'Former Owner-Occupier',
    non_occupier: 'Investor / Non-Occupier',
  };
  return map[t] ?? t;
}

// ---------------------------------------------------------------------------
// Static map rendering (OSM tiles → canvas → base64 PNG)
// ---------------------------------------------------------------------------

async function renderStaticMap(
  lat: number,
  lng: number,
  width: number,
  height: number,
  zoom = 14,
): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const n = Math.pow(2, zoom);
    const xTileFloat = ((lng + 180) / 360) * n;
    const yTileFloat =
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;

    const centerTileX = Math.floor(xTileFloat);
    const centerTileY = Math.floor(yTileFloat);
    const offsetX = Math.round((xTileFloat - centerTileX) * 256);
    const offsetY = Math.round((yTileFloat - centerTileY) * 256);

    const tilesX = Math.ceil(width / 256) + 1;
    const tilesY = Math.ceil(height / 256) + 1;
    const startTileX = centerTileX - Math.floor(tilesX / 2);
    const startTileY = centerTileY - Math.floor(tilesY / 2);

    const loadTile = (tx: number, ty: number): Promise<HTMLImageElement | null> =>
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        const s = ['a', 'b', 'c'][Math.abs(tx + ty) % 3];
        img.src = `https://${s}.tile.openstreetmap.org/${zoom}/${((tx % n) + n) % n}/${ty}.png`;
      });

    const tiles: Array<{ img: HTMLImageElement | null; dx: number; dy: number }> = [];
    const promises: Promise<void>[] = [];

    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        const tileX = startTileX + tx;
        const tileY = startTileY + ty;
        const dx = width / 2 - offsetX + (tileX - centerTileX) * 256;
        const dy = height / 2 - offsetY + (tileY - centerTileY) * 256;
        const entry = { img: null as HTMLImageElement | null, dx, dy };
        tiles.push(entry);
        promises.push(loadTile(tileX, tileY).then((img) => { entry.img = img; }));
      }
    }

    await Promise.all(promises);

    for (const tile of tiles) {
      if (tile.img) ctx.drawImage(tile.img, tile.dx, tile.dy, 256, 256);
    }

    // Draw marker at center
    const cx = width / 2;
    const cy = height / 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#1D9E75';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // OSM attribution
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, height - 14, width, 14);
    ctx.fillStyle = '#666';
    ctx.font = '9px sans-serif';
    ctx.fillText('© OpenStreetMap contributors', 4, height - 4);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

const BRAND = { green: [29, 158, 117] as [number, number, number] };
const GREY = {
  dark: [51, 51, 51] as [number, number, number],
  mid: [102, 102, 102] as [number, number, number],
  light: [170, 170, 170] as [number, number, number],
};
const RED = [220, 38, 38] as [number, number, number];
const AMBER = [217, 119, 6] as [number, number, number];
const GREEN_DARK = [22, 163, 74] as [number, number, number];

function getLastTableY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

// ---------------------------------------------------------------------------
// Grant categorisation
// ---------------------------------------------------------------------------

interface GrantCategory {
  label: string;
  schemes: GrantScheme[];
  totalLow: number;
  totalHigh: number;
}

function categoriseGrants(schemes: GrantScheme[]): GrantCategory[] {
  const energy: GrantScheme[] = [];
  const vacancy: GrantScheme[] = [];
  const acquisition: GrantScheme[] = [];
  const adaptation: GrantScheme[] = [];
  const other: GrantScheme[] = [];

  for (const s of schemes) {
    const code = s.code?.toUpperCase() ?? '';
    const name = s.name?.toLowerCase() ?? '';
    if (code.startsWith('SEAI') || name.includes('insulation') || name.includes('heat pump') || name.includes('solar') || name.includes('window') || name.includes('door') || name.includes('heating') || name.includes('ber')) {
      energy.push(s);
    } else if (code.includes('CROI') || name.includes('vacant') || name.includes('derelict')) {
      vacancy.push(s);
    } else if (code.includes('HTB') || name.includes('help to buy') || code.includes('FHS') || name.includes('first home')) {
      acquisition.push(s);
    } else if (name.includes('adaptation') || name.includes('mobility') || name.includes('older') || name.includes('disability') || name.includes('housing aid')) {
      adaptation.push(s);
    } else {
      other.push(s);
    }
  }

  const cats: GrantCategory[] = [];
  const addCat = (label: string, list: GrantScheme[]) => {
    if (list.length === 0) return;
    cats.push({
      label,
      schemes: list,
      totalLow: list.reduce((s, g) => s + (g.amount_low ?? 0), 0),
      totalHigh: list.reduce((s, g) => s + (g.amount_high ?? 0), 0),
    });
  };
  addCat('Energy / SEAI Grants', energy);
  addCat('Vacant / Derelict Property Grants', vacancy);
  addCat('Acquisition Supports', acquisition);
  addCat('Adaptation Grants (means-tested)', adaptation);
  addCat('Other Schemes', other);
  return cats;
}

// ---------------------------------------------------------------------------
// Data completeness
// ---------------------------------------------------------------------------

interface DataField { field: string; status: 'provided' | 'missing'; impact: string }

function assessCompleteness(input: ReportInput): { score: number; fields: DataField[] } {
  const fields: DataField[] = [
    { field: 'Address', status: input.address ? 'provided' : 'missing', impact: 'Affects geocoding and comparable accuracy' },
    { field: 'County', status: input.county ? 'provided' : 'missing', impact: 'Required for all analysis' },
    { field: 'Purchase price', status: input.purchasePrice > 0 ? 'provided' : 'missing', impact: 'Required for valuation and yield' },
    { field: 'Property type', status: input.propertyType && input.propertyType !== 'unknown' ? 'provided' : 'missing', impact: 'Affects SEAI grant values and valuation confidence' },
    { field: 'Bedrooms', status: input.bedrooms ? 'provided' : 'missing', impact: 'Critical for valuation precision and rental yield estimate' },
    { field: 'BER rating', status: input.berRating ? 'provided' : 'missing', impact: 'Affects retrofit and SEAI grant estimates' },
    { field: 'Year built', status: input.yearBuilt ? 'provided' : 'missing', impact: 'Affects SEAI eligibility and structural risk assessment' },
    { field: 'Coordinates', status: input.result.radon || input.result.solar || input.result.walkability ? 'provided' : 'missing', impact: 'Required for radon, solar, walkability' },
    { field: 'Comparable distance', status: input.result.comparable.comparables_used?.some((c) => c.distance_meters != null) ? 'provided' : 'missing', impact: 'Affects valuation confidence' },
  ];
  const provided = fields.filter((f) => f.status === 'provided').length;
  return { score: Math.round((provided / fields.length) * 100), fields };
}

// ---------------------------------------------------------------------------
// Scorecard
// ---------------------------------------------------------------------------

interface ScoreItem { dimension: string; score: number; note: string }

function computeScorecard(input: ReportInput): ScoreItem[] {
  const { result, purchasePrice } = input;
  const items: ScoreItem[] = [];

  // Value for money
  if (result.comparable.estimated_value) {
    const ratio = purchasePrice / result.comparable.estimated_value;
    const vfm = Math.max(0, Math.min(100, Math.round((1 - (ratio - 1)) * 75)));
    items.push({ dimension: 'Value for money', score: vfm, note: ratio <= 1 ? 'At or below market value' : `${Math.round((ratio - 1) * 100)}% above market value` });
  }

  // Comparable confidence
  const confMap: Record<string, number> = { high: 85, medium: 55, low: 25 };
  const comps = result.comparable.comparables_used ?? [];
  const distVerified = comps.filter((c) => c.distance_meters != null).length;
  const confNote = distVerified > 0
    ? `${comps.length} identified, ${distVerified} distance-verified, ${result.comparable.confidence} confidence`
    : `${comps.length} identified, none distance-verified, ${result.comparable.confidence} confidence`;
  items.push({ dimension: 'Comparable confidence', score: confMap[result.comparable.confidence] ?? 40, note: confNote });

  // Grant upside — use computed total from categorised grants for consistency
  const grantCats = categoriseGrants(result.grants.applicable_schemes ?? []);
  const grantTotalHigh = grantCats.reduce((s, c) => s + c.totalHigh, 0);
  const grantPct = purchasePrice > 0 ? (grantTotalHigh / purchasePrice) * 100 : 0;
  items.push({ dimension: 'Grant upside', score: Math.min(100, Math.round(grantPct * 5)), note: `Up to ${eur(grantTotalHigh)} (${Math.round(grantPct)}% of price)` });

  // Location
  if (result.walkability) {
    items.push({ dimension: 'Location convenience', score: result.walkability.score, note: result.walkability.label });
  }

  // Environmental risk (inverted — higher = safer)
  let envScore = 80;
  const radonIsUnknown = isRadonUnknown(result.radon);
  if (result.radon?.riskCategory === 'high') envScore -= 30;
  else if (result.radon?.riskCategory === 'medium') envScore -= 15;
  else if (radonIsUnknown) envScore -= 10;
  if (result.dcb?.riskLevel === 'high') envScore -= 30;
  else if (result.dcb?.riskLevel === 'medium') envScore -= 15;
  if (result.flood?.riskCategory === 'high') envScore -= 30;
  else if (result.flood?.riskCategory === 'medium') envScore -= 15;
  else if (!result.flood) envScore -= 10;

  const envParts: string[] = [];
  if (radonIsUnknown) envParts.push('radon unknown');
  else if (result.radon?.riskCategory === 'high') envParts.push('radon high');
  else if (result.radon?.riskCategory === 'medium') envParts.push('radon medium');
  if (result.flood?.inFloodZone) envParts.push(`flood ${result.flood.riskCategory}`);
  else if (!result.flood) envParts.push('flood not assessed');
  if (result.dcb?.riskLevel === 'high' || result.dcb?.riskLevel === 'medium') envParts.push(`DCB ${result.dcb.riskLevel}`);
  const allClear = envParts.length === 0;
  const envNote = allClear ? 'Low risk profile — all checks passed' :
    envScore >= 60 ? `Partial assessment — ${envParts.join(', ')}` : `Elevated risk — ${envParts.join(', ')}`;
  items.push({ dimension: 'Environmental safety', score: Math.max(0, envScore), note: envNote });

  // Retrofit opportunity
  if (result.solar) {
    const roiScore = Math.min(100, Math.round((result.solar.financial.lifetimeSavings25yr / result.solar.financial.netCost) * 30));
    items.push({ dimension: 'Retrofit opportunity', score: roiScore, note: `${result.solar.financial.paybackYears}yr solar payback` });
  }

  // Data completeness
  const { score: dataScore } = assessCompleteness(input);
  items.push({ dimension: 'Data completeness', score: dataScore, note: `${dataScore}% of fields provided` });

  return items;
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

export async function generateReport(input: ReportInput): Promise<void> {
  const { result, address, county, propertyType, purchasePrice, berRating, yearBuilt, buyerType, intendedUse, location } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 18;
  const CONTENT_W = W - MARGIN * 2;
  let y = 0;

  function checkPage(need: number) {
    if (y + need > 270) { doc.addPage(); y = 20; }
  }

  function heading(text: string, num?: number) {
    checkPage(14);
    y += 3;
    doc.setDrawColor(...BRAND.green);
    doc.setLineWidth(0.6);
    doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
    y += 7;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY.dark);
    doc.text(num ? `${num}. ${text}` : text, MARGIN, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
  }

  function subheading(text: string) {
    checkPage(10);
    y += 2;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY.mid);
    doc.text(text, MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  }

  function body(text: string | null | undefined) {
    if (!text) return;
    checkPage(10);
    doc.setFontSize(9);
    doc.setTextColor(...GREY.mid);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    for (const line of lines) { checkPage(5); doc.text(line, MARGIN, y); y += 4; }
    y += 2;
  }

  function keyValue(label: string, value: string, valueColor?: [number, number, number]) {
    checkPage(6);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREY.light);
    doc.text(label, MARGIN, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(valueColor ?? GREY.dark));
    doc.text(value, MARGIN + 55, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
  }

  function bulletList(points: string[]) {
    for (const point of points) {
      checkPage(6);
      doc.setFontSize(9);
      doc.setTextColor(...GREY.dark);
      const lines = doc.splitTextToSize(point, CONTENT_W - 6);
      doc.text('•', MARGIN, y);
      for (const line of lines) { checkPage(5); doc.text(line, MARGIN + 5, y); y += 4.5; }
      y += 1;
    }
    y += 2;
  }

  // =========================================================================
  // Cover
  // =========================================================================

  doc.setFillColor(...BRAND.green);
  doc.rect(0, 0, W, 52, 'F');
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('Property Due Diligence Report', MARGIN, 22);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(address || `${county}, Ireland`, MARGIN, 32);
  doc.setFontSize(8);
  doc.text(`Generated ${formatDate()} by ProperData`, MARGIN, 42);
  doc.text('properdata.ie', W - MARGIN - doc.getTextWidth('properdata.ie'), 42);
  y = 60;

  // Property summary box
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(MARGIN, y, CONTENT_W, 28, 2, 2, 'F');
  y += 7;
  doc.setFontSize(8);
  const cols = [
    ['Property', propertyTypeLabel(propertyType)],
    ['County', county],
    ['Price', eur(purchasePrice)],
    ['BER', berRating || '-'],
    ['Built', yearBuilt || '-'],
    ['Buyer', buyerTypeLabel(buyerType)],
    ['Use', intendedUse.replace(/_/g, ' ')],
  ];
  const colW = CONTENT_W / cols.length;
  for (let i = 0; i < cols.length; i++) {
    const cx = MARGIN + i * colW + colW / 2;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREY.light);
    doc.text(cols[i]![0]!, cx, y, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREY.dark);
    doc.text(cols[i]![1]!, cx, y + 6, { align: 'center' });
  }
  y += 20;

  // Preliminary report warning when key fields are missing
  const missingKey = !propertyType || propertyType === 'unknown' || !berRating || !yearBuilt || !input.bedrooms;
  if (missingKey) {
    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(217, 119, 6);
    doc.roundedRect(MARGIN, y, CONTENT_W, 14, 2, 2, 'FD');
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(146, 64, 14);
    doc.text('PRELIMINARY REPORT', MARGIN + 3, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('Key property attributes are unconfirmed. Valuation, grant and retrofit estimates are low-confidence until property type, bedrooms, BER and year built are verified.', MARGIN + 3, y, { maxWidth: CONTENT_W - 6 });
    y += 10;
  }

  // Location map
  if (location) {
    const mapImg = await renderStaticMap(location.lat, location.lng, 600, 200, 14);
    if (mapImg) {
      const mapH = 40;
      checkPage(mapH + 4);
      doc.addImage(mapImg, 'PNG', MARGIN, y, CONTENT_W, mapH);
      y += mapH + 4;
    }
  }

  // =========================================================================
  // 1. Executive Summary
  // =========================================================================

  heading('Executive Summary', 1);

  const grantCats = categoriseGrants(result.grants.applicable_schemes ?? []);
  const costs = computeCanonicalCosts(input, grantCats);
  const hasVacantGrant = (result.grants.applicable_schemes ?? []).some((s) => s.code?.includes('CROI') || s.name?.toLowerCase().includes('vacant'));

  const askVsEstimate = result.comparable.estimated_value
    ? ((purchasePrice - result.comparable.estimated_value) / result.comparable.estimated_value) * 100
    : null;

  const summaryPoints: string[] = [];

  // Valuation
  const compsUsed = result.comparable.comparables_used ?? [];
  const distVerifiedCount = compsUsed.filter((c) => c.distance_meters != null).length;
  const isLowConf = result.comparable.confidence === 'low';
  let valNote = isLowConf
    ? `Indicative model estimate: ${eur(result.comparable.estimated_value)}, based on limited comparable data.`
    : `Market value estimate: ${eur(result.comparable.estimated_value)}.`;
  if (askVsEstimate != null) {
    const dir = askVsEstimate >= 0 ? 'above' : 'below';
    valNote += isLowConf
      ? ` The target price is ${Math.abs(Math.round(askVsEstimate))}% ${dir} this estimate, but confidence is low.`
      : ` Purchase price is ${Math.abs(Math.round(askVsEstimate))}% ${dir} estimate.`;
  }
  valNote += ` Confidence: ${result.comparable.confidence} (${compsUsed.length} comparables identified${distVerifiedCount > 0 ? `, ${distVerifiedCount} distance-verified` : ', none distance-verified'}).`;
  summaryPoints.push(valNote);

  // Grants
  if (grantCats.length > 0) {
    const parts = grantCats.map((c) => `${c.label}: up to ${eur(c.totalHigh)}`);
    summaryPoints.push(`Grant opportunity: ${parts.join('; ')}. Total identified: up to ${eur(costs.grantTotalHigh)}.`);
  }

  // Effective cost — canonical calculation
  summaryPoints.push(`Base effective acquisition cost: ${eur(costs.baseCost)} (${eur(purchasePrice)} + ${eur(costs.stampDuty)} stamp duty + ${eur(costs.legalFees)} legal fees - ${eur(costs.centralGrantEstimate)} central grant estimate).`);
  if (costs.croiHigh > 0) {
    summaryPoints.push(`Additional upside: Croi Conaithe may provide up to ${eur(costs.croiHigh)} if vacancy or dereliction criteria are met; not included in base scenario.`);
  }

  // Yield
  if (result.yield) {
    summaryPoints.push(`Rental yield: ${result.yield.yields.gross_yield_annual}% gross, ${result.yield.yields.net_yield_annual}% net, ${result.yield.yields.tax_adjusted_yield}% after tax (RTB data).`);
  }

  // Radon — handle unknown properly
  summaryPoints.push(radonSummary(result.radon));

  // Flood
  if (result.flood) {
    if (result.flood.inFloodZone) {
      const zoneTypes = [...new Set(result.flood.zones.map((z) => z.source))].join('/');
      summaryPoints.push(`Flood risk: ${result.flood.riskCategory} — property is within ${zoneTypes} flood zone(s). ${result.flood.recommendation}`);
    } else {
      summaryPoints.push('Flood risk: no mapped OPW flood-zone intersection identified. This does not rule out local drainage, groundwater, or unmapped surface-water risk.');
    }
  } else {
    summaryPoints.push('Flood risk: not assessed (coordinates required). Verify on OPW flood maps before purchase.');
  }

  // Solar
  if (result.solar) {
    summaryPoints.push(`Solar: ${result.solar.annualYieldKwh.toLocaleString()} kWh/yr, ${result.solar.financial.paybackYears}-year payback after SEAI grant.`);
  }
  // Walkability
  if (result.walkability) {
    summaryPoints.push(`Walkability: ${result.walkability.score}/100 (${result.walkability.label}).`);
  }
  // DCB
  if (result.dcb && result.dcb.riskLevel !== 'none') {
    summaryPoints.push(`Defective blocks: ${result.dcb.riskLevel} risk.${result.dcb.grantEligible ? ' May qualify for remediation grant.' : ''}`);
  }
  // Noise
  if (result.noise?.hasData) {
    summaryPoints.push(`Noise: ${result.noise.category} (${result.noise.ldenMax ? `${result.noise.ldenMax}+ dB Lden` : 'below threshold'}).`);
  }
  // Air quality
  if (result.airQuality) {
    summaryPoints.push(`Air quality: AQIH ${result.airQuality.aqih ?? 'N/A'} (${result.airQuality.aqihLabel}) at ${result.airQuality.station.name}.`);
  }
  // Microclimate
  if (result.microclimate) {
    summaryPoints.push(`Climate: ${result.microclimate.normals.meanTemp}°C avg, ${result.microclimate.normals.rainfall}mm rain, ${result.microclimate.normals.sunHours ?? '?'} sun hrs/yr.`);
  }

  bulletList(summaryPoints);

  // =========================================================================
  // 2. Recommended Next Actions
  // =========================================================================

  heading('Recommended Next Actions', 2);

  const actions: string[] = [];
  if (!propertyType || propertyType === 'unknown') actions.push('Confirm property type, bedrooms, and floor area to improve valuation accuracy and grant estimates.');
  if (!input.bedrooms) actions.push('Confirm number of bedrooms — critical for valuation precision and rental yield estimates.');
  if (!berRating) actions.push('Obtain BER certificate to establish retrofit baseline and determine SEAI grant eligibility.');
  if (!yearBuilt) actions.push('Confirm year built to assess SEAI eligibility and structural risk factors.');

  if (hasVacantGrant) actions.push('Verify vacancy status (2+ years) for Croi Conaithe eligibility — this could materially change the economics.');

  actions.push('Instruct an independent survey and solicitor title check.');
  if (result.flood?.inFloodZone) {
    actions.push(`Obtain site-specific flood risk assessment — property is in a ${result.flood.riskCategory}-risk flood zone.`);
  } else if (!result.flood) {
    actions.push('Verify flood risk on OPW flood maps (floodinfo.ie) — automated check requires coordinates.');
  }

  if (result.radon?.riskCategory === 'high') {
    actions.push(`Commission radon test before purchase (${result.radon.testCost}).`);
  } else if (isRadonUnknown(result.radon)) {
    actions.push('Commission radon test — property is outside EPA mapped coverage, so risk is unknown.');
  }
  if (result.grants.applicable_schemes?.length) actions.push('Review grant eligibility in Section 6 and begin applications for confirmed schemes.');
  if (result.solar) actions.push('Get a site-specific solar assessment to confirm roof orientation and shading.');

  bulletList(actions);

  // =========================================================================
  // 3. Scorecard
  // =========================================================================

  heading('Scorecard', 3);

  const scores = computeScorecard(input);
  const overall = Math.round(scores.reduce((s, i) => s + i.score, 0) / scores.length);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Dimension', 'Score', 'Notes']],
    body: [
      ...scores.map((s) => [s.dimension, `${s.score}/100`, s.note]),
      [{ content: 'Overall', styles: { fontStyle: 'bold' as const } }, { content: `${overall}/100`, styles: { fontStyle: 'bold' as const } }, ''],
    ],
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 18, halign: 'center' } },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const raw = String(data.cell.raw);
        const num = parseInt(raw);
        if (num >= 70) data.cell.styles.textColor = GREEN_DARK;
        else if (num >= 45) data.cell.styles.textColor = AMBER;
        else data.cell.styles.textColor = RED;
      }
    },
  });
  y = getLastTableY(doc) + 5;

  // Data completeness
  const { score: dataScore, fields: dataFields } = assessCompleteness(input);
  subheading(`Data Completeness: ${dataScore}%`);
  const missingFields = dataFields.filter((f) => f.status === 'missing');
  if (missingFields.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Missing Field', 'Impact']],
      body: missingFields.map((f) => [f.field, f.impact]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: AMBER, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [255, 251, 235] },
      columnStyles: { 0: { cellWidth: 35, fontStyle: 'bold' } },
    });
    y = getLastTableY(doc) + 5;
  }

  // =========================================================================
  // 4. Market Value Estimate
  // =========================================================================

  heading(isLowConf ? 'Indicative Value Estimate' : 'Market Value Estimate', 4);

  keyValue(isLowConf ? 'Indicative estimate' : 'Estimated value', eur(result.comparable.estimated_value), BRAND.green);
  keyValue('Confidence', result.comparable.confidence,
    result.comparable.confidence === 'high' ? GREEN_DARK : result.comparable.confidence === 'medium' ? AMBER : RED);

  if (askVsEstimate != null) {
    const dir = askVsEstimate >= 0 ? 'above' : 'below';
    keyValue('Price vs estimate', `${Math.abs(Math.round(askVsEstimate))}% ${dir}`,
      askVsEstimate > 10 ? AMBER : askVsEstimate < -10 ? GREEN_DARK : GREY.dark);
  }

  if (isLowConf) {
    body('This estimate is based on limited comparable data. Property type, bedrooms, floor area, condition and BER are unknown or unverified. Treat as indicative until these fields are confirmed.');
  }
  y += 2;
  body(sanitizeNarrative(result.comparable.narrative));

  // =========================================================================
  // 5. Comparable Sales
  // =========================================================================

  heading('Comparable Sales', 5);

  if (result.comparable.comparables_used?.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Address', 'Date', 'Price', 'Dist.', 'Weight', 'Rationale']],
      body: result.comparable.comparables_used.map((c) => [
        c.address,
        c.sale_date,
        eur(c.price),
        c.distance_meters != null ? `${c.distance_meters.toLocaleString()}m` : '-',
        c.weight,
        c.rationale || '-',
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 42 },
        2: { fontStyle: 'bold' },
        5: { cellWidth: 40, fontStyle: 'italic' as const },
      },
    });
    y = getLastTableY(doc) + 5;
  } else {
    body('No comparable sales data available.');
  }

  // =========================================================================
  // 6. Grant Opportunity
  // =========================================================================

  heading('Grant Opportunity', 6);

  // Category summary
  if (grantCats.length > 0) {
    subheading('Grant Summary by Category');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Category', 'Schemes', 'Range']],
      body: grantCats.map((c) => [c.label, String(c.schemes.length), c.totalLow === c.totalHigh ? eur(c.totalHigh) : `${eur(c.totalLow)} - ${eur(c.totalHigh)}`]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { cellWidth: 18, halign: 'center' }, 2: { cellWidth: 35 } },
    });
    y = getLastTableY(doc) + 4;

    body('Note: Some grants are mutually exclusive (e.g. Help to Buy cannot be combined with Croi Conaithe). The total does not assume all schemes can be stacked. See individual scheme notes below.');
  }

  // Full scheme table
  if (result.grants.applicable_schemes?.length > 0) {
    subheading('All Identified Schemes');
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Scheme', 'Amount', 'Status', 'Notes']],
      body: result.grants.applicable_schemes.map((s) => [
        s.name,
        s.amount_low === s.amount_high ? eur(s.amount_low) : `${eur(s.amount_low)} - ${eur(s.amount_high)}`,
        s.eligibility_status,
        s.rationale,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold' }, 1: { cellWidth: 26 }, 2: { cellWidth: 18 } },
    });
    y = getLastTableY(doc) + 5;
  }

  body(sanitizeNarrative(result.grants.narrative));

  // =========================================================================
  // 7. Effective Cost Scenarios
  // =========================================================================

  heading('Effective Cost Scenarios', 7);

  {
    // Calculation audit block
    subheading('Base Calculation');
    keyValue('Purchase price', eur(purchasePrice));
    keyValue('Stamp duty', eur(costs.stampDuty));
    keyValue('Estimated legal fees', eur(costs.legalFees));
    keyValue('Central grant estimate', negEur(costs.centralGrantEstimate), GREEN_DARK);
    y += 1;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN + 55, y - 1, MARGIN + 100, y - 1);
    keyValue('Base effective cost', eur(costs.baseCost), BRAND.green);
    y += 3;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Scenario', 'Assumption', 'Effective Cost']],
      body: [
        ['Conservative', 'No grants confirmed', eur(costs.conservativeCost)],
        ['Base', `Central grant estimate (${eur(costs.centralGrantEstimate)}) applied`, eur(costs.baseCost)],
        ...(costs.croiHigh > 0 ? [['Upside', `Base + Croi Conaithe confirmed (${eur(costs.croiHigh)})`, eur(costs.upsideCost)]] : []),
        ...(costs.croiHigh > 0 && costs.energyHigh > 0 ? [['Best case', `Full SEAI (${eur(costs.energyHigh)}) + Croi Conaithe — verify eligibility`, eur(costs.bestCost)]] : []),
      ],
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 2: { cellWidth: 28, fontStyle: 'bold' } },
    });
    y = getLastTableY(doc) + 4;

    const scenarioNotes = [
      'Conservative scenario includes purchase price, stamp duty, and legal fees only.',
      'Base scenario applies the central SEAI energy grant estimate.',
      costs.croiHigh > 0 ? 'Upside scenario should only be used if vacancy criteria are confirmed with the local authority.' : null,
      'Eligibility must be confirmed by the relevant scheme administrator. Some schemes are mutually exclusive.',
    ].filter(Boolean) as string[];
    bulletList(scenarioNotes);

    if (result.yield) {
      subheading('Investor Scenario');
      keyValue('Monthly rent (RTB)', eur(result.yield.property.estimated_rent_monthly));
      keyValue('Gross yield', `${result.yield.yields.gross_yield_annual}%`);
      keyValue('Net yield', `${result.yield.yields.net_yield_annual}%`, BRAND.green);
      keyValue('After-tax yield', `${result.yield.yields.tax_adjusted_yield}%`);
      keyValue('Rent source', result.yield.property.rent_data_source);
      y += 2;
      body(sanitizeNarrative(result.yield.narrative));
    }
  }

  // =========================================================================
  // 8. Solar & Retrofit Estimate
  // =========================================================================

  heading('Solar & Retrofit Estimate', 8);

  if (result.solar) {
    keyValue('Annual generation', `${result.solar.annualYieldKwh.toLocaleString()} kWh`);
    keyValue('System size', `${result.solar.systemSizeKwp} kWp`);
    keyValue('Yield per kWp', `${result.solar.yieldPerKwp} kWh/kWp`);
    y += 2;
    keyValue('System cost (est.)', eur(result.solar.financial.systemCostEstimate));
    keyValue('SEAI grant', negEur(result.solar.financial.seaiGrant), GREEN_DARK);
    keyValue('Net cost', eur(result.solar.financial.netCost));
    keyValue('Annual savings', eur(result.solar.financial.annualSavings), GREEN_DARK);
    keyValue('Payback period', `${result.solar.financial.paybackYears} years`);
    keyValue('25-year savings', eur(result.solar.financial.lifetimeSavings25yr), GREEN_DARK);
    y += 2;

    if (result.solar.monthlyBreakdown.length > 0) {
      subheading('Monthly Generation Profile (kWh)');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [months],
        body: [result.solar.monthlyBreakdown.map((m) => String(m.yieldKwh))],
        styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [251, 191, 36], textColor: GREY.dark, fontStyle: 'bold' },
      });
      y = getLastTableY(doc) + 5;
    }
    body(result.solar.context);
  } else {
    body('Solar estimate not available. Coordinates are required for the PVGIS satellite lookup.');
  }

  // =========================================================================
  // 9. Walkability & Amenities
  // =========================================================================

  heading('Walkability & Amenities', 9);

  if (result.walkability) {
    keyValue('Score', `${result.walkability.score}/100`,
      result.walkability.score >= 70 ? GREEN_DARK : result.walkability.score >= 50 ? AMBER : RED);
    keyValue('Classification', result.walkability.label);
    y += 2;
    body(result.walkability.summary);

    const amenities = result.walkability.amenities.filter((a) => a.count > 0);
    if (amenities.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Category', 'Count', 'Nearest']],
        body: amenities.map((a) => [a.category, String(a.count), a.nearest ? `${a.nearest}m` : '-']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });
      y = getLastTableY(doc) + 5;
    }
    body(result.walkability.context);
  } else {
    body('Walkability data not available. Coordinates are required for the Overpass API lookup.');
  }

  // =========================================================================
  // 10. Environmental Risks
  // =========================================================================

  heading('Environmental Risks', 10);

  if (result.radon) {
    subheading('Radon');
    if (isRadonUnknown(result.radon)) {
      keyValue('Risk level', 'UNKNOWN', AMBER);
      keyValue('Coverage', 'Outside EPA radon risk mapping coverage');
      keyValue('Test cost', result.radon.testCost);
      keyValue('Recommendation', 'In-home radon test recommended before purchase');
      y += 1;
      body('This property is outside the EPA national radon survey mapped area. The 0% prevalence figure is a data gap, not a confirmed low-risk reading. An in-home radon test is the only way to determine actual risk.');
    } else {
      keyValue('Risk level', result.radon.riskCategory.toUpperCase(),
        result.radon.riskCategory === 'high' ? RED : result.radon.riskCategory === 'medium' ? AMBER : GREEN_DARK);
      keyValue('Area prevalence', `${result.radon.riskPercent}% above reference level`);
      keyValue('Test cost', result.radon.testCost);
      keyValue('Remediation cost', result.radon.remediationCost);
      y += 1;
      body(result.radon.riskDescription);
      body(result.radon.context);
    }
  }

  if (result.dcb) {
    subheading('Defective Concrete Blocks (Mica/Pyrite)');
    keyValue('Risk level', result.dcb.riskLevel.toUpperCase(),
      result.dcb.riskLevel === 'high' ? RED : result.dcb.riskLevel === 'medium' ? AMBER : GREEN_DARK);
    keyValue('Affected county', result.dcb.isAffectedCounty ? 'Yes' : 'No');
    if (result.dcb.grantEligible) {
      keyValue('Grant eligible', 'Yes', GREEN_DARK);
      if (result.dcb.grantDetails) body(result.dcb.grantDetails);
    }
    body(result.dcb.context);
    body(result.dcb.recommendation);
  }

  subheading('Flood Risk');
  if (result.flood) {
    keyValue('Risk category', result.flood.riskCategory.toUpperCase(),
      result.flood.riskCategory === 'high' ? RED : result.flood.riskCategory === 'medium' ? AMBER : GREEN_DARK);
    keyValue('In flood zone', result.flood.inFloodZone ? 'Yes' : 'No',
      result.flood.inFloodZone ? RED : GREEN_DARK);
    if (result.flood.zones.length > 0) {
      for (const z of result.flood.zones) {
        keyValue(`${z.source} (${z.dataset.toUpperCase()})`, `1-in-${z.returnPeriod} year`);
      }
    }
    y += 1;
    body(result.flood.summary);
    body(result.flood.context);
    if (result.flood.inFloodZone) {
      body(result.flood.recommendation);
    }
  } else {
    body('Flood risk has not been assessed in this report. Coordinates are required for the OPW flood map lookup. Check floodinfo.ie before purchase.');
  }

  if (result.noise) {
    subheading('Noise Exposure');
    keyValue('Category', result.noise.category.toUpperCase(),
      result.noise.category === 'high' ? RED : result.noise.category === 'moderate' ? AMBER : GREEN_DARK);
    if (result.noise.ldenMax != null) keyValue('Lden (day-evening-night)', `${result.noise.ldenMax}+ dB`);
    if (result.noise.lnightMax != null) keyValue('Lnight (night)', `${result.noise.lnightMax}+ dB`);
    if (result.noise.exposures.length > 0) {
      const sources = [...new Set(result.noise.exposures.map((e) => e.sourceType))];
      keyValue('Sources', sources.join(', '));
    }
    y += 1;
    body(result.noise.summary);
    body(result.noise.whoGuidance);
  }

  if (result.airQuality) {
    subheading('Air Quality');
    if (result.airQuality.aqih != null) {
      keyValue('AQIH', `${result.airQuality.aqih} (${result.airQuality.aqihLabel})`,
        result.airQuality.aqih <= 3 ? GREEN_DARK : result.airQuality.aqih <= 6 ? AMBER : RED);
    }
    keyValue('Nearest station', `${result.airQuality.station.name} (${result.airQuality.station.distanceKm}km)`);
    if (result.airQuality.avg24h.pm25 != null) keyValue('PM2.5 (24h avg)', `${result.airQuality.avg24h.pm25} µg/m³`);
    if (result.airQuality.avg24h.pm10 != null) keyValue('PM10 (24h avg)', `${result.airQuality.avg24h.pm10} µg/m³`);
    y += 1;
    body(result.airQuality.summary);
  }

  if (result.microclimate) {
    subheading('Microclimate');
    keyValue('Station', `${result.microclimate.station.name} (${result.microclimate.station.distanceKm}km, ${result.microclimate.station.height}m elevation)`);
    keyValue('Mean temperature', `${result.microclimate.normals.meanTemp}°C`);
    keyValue('Annual rainfall', `${result.microclimate.normals.rainfall}mm`);
    if (result.microclimate.normals.sunHours != null) keyValue('Sun hours/year', `${result.microclimate.normals.sunHours}`);
    if (result.microclimate.normals.windSpeed != null) keyValue('Wind speed', `${result.microclimate.normals.windSpeed} km/h`);
    if (result.microclimate.normals.frostDays != null) keyValue('Frost days/year', `~${result.microclimate.normals.frostDays}`);
    y += 1;
    body(result.microclimate.retrofitNote);
  }

  if (!result.radon && !result.dcb) {
    body('Limited environmental risk data available. Provide coordinates to enable radon and location-specific checks.');
  }

  // =========================================================================
  // 11. Red Flags
  // =========================================================================

  heading('Red Flags', 11);

  const flags: Array<{ flag: string; severity: string; detail: string }> = [];

  // Valuation flags
  if (result.comparable.confidence === 'low') {
    const localCount = compsUsed.filter((c) => c.weight === 'high').length;
    flags.push({ flag: 'Low valuation confidence', severity: 'HIGH', detail: `${compsUsed.length} comparables identified, ${localCount > 0 ? `${localCount} genuine local references` : 'none are strong local matches'}, ${distVerifiedCount > 0 ? `${distVerifiedCount} distance-verified` : 'none distance-verified'}. Independent valuation recommended.` });
  }
  if (askVsEstimate != null && askVsEstimate > 10) {
    flags.push({ flag: 'Price above market value', severity: 'MEDIUM', detail: `Price is ${Math.round(askVsEstimate)}% above estimated market value. Consider condition, spec, or market timing.` });
  }
  if (askVsEstimate != null && askVsEstimate < -20) {
    flags.push({ flag: 'Price well below market value', severity: 'MEDIUM', detail: `Price is ${Math.abs(Math.round(askVsEstimate))}% below market value. Investigate condition, title, or vacancy.` });
  }

  // Environmental flags
  if (result.flood?.inFloodZone) {
    const zoneTypes = [...new Set(result.flood.zones.map((z) => z.source))].join('/');
    flags.push({ flag: `In ${zoneTypes} flood zone`, severity: result.flood.riskCategory === 'high' ? 'HIGH' : 'MEDIUM', detail: result.flood.recommendation });
  } else if (!result.flood) {
    flags.push({ flag: 'Flood risk not assessed', severity: 'MEDIUM', detail: 'OPW flood-map verification required before purchase. Coordinates needed for automated check.' });
  }
  if (isRadonUnknown(result.radon)) {
    flags.push({ flag: 'Radon mapping unavailable', severity: 'MEDIUM', detail: 'Outside EPA mapped coverage. In-home radon test recommended — unknown should not be treated as low risk.' });
  } else if (result.radon?.riskCategory === 'high') {
    flags.push({ flag: 'High radon risk area', severity: 'MEDIUM', detail: `${result.radon.riskPercent}% of homes exceed reference level. Commission radon test (${result.radon.testCost}).` });
  }
  if (result.dcb && (result.dcb.riskLevel === 'high' || result.dcb.riskLevel === 'medium')) {
    flags.push({ flag: 'Defective block risk', severity: result.dcb.riskLevel === 'high' ? 'HIGH' : 'MEDIUM', detail: result.dcb.recommendation });
  }
  if (result.noise?.category === 'high') {
    flags.push({ flag: 'High noise exposure', severity: 'MEDIUM', detail: `${result.noise.ldenMax ?? ''}+ dB Lden from ${[...new Set(result.noise.exposures.map((e) => e.sourceType))].join(', ')}. ${result.noise.whoGuidance}` });
  }
  if (result.airQuality && result.airQuality.aqih != null && result.airQuality.aqih >= 7) {
    flags.push({ flag: 'Poor air quality area', severity: 'MEDIUM', detail: `AQIH ${result.airQuality.aqih} (${result.airQuality.aqihLabel}) at ${result.airQuality.station.name}. ${result.airQuality.healthAdvice}` });
  }

  // Yield flags
  if (result.yield && result.yield.yields.net_yield_annual < 2) {
    flags.push({ flag: 'Sub-2% net yield', severity: 'MEDIUM', detail: 'Net yield below 2%. May generate minimal or negative cash flow after tax.' });
  }

  // Grant flags
  if (hasVacantGrant) {
    flags.push({ flag: 'Croi Conaithe eligibility unknown', severity: 'MEDIUM', detail: 'Vacancy/dereliction status could materially change effective cost. Confirm 2+ years vacancy before relying on grant economics.' });
  }

  // Missing data flags
  if (!propertyType || propertyType === 'unknown') {
    flags.push({ flag: 'Property type unknown', severity: 'MEDIUM', detail: 'Affects SEAI grant values, valuation confidence, and comparable selection. Confirm property type.' });
  }
  if (!input.bedrooms) {
    flags.push({ flag: 'Bedrooms unknown', severity: 'HIGH', detail: 'Critical for valuation precision and rental yield estimates. Confirm bedroom count.' });
  }
  if (!berRating) {
    flags.push({ flag: 'BER unknown', severity: 'MEDIUM', detail: 'Retrofit and grant assumptions depend on BER and build year. Obtain BER certificate.' });
  }
  if (!yearBuilt) {
    flags.push({ flag: 'Year built unknown', severity: 'MEDIUM', detail: 'Impacts SEAI eligibility (pre-2021 requirement) and structural risk assessment.' });
  }
  if (!result.comparable.comparables_used?.some((c) => c.distance_meters != null)) {
    flags.push({ flag: 'Comparable distances unavailable', severity: 'LOW', detail: 'Spatial proximity to comparables could not be verified. Valuation relies on address matching.' });
  }
  if (!result.radon && !result.solar && !result.walkability) {
    flags.push({ flag: 'No location enrichments', severity: 'LOW', detail: 'Coordinates not available. Radon, solar, and walkability checks were skipped.' });
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Flag', 'Severity', 'Detail']],
    body: flags.map((f) => [f.flag, f.severity, f.detail]),
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [254, 242, 242] },
    columnStyles: { 0: { cellWidth: 38, fontStyle: 'bold' }, 1: { cellWidth: 16, halign: 'center' } },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        const val = data.cell.raw as string;
        if (val === 'HIGH') data.cell.styles.textColor = RED;
        else if (val === 'MEDIUM') data.cell.styles.textColor = AMBER;
        else data.cell.styles.textColor = GREEN_DARK;
      }
    },
  });
  y = getLastTableY(doc) + 5;

  // =========================================================================
  // 12. Due Diligence Checklist
  // =========================================================================

  heading('Due Diligence Checklist', 12);

  const checks = [
    { item: 'Instruct independent valuation / survey', status: 'TODO' },
    { item: 'Verify title with solicitor (folio, charges, rights of way)', status: 'TODO' },
    { item: 'Check planning history on local authority portal', status: 'TODO' },
    { item: 'Confirm BER certificate is current', status: berRating ? 'PROVIDED' : 'TODO' },
    { item: 'Commission radon test', status: result.radon?.riskCategory === 'high' || isRadonUnknown(result.radon) ? 'RECOMMENDED' : result.radon ? 'OPTIONAL' : 'TODO' },
    { item: 'Check for defective concrete blocks (engineer)', status: result.dcb?.riskLevel === 'high' ? 'RECOMMENDED' : 'OPTIONAL' },
    { item: 'Verify vacancy status for Croi Conaithe eligibility', status: hasVacantGrant ? 'RECOMMENDED' : 'N/A' },
    { item: 'Apply for applicable grants (see Section 6)', status: result.grants.applicable_schemes?.length > 0 ? 'ACTION' : 'N/A' },
    { item: 'Obtain solar assessment for exact roof orientation', status: result.solar ? 'OPTIONAL' : 'N/A' },
    { item: 'Verify flood risk on OPW flood maps (floodinfo.ie)', status: result.flood?.inFloodZone ? 'RECOMMENDED' : result.flood ? 'DONE' : 'TODO' },
    { item: 'Check property tax (LPT) band with Revenue', status: 'TODO' },
    { item: 'Review management fees (apartment/duplex)', status: propertyType === 'apartment' || propertyType === 'duplex' ? 'TODO' : 'N/A' },
    { item: 'Confirm RPZ status if buying to let', status: intendedUse === 'rental' || intendedUse === 'mixed' ? 'TODO' : 'N/A' },
    { item: 'Get retrofit assessment before relying on grant economics', status: result.grants.applicable_schemes?.some((s) => s.code?.startsWith('SEAI')) ? 'RECOMMENDED' : 'N/A' },
    { item: 'Verify noise exposure on-site (EPA noise maps show modelled levels)', status: result.noise?.category === 'high' || result.noise?.category === 'moderate' ? 'RECOMMENDED' : 'OPTIONAL' },
    { item: 'Check air quality monitoring at airquality.ie', status: result.airQuality && result.airQuality.aqih != null && result.airQuality.aqih >= 7 ? 'RECOMMENDED' : 'OPTIONAL' },
  ];

  const activeChecks = checks.filter((c) => c.status !== 'N/A');

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['#', 'Item', 'Status']],
    body: activeChecks.map((c, i) => [String(i + 1), c.item, c.status]),
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 28, halign: 'center', fontStyle: 'bold' } },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 2) {
        const val = data.cell.raw as string;
        if (val === 'RECOMMENDED') data.cell.styles.textColor = RED;
        else if (val === 'ACTION') data.cell.styles.textColor = BRAND.green;
        else if (val === 'TODO') data.cell.styles.textColor = AMBER;
        else if (val === 'PROVIDED') data.cell.styles.textColor = GREEN_DARK;
      }
    },
  });
  y = getLastTableY(doc) + 5;

  // =========================================================================
  // 13. Assumptions & Disclaimers
  // =========================================================================

  heading('Assumptions & Disclaimers', 13);

  const disclaimers = [
    'This report is an automated due-diligence aid generated from public and third-party datasets believed to be reliable, but not independently verified by ProperData. Data sources update at different intervals and may contain omissions, lags or errors.',
    'Any market value estimate is an indicative model output based on available comparable PPR sales. It is not a Red Book valuation, SCSI valuation or professional valuation opinion. An independent RICS/SCSI valuation is recommended before purchase.',
    'Grant estimates are indicative only. Eligibility and grant amounts are determined solely by the relevant scheme administrator (SEAI, Revenue, local authority). Some grants may be mutually exclusive or may require works to be completed by registered contractors.',
    'Effective cost scenarios are illustrative. The conservative scenario assumes no grants. The base scenario uses a central grant estimate. Upside scenarios require confirmation of eligibility.',
    ...(result.yield ? ['Rental yield estimates use RTB Rent Index data (actual achieved rents, not asking rents). Actual yield depends on tenancy outcomes, expense levels, and individual tax circumstances.'] : []),
    'Radon risk data is from the EPA national radon survey. Individual property risk can only be determined by an in-home radon test.',
    'Solar potential is estimated using EU PVGIS satellite data for the approximate location. Actual generation depends on roof orientation, pitch, shading, and system specification.',
    'Amenity and walkability data derived from OpenStreetMap contributors. OpenStreetMap data is available under the Open Database Licence (ODbL). ProperData is not affiliated with or endorsed by the OpenStreetMap Foundation.',
    'This report does not constitute financial, legal, tax, or property advice. It is not a substitute for solicitor, surveyor, valuer, tax adviser or estate agent advice. Users should independently verify all material facts before making a property decision.',
    `Report generated on ${formatDate()} using data available at that time.`,
  ];

  doc.setFontSize(7.5);
  doc.setTextColor(...GREY.mid);
  for (const d of disclaimers) {
    const lines = doc.splitTextToSize(d, CONTENT_W - 5);
    for (const line of lines) { checkPage(4); doc.text(line, MARGIN + 4, y); y += 3.5; }
    y += 1.5;
  }

  // =========================================================================
  // 14. Data Sources
  // =========================================================================

  heading('Data Sources', 14);

  const sourceRows: string[][] = [
    ['Comparable sales', 'Property Price Register (PPR)', 'psr.ie', 'Public statutory register'],
    ['Stamp duty', 'Revenue Commissioners published rates', 'revenue.ie', 'Statutory'],
  ];
  if (result.yield) sourceRows.push(['Rent estimates', 'RTB Rent Index (CSO PxStat RIQ02)', 'cso.ie', 'Public dataset']);
  if (result.radon) sourceRows.push(['Radon risk', 'EPA national radon survey', 'epa.ie', 'Public / INSPIRE']);
  if (result.solar) sourceRows.push(['Solar potential', 'EU PVGIS (JRC)', 'ec.europa.eu/jrc', 'EU open data']);
  if (result.walkability) sourceRows.push(['Walkability / amenities', 'OpenStreetMap', 'openstreetmap.org', 'ODbL']);
  if (result.flood) sourceRows.push(['Flood risk', 'OPW CFRAM / NIFM', 'floodinfo.ie', 'Public / INSPIRE']);
  if (result.noise) sourceRows.push(['Noise maps', 'EPA Strategic Noise Maps (Round 4)', 'gis.epa.ie', 'Public / INSPIRE']);
  if (result.airQuality) sourceRows.push(['Air quality', 'EPA Air Quality Network', 'airquality.ie', 'Public']);
  if (result.microclimate) sourceRows.push(['Microclimate', 'Met Éireann 30-year normals', 'met.ie', 'CC BY 4.0']);
  sourceRows.push(['Grant schemes', 'SEAI, Revenue, local authorities', 'seai.ie / revenue.ie', 'Public scheme rules']);

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Data Item', 'Source', 'Reference', 'Licence / Basis']],
    body: sourceRows,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [240, 253, 244] },
  });
  y = getLastTableY(doc) + 5;

  doc.setFontSize(7);
  doc.setTextColor(...GREY.mid);
  doc.text(`All data accessed on or before ${formatDate()}.`, MARGIN, y);
  y += 5;

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GREY.light);
    doc.text('ProperData — Property Due Diligence Report', MARGIN, 290);
    doc.text(`Page ${i} of ${totalPages}`, W - MARGIN - 20, 290);
    doc.setDrawColor(220, 220, 220);
    doc.line(MARGIN, 287, W - MARGIN, 287);
  }

  const filename = address
    ? `ProperData-Report-${address.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50)}.pdf`
    : `ProperData-Report-${county}-${Date.now()}.pdf`;
  doc.save(filename);
}
