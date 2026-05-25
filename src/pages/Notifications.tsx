import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Route { id: string; name: string }
interface LogEntry { id: string; type: string; message: string; sent_at: string; sent_by: string | null }

export function NotificationsPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [customMsg, setCustomMsg] = useState('');
  const [log, setLog] = useState<LogEntry[]>([]);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('routes').select('id,name').eq('is_active', true).order('name').then(({ data }) => {
      setRoutes((data as Route[]) ?? []);
      if (data?.[0]) setSelectedRouteId(data[0].id);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s?.user?.email ?? null));
    loadLog();
  }, []);

  async function loadLog() {
    const { data } = await supabase
      .from('notifications_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);
    setLog((data as LogEntry[]) ?? []);
  }

  async function sendRouteAnnouncement() {
    const route = routes.find((r) => r.id === selectedRouteId);
    if (!route) return;
    const message = `New route just dropped — ${route.name}. Go check it out lah.`;
    await sendNotification('route_announcement', message);
  }

  async function sendCustom() {
    if (!customMsg.trim()) return;
    await sendNotification('custom', customMsg.trim());
    setCustomMsg('');
  }

  async function sendNotification(type: string, message: string) {
    setSending(true);
    setError(null);
    const { error } = await supabase.from('notifications_log').insert({
      type,
      message,
      sent_by: session,
    });
    setSending(false);
    if (error) {
      if (error.message.includes('does not exist')) {
        setError('notifications_log table not found — run game_config_migration.sql first.');
      } else {
        setError(error.message);
      }
      return;
    }
    setToast('Notification logged ✓ — wire up FCM Edge Function to send to real devices');
    setTimeout(() => setToast(null), 5000);
    loadLog();
  }

  const routePreview = routes.find((r) => r.id === selectedRouteId)?.name ?? '';

  return (
    <div>
      <h2 style={s.pageTitle}>Notifications</h2>

      {error && <div style={s.errorBanner}>{error}</div>}
      {toast && <div style={s.toastBanner}>{toast}</div>}

      <div style={s.grid}>
        {/* Route announcement */}
        <div style={s.card}>
          <div style={s.cardHeader}>New Route Announcement</div>
          <div style={s.cardBody}>
            <label style={s.label}>Route</label>
            <select style={s.select} value={selectedRouteId} onChange={(e) => setSelectedRouteId(e.target.value)}>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              {routes.length === 0 && <option disabled>No published routes</option>}
            </select>

            {routePreview && (
              <div style={s.preview}>
                <div style={s.previewLabel}>Preview</div>
                <div style={s.previewText}>
                  "New route just dropped — <strong>{routePreview}</strong>. Go check it out lah."
                </div>
              </div>
            )}

            <button style={s.btnPrimary} onClick={sendRouteAnnouncement} disabled={sending || !selectedRouteId}>
              {sending ? 'Sending...' : 'Send to all users'}
            </button>
          </div>
        </div>

        {/* Custom announcement */}
        <div style={s.card}>
          <div style={s.cardHeader}>Custom Announcement</div>
          <div style={s.cardBody}>
            <label style={s.label}>Message</label>
            <textarea
              style={s.textarea}
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value.slice(0, 140))}
              placeholder="Write your message here..."
              rows={4}
              maxLength={140}
            />
            <div style={s.charCount}>{customMsg.length}/140</div>
            <button style={s.btnPrimary} onClick={sendCustom} disabled={sending || !customMsg.trim()}>
              {sending ? 'Sending...' : 'Send to all users'}
            </button>
          </div>
        </div>
      </div>

      <h3 style={s.sectionTitle}>Last 20 Notifications Sent</h3>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>{['Type', 'Message', 'Sent By', 'Sent At'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {log.length === 0 ? (
              <tr><td colSpan={4} style={s.empty}>No notifications sent yet</td></tr>
            ) : log.map((l) => (
              <tr key={l.id}>
                <td style={s.td}><span style={s.typePill}>{l.type}</span></td>
                <td style={s.td}>{l.message}</td>
                <td style={s.td}>{l.sent_by ?? '—'}</td>
                <td style={s.td}>{new Date(l.sent_at).toLocaleString('en-SG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 24 },
  errorBanner: { background: '#93000A', border: '1px solid #E8192C', borderRadius: 4, color: '#FFB4AB', padding: '10px 16px', marginBottom: 16, fontSize: 13 },
  toastBanner: { background: '#1A4D2E', border: '1px solid #00C853', borderRadius: 4, color: '#00C853', padding: '10px 16px', marginBottom: 24, fontSize: 13 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 },
  card: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden' },
  cardHeader: { padding: '14px 20px', fontSize: 14, fontWeight: 700, color: '#fff', background: '#181717', borderBottom: '1px solid #2D2D2D' },
  cardBody: { padding: 20, display: 'flex', flexDirection: 'column', gap: 12 },
  label: { fontSize: 11, fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: 0.5 },
  select: { background: '#111', border: '2px solid #2D2D2D', borderRadius: 4, color: '#fff', fontSize: 14, padding: '8px 12px' },
  preview: { background: '#111', border: '1px solid #2D2D2D', borderRadius: 4, padding: 12 },
  previewLabel: { fontSize: 10, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  previewText: { fontSize: 14, color: '#A0A0A0', fontStyle: 'italic', lineHeight: 1.5 },
  textarea: { background: '#111', border: '2px solid #2D2D2D', borderRadius: 4, color: '#fff', fontSize: 14, padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit' },
  charCount: { fontSize: 12, color: '#5A5A5A', textAlign: 'right' },
  btnPrimary: { background: '#E8192C', border: '2px solid #000', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700, padding: '12px 0', boxShadow: '2px 2px 0 #000', alignSelf: 'stretch' },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px' },
  tableWrap: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #2D2D2D' },
  td: { padding: '12px 16px', fontSize: 14, color: '#E0E0E0', borderBottom: '1px solid #1A1A1A' },
  empty: { padding: '24px 16px', color: '#5A5A5A', textAlign: 'center' },
  typePill: { background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#A0A0A0' },
};
