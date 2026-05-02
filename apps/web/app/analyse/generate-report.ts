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
  fair_value_low: number;
  fair_value_high: number;
  fair_value_central: number;
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

interface AnalyseResponse {
  comparable: ComparableResult;
  grants: GrantResult;
  yield?: YieldResult;
  radon?: RadonResult;
  solar?: SolarResult;
  walkability?: WalkabilityResult;
  dcb?: DcbResult;
  metadata: { elapsedMs: number; agentCalls: number; estimatedCost: number; from_cache: boolean };
}

export interface ReportInput {
  address: string;
  county: string;
  propertyType: string;
  purchasePrice: number;
  berRating?: string;
  yearBuilt?: string;
  buyerType: string;
  intendedUse: string;
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
    { field: 'BER rating', status: input.berRating ? 'provided' : 'missing', impact: 'Affects retrofit and SEAI grant estimates' },
    { field: 'Year built', status: input.yearBuilt ? 'provided' : 'missing', impact: 'Affects SEAI eligibility and DCB risk' },
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
  if (result.comparable.fair_value_central) {
    const ratio = purchasePrice / result.comparable.fair_value_central;
    const vfm = Math.max(0, Math.min(100, Math.round((1 - (ratio - 1)) * 75)));
    items.push({ dimension: 'Value for money', score: vfm, note: ratio <= 1 ? 'At or below fair value' : `${Math.round((ratio - 1) * 100)}% above fair value` });
  }

  // Comparable confidence
  const confMap: Record<string, number> = { high: 85, medium: 55, low: 25 };
  items.push({ dimension: 'Comparable confidence', score: confMap[result.comparable.confidence] ?? 40, note: `${result.comparable.comparables_used?.length ?? 0} comparables, ${result.comparable.confidence}` });

  // Grant upside
  const grantPct = purchasePrice > 0 ? (result.grants.total_grants_high / purchasePrice) * 100 : 0;
  items.push({ dimension: 'Grant upside', score: Math.min(100, Math.round(grantPct * 5)), note: `Up to ${eur(result.grants.total_grants_high)} (${Math.round(grantPct)}% of price)` });

  // Location
  if (result.walkability) {
    items.push({ dimension: 'Location convenience', score: result.walkability.score, note: result.walkability.label });
  }

