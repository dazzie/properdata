'use client';

import { useState, type FormEvent } from 'react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('success');
        setMessage('You\'re in. Watch your inbox.');
        setEmail('');
      } else {
        const data = await res.json();
        setStatus('error');
        setMessage(data.error ?? 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
        placeholder="you@example.com"
        required
        style={{
          flex: '1 1 240px',
          padding: '0.75rem 1rem',
          fontSize: '1rem',
          border: '1px solid #D3D1C7',
          borderRadius: '6px',
          outline: 'none',
        }}
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 600,
          color: '#fff',
          backgroundColor: '#1D9E75',
          border: 'none',
          borderRadius: '6px',
          cursor: status === 'loading' ? 'wait' : 'pointer',
          opacity: status === 'loading' ? 0.7 : 1,
        }}
      >
        {status === 'loading' ? 'Subscribing...' : 'Get free updates'}
      </button>
      {message && (
        <p
          style={{
            width: '100%',
            margin: '0.5rem 0 0',
            fontSize: '0.9rem',
            color: status === 'success' ? '#1D9E75' : '#D85A30',
          }}
        >
          {message}
        </p>
      )}
    </form>
  );
}
