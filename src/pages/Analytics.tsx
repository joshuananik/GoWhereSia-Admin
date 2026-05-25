import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface RoutePlay { route_id: string; routeName: string; plays: number }
interface HintRow { route_id: string; routeName: string; checkpoint_order: number; location_name: string; total_hints: number }
interface DropoffRow { route_id: string; routeName: string; started: number; completed: number; abandoned: number }
interface AvgTimeRow { route_id: string; routeName: string; tier: string; avg_seconds: number }

function fmtTime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function AnalyticsPage() {
  const [plays, setPlays] = useState<RoutePlay[]>([]);
  const [hints, setHints] = useState<HintRow[]>([]);
  const [dropoff, setDropoff] = useState<DropoffRow[]>([]);
  const [avgTimes, setAvgTimes] = useState<AvgTimeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [routesRes, gamesRes, checkpointsRes, progressRes, leaderboardRes] = await Promise.all([
      supabase.from('routes').select('id,name'),
      supabase.from('games').select('id,route_id,status'),
      supabase.from('checkpoints').select('id,route_id,checkpoint_order,location_name'),
      supabase.from('game_progress').select('checkpoint_id,hints_used'),
      supabase.from('leaderboard_entries').select('route_id,tier,finishing_time_seconds'),
    ]);

    const routes = (routesRes.data ?? []) as { id: string; name: string }[];
    const routeMap = Object.fromEntries(routes.map((r) => [r.id, r.name]));
    const games = (gamesRes.data ?? []) as { id: string; route_id: string; status: string }[];
    const checkpoints = (checkpointsRes.data ?? []) as { id: string; route_id: string; checkpoint_order: number; location_name: string }[];
    const progress = (progressRes.data ?? []) as { checkpoint_id: string; hints_used: number }[];
    const leaderboard = (leaderboardRes.data ?? []) as { route_id: string; tier: string; finishing_time_seconds: number }[];

    // Route popularity
    const playCount: Record<string, number> = {};
    games.filter((g) => g.status === 'completed').forEach((g) => {
      playCount[g.route_id] = (playCount[g.route_id] ?? 0) + 1;
    });
    setPlays(Object.entries(playCount).map(([id, plays]) => ({ route_id: id, routeName: routeMap[id] ?? id, plays })).sort((a, b) => b.plays - a.plays));

    // Hint heatmap
    const hintsByCheckpoint: Record<string, number> = {};
    progress.forEach((p) => {
      if (p.hints_used) hintsByCheckpoint[p.checkpoint_id] = (hintsByCheckpoint[p.checkpoint_id] ?? 0) + (p.hints_used ?? 0);
    });
    const hintRows: HintRow[] = checkpoints.map((cp) => ({
      route_id: cp.route_id,
      routeName: routeMap[cp.route_id] ?? cp.route_id,
      checkpoint_order: cp.checkpoint_order,
      location_name: cp.location_name,
      total_hints: hintsByCheckpoint[cp.id] ?? 0,
    })).sort((a, b) => b.total_hints - a.total_hints);
    setHints(hintRows);

    // Drop-off
    const dropoffMap: Record<string, { started: number; completed: number; abandoned: number }> = {};
    games.forEach((g) => {
      if (!dropoffMap[g.route_id]) dropoffMap[g.route_id] = { started: 0, completed: 0, abandoned: 0 };
      dropoffMap[g.route_id].started++;
      if (g.status === 'completed') dropoffMap[g.route_id].completed++;
      if (g.status === 'abandoned') dropoffMap[g.route_id].abandoned++;
    });
    setDropoff(Object.entries(dropoffMap).map(([id, d]) => ({ route_id: id, routeName: routeMap[id] ?? id, ...d })));

    // Avg completion time
    const timeMap: Record<string, number[]> = {};
    leaderboard.forEach((e) => {
      const key = `${e.route_id}::${e.tier}`;
      if (!timeMap[key]) timeMap[key] = [];
      timeMap[key].push(e.finishing_time_seconds);
    });
    setAvgTimes(Object.entries(timeMap).map(([key, times]) => {
      const [route_id, tier] = key.split('::');
      return { route_id, routeName: routeMap[route_id] ?? route_id, tier, avg_seconds: times.reduce((a, b) => a + b, 0) / times.length };
    }));

    setLoading(false);
  }

  if (loading) return <p style={{ color: '#A0A0A0' }}>Loading analytics...</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      <h2 style={s.pageTitle}>Analytics</h2>

      <Card title="Route Popularity">
        {plays.length === 0 ? <p style={s.empty}>No completed games yet</p> : plays.map((r) => (
          <div key={r.route_id} style={s.barRow}>
            <span style={s.barLabel}>{r.routeName}</span>
            <div style={s.barTrack}>
              <div style={{ ...s.barFill, width: `${Math.min(100, (r.plays / Math.max(...plays.map((p) => p.plays))) * 100)}%` }} />
            </div>
            <span style={s.barNum}>{r.plays} games</span>
          </div>
        ))}
      </Card>

      <Card title="Hint Heatmap — Hardest Checkpoints">
        <table style={s.table}>
          <thead><tr>{['Route', 'CP#', 'Location', 'Total Hints'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {hints.slice(0, 20).map((r, i) => (
              <tr key={i}>
                <td style={s.td}>{r.routeName}</td>
                <td style={s.td}>{r.checkpoint_order}</td>
                <td style={s.td}>{r.location_name}</td>
                <td style={{ ...s.td, color: r.total_hints > 10 ? '#E8192C' : r.total_hints > 3 ? '#FFD100' : '#A0A0A0' }}>
                  {r.total_hints}
                </td>
              </tr>
            ))}
            {hints.length === 0 && <tr><td colSpan={4} style={s.empty}>No hint data yet</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card title="Drop-off Rate">
        <table style={s.table}>
          <thead><tr>{['Route', 'Started', 'Completed', 'Abandoned', 'Drop-off %'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {dropoff.length === 0 ? <tr><td colSpan={5} style={s.empty}>No data yet</td></tr> : dropoff.map((r) => {
              const pct = r.started > 0 ? Math.round((r.abandoned / r.started) * 100) : 0;
              return (
                <tr key={r.route_id}>
                  <td style={s.td}>{r.routeName}</td>
                  <td style={s.td}>{r.started}</td>
                  <td style={s.td}>{r.completed}</td>
                  <td style={s.td}>{r.abandoned}</td>
                  <td style={{ ...s.td, color: pct > 50 ? '#E8192C' : pct > 20 ? '#FFD100' : '#00C853' }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card title="Average Completion Time">
        <table style={s.table}>
          <thead><tr>{['Route', 'Tier', 'Avg Time'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
          <tbody>
            {avgTimes.length === 0 ? <tr><td colSpan={3} style={s.empty}>No data yet</td></tr> : avgTimes.map((r, i) => (
              <tr key={i}>
                <td style={s.td}>{r.routeName}</td>
                <td style={s.td}><span style={s.pill}>{r.tier}</span></td>
                <td style={s.td}>{fmtTime(r.avg_seconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>{title}</div>
      <div style={s.cardBody}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  card: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden' },
  cardHeader: { padding: '14px 20px', fontSize: 15, fontWeight: 700, color: '#fff', borderBottom: '1px solid #2D2D2D', background: '#181717' },
  cardBody: { padding: 20 },
  barRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  barLabel: { width: 200, fontSize: 14, color: '#E0E0E0', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barTrack: { flex: 1, height: 20, background: '#2A2A2A', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', background: '#E8192C', borderRadius: 4, transition: 'width 0.3s' },
  barNum: { width: 70, fontSize: 13, color: '#A0A0A0', textAlign: 'right', flexShrink: 0 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #2D2D2D' },
  td: { padding: '10px 12px', fontSize: 14, color: '#E0E0E0', borderBottom: '1px solid #1A1A1A' },
  empty: { padding: '16px 0', color: '#5A5A5A', textAlign: 'center' },
  pill: { background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 4, padding: '2px 8px', fontSize: 12, color: '#A0A0A0' },
};