  // Environmental risk (inverted — higher = safer)
  let envScore = 80;
  if (result.radon?.riskCategory === 'high') envScore -= 30;
  else if (result.radon?.riskCategory === 'medium') envScore -= 15;
  if (result.dcb?.riskLevel === 'high') envScore -= 30;
  else if (result.dcb?.riskLevel === 'medium') envScore -= 15;
  items.push({ dimension: 'Environmental safety', score: Math.max(0, envScore), note: envScore >= 70 ? 'Low risk profile' : 'Elevated risk — see Section 8' });

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

export function generateReport(input: ReportInput): void {
  const { result, address, county, propertyType, purchasePrice, berRating, yearBuilt, buyerType, intendedUse } = input;
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

  // =========================================================================
  // 1. Executive Summary
  // =========================================================================

  heading('Executive Summary', 1);

  const summaryPoints: string[] = [];
  summaryPoints.push(`Fair value estimate: ${eur(result.comparable.fair_value_central)} (${eur(result.comparable.fair_value_low)} - ${eur(result.comparable.fair_value_high)}), ${result.comparable.confidence} confidence.`);

  // Categorised grant summary
  const grantCats = categoriseGrants(result.grants.applicable_schemes ?? []);
  if (grantCats.length > 0) {
    const parts = grantCats.map((c) => `${c.label}: up to ${eur(c.totalHigh)}`);
    summaryPoints.push(`Grant opportunity: ${parts.join('; ')}.`);
  }

  if (result.grants.net_acquisition_cost) {
    summaryPoints.push(`Effective acquisition cost (base scenario): ${eur(result.grants.net_acquisition_cost.effective_cost)}.`);
  }
  if (result.yield) {
    summaryPoints.push(`Rental yield: ${result.yield.yields.gross_yield_annual}% gross, ${result.yield.yields.net_yield_annual}% net, ${result.yield.yields.tax_adjusted_yield}% after tax (RTB data).`);
  }
  if (result.radon) {
    summaryPoints.push(`Radon: ${result.radon.riskCategory} risk (${result.radon.riskPercent}% of homes in area exceed reference level).`);
  }
  if (result.solar) {
    summaryPoints.push(`Solar: ${result.solar.annualYieldKwh.toLocaleString()} kWh/yr, ${result.solar.financial.paybackYears}-year payback after SEAI grant.`);
  }
  if (result.walkability) {
    summaryPoints.push(`Walkability: ${result.walkability.score}/100 (${result.walkability.label}).`);
  }
  if (result.dcb && result.dcb.riskLevel !== 'none') {
    summaryPoints.push(`Defective blocks: ${result.dcb.riskLevel} risk.${result.dcb.grantEligible ? ' May qualify for remediation grant.' : ''}`);
  }

  bulletList(summaryPoints);

  // =========================================================================
  // 2. Recommended Next Actions
  // =========================================================================

  heading('Recommended Next Actions', 2);

  const actions: string[] = [];
  if (!propertyType || propertyType === 'unknown') actions.push('Confirm property type, bedrooms, and floor area to improve valuation accuracy and grant estimates.');
  if (!berRating) actions.push('Obtain BER certificate to establish retrofit baseline and determine SEAI grant eligibility.');
  if (!yearBuilt) actions.push('Confirm year built to assess SEAI eligibility and structural risk factors.');

  const hasVacantGrant = (result.grants.applicable_schemes ?? []).some((s) => s.code?.includes('CROI') || s.name?.toLowerCase().includes('vacant'));
  if (hasVacantGrant) actions.push('Verify vacancy status (2+ years) for Croi Conaithe eligibility - this could materially change the economics.');

  actions.push('Instruct an independent survey and solicitor title check.');
  actions.push('Verify flood risk on OPW flood maps (floodinfo.ie).');

  if (result.radon?.riskCategory === 'high') actions.push(`Commission radon test before purchase (${result.radon.testCost}).`);
  if (result.grants.applicable_schemes?.length) actions.push('Review grant eligibility in Section 5 and begin applications for confirmed schemes.');
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
  // 4. Fair Value Range
  // =========================================================================

  heading('Fair Value Range', 4);

  keyValue('Low estimate', eur(result.comparable.fair_value_low));
  keyValue('Central estimate', eur(result.comparable.fair_value_central), BRAND.green);
  keyValue('High estimate', eur(result.comparable.fair_value_high));
  keyValue('Confidence', result.comparable.confidence,
    result.comparable.confidence === 'high' ? GREEN_DARK : result.comparable.confidence === 'medium' ? AMBER : RED);

  const askVsFair = result.comparable.fair_value_central
    ? ((purchasePrice - result.comparable.fair_value_central) / result.comparable.fair_value_central) * 100
    : null;
  if (askVsFair != null) {
    const dir = askVsFair >= 0 ? 'above' : 'below';
    keyValue('Price vs fair value', `${Math.abs(Math.round(askVsFair))}% ${dir}`,
      askVsFair > 10 ? AMBER : askVsFair < -10 ? GREEN_DARK : GREY.dark);
  }
  y += 2;
  body(result.comparable.narrative);

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

  body(result.grants.narrative);

  // =========================================================================
  // 7. Effective Cost Scenarios
  // =========================================================================

  heading('Effective Cost Scenarios', 7);

  if (result.grants.net_acquisition_cost) {
    const nac = result.grants.net_acquisition_cost;
    const fees = (nac.stamp_duty ?? 0) + (nac.estimated_legal_fees ?? 0);
    const conservativeCost = purchasePrice + fees;
    const baseCost = nac.effective_cost;

    // Find Croi Conaithe high value
    const croiSchemes = (result.grants.applicable_schemes ?? []).filter(
      (s) => s.code?.includes('CROI') || s.name?.toLowerCase().includes('vacant') || s.name?.toLowerCase().includes('derelict'),
    );
    const croiHigh = croiSchemes.reduce((s, g) => s + (g.amount_high ?? 0), 0);
    const energyHigh = grantCats.find((c) => c.label.includes('Energy'))?.totalHigh ?? 0;
    const upsideCost = conservativeCost - (nac.total_grants_central ?? 0) - croiHigh;
    const bestCost = conservativeCost - energyHigh - croiHigh;

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Scenario', 'Assumption', 'Effective Cost']],
      body: [
        ['Conservative', 'No grants confirmed', eur(conservativeCost)],
        ['Base', 'Central SEAI grant estimate applied', eur(baseCost)],
        ...(croiHigh > 0 ? [['Upside', 'Base + Croi Conaithe confirmed', eur(Math.max(0, upsideCost))]] : []),
        ...(croiHigh > 0 && energyHigh > 0 ? [['Best case', 'Full SEAI + Croi Conaithe (caveat: verify eligibility)', eur(Math.max(0, bestCost))]] : []),
      ],
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold' }, 2: { cellWidth: 28, fontStyle: 'bold' } },
    });
    y = getLastTableY(doc) + 4;

