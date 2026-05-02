import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Re-use the response types from the page
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
  yields: {
    gross_yield_annual: number;
    net_yield_annual: number;
    tax_adjusted_yield: number;
  };
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
  metadata: {
    elapsedMs: number;
    agentCalls: number;
    estimatedCost: number;
    from_cache: boolean;
  };
}

interface ReportInput {
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
  if (n == null) return '—';
  return '€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function propertyTypeLabel(t: string): string {
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
const GREY = { dark: [51, 51, 51] as [number, number, number], mid: [102, 102, 102] as [number, number, number], light: [170, 170, 170] as [number, number, number] };
const RED = [220, 38, 38] as [number, number, number];
const AMBER = [217, 119, 6] as [number, number, number];
const GREEN_DARK = [22, 163, 74] as [number, number, number];

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
    if (y + need > 270) {
      doc.addPage();
      y = 20;
    }
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

  function body(text: string | null | undefined, maxWidth?: number) {
    if (!text) return;
    checkPage(10);
    doc.setFontSize(9);
    doc.setTextColor(...GREY.mid);
    const lines = doc.splitTextToSize(text, maxWidth ?? CONTENT_W);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, MARGIN, y);
      y += 4;
    }
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

  // =========================================================================
  // Cover / Header
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
  doc.setTextColor(...GREY.light);
  const cols = [
    ['Property', propertyTypeLabel(propertyType)],
    ['County', county],
    ['Asking Price', eur(purchasePrice)],
    ['BER', berRating || '—'],
    ['Year Built', yearBuilt || '—'],
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

  summaryPoints.push(
    `Fair value estimate: ${eur(result.comparable.fair_value_central)} (${eur(result.comparable.fair_value_low)} – ${eur(result.comparable.fair_value_high)}), ${result.comparable.confidence} confidence.`,
  );

  if (result.grants.total_grants_high > 0) {
    summaryPoints.push(
      `Up to ${eur(result.grants.total_grants_high)} in potential grants across ${result.grants.applicable_schemes?.length ?? 0} schemes.`,
    );
  }

  if (result.grants.net_acquisition_cost) {
    summaryPoints.push(
      `Effective acquisition cost after grants and fees: ${eur(result.grants.net_acquisition_cost.effective_cost)}.`,
    );
  }

  if (result.yield) {
    summaryPoints.push(
      `Estimated rental yield: ${result.yield.yields.gross_yield_annual}% gross, ${result.yield.yields.net_yield_annual}% net, ${result.yield.yields.tax_adjusted_yield}% after tax.`,
    );
  }

  if (result.radon) {
    summaryPoints.push(
      `Radon risk: ${result.radon.riskCategory} (${result.radon.riskPercent}% of homes in this area exceed the reference level).`,
    );
  }

  if (result.solar) {
    summaryPoints.push(
      `Solar potential: ${result.solar.annualYieldKwh.toLocaleString()} kWh/yr, ${result.solar.financial.paybackYears}-year payback after SEAI grant.`,
    );
  }

  if (result.walkability) {
    summaryPoints.push(
      `Walkability: ${result.walkability.score}/100 (${result.walkability.label}).`,
    );
  }

  if (result.dcb && result.dcb.riskLevel !== 'none') {
    summaryPoints.push(
      `Defective concrete blocks: ${result.dcb.riskLevel} risk. ${result.dcb.grantEligible ? 'May qualify for remediation grant.' : ''}`,
    );
  }

  for (const point of summaryPoints) {
    checkPage(6);
    doc.setFontSize(9);
    doc.setTextColor(...GREY.dark);
    doc.text('•', MARGIN, y);
    const lines = doc.splitTextToSize(point, CONTENT_W - 6);
    for (const line of lines) {
      checkPage(5);
      doc.text(line, MARGIN + 5, y);
      y += 4.5;
    }
    y += 1;
  }
  y += 2;

  // =========================================================================
  // 2. Fair Value Range
  // =========================================================================

  heading('Fair Value Range', 2);

  keyValue('Low estimate', eur(result.comparable.fair_value_low));
  keyValue('Central estimate', eur(result.comparable.fair_value_central), BRAND.green);
  keyValue('High estimate', eur(result.comparable.fair_value_high));
  keyValue('Confidence', result.comparable.confidence,
    result.comparable.confidence === 'high' ? GREEN_DARK : result.comparable.confidence === 'medium' ? AMBER : RED);
  y += 2;
  body(result.comparable.narrative);

  // =========================================================================
  // 3. Comparable Sales
  // =========================================================================

  heading('Comparable Sales', 3);

  if (result.comparable.comparables_used?.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Address', 'Date', 'Price', 'Distance', 'Weight']],
      body: result.comparable.comparables_used.map((c) => [
        c.address,
        c.sale_date,
        eur(c.price),
        c.distance_meters != null ? `${c.distance_meters.toLocaleString()}m` : '—',
        c.weight,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 60 },
        2: { fontStyle: 'bold' },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  } else {
    body('No comparable sales data available.');
  }

  // =========================================================================
  // 4. Grant Opportunity
  // =========================================================================

  heading('Grant Opportunity', 4);

  keyValue('Total grants (low)', eur(result.grants.total_grants_low));
  keyValue('Total grants (high)', eur(result.grants.total_grants_high), GREEN_DARK);
  keyValue('Schemes identified', String(result.grants.applicable_schemes?.length ?? 0));
  y += 2;

  if (result.grants.applicable_schemes?.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Scheme', 'Amount', 'Eligibility', 'Notes']],
      body: result.grants.applicable_schemes.map((s) => [
        s.name,
        s.amount_low === s.amount_high ? eur(s.amount_low) : `${eur(s.amount_low)} – ${eur(s.amount_high)}`,
        s.eligibility_status,
        s.rationale,
      ]),
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 28 },
        2: { cellWidth: 20 },
        3: { cellWidth: 'auto' },
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  }

  body(result.grants.narrative);

  // =========================================================================
  // 5. Effective Cost Scenarios
  // =========================================================================

  heading('Effective Cost Scenarios', 5);

  if (result.grants.net_acquisition_cost) {
    const nac = result.grants.net_acquisition_cost;

    subheading('Base Scenario');
    keyValue('Purchase price', eur(nac.purchase_price));
    keyValue('Stamp duty', eur(nac.stamp_duty));
    keyValue('Legal fees (est.)', eur(nac.estimated_legal_fees));
    keyValue('Grants (est.)', `−${eur(nac.total_grants_central)}`, GREEN_DARK);

    y += 1;
    doc.setDrawColor(200, 200, 200);
    doc.line(MARGIN, y, MARGIN + 80, y);
    y += 4;
    keyValue('Effective cost', eur(nac.effective_cost), BRAND.green);
    y += 2;

    if (result.yield) {
      subheading('Investor Scenario');
      keyValue('Monthly rent (RTB)', eur(result.yield.property.estimated_rent_monthly));
      keyValue('Gross yield', `${result.yield.yields.gross_yield_annual}%`);
      keyValue('Net yield', `${result.yield.yields.net_yield_annual}%`, BRAND.green);
      keyValue('After-tax yield', `${result.yield.yields.tax_adjusted_yield}%`);
      keyValue('Rent source', result.yield.property.rent_data_source);
      y += 2;
    }
  }

  // =========================================================================
  // 6. Solar / Retrofit Estimate
  // =========================================================================

  heading('Solar & Retrofit Estimate', 6);

  if (result.solar) {
    keyValue('Annual generation', `${result.solar.annualYieldKwh.toLocaleString()} kWh`);
    keyValue('System size', `${result.solar.systemSizeKwp} kWp`);
    keyValue('Yield per kWp', `${result.solar.yieldPerKwp} kWh/kWp`);
    y += 2;
    keyValue('System cost (est.)', eur(result.solar.financial.systemCostEstimate));
    keyValue('SEAI grant', `−${eur(result.solar.financial.seaiGrant)}`, GREEN_DARK);
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
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }

    body(result.solar.context);
  } else {
    body('Solar estimate not available — coordinates required for PVGIS lookup.');
  }

  // =========================================================================
  // 7. Walkability & Amenities
  // =========================================================================

  heading('Walkability & Amenities', 7);

  if (result.walkability) {
    keyValue('Walkability score', `${result.walkability.score}/100`,
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
        body: amenities.map((a) => [a.category, String(a.count), a.nearest ? `${a.nearest}m` : '—']),
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: BRAND.green, textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 248, 248] },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    }

    body(result.walkability.context);
  } else {
    body('Walkability data not available — coordinates required for Overpass API lookup.');
  }

  // =========================================================================
  // 8. Environmental Risks
  // =========================================================================

  heading('Environmental Risks', 8);

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

  if (!result.radon && !result.dcb) {
    body('No environmental risk data available for this property.');
  }

  // =========================================================================
  // 9. Red Flags
  // =========================================================================

  heading('Red Flags', 9);

  const flags: Array<{ flag: string; severity: string; detail: string }> = [];

  if (result.comparable.confidence === 'low') {
    flags.push({
      flag: 'Low valuation confidence',
      severity: 'HIGH',
      detail: 'Fewer than 3 relevant comparables found. The fair value range may be unreliable. Consider instructing an independent valuation.',
    });
  }

  if (result.radon && result.radon.riskCategory === 'high') {
    flags.push({
      flag: 'High radon risk area',
      severity: 'MEDIUM',
      detail: `${result.radon.riskPercent}% of homes in this area exceed the reference level. Commission a radon test before purchase (${result.radon.testCost}).`,
    });
  }

  if (result.dcb && (result.dcb.riskLevel === 'high' || result.dcb.riskLevel === 'medium')) {
    flags.push({
      flag: 'Defective concrete block risk',
      severity: result.dcb.riskLevel === 'high' ? 'HIGH' : 'MEDIUM',
      detail: result.dcb.recommendation,
    });
  }

  const askVsFair = result.comparable.fair_value_central
    ? ((purchasePrice - result.comparable.fair_value_central) / result.comparable.fair_value_central) * 100
    : null;

  if (askVsFair != null && askVsFair > 10) {
    flags.push({
      flag: 'Asking price above fair value',
      severity: 'MEDIUM',
      detail: `Asking price is ${Math.round(askVsFair)}% above the central fair value estimate. Consider whether condition, spec, or market timing justify the premium.`,
    });
  }

  if (askVsFair != null && askVsFair < -20) {
    flags.push({
      flag: 'Asking price significantly below fair value',
      severity: 'MEDIUM',
      detail: `Asking price is ${Math.abs(Math.round(askVsFair))}% below fair value. Investigate condition, title issues, or vacancy/dereliction.`,
    });
  }

  if (result.yield && result.yield.yields.net_yield_annual < 2) {
    flags.push({
      flag: 'Sub-2% net yield',
      severity: 'MEDIUM',
      detail: 'Net rental yield is below 2%. After tax, this property may generate minimal or negative cash flow.',
    });
  }

  if (flags.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Flag', 'Severity', 'Detail']],
      body: flags.map((f) => [f.flag, f.severity, f.detail]),
      styles: { fontSize: 8, cellPadding: 2.5 },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      columnStyles: {
        0: { cellWidth: 40, fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 'auto' },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 1) {
          const val = data.cell.raw as string;
          if (val === 'HIGH') data.cell.styles.textColor = RED;
          else if (val === 'MEDIUM') data.cell.styles.textColor = AMBER;
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...GREEN_DARK);
    doc.text('No red flags identified based on available data.', MARGIN, y);
    y += 6;
  }

  // =========================================================================
  // 10. Due Diligence Checklist
  // =========================================================================

  heading('Due Diligence Checklist', 10);

  const checks = [
    { item: 'Instruct independent valuation / survey', status: 'TODO' },
    { item: 'Verify title with solicitor (folio, charges, rights of way)', status: 'TODO' },
    { item: 'Check planning history on local authority portal', status: 'TODO' },
    { item: 'Confirm BER certificate is current', status: berRating ? 'PROVIDED' : 'TODO' },
    { item: 'Commission radon test', status: result.radon?.riskCategory === 'high' ? 'RECOMMENDED' : result.radon ? 'OPTIONAL' : 'TODO' },
    { item: 'Check for defective concrete blocks (engineer report)', status: result.dcb?.riskLevel === 'high' ? 'RECOMMENDED' : 'OPTIONAL' },
    { item: 'Apply for applicable grants (see Section 4)', status: result.grants.applicable_schemes?.length > 0 ? 'ACTION' : 'N/A' },
    { item: 'Obtain solar assessment for exact roof orientation', status: result.solar ? 'OPTIONAL' : 'N/A' },
    { item: 'Verify flood risk on OPW flood maps', status: 'TODO' },
    { item: 'Check property tax (LPT) band with Revenue', status: 'TODO' },
    { item: 'Review management fees (if apartment/duplex)', status: propertyType === 'apartment' || propertyType === 'duplex' ? 'TODO' : 'N/A' },
    { item: 'Confirm RPZ status if buying to let', status: intendedUse === 'rental' || intendedUse === 'mixed' ? 'TODO' : 'N/A' },
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
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
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
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;

  // =========================================================================
  // 11. Assumptions & Disclaimers
  // =========================================================================

  heading('Assumptions & Disclaimers', 11);

  const disclaimers = [
    'This report is generated by AI using verified public data sources including the Property Price Register (PPR), RTB Rent Index, SEAI BER database, EPA radon maps, EU PVGIS solar data, and OpenStreetMap.',
    'Fair value estimates are based on comparable PPR sales within the local area. They are not a formal valuation and should not be treated as such.',
    'Grant eligibility is estimated based on publicly available scheme rules. Actual eligibility is determined by the relevant scheme administrator (SEAI, local authority, Revenue) based on documentation submitted at application.',
    'Rental yield estimates use RTB Rent Index data (actual achieved rents, not asking rents). Actual yield depends on tenancy outcomes, expense levels, and individual tax circumstances.',
    'Radon risk data is from the EPA national radon survey. Individual property risk can only be determined by an in-home radon test.',
    'Solar potential is estimated using EU PVGIS satellite data for the location. Actual generation depends on roof orientation, shading, and system specification.',
    'This report does not constitute financial, legal, tax, or property advice. Consult a qualified professional before making property decisions.',
    `Report generated on ${formatDate()} using data available at that time. Data sources update at different frequencies; some figures may not reflect the very latest changes.`,
  ];

  doc.setFontSize(7.5);
  doc.setTextColor(...GREY.mid);
  for (const d of disclaimers) {
    const lines = doc.splitTextToSize(d, CONTENT_W - 5);
    for (const line of lines) {
      checkPage(4);
      doc.text(line, MARGIN + 4, y);
      y += 3.5;
    }
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

  // Save
  const filename = address
    ? `ProperData-Report-${address.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50)}.pdf`
    : `ProperData-Report-${county}-${Date.now()}.pdf`;
  doc.save(filename);
}
