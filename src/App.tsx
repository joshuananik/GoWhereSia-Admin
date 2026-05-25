import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import { LoginPage } from './pages/Login';
import { RoutesPage } from './pages/Routes';
import { CheckpointsPage } from './pages/Checkpoints';
import { OverviewPage } from './pages/Overview';
import { UsersPage } from './pages/Users';
import { AnalyticsPage } from './pages/Analytics';
import { GameConfigPage } from './pages/GameConfig';
import { NotificationsPage } from './pages/Notifications';
import { GodModePage } from './pages/GodMode';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;

export type AdminPage =
  | { name: 'overview' }
  | { name: 'routes' }
  | { name: 'checkpoints'; routeId: string; routeName: string }
  | { name: 'users' }
  | { name: 'analytics' }
  | { name: 'game_config' }
  | { name: 'notifications' }
  | { name: 'god_mode' };

const NAV_ITEMS: { name: AdminPage['name']; label: string; icon: string }[] = [
  { name: 'overview', label: 'Overview', icon: '◎' },
  { name: 'routes', label: 'Routes', icon: '🗺' },
  { name: 'users', label: 'Users', icon: '👥' },
  { name: 'analytics', label: 'Analytics', icon: '📊' },
  { name: 'game_config', label: 'Game Config', icon: '⚙️' },
  { name: 'notifications', label: 'Notifications', icon: '🔔' },
  { name: 'god_mode', label: 'God Mode', icon: '🌐' },
];

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<AdminPage>({ name: 'overview' });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div style={s.center}><p style={{ color: '#A0A0A0' }}>Loading...</p></div>;
  if (!session) return <LoginPage />;

  const userEmail = session.user.email ?? '';
  if (userEmail !== ADMIN_EMAIL) {
    return (
      <div style={s.center}>
        <div style={s.accessDenied}>
          <h2 style={{ color: '#E8192C', marginBottom: 16 }}>Access Denied</h2>
          <p style={{ color: '#A0A0A0', marginBottom: 24 }}>{userEmail} is not an admin account.</p>
          <button style={s.btnDanger} onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  }

  const activePage = page.name === 'checkpoints' ? 'routes' : page.name;

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={{ ...s.sidebar, width: sidebarCollapsed ? 56 : 220 }}>
        <div style={s.sidebarTop}>
          {!sidebarCollapsed && (
            <div style={s.wordmarkWrap}>
              <span style={s.wordmark}>GWS</span>
              <span style={s.adminBadge}>ADMIN</span>
            </div>
          )}
          <button style={s.collapseBtn} onClick={() => setSidebarCollapsed((v) => !v)} title="Toggle sidebar">
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav style={s.nav}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.name}
              style={{
                ...s.navItem,
                ...(activePage === item.name ? s.navItemActive : {}),
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              }}
              onClick={() => setPage({ name: item.name } as AdminPage)}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span style={s.navIcon}>{item.icon}</span>
              {!sidebarCollapsed && <span style={s.navLabel}>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div style={s.sidebarBottom}>
          {!sidebarCollapsed && <span style={{ color: '#3A3939', fontSize: 12, marginBottom: 8, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>}
          <button style={s.signOutBtn} onClick={() => supabase.auth.signOut()} title="Sign out">
            {sidebarCollapsed ? '⇦' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={s.main}>
        {/* Breadcrumb for checkpoints */}
        {page.name === 'checkpoints' && (
          <div style={s.breadcrumb}>
            <button style={s.breadcrumbBtn} onClick={() => setPage({ name: 'routes' })}>Routes</button>
            <span style={s.breadcrumbSep}>›</span>
            <span style={{ color: '#fff', fontSize: 14 }}>{page.routeName}</span>
          </div>
        )}

        <div style={s.content}>
          {page.name === 'overview' && <OverviewPage />}
          {page.name === 'routes' && (
            <RoutesPage onSelectRoute={(id, name) => setPage({ name: 'checkpoints', routeId: id, routeName: name })} />
          )}
          {page.name === 'checkpoints' && (
            <CheckpointsPage routeId={page.routeId} routeName={page.routeName} onBack={() => setPage({ name: 'routes' })} />
          )}
          {page.name === 'users' && <UsersPage />}
          {page.name === 'analytics' && <AnalyticsPage />}
          {page.name === 'game_config' && <GameConfigPage />}
          {page.name === 'notifications' && <NotificationsPage />}
          {page.name === 'god_mode' && <GodModePage />}
        </div>
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  center: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#111111' },
  accessDenied: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400 },
  btnDanger: { background: '#E8192C', border: '2px solid #000', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600, padding: '10px 20px' },

  shell: { display: 'flex', minHeight: '100vh', background: '#111111' },

  sidebar: { background: '#1C1B1B', borderRight: '2px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden' },
  sidebarTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 12px', borderBottom: '1px solid #2D2D2D', minHeight: 56 },
  wordmarkWrap: { display: 'flex', alignItems: 'center', gap: 8 },
  wordmark: { fontWeight: 700, fontSize: 16, color: '#E8192C', letterSpacing: 2 },
  adminBadge: { background: '#E8192C', color: '#fff', fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: '2px 5px', borderRadius: 2, border: '1px solid #000' },
  collapseBtn: { background: 'transparent', border: '1px solid #2D2D2D', borderRadius: 4, color: '#A0A0A0', cursor: 'pointer', fontSize: 16, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  nav: { flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderRadius: 6, color: '#A0A0A0', cursor: 'pointer', fontSize: 14, padding: '10px 12px', width: '100%', textAlign: 'left', transition: 'background 0.1s' },
  navItemActive: { background: 'rgba(232,25,44,0.15)', color: '#E8192C', fontWeight: 700 },
  navIcon: { fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' },
  navLabel: { whiteSpace: 'nowrap', overflow: 'hidden' },

  sidebarBottom: { padding: '12px 12px 16px', borderTop: '1px solid #2D2D2D' },
  signOutBtn: { background: 'transparent', border: '1px solid #3A3939', borderRadius: 4, color: '#5A5A5A', cursor: 'pointer', fontSize: 12, padding: '6px 10px', width: '100%' },

  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 32px', borderBottom: '1px solid #2D2D2D', background: '#1C1B1B' },
  breadcrumbBtn: { background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', fontSize: 14, padding: 0 },
  breadcrumbSep: { color: '#3A3939', fontSize: 18 },
  content: { padding: '32px', maxWidth: 1200, width: '100%' },
};
