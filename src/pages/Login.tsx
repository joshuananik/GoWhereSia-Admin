import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.goldBar} />
        <div style={styles.body}>
          <h1 style={styles.wordmark}>GOWHERESIA</h1>
          <div style={styles.divider} />
          <p style={styles.subtitle}>Admin Dashboard</p>
          <p style={styles.hint}>Sign in with the founder Google account to continue.</p>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.btn} onClick={handleGoogleLogin} disabled={loading}>
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#111111',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#1C1B1B',
    border: '2px solid #000',
    borderRadius: 12,
    overflow: 'hidden',
    boxShadow: '4px 4px 0 #000',
  },
  goldBar: { height: 2, background: '#FFD100' },
  body: { padding: 40, display: 'flex', flexDirection: 'column', gap: 16 },
  wordmark: {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: 700,
    fontSize: 32,
    color: '#E8192C',
    letterSpacing: 3,
    textAlign: 'center',
  },
  divider: { height: 2, width: 48, background: '#FFD100', margin: '0 auto' },
  subtitle: { textAlign: 'center', fontSize: 16, color: '#fff', fontWeight: 600 },
  hint: { textAlign: 'center', fontSize: 13, color: '#A0A0A0', lineHeight: 1.5 },
  error: { background: '#93000A', border: '1px solid #E8192C', borderRadius: 4, padding: '8px 12px', fontSize: 13, color: '#FFB4AB' },
  btn: {
    background: '#E8192C',
    border: '2px solid #000',
    borderRadius: 4,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '14px 20px',
    textTransform: 'uppercase' as const,
    boxShadow: '4px 4px 0 #000',
    marginTop: 8,
  },
};
