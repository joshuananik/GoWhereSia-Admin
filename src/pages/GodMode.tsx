import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';

L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function makeTeamIcon(color: string, label: string) {
  return L.divIcon({
    html: `
      <div style="
        background:${color};
        border:2px solid #fff;
        border-radius:50%;
        width:22px;height:22px;
        box-shadow:0 2px 6px rgba(0,0,0,0.8);
        display:flex;align-items:center;justify-content:center;
        font-size:8px;font-weight:700;color:#fff;
      ">${label.slice(0, 1)}</div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    className: '',
  });
}

interface ActiveTeam {
  id: string;
  team_name: string;
  color: string;
}

interface ActiveGame {
  id: string;
  game_code: string;
  route_name: string;
  tier: string;
  started_at: string | null;
  teams: ActiveTeam[];
}

interface TeamLocation {
  teamId: string;
  teamName: string;
  routeName: string;
  gameCode: string;
  tier: string;
  lat: number;
  lng: number;
  lastSeen: Date | null;
  color: string;
  hasLocation: boolean;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '—';
  const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatLastSeen(d: Date | null): string {
  if (!d) return 'No signal yet';
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 5) return 'Just now';
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function GodModePage() {
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [teamLocations, setTeamLocations] = useState<Map<string, TeamLocation>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const channelsRef = useRef<ReturnType<typeof supabase.channel>[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadActiveGames();
    // Re-render every 5s so "last seen" timestamps stay fresh
    tickRef.current = setInterval(() => setTick((t) => t + 1), 5000);
    return () => {
      channelsRef.current.forEach((ch) => ch.unsubscribe());
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  void tick; // used only to trigger re-renders for timestamp freshness

  async function loadActiveGames() {
    setLoading(true);
    setError(null);

    const { data: games, error: gErr } = await supabase
      .from('games')
      .select('id, game_code, route_id, tier, started_at, teams(id, team_name, color)')
      .eq('status', 'active')
      .order('started_at', { ascending: false });

    if (gErr) { setError(gErr.message); setLoading(false); return; }
    if (!games || games.length === 0) { setActiveGames([]); setLoading(false); return; }

    // Fetch route names for all unique route_ids
    const routeIds = [...new Set((games as Array<{ route_id: string }>).map((g) => g.route_id))];
    const { data: routes } = await supabase
      .from('routes')
      .select('id, name')
      .in('id', routeIds);
    const routeMap = new Map((routes ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));

    const formattedGames: ActiveGame[] = (games as Array<{
      id: string;
      game_code: string;
      route_id: string;
      tier: string;
      started_at: string | null;
      teams: ActiveTeam[];
    }>).map((g) => ({
      id: g.id,
      game_code: g.game_code,
      route_name: routeMap.get(g.route_id) ?? 'Unknown Route',
      tier: g.tier,
      started_at: g.started_at,
      teams: g.teams ?? [],
    }));

    setActiveGames(formattedGames);

    // Seed location map with placeholder entries (no GPS yet)
    const seedMap = new Map<string, TeamLocation>();
    for (const game of formattedGames) {
      for (const team of game.teams) {
        seedMap.set(team.id, {
          teamId: team.id,
          teamName: team.team_name,
          routeName: game.route_name,
          gameCode: game.game_code,
          tier: game.tier,
          lat: 1.3521,
          lng: 103.8198,
          lastSeen: null,
          color: team.color || '#E8192C',
          hasLocation: false,
        });
      }
    }
    setTeamLocations(seedMap);

    // Tear down old subscriptions
    channelsRef.current.forEach((ch) => ch.unsubscribe());
    channelsRef.current = [];

    // Subscribe to each active game channel
    for (const game of formattedGames) {
      const teamLookup = new Map(game.teams.map((t) => [t.id, t]));
      const channel = supabase
        .channel(`game:${game.id}`)
        .on('broadcast', { event: 'location' }, (payload) => {
          const { teamId, lat, lng } = payload.payload as { teamId: string; lat: number; lng: number };
          const team = teamLookup.get(teamId);
          if (!team) return;
          setTeamLocations((prev) => {
            const next = new Map(prev);
            next.set(teamId, {
              teamId,
              teamName: team.team_name,
              routeName: game.route_name,
              gameCode: game.game_code,
              tier: game.tier,
              lat,
              lng,
              lastSeen: new Date(),
              color: team.color || '#E8192C',
              hasLocation: true,
            });
            return next;
          });
        })
        .subscribe();
      channelsRef.current.push(channel);
    }

    setLoading(false);
  }

  const allLocations = [...teamLocations.values()];

  return (
    <div>
      <div style={s.pageHeader}>
        <div>
          <h2 style={s.pageTitle}>God Mode</h2>
          <p style={s.pageSubtitle}>Live player locations for all active games</p>
        </div>
        <button style={s.btnRefresh} onClick={loadActiveGames}>
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}

      {/* Live map */}
      <div style={s.mapWrap}>
        <MapContainer
          center={[1.3521, 103.8198]}
          zoom={13}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
            subdomains={['a', 'b', 'c', 'd']}
          />
          {allLocations.filter((loc) => loc.hasLocation).map((loc) => (
            <Marker
              key={loc.teamId}
              position={[loc.lat, loc.lng]}
              icon={makeTeamIcon(loc.color, loc.teamName)}
            >
              <Popup>
                <div style={{ fontFamily: 'sans-serif', minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: loc.color }}>
                    {loc.teamName}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 2 }}>
                    {loc.routeName} · {loc.tier}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
                    Game: <strong>{loc.gameCode}</strong>
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    Last seen: {formatLastSeen(loc.lastSeen)}
                  </div>
                  <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                    {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        {allLocations.filter((l) => l.hasLocation).length === 0 && !loading && (
          <div style={s.mapEmptyOverlay}>
            {activeGames.length === 0
              ? 'No active games right now'
              : 'Waiting for teams to broadcast location...'}
          </div>
        )}
      </div>

      {/* Active games list */}
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>Active Games</span>
        <span style={s.sectionCount}>{activeGames.length}</span>
      </div>

      {loading ? (
        <p style={{ color: '#A0A0A0' }}>Loading active games...</p>
      ) : activeGames.length === 0 ? (
        <div style={s.empty}>
          <p>No games are currently active.</p>
          <p style={{ fontSize: 13, marginTop: 8, color: '#5A5A5A' }}>
            Games show up here when their status is "active".
          </p>
        </div>
      ) : (
        <div style={s.gameList}>
          {activeGames.map((game) => (
            <div key={game.id} style={s.gameCard}>
              <div style={s.goldBar} />
              <div style={s.gameCardBody}>
                <div style={s.gameCardHeader}>
                  <div>
                    <span style={s.gameCode}>{game.game_code}</span>
                    <span style={s.gameTier}>{game.tier}</span>
                  </div>
                  <span style={s.gameElapsed}>{formatElapsed(game.started_at)}</span>
                </div>
                <div style={s.gameRoute}>{game.route_name}</div>
                <div style={s.teamRow}>
                  {game.teams.map((team) => {
                    const loc = teamLocations.get(team.id);
                    return (
                      <div key={team.id} style={s.teamChip}>
                        <div style={{ ...s.teamDot, background: team.color || '#E8192C' }} />
                        <span style={s.teamName}>{team.team_name}</span>
                        <span style={s.teamLastSeen}>
                          {loc?.hasLocation ? formatLastSeen(loc.lastSeen) : 'no signal'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  pageSubtitle: { fontSize: 13, color: '#5A5A5A', margin: '4px 0 0' },
  btnRefresh: {
    background: 'transparent', border: '2px solid #3A3939', borderRadius: 4,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 13, padding: '8px 16px',
  },
  errorBanner: {
    background: '#93000A', border: '1px solid #E8192C', borderRadius: 4,
    color: '#FFB4AB', padding: '10px 16px', marginBottom: 16, fontSize: 13,
  },
  mapWrap: {
    position: 'relative',
    height: 480,
    border: '2px solid #2D2D2D',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  mapEmptyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#5A5A5A', fontSize: 14, pointerEvents: 'none',
    backgroundColor: 'rgba(17,17,17,0.5)',
  },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 },
  sectionTitle: { fontWeight: 700, fontSize: 16, color: '#fff', textTransform: 'uppercase', letterSpacing: 1 },
  sectionCount: {
    background: '#E8192C', color: '#fff', fontSize: 11, fontWeight: 700,
    padding: '2px 7px', borderRadius: 10, border: '1px solid #000',
  },
  empty: { color: '#A0A0A0', padding: '32px 0', textAlign: 'center' },
  gameList: { display: 'flex', flexDirection: 'column', gap: 12 },
  gameCard: {
    background: '#1C1B1B', border: '2px solid #000', borderRadius: 8,
    overflow: 'hidden', boxShadow: '3px 3px 0 #000',
  },
  goldBar: { height: 2, background: '#FFD100' },
  gameCardBody: { padding: '14px 16px' },
  gameCardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  gameCode: {
    fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: '#fff',
    letterSpacing: 3, marginRight: 10,
  },
  gameTier: {
    background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 3,
    color: '#FFD100', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.5, padding: '2px 6px',
  },
  gameElapsed: { color: '#5A5A5A', fontSize: 12 },
  gameRoute: { color: '#A0A0A0', fontSize: 14, marginBottom: 12 },
  teamRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  teamChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#111', border: '1px solid #2D2D2D', borderRadius: 4,
    padding: '5px 10px',
  },
  teamDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  teamName: { color: '#fff', fontSize: 13, fontWeight: 600 },
  teamLastSeen: { color: '#5A5A5A', fontSize: 11 },
};
