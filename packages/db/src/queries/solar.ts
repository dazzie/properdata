import 'server-only';

export interface SolarPotentialResult {
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

// PVGIS API endpoint (EU Joint Research Centre, free, no key required)
const PVGIS_URL = 'https://re.jrc.ec.europa.eu/api/v5_3/PVcalc';

// Current Irish electricity rate (€/kWh) — update as rates change
const ELECTRICITY_RATE = 0.32;

// System cost per kWp installed (Irish market average 2026)
const COST_PER_KWP = 1_500;

// SEAI Solar PV grant tiers (effective March 2026)
export function calculateSeaiSolarGrant(systemSizeKwp: number): number {
  // €700/kWp for first 2 kWp, €200/kWp for 2-4 kWp, max 4 kWp
  const cappedSize = Math.min(systemSizeKwp, 4);
  if (cappedSize <= 2) {
    return cappedSize * 700;
  }
  return 2 * 700 + (cappedSize - 2) * 200;
}

// Self-consumption ratio — what % of generated electricity is used on-site
// vs exported. Ireland averages ~30-40% self-consumption for a typical home.
const SELF_CONSUMPTION_RATIO = 0.35;
const EXPORT_RATE = 0.185; // Clean Export Guarantee rate (€/kWh)

/**
 * Compute solar PV potential for a given location using PVGIS.
 *
 * Uses crystalline silicon panels at optimal tilt angle for the latitude.
 * Default system size: 4 kWp (typical Irish residential installation).
 */
export async function getSolarPotential(opts: {
  lat: number;
  lng: number;
  systemSizeKwp?: number;
}): Promise<SolarPotentialResult> {
  const systemSize = opts.systemSizeKwp ?? 4;

  const params = new URLSearchParams({
    lat: opts.lat.toFixed(4),
    lon: opts.lng.toFixed(4),
    peakpower: systemSize.toString(),
    loss: '14', // system losses (wiring, inverter, soiling)
    outputformat: 'json',
    pvtechchoice: 'crystSi',
    mountingplace: 'building',
    angle: '35', // optimal tilt for Irish latitudes
    aspect: '0', // south-facing (0° = south in PVGIS convention)
  });

  try {
    const response = await fetch(`${PVGIS_URL}?${params}`, {
      headers: { 'User-Agent': 'ProperData/1.0 (property intelligence)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`PVGIS request failed: ${response.status}`);
    }

    const data = (await response.json()) as {
      outputs: {
        totals: {
          fixed: { E_y: number; 'H(i)_y': number };
        };
        monthly: {
          fixed: Array<{ month: number; E_m: number }>;
        };
      };
    };

    const annualYield = data.outputs.totals.fixed.E_y;
    const yieldPerKwp = annualYield / systemSize;

    const monthlyBreakdown = data.outputs.monthly.fixed.map((m) => ({
      month: m.month,
      yieldKwh: Math.round(m.E_m * 10) / 10,
    }));

    // Financial calculations
    const systemCost = systemSize * COST_PER_KWP;
    const grant = calculateSeaiSolarGrant(systemSize);
    const netCost = systemCost - grant;

    // Annual savings = self-consumed × retail rate + exported × export rate
    const selfConsumed = annualYield * SELF_CONSUMPTION_RATIO;
    const exported = annualYield * (1 - SELF_CONSUMPTION_RATIO);
    const annualSavings = selfConsumed * ELECTRICITY_RATE + exported * EXPORT_RATE;

    const paybackYears = Math.round((netCost / annualSavings) * 10) / 10;
    const lifetimeSavings = annualSavings * 25 - netCost;

    return {
      annualYieldKwh: Math.round(annualYield),
      yieldPerKwp: Math.round(yieldPerKwp),
      systemSizeKwp: systemSize,
      monthlyBreakdown,
      financial: {
        systemCostEstimate: systemCost,
        seaiGrant: grant,
        netCost,
        annualSavings: Math.round(annualSavings),
        paybackYears,
        lifetimeSavings25yr: Math.round(lifetimeSavings),
      },
      context: `A ${systemSize}kWp south-facing system at this location would generate approximately ${Math.round(annualYield).toLocaleString()} kWh/year (${Math.round(yieldPerKwp)} kWh/kWp). After the SEAI grant of €${grant.toLocaleString()}, net installation cost is approximately €${netCost.toLocaleString()} with an estimated payback period of ${paybackYears} years.`,
    };
  } catch (err) {
    console.error('PVGIS solar query failed:', (err as Error).message);
    // Fallback with Irish average yield
    const avgYieldPerKwp = 900;
    const annualYield = avgYieldPerKwp * systemSize;
    const systemCost = systemSize * COST_PER_KWP;
    const grant = calculateSeaiSolarGrant(systemSize);
    const netCost = systemCost - grant;
    const selfConsumed = annualYield * SELF_CONSUMPTION_RATIO;
    const exported = annualYield * (1 - SELF_CONSUMPTION_RATIO);
    const annualSavings = selfConsumed * ELECTRICITY_RATE + exported * EXPORT_RATE;
    const paybackYears = Math.round((netCost / annualSavings) * 10) / 10;

    return {
      annualYieldKwh: annualYield,
      yieldPerKwp: avgYieldPerKwp,
      systemSizeKwp: systemSize,
      monthlyBreakdown: [],
      financial: {
        systemCostEstimate: systemCost,
        seaiGrant: grant,
        netCost,
        annualSavings: Math.round(annualSavings),
        paybackYears,
        lifetimeSavings25yr: Math.round(annualSavings * 25 - netCost),
      },
      context: `Estimated using Irish average solar yield (${avgYieldPerKwp} kWh/kWp). PVGIS data temporarily unavailable — location-specific yield may differ by ±10%.`,
    };
  }
}
