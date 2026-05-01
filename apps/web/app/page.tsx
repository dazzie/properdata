import SubscribeForm from './components/SubscribeForm';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '4rem auto', padding: '0 1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>ProperData</h1>
      <p style={{ fontSize: '1.25rem', color: '#555', marginBottom: '2rem' }}>
        Property intelligence, properly verified.
      </p>

      <p>
        AI-powered Irish property intelligence built entirely on verified public data.
        We cross-reference the Property Price Register, government grants, RTB rents,
        and 15+ public datasets so you don't have to.
      </p>

      <section style={{ marginTop: '2.5rem', padding: '1.5rem', backgroundColor: '#F8F8F6', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.25rem', marginTop: 0, marginBottom: '0.5rem' }}>
          Free weekly property intelligence
        </h2>
        <p style={{ color: '#555', marginBottom: '1rem', fontSize: '0.95rem' }}>
          What actually sold, for how much, and what the data means. No asking prices, no spin.
        </p>
        <SubscribeForm />
      </section>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <a href="/explorer" style={{ color: '#1D9E75', textDecoration: 'underline' }}>
          Explore property data
        </a>
        <a href="https://properdata.substack.com" style={{ color: '#1D9E75', textDecoration: 'underline' }}>
          Read on Substack
        </a>
      </div>
    </main>
  );
}
