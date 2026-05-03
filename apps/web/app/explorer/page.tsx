'use client';

import { useState, useCallback } from 'react';

interface SaleRow {
  id: number;
  sale_date: string;
  price: string;
  address_raw: string;
  address_normalised: string | null;
  county: string;
  eircode: string | null;
  property_type: string | null;
  is_new: boolean;
  description: string | null;
}

interface StatRow {
  county: string;
  total_sales: string;
  avg_price: string;
  median_price: string;
  min_price: string;
  max_price: string;
  new_build_pct: string;
}

interface TrendRow {
  period: string;
  total_sales: string;
  avg_price: string;
  median_price: string;
}

interface DynamicRow {
  [key: string]: unknown;
}

type ResultData =
  | { type: 'search'; rows: SaleRow[]; total: number }
  | { type: 'stats'; rows: StatRow[] }
  | { type: 'trends'; rows: TrendRow[] }
  | { type: 'dynamic'; rows: DynamicRow[]; title: string; description: string; sql: string };

interface SampleQuery {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  params: Record<string, string>;
  resultType: 'search' | 'stats' | 'trends';
}

const SAMPLE_QUERIES: SampleQuery[] = [
  {
    id: 'dublin-apartments',
    title: 'Dublin Apartments €300k–€500k (2024)',
    description: 'Apartments sold in Dublin between €300,000 and €500,000 in 2024',
    endpoint: '/api/property/search',
    params: {
      county: 'Dublin',
      property_type: 'apartment',
      min_price: '300000',
      max_price: '500000',
      from_date: '2024-01-01',
      to_date: '2024-12-31',
      limit: '50',
    },
    resultType: 'search',
  },
  {
    id: 'cork-houses-2024',
    title: 'Cork Houses Sold in 2024',
    description: 'All house sales in Cork county during 2024',
    endpoint: '/api/property/search',
    params: {
      county: 'Cork',
      from_date: '2024-01-01',
      to_date: '2024-12-31',
      limit: '50',
    },
    resultType: 'search',
  },
  {
    id: 'new-builds-under-400k',
    title: 'New Builds Under €400k (2024)',
    description: 'New-build properties sold for under €400,000 nationwide in 2024',
    endpoint: '/api/property/search',
    params: {
      is_new: 'true',
      max_price: '400000',
      from_date: '2024-01-01',
      to_date: '2024-12-31',
      limit: '50',
    },
    resultType: 'search',
  },
  {
    id: 'county-stats-2024',
    title: 'County Comparison (2024)',
    description: 'Average and median prices by county for 2024',
    endpoint: '/api/property/stats',
    params: { year: '2024' },
    resultType: 'stats',
  },
  {
    id: 'dublin-trends',
    title: 'Dublin Price Trends (Quarterly)',
    description: 'Quarterly median price trends for Dublin',
    endpoint: '/api/property/trends',
    params: { county: 'Dublin', group_by: 'quarter' },
    resultType: 'trends',
  },
  {
    id: 'apartment-trends-national',
    title: 'National Apartment Trends (Yearly)',
    description: 'Year-over-year apartment price trends nationwide',
    endpoint: '/api/property/trends',
    params: { property_type: 'apartment', group_by: 'year' },
    resultType: 'trends',
  },
];

function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  return '€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPropertyType(type: string | null): string {
  if (!type) return '—';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCell(col: string, val: unknown): string {
  if (val == null) return '—';
  const s = String(val);

  if (
    (col === 'price' || col.includes('price') || col.includes('avg') || col.includes('median') || col === 'min_price' || col === 'max_price') &&
    !isNaN(Number(s))
  ) {
    return formatPrice(s);
  }

  if ((col === 'sale_date' || col.endsWith('_date')) && s.includes('T')) {
    return formatDate(s);
  }

  if (col === 'property_type' && typeof val === 'string') {
    return formatPropertyType(val);
  }

  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (col === 'is_new') return s === 'true' ? 'Yes' : 'No';

  return s;
}

