'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKeyInfo {
  id: number;
  key_prefix: string;
  name: string;
  credits_remaining: number;
  credits_purchased: number;
  tier: string;
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface UsageRow {
  id: number;
  endpoint: string;
  credits_used: number;
  response_status: number;
  latency_ms: number | null;
  ip_address: string | null;
  created_at: string;
}

const S = {
  page: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#1a1a1a',
  } as React.CSSProperties,
  backLink: {
    color: '#1D9E75',
    textDecoration: 'none',
    fontSize: '0.85rem',
    display: 'inline-block',
    marginBottom: '1rem',
  } as React.CSSProperties,
  title: { fontSize: '1.75rem', fontWeight: 700, margin: 0 } as React.CSSProperties,
  subtitle: { color: '#666', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: '1.5rem' } as React.CSSProperties,
  card: {
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '1.25rem',
    background: '#fff',
  } as React.CSSProperties,
  cardTitle: { fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' } as React.CSSProperties,
  statsRow: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,
  stat: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.15rem',
  } as React.CSSProperties,
  statVal: { fontSize: '1.5rem', fontWeight: 700 } as React.CSSProperties,
  statLabel: { fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' as const, letterSpacing: '0.04em' } as React.CSSProperties,
  keyBox: {
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    padding: '0.5rem 0.75rem',
    background: '#f8f8f6',
    borderRadius: '4px',
    border: '1px solid #e5e5e5',
    marginBottom: '0.75rem',
  } as React.CSSProperties,
  btn: {
    padding: '0.5rem 1rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#fff',
    background: '#1D9E75',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '0.5rem',
  } as React.CSSProperties,
  btnSmall: {
    padding: '0.35rem 0.75rem',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#666',
    background: '#f5f5f5',
    border: '1px solid #d4d4d4',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '0.35rem',
  } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8rem' } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem 0.5rem',
    borderBottom: '2px solid #e5e5e5',
    fontSize: '0.7rem',
    textTransform: 'uppercase' as const,
    color: '#888',
    fontWeight: 600,
  } as React.CSSProperties,
  td: { padding: '0.5rem', borderBottom: '1px solid #f0f0f0' } as React.CSSProperties,
  statusOk: { color: '#16a34a', fontWeight: 600 } as React.CSSProperties,
  statusErr: { color: '#dc2626', fontWeight: 600 } as React.CSSProperties,
  input: {
    padding: '0.5rem 0.625rem',
    fontSize: '0.85rem',
    border: '1px solid #d4d4d4',
    borderRadius: '6px',
    width: '100%',
    maxWidth: 300,
    marginBottom: '1rem',
  } as React.CSSProperties,
  alert: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#dcfce7',
    color: '#166534',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  error: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '0.85rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
};

const CREDIT_PACKS = [
  { pack: '10', credits: 10, price: '€49', perReport: '€4.90' },
  { pack: '50', credits: 50, price: '€199', perReport: '€3.98' },
  { pack: '200', credits: 200, price: '€649', perReport: '€3.25' },
];

