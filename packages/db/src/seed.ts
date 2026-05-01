/**
 * Database seed.
 *
 * Run with: pnpm --filter @properdata/db seed
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so re-running is safe.
 *
 * Uses seed-client.ts instead of client.ts to avoid the 'server-only'
 * import which fails outside Next.js context.
 */

import { db } from './seed-client';
import { towns, grantSchemes, type NewTown } from './schema';
import { sql } from 'drizzle-orm';

async function seedTowns() {
  console.log('Seeding towns...');

  const initialTowns: NewTown[] = [
    {
      slug: 'mullingar',
      name: 'Mullingar',
      county: 'Westmeath',
      centroid: { lng: -7.3398, lat: 53.5253 },
      radiusMeters: 4000,
      population2022: 22667,
      eircodeRoutingKey: 'N91',
      coverageStartedAt: '2026-04-28',
      isActive: true,
    },
    {
      slug: 'athlone',
      name: 'Athlone',
      county: 'Westmeath',
      centroid: { lng: -7.9407, lat: 53.4239 },
      radiusMeters: 5000,
      population2022: 21349,
      eircodeRoutingKey: 'N37',
      coverageStartedAt: '2026-04-28',
      isActive: true,
    },
    {
      slug: 'tullamore',
      name: 'Tullamore',
      county: 'Offaly',
      centroid: { lng: -7.4906, lat: 53.2735 },
      radiusMeters: 4000,
      population2022: 14607,
      eircodeRoutingKey: 'R35',
      coverageStartedAt: '2026-04-28',
      isActive: true,
    },
    {
      slug: 'longford',
      name: 'Longford',
      county: 'Longford',
      centroid: { lng: -7.7982, lat: 53.7274 },
      radiusMeters: 3500,
      population2022: 10952,
      eircodeRoutingKey: 'N39',
      coverageStartedAt: '2026-04-30',
      isActive: true,
    },
    {
      slug: 'portlaoise',
      name: 'Portlaoise',
      county: 'Laois',
      centroid: { lng: -7.2993, lat: 53.0343 },
      radiusMeters: 4000,
      population2022: 23041,
      eircodeRoutingKey: 'R32',
      coverageStartedAt: '2026-04-30',
      isActive: true,
    },
    {
      slug: 'carrick-on-shannon',
      name: 'Carrick-on-Shannon',
      county: 'Leitrim',
      centroid: { lng: -8.0900, lat: 53.9469 },
      radiusMeters: 3000,
      population2022: 4062,
      eircodeRoutingKey: 'N41',
      coverageStartedAt: '2026-04-30',
      isActive: true,
    },
  ];

  for (const town of initialTowns) {
    await db.insert(towns).values(town).onConflictDoNothing({ target: towns.slug });
  }

  console.log(`  ${initialTowns.length} towns seeded`);
}

