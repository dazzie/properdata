import 'server-only';

export interface DcbRiskResult {
  riskLevel: 'high' | 'medium' | 'low' | 'none';
  isAffectedCounty: boolean;
  context: string;
  grantEligible: boolean;
  grantDetails: string | null;
  recommendation: string;
}

// Counties confirmed as covered by the DCB Grant Scheme
const DCB_SCHEME_COUNTIES = new Set([
  'Donegal',
  'Mayo',
  'Clare',
  'Limerick',
  'Sligo',
]);

// Counties with known or suspected affected blocks but not yet in the scheme
const AT_RISK_COUNTIES = new Set([
  'Galway',
  'Roscommon',
  'Leitrim',
  'Tipperary',
  'Cork',
]);

// Build years with highest DCB risk (blocks from affected quarries)
const HIGH_RISK_YEAR_MIN = 1980;
const HIGH_RISK_YEAR_MAX = 2010;

/**
 * Assess defective concrete block (mica/pyrite) risk for a property
 * based on county and build year.
 *
 * The DCB Grant Scheme (2022, extended 2024) covers up to 100% of
 * remediation costs, capped at €420,000, for properties in affected counties.
 */
export function getDcbRisk(opts: {
  county: string;
  yearBuilt?: number | null;
}): DcbRiskResult {
  const county = opts.county.trim();
  const yearBuilt = opts.yearBuilt ?? null;

  const inScheme = DCB_SCHEME_COUNTIES.has(county);
  const atRisk = AT_RISK_COUNTIES.has(county);

  if (!inScheme && !atRisk) {
    return {
      riskLevel: 'none',
      isAffectedCounty: false,
      context: `${county} is not in a known defective concrete block affected area.`,
      grantEligible: false,
      grantDetails: null,
      recommendation: 'No DCB-specific due diligence required for this county.',
    };
  }

  const inRiskWindow = yearBuilt !== null && yearBuilt >= HIGH_RISK_YEAR_MIN && yearBuilt <= HIGH_RISK_YEAR_MAX;
  const isOlder = yearBuilt !== null && yearBuilt < HIGH_RISK_YEAR_MIN;

  let riskLevel: DcbRiskResult['riskLevel'];
  let context: string;
  let recommendation: string;

  if (inScheme && inRiskWindow) {
    riskLevel = 'high';
    context = `${county} is a confirmed DCB-affected county. Properties built ${HIGH_RISK_YEAR_MIN}-${HIGH_RISK_YEAR_MAX} have the highest risk of defective concrete blocks (mica/pyrite). Built ${yearBuilt}.`;
    recommendation = 'Strongly recommend independent structural engineer assessment before purchase. Request sight of any existing DCB testing or remediation documentation.';
  } else if (inScheme && !inRiskWindow) {
    riskLevel = yearBuilt !== null && yearBuilt > HIGH_RISK_YEAR_MAX ? 'low' : 'medium';
    context = `${county} is a confirmed DCB-affected county. ${yearBuilt ? `Built ${yearBuilt} — ${yearBuilt > HIGH_RISK_YEAR_MAX ? 'post-peak risk period, lower but not zero risk' : 'pre-peak risk period'}.` : 'Build year unknown — cannot assess year-based risk.'}`;
    recommendation = yearBuilt !== null && yearBuilt > HIGH_RISK_YEAR_MAX
      ? 'DCB risk is lower for post-2010 builds due to improved quality controls, but a structural assessment is still advisable in affected counties.'
      : 'Recommend structural engineer assessment given the county is in a confirmed DCB area.';
  } else if (atRisk && inRiskWindow) {
    riskLevel = 'medium';
    context = `${county} is not yet covered by the DCB Grant Scheme but has reported cases of defective concrete blocks. Built ${yearBuilt} — within the peak risk period.`;
    recommendation = 'Recommend structural engineer assessment. If defective blocks are found, the property may become eligible if the scheme is extended to this county.';
  } else {
    riskLevel = 'low';
    context = `${county} has some reported DCB cases but is not in the confirmed scheme counties. ${yearBuilt ? `Built ${yearBuilt}.` : 'Build year unknown.'}`;
    recommendation = 'Standard structural survey should cover any block deficiency concerns.';
  }

  const grantEligible = inScheme;
  const grantDetails = inScheme
    ? 'DCB Grant Scheme covers up to 100% of remediation costs, capped at €420,000. Administered by the Department of Housing. Application requires independent engineer\'s report confirming defective blocks. Processing times vary by county — Donegal and Mayo have the longest queues.'
    : atRisk
      ? 'Not currently covered by the DCB Grant Scheme. Scheme extensions have been made previously (Clare added 2023, Limerick 2024) — future extensions are possible.'
      : null;

  return {
    riskLevel,
    isAffectedCounty: inScheme || atRisk,
    context,
    grantEligible,
    grantDetails,
    recommendation,
  };
}