export default function DashboardPage() {
  const [masterKey, setMasterKey] = useState('');
  const [authed, setAuthed] = useState(false);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [selectedKey, setSelectedKey] = useState<ApiKeyInfo | null>(null);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyCredits, setNewKeyCredits] = useState('10');

  const headers = useCallback(
    () => ({ Authorization: `Bearer ${masterKey}`, 'Content-Type': 'application/json' }),
    [masterKey],
  );

  const loadKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/keys', { headers: headers() });
      if (!res.ok) throw new Error('Failed to load keys');
      const data = await res.json() as { keys: ApiKeyInfo[] };
      setKeys(data.keys);
      if (data.keys.length > 0 && !selectedKey) {
        setSelectedKey(data.keys[0]!);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [headers, selectedKey]);

  const loadUsage = useCallback(async (keyId: number) => {
    try {
      const res = await fetch(`/api/v1/usage?api_key_id=${keyId}`, { headers: headers() });
      if (!res.ok) throw new Error('Failed to load usage');
      const data = await res.json() as { usage: UsageRow[] };
      setUsage(data.usage);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [headers]);

  useEffect(() => {
    if (authed) {
      void loadKeys();
    }
  }, [authed, loadKeys]);

  useEffect(() => {
    if (selectedKey && authed) {
      void loadUsage(selectedKey.id);
    }
  }, [selectedKey, authed, loadUsage]);

  async function handleLogin() {
    setError(null);
    try {
      const res = await fetch('/api/v1/keys', { headers: { Authorization: `Bearer ${masterKey}` } });
      if (!res.ok) { setError('Invalid master key'); return; }
      setAuthed(true);
    } catch {
      setError('Connection failed');
    }
  }

  async function createKey() {
    if (!newKeyName) { setError('Key name is required'); return; }
    setError(null);
    try {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: newKeyName, credits: Number(newKeyCredits) || 0 }),
      });
      const data = await res.json() as { key?: string; error?: string };
      if (!res.ok) { setError(data.error ?? 'Failed'); return; }
      setAlert(`Key created: ${data.key} — copy this now, it won't be shown again.`);
      setNewKeyName('');
      void loadKeys();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function revokeKey(id: number) {
    try {
      await fetch(`/api/v1/keys/${id}`, { method: 'DELETE', headers: headers() });
      void loadKeys();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!authed) {
    return (
      <div style={S.page}>
        <a href="/" style={S.backLink}>&larr; ProperData</a>
        <h1 style={S.title}>API Dashboard</h1>
        <p style={S.subtitle}>Enter your master key to manage API keys and view usage.</p>
        {error && <div style={S.error}>{error}</div>}
        <input
          type="password"
          placeholder="Master key..."
          value={masterKey}
          onChange={(e) => setMasterKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          style={S.input}
        />
        <br />
        <button onClick={handleLogin} style={S.btn}>Login</button>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <a href="/" style={S.backLink}>&larr; ProperData</a>
      <h1 style={S.title}>API Dashboard</h1>
      <p style={S.subtitle}>Manage API keys, purchase credits, and monitor usage.</p>

      {error && <div style={S.error}>{error}</div>}
      {alert && <div style={S.alert}>{alert}</div>}

      {/* Active key overview */}
      {selectedKey && (
        <div style={S.card}>
          <div style={S.cardTitle}>{selectedKey.name}</div>
          <div style={S.keyBox}>{selectedKey.key_prefix}{'•'.repeat(24)}</div>
          <div style={S.statsRow}>
            <div style={S.stat}>
              <span style={{ ...S.statVal, color: selectedKey.credits_remaining > 0 ? '#16a34a' : '#dc2626' }}>
                {selectedKey.credits_remaining}
              </span>
              <span style={S.statLabel}>Credits remaining</span>
            </div>
            <div style={S.stat}>
              <span style={S.statVal}>{selectedKey.credits_purchased}</span>
              <span style={S.statLabel}>Total purchased</span>
            </div>
            <div style={S.stat}>
              <span style={S.statVal}>{selectedKey.rate_limit_per_minute}/min</span>
              <span style={S.statLabel}>Rate limit</span>
            </div>
            <div style={S.stat}>
              <span style={S.statVal}>{selectedKey.tier}</span>
              <span style={S.statLabel}>Tier</span>
            </div>
          </div>
        </div>
      )}

      {/* Credit packs */}
      <div style={S.card}>
        <div style={S.cardTitle}>Buy Credits</div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {CREDIT_PACKS.map((p) => (
            <div key={p.pack} style={{
              border: '1px solid #e5e5e5',
              borderRadius: '6px',
              padding: '1rem',
              textAlign: 'center',
              minWidth: 140,
              flex: 1,
            }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{p.credits} reports</div>
              <div style={{ fontSize: '1.1rem', color: '#1D9E75', fontWeight: 600, margin: '0.25rem 0' }}>{p.price}</div>
              <div style={{ fontSize: '0.75rem', color: '#888' }}>{p.perReport}/report</div>
              <button
                style={{ ...S.btn, marginTop: '0.5rem', marginRight: 0, width: '100%' }}
                onClick={() => setAlert(`Stripe checkout coming soon for ${p.credits} credits.`)}
              >
                Buy
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* All keys */}
      <div style={S.card}>
        <div style={S.cardTitle}>API Keys</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Prefix</th>
              <th style={S.th}>Credits</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Last used</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr
                key={k.id}
                style={{ cursor: 'pointer', background: selectedKey?.id === k.id ? '#f8f8f6' : '' }}
                onClick={() => setSelectedKey(k)}
              >
                <td style={S.td}>{k.name}</td>
                <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.75rem' }}>{k.key_prefix}...</td>
                <td style={S.td}>{k.credits_remaining}</td>
                <td style={S.td}>
                  <span style={k.is_active ? S.statusOk : S.statusErr}>
                    {k.is_active ? 'Active' : 'Revoked'}
                  </span>
                </td>
                <td style={{ ...S.td, color: '#888', fontSize: '0.75rem' }}>
                  {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString('en-IE') : 'Never'}
                </td>
                <td style={S.td}>
                  {k.is_active && (
                    <button style={S.btnSmall} onClick={(e) => { e.stopPropagation(); void revokeKey(k.id); }}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Create new key */}
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <input
            placeholder="Key name (e.g. Production)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            style={{ ...S.input, marginBottom: 0, width: 200 }}
          />
          <input
            type="number"
            placeholder="Credits"
            value={newKeyCredits}
            onChange={(e) => setNewKeyCredits(e.target.value)}
            style={{ ...S.input, marginBottom: 0, width: 80 }}
          />
          <button onClick={createKey} style={S.btn}>Create key</button>
        </div>
      </div>

      {/* Usage log */}
      {usage.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>Recent Usage</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Time</th>
                <th style={S.th}>Endpoint</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Latency</th>
                <th style={S.th}>Credits</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u) => (
                <tr key={u.id}>
                  <td style={{ ...S.td, fontSize: '0.75rem', color: '#888' }}>
                    {new Date(u.created_at).toLocaleString('en-IE')}
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '0.75rem' }}>{u.endpoint}</td>
                  <td style={S.td}>
                    <span style={u.response_status < 400 ? S.statusOk : S.statusErr}>{u.response_status}</span>
                  </td>
                  <td style={{ ...S.td, color: '#888' }}>{u.latency_ms ? `${(u.latency_ms / 1000).toFixed(1)}s` : '—'}</td>
                  <td style={S.td}>{u.credits_used}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