async function seedGrantSchemes() {
  console.log('Seeding grant schemes...');

  const schemes = [
    // ---- SEAI Energy Grants ----
    {
      code: 'SEAI_ATTIC_INSULATION',
      name: 'SEAI Attic Insulation Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '2000',
      description:
        'Grant for attic insulation. Amount varies by dwelling type: apartment €800, mid-terrace €1,200, semi-detached/end-terrace €1,300, detached €2,000.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_CAVITY_WALL',
      name: 'SEAI Cavity Wall Insulation Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '1800',
      description:
        'Grant for cavity wall insulation. Amount varies by dwelling type: apartment €700, mid-terrace €800, semi-detached €1,200, detached €1,800.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_EXTERNAL_WALL',
      name: 'SEAI External Wall Insulation Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '8000',
      description:
        'Grant for external wall insulation. Amount varies: apartment €3,000, mid-terrace €3,500, semi-detached €6,000, detached €8,000.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_INTERNAL_WALL',
      name: 'SEAI Internal Wall Insulation Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '4500',
      description:
        'Grant for internal wall insulation. Amount varies: apartment €1,500, mid-terrace €2,000, semi-detached €3,500, detached €4,500.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_FLOOR_INSULATION',
      name: 'SEAI Floor Insulation Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '3500',
      description: 'Grant for floor insulation in houses.',
      eligibilityRules: { maxBuildYear: 2010, propertyType: ['detached', 'semi_detached', 'terraced', 'bungalow'] },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/insulation-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_HEAT_PUMP',
      name: 'SEAI Heat Pump System Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '12500',
      description:
        'Combined grant for heat pump system: €6,500 pump + €2,000 central heating upgrade + €4,000 renewable bonus (when replacing fossil fuel system). Total €12,500.',
      eligibilityRules: { maxBuildYear: 2020 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/heat-pump-systems/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_HEATING_CONTROLS',
      name: 'SEAI Heating Controls Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '700',
      description: 'Grant for smart heating controls upgrade.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/heating-controls-grant/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_SOLAR_PV',
      name: 'SEAI Solar PV Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '1800',
      description: 'Grant for solar PV installation: €900 per kWp up to 2kWp.',
      eligibilityRules: { maxBuildYear: 2020 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/solar-electricity-grant/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_SOLAR_THERMAL',
      name: 'SEAI Solar Thermal Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '1200',
      description: 'Grant for solar thermal (hot water) panel installation.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/solar-water-heating-grant/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },
    {
      code: 'SEAI_WINDOWS_DOORS',
      name: 'SEAI Windows and Doors Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '5600',
      description:
        'Grant for window and door replacement: €4,000 for windows + €1,600 for doors. Available from March 2026. Requires building fabric to meet minimum standard.',
      eligibilityRules: { maxBuildYear: 2010 },
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/',
      effectiveFrom: '2026-03-01',
      isActive: true,
    },
    {
      code: 'SEAI_BER_ASSESSMENT',
      name: 'SEAI BER Assessment Grant',
      provider: 'SEAI',
      category: 'energy',
      maxAmount: '50',
      description: 'Grant towards BER assessment after any SEAI-funded energy upgrade.',
      eligibilityRules: {},
      sourceUrl: 'https://www.seai.ie/grants/home-energy-grants/',
      effectiveFrom: '2026-02-01',
      isActive: true,
    },

    // ---- Vacancy and Dereliction ----
    {
      code: 'CROI_CONAITHE_VACANT',
      name: 'Croi Conaithe Vacant Property Refurbishment Grant',
      provider: 'Department of Housing',
      category: 'vacancy',
      maxAmount: '50000',
      description:
        'Grant for refurbishment of properties vacant for 2+ years, for owner-occupiers or rental. Max 2 grants per applicant (1 for rental). Administered by local authority.',
      eligibilityRules: { vacancyMinYears: 2 },
      sourceUrl: 'https://www.gov.ie/en/service/0e9c0-vacant-property-refurbishment-grant/',
      effectiveFrom: '2022-07-14',
      isActive: true,
    },
    {
      code: 'CROI_CONAITHE_DERELICT',
      name: 'Croi Conaithe Derelict Property Top-up',
      provider: 'Department of Housing',
      category: 'vacancy',
      maxAmount: '20000',
      description:
        'Additional €20,000 top-up on the Vacant grant for properties that are structurally unsound, bringing total to €70,000. Requires independent building survey.',
      eligibilityRules: { vacancyMinYears: 2 },
      sourceUrl: 'https://www.gov.ie/en/service/0e9c0-vacant-property-refurbishment-grant/',
      effectiveFrom: '2022-07-14',
      isActive: true,
    },

    // ---- Purchase Support ----
    {
      code: 'HTB',
      name: 'Help to Buy',
      provider: 'Revenue',
      category: 'purchase',
      maxAmount: '30000',
      description:
        'Tax rebate of up to €30,000 (10% of purchase price, max €500K) for first-time buyers of new builds or self-builds. Rebate of income tax and DIRT paid over previous 4 years. Extended to December 2029.',
      eligibilityRules: {
        buyerType: ['first_time_buyer'],
        maxPropertyValue: 500000,
      },
      sourceUrl: 'https://www.revenue.ie/en/property/help-to-buy-incentive/',
      effectiveFrom: '2017-01-01',
      effectiveTo: '2029-12-31',
      isActive: true,
    },
    {
      code: 'FIRST_HOME_SCHEME',
      name: 'First Home Scheme',
      provider: 'First Home Scheme Ireland DAC',
      category: 'purchase',
      maxAmount: null,
      description:
        'Shared equity scheme: state takes up to 30% equity stake (20% if combined with HTB). New builds only, with regional price ceilings reviewed every 6 months.',
      eligibilityRules: {
        buyerType: ['first_time_buyer'],
      },
      sourceUrl: 'https://www.firsthomescheme.ie/',
      isActive: true,
    },

    // ---- Tax Relief ----
    {
      code: 'LANDLORD_RETROFIT_DEDUCTION',
      name: 'Landlord Retrofit Tax Deduction',
      provider: 'Revenue',
      category: 'tax',
      maxAmount: '10000',
      description:
        'Tax deduction of up to €10,000 per property (max 3 properties) for retrofit expenses net of SEAI grant, deductible against rental income. Covers 2024-2028.',
      eligibilityRules: {
        buyerType: ['non_occupier'],
      },
      sourceUrl: 'https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-04/04-08-09.pdf',
      effectiveFrom: '2024-01-01',
      effectiveTo: '2028-12-31',
      isActive: true,
    },

    // ---- Remediation ----
    {
      code: 'DCB_REMEDIATION',
      name: 'Defective Concrete Blocks Grant Scheme',
      provider: 'Department of Housing',
      category: 'remediation',
      maxAmount: '420000',
      description:
        'Grant for remediation of homes affected by defective concrete blocks (mica/pyrite). Primarily Donegal, Mayo, Clare, Limerick. Can be combined with SEAI energy grants.',
      eligibilityRules: {},
      sourceUrl: 'https://www.gov.ie/en/publication/9bb13-defective-concrete-blocks-grant-scheme/',
      isActive: true,
    },

    // ---- Adaptation Grants ----
    {
      code: 'HOUSING_ADAPTATION_OLDER',
      name: 'Housing Adaptation Grant for People with a Disability',
      provider: 'Local Authority',
      category: 'adaptation',
      maxAmount: '30000',
      description:
        'Grant of up to 95% of cost (max €30,000) for adaptations to make a home more suitable for a person with a physical, sensory, or intellectual disability. Means-tested.',
      eligibilityRules: {},
      sourceUrl: 'https://www.citizensinformation.ie/en/housing/housing-grants-and-schemes/housing-adaptation-grant-for-people-with-disability/',
      isActive: true,
    },
    {
      code: 'HOUSING_AID_OLDER_PEOPLE',
      name: 'Housing Aid for Older People',
      provider: 'Local Authority',
      category: 'adaptation',
      maxAmount: '8000',
      description:
        'Grant of up to 100% of cost (max €8,000) for essential repairs (roofing, wiring, plumbing) for people aged 66+. Means-tested.',
      eligibilityRules: {},
      sourceUrl: 'https://www.citizensinformation.ie/en/housing/housing-grants-and-schemes/housing-aid-for-older-persons-grant/',
      isActive: true,
    },
    {
      code: 'MOBILITY_AIDS_GRANT',
      name: 'Mobility Aids Grant',
      provider: 'Local Authority',
      category: 'adaptation',
      maxAmount: '6000',
      description:
        'Grant of up to 100% of cost (max €6,000) for mobility aids: grab-rails, ramps, level-access showers. Means-tested.',
      eligibilityRules: {},
      sourceUrl: 'https://www.citizensinformation.ie/en/housing/housing-grants-and-schemes/mobility-aids-grant-scheme/',
      isActive: true,
    },
  ];

  for (const scheme of schemes) {
    await db
      .insert(grantSchemes)
      .values(scheme as typeof grantSchemes.$inferInsert)
      .onConflictDoNothing({ target: grantSchemes.code });
  }

  console.log(`  ${schemes.length} grant schemes seeded`);
}

async function main() {
  console.log('Starting seed...\n');
  await seedTowns();
  await seedGrantSchemes();

  const townCount = await db.select({ count: sql<number>`count(*)` }).from(towns);
  const grantCount = await db.select({ count: sql<number>`count(*)` }).from(grantSchemes);

  console.log(`\nDatabase state:`);
  console.log(`  towns: ${townCount[0]?.count ?? 0}`);
  console.log(`  grant_schemes: ${grantCount[0]?.count ?? 0}`);
  console.log('\nSeed complete');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