export default function ExplorerPage() {
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [result, setResult] = useState<ResultData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');

  const runQuery = useCallback(async (query: SampleQuery) => {
    setActiveQuery(query.id);
    setLoading(true);
    setError(null);
    setResult(null);

    const searchParams = new URLSearchParams(query.params);
    try {
      const res = await fetch(`${query.endpoint}?${searchParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();

      if (query.resultType === 'search') {
        setResult({ type: 'search', rows: data.rows, total: data.total });
      } else if (query.resultType === 'stats') {
        setResult({ type: 'stats', rows: data.rows });
      } else {
        setResult({ type: 'trends', rows: data.rows });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const askQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q) return;

    setActiveQuery('ask');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/property/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult({
        type: 'dynamic',
        rows: data.rows,
        title: data.title,
        description: data.description,
        sql: data.sql,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [question]);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <a href="/" style={styles.logoLink}>ProperData</a>
        <h1 style={styles.title}>Property Explorer</h1>
        <p style={styles.subtitle}>
          Query Irish property sales from the Property Price Register. Ask a question or click a sample query.
        </p>
      </header>

      <section style={styles.askSection}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion();
          }}
          style={styles.askForm}
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything... e.g. &quot;What's the median apartment price in Dublin 2 in 2024?&quot;"
            style={styles.askInput}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            style={{
              ...styles.askButton,
              ...(loading || !question.trim() ? styles.askButtonDisabled : {}),
            }}
          >
            {loading && activeQuery === 'ask' ? 'Asking...' : 'Ask'}
          </button>
        </form>
        <div style={styles.askHints}>
          Try: &quot;Average house price in Galway 2023 vs 2024&quot; &middot; &quot;Top 10 most expensive sales in 2024&quot; &middot; &quot;New build apartments in Cork under 350k&quot;
        </div>
      </section>

      <section style={styles.queryGrid}>
        {SAMPLE_QUERIES.map((q) => (
          <button
            key={q.id}
            onClick={() => runQuery(q)}
            style={{
              ...styles.queryCard,
              ...(activeQuery === q.id ? styles.queryCardActive : {}),
            }}
          >
            <div style={styles.queryCardTitle}>{q.title}</div>
            <div style={styles.queryCardDesc}>{q.description}</div>
            <div style={styles.queryCardBadge}>
              {q.resultType === 'search' ? 'Sales' : q.resultType === 'stats' ? 'Stats' : 'Trends'}
            </div>
          </button>
        ))}
      </section>

      <section style={styles.results}>
        {loading && (
          <div style={styles.loading}>
            <div style={styles.spinner} />
            <span>Querying database...</span>
          </div>
        )}

        {error && (
          <div style={styles.error}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result?.type === 'search' && (
          <div>
            <div style={styles.resultHeader}>
              <h2 style={styles.resultTitle}>
                {SAMPLE_QUERIES.find((q) => q.id === activeQuery)?.title}
              </h2>
              <span style={styles.resultCount}>
                Showing {result.rows.length} of {result.total.toLocaleString()} results
              </span>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Price</th>
                    <th style={styles.th}>Address</th>
                    <th style={styles.th}>County</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>New</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id} style={styles.tr}>
                      <td style={styles.td}>{formatDate(row.sale_date)}</td>
                      <td style={{ ...styles.td, ...styles.tdPrice }}>{formatPrice(row.price)}</td>
                      <td style={styles.td}>{row.address_normalised ?? row.address_raw}</td>
                      <td style={styles.td}>{row.county}</td>
                      <td style={styles.td}>{formatPropertyType(row.property_type)}</td>
                      <td style={styles.td}>{row.is_new ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result?.type === 'stats' && (
          <div>
            <div style={styles.resultHeader}>
              <h2 style={styles.resultTitle}>
                {SAMPLE_QUERIES.find((q) => q.id === activeQuery)?.title}
              </h2>
              <span style={styles.resultCount}>{result.rows.length} counties</span>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>County</th>
                    <th style={styles.th}>Total Sales</th>
                    <th style={styles.th}>Median Price</th>
                    <th style={styles.th}>Avg Price</th>
                    <th style={styles.th}>Min</th>
                    <th style={styles.th}>Max</th>
                    <th style={styles.th}>New Build %</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.county} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{row.county}</td>
                      <td style={styles.td}>{Number(row.total_sales).toLocaleString()}</td>
                      <td style={{ ...styles.td, ...styles.tdPrice }}>{formatPrice(row.median_price)}</td>
                      <td style={styles.td}>{formatPrice(row.avg_price)}</td>
                      <td style={styles.td}>{formatPrice(row.min_price)}</td>
                      <td style={styles.td}>{formatPrice(row.max_price)}</td>
                      <td style={styles.td}>{row.new_build_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result?.type === 'trends' && (
          <div>
            <div style={styles.resultHeader}>
              <h2 style={styles.resultTitle}>
                {SAMPLE_QUERIES.find((q) => q.id === activeQuery)?.title}
              </h2>
              <span style={styles.resultCount}>{result.rows.length} periods</span>
            </div>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Period</th>
                    <th style={styles.th}>Total Sales</th>
                    <th style={styles.th}>Median Price</th>
                    <th style={styles.th}>Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.period} style={styles.tr}>
                      <td style={{ ...styles.td, fontWeight: 600 }}>{row.period}</td>
                      <td style={styles.td}>{Number(row.total_sales).toLocaleString()}</td>
                      <td style={{ ...styles.td, ...styles.tdPrice }}>{formatPrice(row.median_price)}</td>
                      <td style={styles.td}>{formatPrice(row.avg_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result?.type === 'dynamic' && (
          <div>
            <div style={styles.resultHeader}>
              <div>
                <h2 style={styles.resultTitle}>{result.title}</h2>
                <p style={styles.resultDesc}>{result.description}</p>
              </div>
              <span style={styles.resultCount}>{result.rows.length} rows</span>
            </div>
            <details style={styles.sqlDetails}>
              <summary style={styles.sqlSummary}>View SQL</summary>
              <pre style={styles.sqlPre}>{result.sql}</pre>
            </details>
            {result.rows.length > 0 ? (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      {Object.keys(result.rows[0]!).map((col) => (
                        <th key={col} style={styles.th}>
                          {col.replace(/_/g, ' ')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} style={styles.tr}>
                        {Object.entries(row).map(([col, val]) => (
                          <td
                            key={col}
                            style={{
                              ...styles.td,
                              ...(col === 'price' ||
                              col.includes('price') ||
                              col.includes('avg') ||
                              col.includes('median') ||
                              col.includes('min_') ||
                              col.includes('max_')
                                ? styles.tdPrice
                                : {}),
                            }}
                          >
                            {formatCell(col, val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                No results found.
              </p>
            )}
          </div>
        )}

        {!loading && !error && !result && (
          <div style={styles.empty}>
            <p style={styles.emptyText}>Click a sample query above to explore property data</p>
            <p style={styles.emptySubtext}>
              Data sourced from the Property Price Register — all residential sales since 2010
            </p>
          </div>
        )}
      </section>

      <footer style={styles.footer}>
        <p>
          Data source: <a href="https://www.propertypriceregister.ie/" style={styles.footerLink}>Property Price Register</a> (statutory public register).
          ProperData uses only verified public data.
        </p>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '2rem 1.5rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    marginBottom: '2rem',
  },
  logoLink: {
    fontSize: '0.875rem',
    color: '#666',
    textDecoration: 'none',
    fontWeight: 500,
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: '0.5rem 0 0.25rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    margin: 0,
  },
  askSection: {
    marginBottom: '1.5rem',
  },
  askForm: {
    display: 'flex',
    gap: '0.5rem',
  },
  askInput: {
    flex: 1,
    padding: '0.75rem 1rem',
    fontSize: '0.95rem',
    border: '1px solid #d0d0d0',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  askButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    background: '#0070f3',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap' as const,
    transition: 'background 0.15s',
  },
  askButtonDisabled: {
    background: '#a0c4f5',
    cursor: 'not-allowed',
  },
  askHints: {
    fontSize: '0.78rem',
    color: '#999',
    marginTop: '0.5rem',
    lineHeight: 1.5,
  },
  queryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '0.75rem',
    marginBottom: '2rem',
  },
  queryCard: {
    background: '#fff',
    borderWidth: '1px',
    borderStyle: 'solid' as const,
    borderColor: '#e0e0e0',
    borderRadius: '8px',
    padding: '1rem',
    cursor: 'pointer',
    textAlign: 'left' as const,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    position: 'relative' as const,
    fontFamily: 'inherit',
    fontSize: 'inherit',
  },
  queryCardActive: {
    borderColor: '#0070f3',
    boxShadow: '0 0 0 1px #0070f3',
  },
  queryCardTitle: {
    fontSize: '0.95rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
    color: '#1a1a1a',
  },
  queryCardDesc: {
    fontSize: '0.8rem',
    color: '#666',
    lineHeight: 1.4,
  },
  queryCardBadge: {
    position: 'absolute' as const,
    top: '0.75rem',
    right: '0.75rem',
    fontSize: '0.65rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    color: '#0070f3',
    background: '#e8f4ff',
    padding: '2px 6px',
    borderRadius: '4px',
    letterSpacing: '0.04em',
  },
  results: {
    flex: 1,
    minHeight: 300,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    padding: '3rem',
    color: '#666',
  },
  spinner: {
    width: 20,
    height: 20,
    border: '2px solid #e0e0e0',
    borderTopColor: '#0070f3',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite',
  },
  error: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '1rem',
    color: '#991b1b',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '0.75rem',
    flexWrap: 'wrap' as const,
    gap: '0.5rem',
  },
  resultTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: 0,
  },
  resultCount: {
    fontSize: '0.85rem',
    color: '#666',
  },
  tableWrap: {
    overflowX: 'auto' as const,
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.625rem 0.75rem',
    borderBottom: '2px solid #e0e0e0',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
    background: '#fafafa',
    color: '#444',
    fontSize: '0.8rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.03em',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '0.5rem 0.75rem',
    verticalAlign: 'top' as const,
  },
  tdPrice: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap' as const,
  },
  resultDesc: {
    fontSize: '0.85rem',
    color: '#666',
    margin: '0.25rem 0 0',
  },
  sqlDetails: {
    marginBottom: '0.75rem',
  },
  sqlSummary: {
    fontSize: '0.8rem',
    color: '#0070f3',
    cursor: 'pointer',
    fontWeight: 500,
  },
  sqlPre: {
    background: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '0.75rem',
    fontSize: '0.8rem',
    overflowX: 'auto' as const,
    marginTop: '0.5rem',
    lineHeight: 1.5,
    color: '#333',
  },
  empty: {
    textAlign: 'center' as const,
    padding: '4rem 1rem',
    color: '#999',
  },
  emptyText: {
    fontSize: '1.1rem',
    margin: '0 0 0.5rem',
  },
  emptySubtext: {
    fontSize: '0.85rem',
    color: '#bbb',
  },
  footer: {
    marginTop: '3rem',
    paddingTop: '1.5rem',
    borderTop: '1px solid #e0e0e0',
    fontSize: '0.8rem',
    color: '#999',
  },
  footerLink: {
    color: '#666',
    textDecoration: 'underline',
  },
};
