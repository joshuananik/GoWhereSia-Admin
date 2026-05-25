import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface Stats {
  totalUsers: number;
  proUsers: number;
  activeGames: number;
  completedGames: number;
  gamesToday: number;
  publishedRoutes: number;
}

interface RecentGame {
  id: string;
  game_code: string;
  status: string;
  tier: string;
  mode: string;
  completed_at: string | null;
  routes: { name: string } | null;
}

interface RecentUser {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
  is_pro: boolean;
}

export function OverviewPage() {
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, proUsers: 0, activeGames: 0, completedGames: 0, gamesToday: 0, publishedRoutes: 0 });
  const [recentGames, setRecentGames] = useState<RecentGame[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      { count: totalUsers },
      { count: proUsers },
      { count: activeGames },
      { count: completedGames },
      { count: gamesToday },
      { count: publishedRoutes },
      { data: games },
      { data: users },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_pro', true),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', today.toISOString()),
      supabase.from('routes').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('games').select('id,game_code,status,tier,mode,completed_at,routes(name)').eq('status', 'completed').order('completed_at', { ascending: false }).limit(10),
      supabase.from('users').select('id,display_name,email,created_at,is_pro').order('created_at', { ascending: false }).limit(10),
    ]);

    setStats({
      totalUsers: totalUsers ?? 0,
      proUsers: proUsers ?? 0,
      activeGames: activeGames ?? 0,
      completedGames: completedGames ?? 0,
      gamesToday: gamesToday ?? 0,
      publishedRoutes: publishedRoutes ?? 0,
    });
    setRecentGames((games as unknown as RecentGame[]) ?? []);
    setRecentUsers((users as RecentUser[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return <p style={{ color: '#A0A0A0' }}>Loading overview...</p>;

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, color: '#E8192C' },
    { label: 'Pro Subscribers', value: stats.proUsers, color: '#FFD100' },
    { label: 'Active Games Now', value: stats.activeGames, color: '#00C853' },
    { label: 'Games Completed', value: stats.completedGames, color: '#A0A0A0' },
    { label: 'Games Today', value: stats.gamesToday, color: '#E8192C' },
    { label: 'Published Routes', value: stats.publishedRoutes, color: '#FFD100' },
  ];

  return (
    <div>
      <h2 style={s.pageTitle}>Overview</h2>

      <div style={s.statGrid}>
        {statCards.map((c) => (
          <div key={c.label} style={s.statCard}>
            <div style={{ ...s.statAccent, background: c.color }} />
            <div style={s.statCardBody}>
              <div style={{ ...s.statNum, color: c.color }}>{c.value.toLocaleString()}</div>
              <div style={s.statLabel}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={s.sectionTitle}>Recent Games</h3>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Code', 'Route', 'Tier', 'Mode', 'Finished'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentGames.length === 0 ? (
              <tr><td colSpan={5} style={s.empty}>No completed games yet</td></tr>
            ) : recentGames.map((g) => (
              <tr key={g.id}>
                <td style={s.td}><span style={s.code}>{g.game_code}</span></td>
                <td style={s.td}>{(g.routes as { name: string } | null)?.name ?? '—'}</td>
                <td style={s.td}><span style={s.pill}>{g.tier}</span></td>
                <td style={s.td}><span style={s.pill}>{g.mode === 'team_vs_team' ? 'Team' : 'Clock'}</span></td>
                <td style={s.td}>{g.completed_at ? new Date(g.completed_at).toLocaleString('en-SG') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={s.sectionTitle}>Recent Signups</h3>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {['Name', 'Email', 'Signed Up', 'Pro'].map((h) => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentUsers.length === 0 ? (
              <tr><td colSpan={4} style={s.empty}>No users yet</td></tr>
            ) : recentUsers.map((u) => (
              <tr key={u.id}>
                <td style={s.td}>{u.display_name || '—'}</td>
                <td style={s.td}>{u.email}</td>
                <td style={s.td}>{new Date(u.created_at).toLocaleDateString('en-SG')}</td>
                <td style={s.td}>{u.is_pro ? <span style={s.proBadge}>Pro</span> : '—'}</td>
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
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 40 },
  statCard: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', boxShadow: '3px 3px 0 #000' },
  statAccent: { height: 3 },
  statCardBody: { padding: '20px 24px' },
  statNum: { fontSize: 40, fontWeight: 700, letterSpacing: -1, marginBottom: 4 },
  statLabel: { fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#fff', margin: '0 0 16px' },
  tableWrap: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', marginBottom: 40 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #2D2D2D' },
  td: { padding: '12px 16px', fontSize: 14, color: '#E0E0E0', borderBottom: '1px solid #1A1A1A' },
  empty: { padding: '24px 16px', color: '#5A5A5A', textAlign: 'center' },
  code: { fontFamily: 'monospace', background: '#2A2A2A', padding: '2px 6px', borderRadius: 3, color: '#E8192C', fontWeight: 700, letterSpacing: 2 },
  pill: { background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#A0A0A0' },
  proBadge: { background: '#FFD100', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 2 },
};
