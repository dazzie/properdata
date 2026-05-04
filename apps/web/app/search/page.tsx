'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const COUNTIES = [
  'Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway',
  'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick',
  'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly',
  'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath',
  'Wexford', 'Wicklow',
];

const PROPERTY_TYPES = [
  { value: 'detached', label: 'Detached' },
  { value: 'semi_detached', label: 'Semi-detached' },
  { value: 'terraced', label: 'Terraced' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'duplex', label: 'Duplex' },
  { value: 'bungalow', label: 'Bungalow' },
];

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'Newest first' },
  { value: 'date_asc', label: 'Oldest first' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_asc', label: 'Price: low to high' },
];

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
  lat: number | null;
  lng: number | null;
}

function eur(n: number | null | undefined): string {
  if (n == null) return '—';
  return '€' + n.toLocaleString('en-IE', { maximumFractionDigits: 0 });
}

function formatType(t: string | null): string {
  if (!t || t === 'unknown') return '—';
  return t.replace(/_/g, '-').replace(/\b\w/g, (c) => c.toUpperCase());
}

const LIMIT = 50;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const S = {
  page: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
  } as React.CSSProperties,
  header: {
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    color: '#666',
    fontSize: '0.95rem',
    marginTop: '0.25rem',
  } as React.CSSProperties,
  backLink: {
    color: '#1D9E75',
    textDecoration: 'none',
    fontSize: '0.85rem',
    display: 'inline-block',
    marginBottom: '1rem',
  } as React.CSSProperties,
  searchBar: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  searchInput: {
    flex: 1,
    padding: '0.625rem 0.75rem',
    fontSize: '0.95rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    outline: 'none',
  } as React.CSSProperties,
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap' as const,
    marginBottom: '1.25rem',
    alignItems: 'flex-end',
  } as React.CSSProperties,
  filterGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.2rem',
    minWidth: 0,
  } as React.CSSProperties,
  filterLabel: {
    fontSize: '0.7rem',
    color: '#888',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    fontWeight: 600,
  } as React.CSSProperties,
  select: {
    padding: '0.5rem 0.625rem',
    fontSize: '0.85rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    background: '#fff',
    minWidth: 120,
  } as React.CSSProperties,
  input: {
    padding: '0.5rem 0.625rem',
    fontSize: '0.85rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    width: 110,
  } as React.CSSProperties,
  dateInput: {
    padding: '0.5rem 0.625rem',
    fontSize: '0.85rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    width: 140,
  } as React.CSSProperties,
  btn: {
    padding: '0.5rem 1.25rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#fff',
    background: '#1D9E75',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,
  btnSecondary: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    color: '#666',
    background: '#f5f5f5',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    cursor: 'pointer',
  } as React.CSSProperties,
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
    fontSize: '0.85rem',
    color: '#666',
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.875rem',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.625rem 0.75rem',
    borderBottom: '2px solid #e5e5e5',
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
    color: '#888',
    fontWeight: 600,
  } as React.CSSProperties,
  td: {
    padding: '0.625rem 0.75rem',
    borderBottom: '1px solid #f0f0f0',
  } as React.CSSProperties,
  row: {
    cursor: 'pointer',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  price: {
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  date: {
    color: '#666',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  type: {
    color: '#888',
    fontSize: '0.8rem',
  } as React.CSSProperties,
  newBadge: {
    display: 'inline-block',
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    background: '#dcfce7',
    color: '#166534',
    marginLeft: '0.35rem',
    verticalAlign: 'middle',
  } as React.CSSProperties,
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.35rem',
    marginTop: '1.25rem',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  pageBtn: {
    padding: '0.35rem 0.65rem',
    border: '1px solid #d4d4d4',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    color: '#333',
  } as React.CSSProperties,
  pageBtnActive: {
    padding: '0.35rem 0.65rem',
    border: '1px solid #1D9E75',
    borderRadius: '4px',
    background: '#1D9E75',
    color: '#fff',
    cursor: 'default',
    fontSize: '0.85rem',
    fontWeight: 600,
  } as React.CSSProperties,
  pageBtnDisabled: {
    padding: '0.35rem 0.65rem',
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    background: '#fafafa',
    color: '#ccc',
    cursor: 'default',
    fontSize: '0.85rem',
  } as React.CSSProperties,
  empty: {
    textAlign: 'center' as const,
    padding: '3rem 1rem',
    color: '#888',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '3rem 1rem',
    color: '#888',
  } as React.CSSProperties,
  error: {
    padding: '1rem',
    borderRadius: '6px',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  footer: {
    marginTop: '2rem',
    paddingTop: '1rem',
    borderTop: '1px solid #e5e5e5',
    fontSize: '0.75rem',
    color: '#aaa',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [address, setAddress] = useState('');
  const [county, setCounty] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [isNew, setIsNew] = useState('');
  const [sort, setSort] = useState('date_desc');

  const [results, setResults] = useState<SaleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const doSearch = useCallback(
    async (pageNum: number, sortVal: string) => {
      setLoading(true);
      setError(null);

      const qp = new URLSearchParams();
      if (address) qp.set('address_search', address);
      if (county) qp.set('county', county);
      if (minPrice) qp.set('min_price', minPrice);
      if (maxPrice) qp.set('max_price', maxPrice);
      if (fromDate) qp.set('from_date', fromDate);
      if (toDate) qp.set('to_date', toDate);
      if (propertyType) qp.set('property_type', propertyType);
      if (isNew) qp.set('is_new', isNew);
      qp.set('sort', sortVal);
      qp.set('limit', String(LIMIT));
      qp.set('offset', String((pageNum - 1) * LIMIT));

      try {
        const res = await fetch(`/api/property/search?${qp}`);
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const data = await res.json() as { rows: SaleRow[]; total: number };
        setResults(data.rows);
        setTotal(data.total);
        setSearched(true);

        // sync URL
        const urlParams = new URLSearchParams();
        if (address) urlParams.set('q', address);
        if (county) urlParams.set('county', county);
        if (minPrice) urlParams.set('min', minPrice);
        if (maxPrice) urlParams.set('max', maxPrice);
        if (fromDate) urlParams.set('from', fromDate);
        if (toDate) urlParams.set('to', toDate);
        if (propertyType) urlParams.set('type', propertyType);
        if (isNew) urlParams.set('new', isNew);
        if (sortVal !== 'date_desc') urlParams.set('sort', sortVal);
        if (pageNum > 1) urlParams.set('page', String(pageNum));
        const qs = urlParams.toString();
        router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [address, county, minPrice, maxPrice, fromDate, toDate, propertyType, isNew, router],
  );

  // Initialise from URL params on mount
  useEffect(() => {
    const q = searchParams.get('q');
    const c = searchParams.get('county');
    const mn = searchParams.get('min');
    const mx = searchParams.get('max');
    const fr = searchParams.get('from');
    const to = searchParams.get('to');
    const tp = searchParams.get('type');
    const nw = searchParams.get('new');
    const so = searchParams.get('sort');
    const pg = searchParams.get('page');

    if (q) setAddress(q);
    if (c) setCounty(c);
    if (mn) setMinPrice(mn);
    if (mx) setMaxPrice(mx);
    if (fr) setFromDate(fr);
    if (to) setToDate(to);
    if (tp) setPropertyType(tp);
    if (nw) setIsNew(nw);
    if (so) setSort(so);

    const hasParams = q || c || mn || mx || fr || to || tp || nw;
    if (hasParams) {
      // Need to set state before searching — use a microtask
      const pageNum = Number(pg) || 1;
      const sortVal = so ?? 'date_desc';
      setTimeout(() => {
        setPage(pageNum);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-search when page loads with URL params (fires after state is set)
  useEffect(() => {
    const hasParams = searchParams.get('q') || searchParams.get('county') ||
      searchParams.get('min') || searchParams.get('max') ||
      searchParams.get('from') || searchParams.get('to') ||
      searchParams.get('type') || searchParams.get('new');
    if (hasParams && !searched && !loading) {
      const pg = Number(searchParams.get('page')) || 1;
      const so = searchParams.get('sort') ?? 'date_desc';
      void doSearch(pg, so);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, county, minPrice, maxPrice, fromDate, toDate, propertyType, isNew]);

  function handleSearch() {
    setPage(1);
    void doSearch(1, sort);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
    void doSearch(newPage, sort);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSortChange(newSort: string) {
    setSort(newSort);
    setPage(1);
    void doSearch(1, newSort);
  }

  function handleClear() {
    setAddress('');
    setCounty('');
    setMinPrice('');
    setMaxPrice('');
    setFromDate('');
    setToDate('');
    setPropertyType('');
    setIsNew('');
    setSort('date_desc');
    setResults([]);
    setTotal(0);
    setPage(1);
    setSearched(false);
    setError(null);
    router.replace('/search', { scroll: false });
  }

  function goToAnalyse(row: SaleRow) {
    const params = new URLSearchParams();
    params.set('address', row.address_normalised ?? row.address_raw);
    params.set('county', row.county ?? '');
    params.set('purchasePrice', String(Math.round(Number(row.price))));
    if (row.property_type && row.property_type !== 'unknown') {
      params.set('propertyType', row.property_type);
    }
    if (row.eircode) params.set('eircode', row.eircode);
    router.push(`/analyse?${params}`);
  }

  // Pagination range
  function pageRange(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const from = (page - 1) * LIMIT + 1;
  const to = Math.min(page * LIMIT, total);

  return (
    <div style={S.page}>
      <a href="/" style={S.backLink}>&larr; ProperData</a>
      <header style={S.header}>
        <h1 style={S.title}>Property Search</h1>
        <p style={S.subtitle}>Search {total > 0 ? total.toLocaleString() : ''} sold properties from the Property Price Register</p>
      </header>

      {/* Search bar */}
      <div style={S.searchBar}>
        <input
          type="text"
          placeholder="Search by address, town, or eircode..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={S.searchInput}
        />
        <button onClick={handleSearch} style={S.btn} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Filters */}
      <div style={S.filterRow}>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>County</span>
          <select value={county} onChange={(e) => setCounty(e.target.value)} style={S.select}>
            <option value="">All counties</option>
            {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Min price</span>
          <input type="number" placeholder="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={S.input} />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Max price</span>
          <input type="number" placeholder="No max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={S.input} />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>From date</span>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={S.dateInput} />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>To date</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={S.dateInput} />
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Type</span>
          <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} style={S.select}>
            <option value="">All types</option>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div style={S.filterGroup}>
          <span style={S.filterLabel}>Build</span>
          <select value={isNew} onChange={(e) => setIsNew(e.target.value)} style={{ ...S.select, minWidth: 100 }}>
            <option value="">All</option>
            <option value="true">New builds</option>
            <option value="false">Second-hand</option>
          </select>
        </div>
        <button onClick={handleClear} style={S.btnSecondary}>Clear</button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      {/* Results */}
      {searched && !loading && results.length === 0 && (
        <div style={S.empty}>No properties found matching your search.</div>
      )}

      {searched && results.length > 0 && (
        <>
          <div style={S.resultsHeader}>
            <span>Showing {from.toLocaleString()}&ndash;{to.toLocaleString()} of {total.toLocaleString()} results</span>
            <select value={sort} onChange={(e) => handleSortChange(e.target.value)} style={{ ...S.select, minWidth: 150 }}>
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Address</th>
                <th style={S.th}>Price</th>
                <th style={S.th}>Date</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>County</th>
                <th style={S.th}>Eircode</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  style={S.row}
                  onClick={() => goToAnalyse(r)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8f8f6'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
                >
                  <td style={S.td}>
                    {r.address_normalised ?? r.address_raw}
                    {r.is_new && <span style={S.newBadge}>NEW</span>}
                  </td>
                  <td style={{ ...S.td, ...S.price }}>{eur(Number(r.price))}</td>
                  <td style={{ ...S.td, ...S.date }}>
                    {new Date(r.sale_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ ...S.td, ...S.type }}>{formatType(r.property_type)}</td>
                  <td style={S.td}>{r.county}</td>
                  <td style={{ ...S.td, color: '#888', fontSize: '0.8rem' }}>{r.eircode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={S.pagination}>
              <button
                style={page === 1 ? S.pageBtnDisabled : S.pageBtn}
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
              >
                Previous
              </button>
              {pageRange().map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} style={{ padding: '0 0.25rem', color: '#aaa' }}>&hellip;</span>
                ) : (
                  <button
                    key={p}
                    style={p === page ? S.pageBtnActive : S.pageBtn}
                    onClick={() => p !== page && handlePageChange(p)}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                style={page === totalPages ? S.pageBtnDisabled : S.pageBtn}
                disabled={page === totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {loading && <div style={S.loading}>Searching...</div>}

      <div style={S.footer}>
        Data source: Property Price Register (psr.ie). Updated weekly. All prices as recorded at time of sale.
      </div>
    </div>
  );
}
