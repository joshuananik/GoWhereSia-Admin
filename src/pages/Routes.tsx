import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Route, RouteInput, Difficulty } from '../types';

const BLANK_ROUTE: RouteInput = {
  name: '',
  tagline: '',
  hero_image_url: null,
  difficulty: 'lepak',
  zone: '',
  is_free: true,
  is_active: false,
  is_night_only: false,
  min_players: 2,
  recommended_players: '2–4 players',
  quickie_duration: '~3h',
  standard_duration: '~5h',
  fullsend_duration: '~7h',
  clock_par_quickie: 180,
  clock_par_standard: 300,
  clock_par_fullsend: 420,
};

interface RoutesPageProps {
  onSelectRoute: (id: string, name: string) => void;
}

export function RoutesPage({ onSelectRoute }: RoutesPageProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Route | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RouteInput>(BLANK_ROUTE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadRoutes(); }, []);

  async function loadRoutes() {
    setLoading(true);
    const { data, error } = await supabase.from('routes').select('*').order('name');
    if (error) setError(error.message);
    setRoutes((data as Route[]) ?? []);
    setLoading(false);
  }

  function startCreate() {
    setForm(BLANK_ROUTE);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function startEdit(route: Route) {
    const { id, ...rest } = route;
    void id;
    setForm(rest as RouteInput);
    setEditing(route);
    setCreating(false);
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    if (editing) {
      const { error } = await supabase.from('routes').update(form).eq('id', editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('routes').insert(form);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setCreating(false);
    setEditing(null);
    await loadRoutes();
  }

  async function toggleActive(route: Route) {
    const { error } = await supabase
      .from('routes')
      .update({ is_active: !route.is_active })
      .eq('id', route.id);
    if (error) setError(error.message);
    else await loadRoutes();
  }

  async function deleteRoute(route: Route) {
    if (!window.confirm(`Delete "${route.name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('routes').delete().eq('id', route.id);
    if (error) setError(error.message);
    else await loadRoutes();
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>Routes</h2>
        <button style={styles.btnPrimary} onClick={startCreate}>+ New route</button>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {(creating || editing) && (
        <RouteForm
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          isEdit={!!editing}
        />
      )}

      {loading ? (
        <p style={{ color: '#A0A0A0' }}>Loading routes...</p>
      ) : routes.length === 0 ? (
        <div style={styles.empty}>
          <p>No routes yet. Create the first one!</p>
        </div>
      ) : (
        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={styles.col4}>Name</span>
            <span style={styles.col2}>Zone</span>
            <span style={styles.col2}>Difficulty</span>
            <span style={styles.col1}>Free</span>
            <span style={styles.col1}>Status</span>
            <span style={styles.col3}>Actions</span>
          </div>
          {routes.map((route) => (
            <div key={route.id} style={styles.tableRow}>
              <span style={{ ...styles.col4, color: '#fff', fontWeight: 600 }}>{route.name}</span>
              <span style={styles.col2}>{route.zone}</span>
              <span style={styles.col2}>
                <DiffBadge difficulty={route.difficulty} />
              </span>
              <span style={styles.col1}>{route.is_free ? '✓' : '–'}</span>
              <span style={styles.col1}>
                <StatusBadge active={route.is_active} />
              </span>
              <div style={{ ...styles.col3, display: 'flex', gap: 6 }}>
                <button style={styles.btnSm} onClick={() => onSelectRoute(route.id, route.name)}>
                  Checkpoints
                </button>
                <button style={styles.btnSm} onClick={() => startEdit(route)}>
                  Edit
                </button>
                <button
                  style={{ ...styles.btnSm, ...styles.btnToggle, background: route.is_active ? '#1A4D2E' : '#2A2A2A' }}
                  onClick={() => toggleActive(route)}
                >
                  {route.is_active ? 'Unpublish' : 'Publish'}
                </button>
                <button style={{ ...styles.btnSm, background: '#93000A', color: '#FFB4AB' }} onClick={() => deleteRoute(route)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  isEdit,
}: {
  form: RouteInput;
  onChange: (f: RouteInput) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function set<K extends keyof RouteInput>(key: K, value: RouteInput[K]) {
    onChange({ ...form, [key]: value });
  }

  async function handleHeroUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `hero_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('route-images')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('route-images').getPublicUrl(path);
    set('hero_image_url', data.publicUrl);
    setUploading(false);
    // Reset file input so same file can be re-uploaded if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={styles.formCard}>
      <div style={styles.goldBar} />
      <div style={styles.formBody}>
        <h3 style={styles.formTitle}>{isEdit ? 'Edit route' : 'New route'}</h3>

        <div style={styles.fieldGrid}>
          <Field label="Name" required>
            <input style={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Chinatown Chronicles" />
          </Field>
          <Field label="Zone / area">
            <input style={styles.input} value={form.zone} onChange={(e) => set('zone', e.target.value)} placeholder="Chinatown" />
          </Field>
          <Field label="Tagline" cols={2}>
            <input style={styles.input} value={form.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Race through Singapore's oldest streets..." />
          </Field>
          <Field label="Difficulty">
            <select style={styles.select} value={form.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
              <option value="lepak">Lepak</option>
              <option value="shiok">Shiok</option>
              <option value="jialat">Jialat</option>
              <option value="siao_eh">Siao Eh</option>
            </select>
          </Field>
          <Field label="Recommended players">
            <input style={styles.input} value={form.recommended_players} onChange={(e) => set('recommended_players', e.target.value)} placeholder="2–4 players" />
          </Field>
          <Field label="Min players">
            <input style={styles.input} type="number" value={form.min_players} onChange={(e) => set('min_players', Number(e.target.value))} />
          </Field>

          <Field label="Quickie duration">
            <input style={styles.input} value={form.quickie_duration} onChange={(e) => set('quickie_duration', e.target.value)} placeholder="~3h" />
          </Field>
          <Field label="Standard duration">
            <input style={styles.input} value={form.standard_duration} onChange={(e) => set('standard_duration', e.target.value)} placeholder="~5h" />
          </Field>
          <Field label="Full Send duration">
            <input style={styles.input} value={form.fullsend_duration} onChange={(e) => set('fullsend_duration', e.target.value)} placeholder="~7h" />
          </Field>

          <Field label="Par time Quickie (mins)">
            <input style={styles.input} type="number" value={form.clock_par_quickie} onChange={(e) => set('clock_par_quickie', Number(e.target.value))} />
          </Field>
          <Field label="Par time Standard (mins)">
            <input style={styles.input} type="number" value={form.clock_par_standard} onChange={(e) => set('clock_par_standard', Number(e.target.value))} />
          </Field>
          <Field label="Par time Full Send (mins)">
            <input style={styles.input} type="number" value={form.clock_par_fullsend} onChange={(e) => set('clock_par_fullsend', Number(e.target.value))} />
          </Field>

          <Field label="Hero image" cols={2}>
            <div style={styles.imageUploadRow}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleHeroUpload}
              />
              <button
                style={styles.uploadBtn}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? 'Uploading…' : 'Choose image'}
              </button>
              {form.hero_image_url && (
                <img
                  src={form.hero_image_url}
                  alt="Hero preview"
                  style={styles.heroThumb}
                />
              )}
              {!form.hero_image_url && (
                <span style={{ color: '#5A5A5A', fontSize: 12 }}>No image uploaded</span>
              )}
            </div>
            {uploadError && <div style={{ color: '#FFB4AB', fontSize: 12, marginTop: 4 }}>{uploadError}</div>}
            <div style={{ color: '#5A5A5A', fontSize: 11, marginTop: 4 }}>
              Or paste a URL directly:
            </div>
            <input
              style={styles.input}
              value={form.hero_image_url ?? ''}
              onChange={(e) => set('hero_image_url', e.target.value || null)}
              placeholder="https://..."
            />
          </Field>
        </div>

        <div style={styles.checkRow}>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={form.is_free} onChange={(e) => set('is_free', e.target.checked)} />
            Free route
          </label>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Published
          </label>
          <label style={styles.checkLabel}>
            <input type="checkbox" checked={form.is_night_only} onChange={(e) => set('is_night_only', e.target.checked)} />
            Night only
          </label>
        </div>

        <div style={styles.formActions}>
          <button style={styles.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
          <button style={styles.btnPrimary} onClick={onSave} disabled={saving || !form.name}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create route'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, cols, required }: {
  label: string; children: React.ReactNode; cols?: number; required?: boolean;
}) {
  return (
    <div style={{ gridColumn: cols === 2 ? 'span 2' : undefined }}>
      <label style={styles.fieldLabel}>{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

function DiffBadge({ difficulty }: { difficulty: Difficulty }) {
  const colors: Record<Difficulty, { bg: string; color: string }> = {
    lepak:   { bg: '#1A4D2E', color: '#fff' },
    shiok:   { bg: '#FFD100', color: '#000' },
    jialat:  { bg: '#E8192C', color: '#fff' },
    siao_eh: { bg: '#6B0F1A', color: '#fff' },
  };
  const c = colors[difficulty];
  const labels: Record<Difficulty, string> = { lepak: 'Lepak', shiok: 'Shiok', jialat: 'Jialat', siao_eh: 'Siao Eh' };
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {labels[difficulty]}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{ color: active ? '#9DD3AA' : '#3A3939', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {active ? 'Live' : 'Draft'}
    </span>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff' },
  btnPrimary: {
    background: '#E8192C', border: '2px solid #000', borderRadius: 4,
    color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
    letterSpacing: 0.5, padding: '10px 20px',
    boxShadow: '2px 2px 0 #000',
  },
  btnGhost: {
    background: 'transparent', border: '2px solid #3A3939', borderRadius: 4,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 13, padding: '8px 16px',
  },
  btnSm: {
    background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 2,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 12, padding: '4px 8px',
  },
  btnToggle: { color: '#9DD3AA' },
  errorBanner: {
    background: '#93000A', border: '1px solid #E8192C', borderRadius: 4,
    color: '#FFB4AB', padding: '10px 16px', marginBottom: 16, fontSize: 13,
  },
  empty: { color: '#A0A0A0', padding: '48px 0', textAlign: 'center' },
  table: {
    background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex', alignItems: 'center',
    background: '#111111', borderBottom: '1px solid #000',
    padding: '10px 16px', gap: 8,
    fontSize: 11, fontWeight: 700, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tableRow: {
    display: 'flex', alignItems: 'center',
    borderBottom: '1px solid #000',
    padding: '12px 16px', gap: 8,
    fontSize: 13, color: '#A0A0A0',
  },
  col1: { flex: 1 },
  col2: { flex: 2 },
  col3: { flex: 3 },
  col4: { flex: 4 },

  formCard: {
    background: '#1C1B1B', border: '2px solid #000', borderRadius: 12,
    overflow: 'hidden', marginBottom: 24, boxShadow: '4px 4px 0 #000',
  },
  goldBar: { height: 2, background: '#FFD100' },
  formBody: { padding: 24 },
  formTitle: { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20 },
  fieldGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20,
  },
  fieldLabel: { display: 'block', fontSize: 11, fontWeight: 700, color: '#A0A0A0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  input: {
    width: '100%', background: '#111111', border: '2px solid #2D2D2D', borderRadius: 4,
    color: '#fff', fontSize: 14, padding: '8px 12px',
    boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', background: '#111111', border: '2px solid #2D2D2D', borderRadius: 4,
    color: '#fff', fontSize: 14, padding: '8px 12px',
  },
  checkRow: { display: 'flex', gap: 24, marginBottom: 20 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, color: '#A0A0A0', fontSize: 14, cursor: 'pointer' },
  formActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  imageUploadRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  uploadBtn: {
    background: '#2A2A2A', border: '2px solid #3A3939', borderRadius: 4,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 13, padding: '8px 14px',
  },
  heroThumb: {
    width: 80, height: 50, objectFit: 'cover' as const,
    borderRadius: 4, border: '2px solid #3A3939',
  },
};
