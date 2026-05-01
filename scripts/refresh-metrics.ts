import { db } from '../packages/db/src/seed-client';
import { sql } from '../packages/db/src/index';

async function main() {
  console.log('Sales statistics:\n');

  const total = await db.execute(sql`SELECT count(*) FROM sales`);
  console.log(`Total sales: ${total.rows[0]?.count}`);

  const withNorm = await db.execute(sql`SELECT count(*) FROM sales WHERE address_normalised IS NOT NULL`);
  console.log(`Normalised: ${withNorm.rows[0]?.count}`);

  const withTown = await db.execute(sql`SELECT count(*) FROM sales WHERE town_id IS NOT NULL`);
  console.log(`With town: ${withTown.rows[0]?.count}`);

  // Top counties by count
  const counties = await db.execute(sql`
    SELECT county, count(*) as cnt,
           round(avg(price::numeric)) as avg_price,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price
    FROM sales
    GROUP BY county
    ORDER BY cnt DESC
    LIMIT 10
  `);
  console.log('\nTop 10 counties:');
  for (const r of counties.rows) {
    console.log(`  ${r.county}: ${r.cnt} sales, avg €${Number(r.avg_price).toLocaleString()}, median €${Number(r.median_price).toLocaleString()}`);
  }

  // Sales by year
  const years = await db.execute(sql`
    SELECT extract(year from sale_date::date) as year, count(*) as cnt,
           round(percentile_cont(0.5) WITHIN GROUP (ORDER BY price::numeric)) as median_price
    FROM sales
    GROUP BY year
    ORDER BY year
  `);
  console.log('\nSales by year:');
  for (const r of years.rows) {
    console.log(`  ${r.year}: ${r.cnt} sales, median €${Number(r.median_price).toLocaleString()}`);
  }

  // DB size
  const size = await db.execute(sql`SELECT pg_size_pretty(pg_database_size(current_database())) as size`);
  console.log(`\nDatabase size: ${size.rows[0]?.size}`);
}

main().catch(console.error);