    body('Important: Grant eligibility must be confirmed with the relevant scheme administrator before relying on these scenarios. Some schemes are mutually exclusive and cannot be stacked.');

    if (result.yield) {
      subheading('Investor Scenario');
      keyValue('Monthly rent (RTB)', eur(result.yield.property.estimated_rent_monthly));
      keyValue('Gross yield', `${result.yield.yields.gross_yield_annual}%`);
      keyValue('Net yield', `${result.yield.yields.net_yield_annual}%`, BRAND.green);
      keyValue('After-tax yield', `${result.yield.yields.tax_adjusted_yield}%`);
      keyValue('Rent source', result.yield.property.rent_data_source);
      y += 2;
      body(result.yield.narrative);
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
    keyValue('Risk level', result.radon.riskCategory.toUpperCase(),
      result.radon.riskCategory === 'high' ? RED : result.radon.riskCategory === 'medium' ? AMBER : GREEN_DARK);
    keyValue('Area prevalence', `${result.radon.riskPercent}% above reference level`);
    keyValue('Test cost', result.radon.testCost);
    keyValue('Remediation cost', result.radon.remediationCost);
    y += 1;
    body(result.radon.riskDescription);
    body(result.radon.context);
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
  body('Flood risk has not been assessed in this report. Check the OPW National Flood Hazard Mapping at floodinfo.ie for the property location before purchase.');

  if (!result.radon && !result.dcb) {
    body('Limited environmental risk data available. Provide coordinates to enable radon and location-specific checks.');
  }

  // =========================================================================
  // 11. Red Flags
  // =========================================================================

  heading('Red Flags', 11);

  const flags: Array<{ flag: string; severity: string; detail: string }> = [];

  // Detected issues
  if (result.comparable.confidence === 'low') {
    flags.push({ flag: 'Low valuation confidence', severity: 'HIGH', detail: 'Fewer than 3 relevant comparables found. Fair value range may be unreliable. Consider an independent valuation.' });
  }
  if (result.radon && result.radon.riskCategory === 'high') {
    flags.push({ flag: 'High radon risk area', severity: 'MEDIUM', detail: `${result.radon.riskPercent}% of homes exceed reference level. Commission radon test (${result.radon.testCost}).` });
  }
  if (result.dcb && (result.dcb.riskLevel === 'high' || result.dcb.riskLevel === 'medium')) {
    flags.push({ flag: 'Defective block risk', severity: result.dcb.riskLevel === 'high' ? 'HIGH' : 'MEDIUM', detail: result.dcb.recommendation });
  }
  if (askVsFair != null && askVsFair > 10) {
    flags.push({ flag: 'Price above fair value', severity: 'MEDIUM', detail: `Price is ${Math.round(askVsFair)}% above central fair value. Consider condition, spec, or market timing.` });
  }
  if (askVsFair != null && askVsFair < -20) {
    flags.push({ flag: 'Price well below fair value', severity: 'MEDIUM', detail: `Price is ${Math.abs(Math.round(askVsFair))}% below fair value. Investigate condition, title, or vacancy.` });
  }
  if (result.yield && result.yield.yields.net_yield_annual < 2) {
    flags.push({ flag: 'Sub-2% net yield', severity: 'MEDIUM', detail: 'Net yield below 2%. May generate minimal or negative cash flow after tax.' });
  }

  // Missing data flags
  if (!propertyType || propertyType === 'unknown') {
    flags.push({ flag: 'Property type unknown', severity: 'MEDIUM', detail: 'Affects SEAI grant values and valuation confidence. Confirm property type.' });
  }
  if (!berRating) {
    flags.push({ flag: 'BER unknown', severity: 'MEDIUM', detail: 'Retrofit and grant assumptions depend on BER and build year. Obtain BER certificate.' });
  }
  if (!result.comparable.comparables_used?.some((c) => c.distance_meters != null)) {
    flags.push({ flag: 'Comparable distances unavailable', severity: 'LOW', detail: 'Spatial proximity to comparables could not be verified. Valuation relies on address matching.' });
  }
  if (hasVacantGrant) {
    flags.push({ flag: 'Vacancy status unconfirmed', severity: 'HIGH', detail: 'Croi Conaithe eligibility depends on 2+ years vacancy. Confirm before relying on grant economics.' });
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
    { item: 'Commission radon test', status: result.radon?.riskCategory === 'high' ? 'RECOMMENDED' : result.radon ? 'OPTIONAL' : 'TODO' },
    { item: 'Check for defective concrete blocks (engineer)', status: result.dcb?.riskLevel === 'high' ? 'RECOMMENDED' : 'OPTIONAL' },
    { item: 'Verify vacancy status for Croi Conaithe eligibility', status: hasVacantGrant ? 'RECOMMENDED' : 'N/A' },
    { item: 'Apply for applicable grants (see Section 6)', status: result.grants.applicable_schemes?.length > 0 ? 'ACTION' : 'N/A' },
    { item: 'Obtain solar assessment for exact roof orientation', status: result.solar ? 'OPTIONAL' : 'N/A' },
    { item: 'Verify flood risk on OPW flood maps (floodinfo.ie)', status: 'TODO' },
    { item: 'Check property tax (LPT) band with Revenue', status: 'TODO' },
    { item: 'Review management fees (apartment/duplex)', status: propertyType === 'apartment' || propertyType === 'duplex' ? 'TODO' : 'N/A' },
    { item: 'Confirm RPZ status if buying to let', status: intendedUse === 'rental' || intendedUse === 'mixed' ? 'TODO' : 'N/A' },
    { item: 'Get retrofit assessment before relying on grant economics', status: result.grants.applicable_schemes?.some((s) => s.code?.startsWith('SEAI')) ? 'RECOMMENDED' : 'N/A' },
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
    'This report is generated by AI using verified public data sources including the Property Price Register (PPR), RTB Rent Index, SEAI BER database, EPA radon maps, EU PVGIS solar data, and OpenStreetMap.',
    'Fair value estimates are based on comparable PPR sales within the local area. They are not a formal valuation and should not be treated as such. An independent RICS/SCSI valuation is recommended before purchase.',
    'Grant eligibility is estimated based on publicly available scheme rules. Actual eligibility is determined by the relevant scheme administrator (SEAI, local authority, Revenue) based on documentation submitted at application. Some grants shown may be mutually exclusive.',
    'Effective cost scenarios are illustrative. The conservative scenario assumes no grants. The base scenario uses a central grant estimate. Upside scenarios require confirmation of eligibility.',
    'Rental yield estimates use RTB Rent Index data (actual achieved rents, not asking rents). Actual yield depends on tenancy outcomes, expense levels, and individual tax circumstances.',
    'Radon risk data is from the EPA national radon survey. Individual property risk can only be determined by an in-home radon test.',
    'Solar potential is estimated using EU PVGIS satellite data for the approximate location. Actual generation depends on roof orientation, pitch, shading, and system specification.',
    'This report does not constitute financial, legal, tax, or property advice. Consult a qualified professional before making property decisions.',
    `Report generated on ${formatDate()} using data available at that time. Data sources update at different frequencies; some figures may not reflect the very latest changes.`,
  ];

  doc.setFontSize(7.5);
  doc.setTextColor(...GREY.mid);
  for (const d of disclaimers) {
    const lines = doc.splitTextToSize(d, CONTENT_W - 5);
    for (const line of lines) { checkPage(4); doc.text(line, MARGIN + 4, y); y += 3.5; }
    y += 1.5;
  }

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
