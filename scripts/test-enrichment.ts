/**
 * Smoke test for Sprint 5 enrichment queries.
 *
 * Hits each external API with Mullingar coordinates and prints results.
 * No database required — these are all live API lookups.
 *
 * Run: pnpm tsx scripts/test-enrichment.ts
 */

// Shim server-only for script context
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require.cache[require.resolve('server-only')] = {
  id: 'server-only',
  filename: 'server-only',
  loaded: true,
  exports: {},
} as NodeModule;

import { getRadonRisk } from '../packages/db/src/queries/radon';
import { getSolarPotential } from '../packages/db/src/queries/solar';
import { getWalkabilityScore } from '../packages/db/src/queries/walkability';
import { getDcbRisk } from '../packages/db/src/queries/dcb-risk';

const MULLINGAR = { lat: 53.5253, lng: -7.3398 };

async function testRadon() {
  console.log('\n=== RADON RISK ===');
  const result = await getRadonRisk(MULLINGAR);
  console.log(`  Risk: ${result.riskPercent}% (${result.riskCategory})`);
  console.log(`  Description: ${result.riskDescription}`);
  console.log(`  Context: ${result.context}`);
  console.log(`  Test cost: ${result.testCost}`);
  return result.riskCategory !== 'unknown';
}

async function testSolar() {
  console.log('\n=== SOLAR POTENTIAL ===');
  const result = await getSolarPotential({ ...MULLINGAR, systemSizeKwp: 4 });
  console.log(`  Annual yield: ${result.annualYieldKwh} kWh`);
  console.log(`  Per kWp: ${result.yieldPerKwp} kWh/kWp`);
  console.log(`  System cost: €${result.financial.systemCostEstimate}`);
  console.log(`  SEAI grant: €${result.financial.seaiGrant}`);
  console.log(`  Net cost: €${result.financial.netCost}`);
  console.log(`  Annual savings: €${result.financial.annualSavings}`);
  console.log(`  Payback: ${result.financial.paybackYears} years`);
  console.log(`  25yr savings: €${result.financial.lifetimeSavings25yr}`);
  console.log(`  Months: ${result.monthlyBreakdown.length}`);
  return result.yieldPerKwp >= 800 && result.yieldPerKwp <= 1000;
}

async function testWalkability() {
  console.log('\n=== WALKABILITY ===');
  const result = await getWalkabilityScore({ ...MULLINGAR, persona: 'family' });
  console.log(`  Score: ${result.score}/100 (${result.label})`);
  console.log(`  Summary: ${result.summary}`);
  for (const a of result.amenities) {
    if (a.count > 0) {
      console.log(`    ${a.category}: ${a.count} (nearest: ${a.nearest ?? '?'}m)`);
    }
  }
  return result.score >= 20;
}

function testDcb() {
  console.log('\n=== DCB/MICA RISK ===');

  const donegal = getDcbRisk({ county: 'Donegal', yearBuilt: 2003 });
  console.log(`  Donegal 2003: ${donegal.riskLevel} (grant: ${donegal.grantEligible})`);

  const westmeath = getDcbRisk({ county: 'Westmeath', yearBuilt: 2005 });
  console.log(`  Westmeath 2005: ${westmeath.riskLevel}`);

  const galway = getDcbRisk({ county: 'Galway', yearBuilt: 1995 });
  console.log(`  Galway 1995: ${galway.riskLevel} (grant: ${galway.grantEligible})`);

  const mayo = getDcbRisk({ county: 'Mayo', yearBuilt: 2015 });
  console.log(`  Mayo 2015: ${mayo.riskLevel}`);

  const sligo = getDcbRisk({ county: 'Sligo' });
  console.log(`  Sligo (no year): ${sligo.riskLevel}`);

  return (
    donegal.riskLevel === 'high' &&
    westmeath.riskLevel === 'none' &&
    galway.riskLevel === 'medium' &&
    mayo.riskLevel === 'low'
  );
}

async function main() {
  console.log('ProperData Enrichment Smoke Test');
  console.log('================================');
  console.log(`Location: Mullingar (${MULLINGAR.lat}, ${MULLINGAR.lng})`);

  const results: Array<{ name: string; pass: boolean }> = [];

  // DCB — pure logic, no API
  try {
    results.push({ name: 'DCB/Mica', pass: testDcb() });
  } catch (err) {
    console.error('  FAILED:', (err as Error).message);
    results.push({ name: 'DCB/Mica', pass: false });
  }

  // External API tests
  for (const [name, fn] of [
    ['Radon (EPA WFS)', testRadon],
    ['Solar (PVGIS)', testSolar],
    ['Walkability (Overpass)', testWalkability],
  ] as const) {
    try {
      const pass = await fn();
      results.push({ name, pass });
    } catch (err) {
      console.error(`  FAILED: ${(err as Error).message}`);
      results.push({ name, pass: false });
    }
  }

  console.log('\n================================');
  console.log('Results:');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.name}`);
  }

  const allPass = results.every((r) => r.pass);
  console.log(`\n${allPass ? 'All tests passed.' : 'Some tests failed.'}`);
  process.exit(allPass ? 0 : 1);
}

main();
