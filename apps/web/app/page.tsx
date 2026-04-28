/**
 * Home page — placeholder.
 *
 * In Phase 1-2, the public face of ProperData is Substack. This page exists
 * as a landing page that links to the Substack and explains the product.
 *
 * Sprint 7 (Web App MVP) replaces this with the full town explorer + dashboard.
 */
export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>ProperData</h1>
      <p style={{ fontSize: '1.25rem', color: '#555' }}>Property intelligence, properly verified.</p>
      <p style={{ marginTop: '2rem' }}>
        AI-powered Irish property intelligence built entirely on verified public data.
      </p>
      <p style={{ marginTop: '1rem' }}>
        <a
          href="https://properdata.substack.com"
          style={{ color: '#0070f3', textDecoration: 'underline' }}
        >
          Read the latest on Substack →
        </a>
      </p>
    </main>
  );
}
