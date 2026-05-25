import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  display_name: string;
  email: string;
  is_pro: boolean;
  sia_points: number;
  created_at: string;
}

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editPoints, setEditPoints] = useState<{ id: string; val: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id,display_name,email,is_pro,sia_points,created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    setUsers((data as User[]) ?? []);
    setLoading(false);
  }

  async function togglePro(user: User) {
    setSaving(user.id);
    await supabase.from('users').update({ is_pro: !user.is_pro }).eq('id', user.id);
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, is_pro: !u.is_pro } : u));
    setSaving(null);
  }

  async function savePoints(userId: string) {
    if (!editPoints || editPoints.id !== userId) return;
    const pts = parseInt(editPoints.val, 10);
    if (isNaN(pts)) return;
    setSaving(userId);
    await supabase.from('users').update({ sia_points: pts }).eq('id', userId);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, sia_points: pts } : u));
    setEditPoints(null);
    setSaving(null);
  }

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return u.display_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.pageTitle}>Users</h2>
        <span style={s.count}>{filtered.length} of {users.length}</span>
      </div>
      <input
        style={s.search}
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? <p style={{ color: '#A0A0A0' }}>Loading users...</p> : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Pro', 'SIA Points', 'Signed Up', 'Actions'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={s.empty}>No users found</td></tr>
              ) : filtered.map((u) => (
                <tr key={u.id}>
                  <td style={s.td}>{u.display_name || <span style={{ color: '#5A5A5A' }}>—</span>}</td>
                  <td style={s.td} title={u.email}>{u.email}</td>
                  <td style={s.td}>
                    {u.is_pro
                      ? <span style={s.proBadge}>Pro</span>
                      : <span style={s.freeBadge}>Free</span>}
                  </td>
                  <td style={s.td}>
                    {editPoints?.id === u.id ? (
                      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          style={{ ...s.ptInput }}
                          value={editPoints.val}
                          onChange={(e) => setEditPoints({ id: u.id, val: e.target.value })}
                          onKeyDown={(e) => e.key === 'Enter' && savePoints(u.id)}
                          autoFocus
                          type="number"
                        />
                        <button style={s.btnSave} onClick={() => savePoints(u.id)} disabled={saving === u.id}>
                          {saving === u.id ? '...' : 'Save'}
                        </button>
                        <button style={s.btnCancel} onClick={() => setEditPoints(null)}>✕</button>
                      </span>
                    ) : (
                      <span
                        style={{ cursor: 'pointer', color: '#FFD100' }}
                        onClick={() => setEditPoints({ id: u.id, val: String(u.sia_points ?? 0) })}
                        title="Click to edit"
                      >
                        {(u.sia_points ?? 0).toLocaleString()} pts ✏️
                      </span>
                    )}
                  </td>
                  <td style={s.td}>{new Date(u.created_at).toLocaleDateString('en-SG')}</td>
                  <td style={s.td}>
                    <button
                      style={{ ...s.btnSm, color: u.is_pro ? '#FFB4AB' : '#A0A0A0' }}
                      onClick={() => togglePro(u)}
                      disabled={saving === u.id}
                    >
                      {u.is_pro ? 'Revoke Pro' : 'Grant Pro'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  count: { fontSize: 13, color: '#5A5A5A' },
  search: { width: '100%', maxWidth: 400, background: '#1C1B1B', border: '2px solid #2D2D2D', borderRadius: 4, color: '#fff', fontSize: 14, padding: '10px 14px', marginBottom: 24, boxSizing: 'border-box' },
  tableWrap: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #2D2D2D' },
  td: { padding: '12px 16px', fontSize: 14, color: '#E0E0E0', borderBottom: '1px solid #1A1A1A', verticalAlign: 'middle' },
  empty: { padding: '24px 16px', color: '#5A5A5A', textAlign: 'center' },
  proBadge: { background: '#FFD100', color: '#000', fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 2 },
  freeBadge: { background: '#2A2A2A', color: '#5A5A5A', fontSize: 11, padding: '2px 6px', borderRadius: 2 },
  ptInput: { background: '#111', border: '2px solid #3A3939', borderRadius: 4, color: '#fff', fontSize: 13, padding: '4px 8px', width: 90 },
  btnSave: { background: '#E8192C', border: '1px solid #000', borderRadius: 3, color: '#fff', cursor: 'pointer', fontSize: 12, padding: '4px 8px' },
  btnCancel: { background: 'transparent', border: '1px solid #3A3939', borderRadius: 3, color: '#A0A0A0', cursor: 'pointer', fontSize: 12, padding: '4px 8px' },
  btnSm: { background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 3, cursor: 'pointer', fontSize: 12, padding: '5px 10px' },
};
