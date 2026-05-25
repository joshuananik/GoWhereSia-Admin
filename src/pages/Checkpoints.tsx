import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { Checkpoint, CheckpointInput, Tier } from '../types';

// Fix default marker icons broken by Vite's asset bundling
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
    },
  });
  return null;
}

function MapPicker({
  lat, lng, onChange, radius, onRadiusChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  radius: number;
  onRadiusChange: (r: number) => void;
}) {
  return (
    <div>
      <div style={{ border: '2px solid #2D2D2D', borderRadius: 4, overflow: 'hidden' }}>
        <MapContainer
          center={[lat, lng]}
          zoom={17}
          style={{ width: '100%', height: 300 }}
          scrollWheelZoom
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            maxZoom={20}
            subdomains={['a', 'b', 'c', 'd']}
          />
          <MapClickHandler onMapClick={onChange} />
          <Marker
            position={[lat, lng]}
            draggable
            eventHandlers={{
              dragend(e) {
                const ll = (e.target as L.Marker).getLatLng();
                onChange(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
              },
            }}
          />
          <Circle
            center={[lat, lng]}
            radius={radius}
            pathOptions={{ color: '#E8192C', fillColor: '#E8192C', fillOpacity: 0.15, weight: 2 }}
          />
        </MapContainer>
      </div>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#A0A0A0', flexShrink: 0, fontWeight: 700 }}>
          Radius: {radius}m
        </span>
        <input
          type="range"
          min={10}
          max={200}
          value={radius}
          onChange={(e) => onRadiusChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#E8192C' }}
        />
        <span style={{ fontSize: 11, color: '#5A5A5A', flexShrink: 0 }}>
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </span>
      </div>
    </div>
  );
}

const TIERS: Tier[] = ['quickie', 'standard', 'fullsend'];
const TIER_LABELS: Record<Tier, string> = { quickie: 'Quickie', standard: 'Standard', fullsend: 'Full Send' };

function blankCheckpoint(routeId: string, tier: Tier, order: number): CheckpointInput {
  return {
    route_id: routeId,
    tier,
    checkpoint_order: order,
    location_name: '',
    lat: 1.3521,
    lng: 103.8198,
    radius_meters: 50,
    riddle_text: '',
    image_url: null,
    hint_1_text: '',
    hint_2_reveal_percent: 50,
    hint_3_answer_text: '',
    zone_label: '',
  };
}

interface CheckpointsPageProps {
  routeId: string;
  routeName: string;
  onBack: () => void;
}

export function CheckpointsPage({ routeId, routeName, onBack }: CheckpointsPageProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>('standard');
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Checkpoint | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CheckpointInput>(blankCheckpoint(routeId, selectedTier, 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadCheckpoints(); }, [selectedTier]);

  async function loadCheckpoints() {
    setLoading(true);
    const { data, error } = await supabase
      .from('checkpoints')
      .select('*')
      .eq('route_id', routeId)
      .eq('tier', selectedTier)
      .order('checkpoint_order', { ascending: true });
    if (error) setError(error.message);
    setCheckpoints((data as Checkpoint[]) ?? []);
    setLoading(false);
  }

  function startCreate() {
    const nextOrder = checkpoints.length + 1;
    setForm(blankCheckpoint(routeId, selectedTier, nextOrder));
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function startEdit(cp: Checkpoint) {
    const { id, ...rest } = cp;
    void id;
    setForm(rest as CheckpointInput);
    setEditing(cp);
    setCreating(false);
    setError(null);
  }

  function cancelForm() {
    setCreating(false);
    setEditing(null);
    setError(null);
  }

  async function handleSave() {
    if (!form.location_name || !form.riddle_text) {
      setError('Location name and riddle text are required.');
      return;
    }
    setSaving(true);
    setError(null);
    if (editing) {
      const { error } = await supabase.from('checkpoints').update(form).eq('id', editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('checkpoints').insert(form);
      if (error) { setError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setCreating(false);
    setEditing(null);
    await loadCheckpoints();
  }

  async function moveUp(cp: Checkpoint) {
    if (cp.checkpoint_order <= 1) return;
    const prev = checkpoints.find((c) => c.checkpoint_order === cp.checkpoint_order - 1);
    if (!prev) return;
    await Promise.all([
      supabase.from('checkpoints').update({ checkpoint_order: cp.checkpoint_order - 1 }).eq('id', cp.id),
      supabase.from('checkpoints').update({ checkpoint_order: cp.checkpoint_order }).eq('id', prev.id),
    ]);
    await loadCheckpoints();
  }

  async function moveDown(cp: Checkpoint) {
    const next = checkpoints.find((c) => c.checkpoint_order === cp.checkpoint_order + 1);
    if (!next) return;
    await Promise.all([
      supabase.from('checkpoints').update({ checkpoint_order: cp.checkpoint_order + 1 }).eq('id', cp.id),
      supabase.from('checkpoints').update({ checkpoint_order: cp.checkpoint_order }).eq('id', next.id),
    ]);
    await loadCheckpoints();
  }

  async function deleteCheckpoint(cp: Checkpoint) {
    if (!window.confirm(`Delete checkpoint "${cp.location_name}"?`)) return;
    const { error } = await supabase.from('checkpoints').delete().eq('id', cp.id);
    if (error) setError(error.message);
    else await loadCheckpoints();
  }

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <button style={styles.backBtn} onClick={onBack}>← Back to routes</button>
          <h2 style={styles.pageTitle}>{routeName} — Checkpoints</h2>
        </div>
        <button style={styles.btnPrimary} onClick={startCreate}>+ Add checkpoint</button>
      </div>

      {/* Tier tabs */}
      <div style={styles.tierTabs}>
        {TIERS.map((tier) => (
          <button
            key={tier}
            style={{ ...styles.tierTab, ...(selectedTier === tier ? styles.tierTabActive : {}) }}
            onClick={() => { setSelectedTier(tier); setCreating(false); setEditing(null); }}
          >
            {TIER_LABELS[tier]}
            {' '}
            <span style={styles.tierCount}>
              ({checkpoints.filter((c) => c.tier === tier).length})
            </span>
          </button>
        ))}
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {(creating || editing) && (
        <CheckpointForm
          key={editing ? editing.id : 'new'}
          form={form}
          onChange={setForm}
          onSave={handleSave}
          onCancel={cancelForm}
          saving={saving}
          isEdit={!!editing}
          routeId={routeId}
          onImageUploaded={(url) => setForm((f) => ({ ...f, image_url: url }))}
        />
      )}

      {loading ? (
        <p style={{ color: '#A0A0A0' }}>Loading checkpoints...</p>
      ) : checkpoints.length === 0 ? (
        <div style={styles.empty}>
          <p>No {TIER_LABELS[selectedTier]} checkpoints yet.</p>
          <p style={{ fontSize: 13, marginTop: 8, color: '#5A5A5A' }}>
            Click "+ Add checkpoint" to create the first one.
          </p>
        </div>
      ) : (
        <div style={styles.cpList}>
          {checkpoints.map((cp, i) => (
            <div key={cp.id} style={styles.cpRow}>
              <div style={styles.cpOrder}>{cp.checkpoint_order}</div>
              <div style={styles.cpInfo}>
                <span style={styles.cpName}>{cp.location_name || 'Unnamed'}</span>
                <span style={styles.cpZone}>{cp.zone_label}</span>
                <span style={styles.cpCoords}>
                  {cp.lat.toFixed(4)}, {cp.lng.toFixed(4)} · r={cp.radius_meters}m
                </span>
                <span style={styles.cpRiddle} title={cp.riddle_text}>
                  {cp.riddle_text.length > 60 ? cp.riddle_text.slice(0, 57) + '...' : cp.riddle_text}
                </span>
              </div>
              {cp.image_url && (
                <div style={styles.cpImageThumb}>
                  <img src={cp.image_url} alt={cp.location_name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 4 }} />
                </div>
              )}
              <div style={styles.cpActions}>
                <button style={styles.btnSm} disabled={i === 0} onClick={() => moveUp(cp)}>↑</button>
                <button style={styles.btnSm} disabled={i === checkpoints.length - 1} onClick={() => moveDown(cp)}>↓</button>
                <button style={styles.btnSm} onClick={() => startEdit(cp)}>Edit</button>
                <button style={{ ...styles.btnSm, background: '#93000A', color: '#FFB4AB' }} onClick={() => deleteCheckpoint(cp)}>Del</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckpointForm({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  isEdit,
  routeId,
  onImageUploaded,
}: {
  form: CheckpointInput;
  onChange: (f: CheckpointInput) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isEdit: boolean;
  routeId: string;
  onImageUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof CheckpointInput>(key: K, value: CheckpointInput[K]) {
    onChange({ ...form, [key]: value });
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `checkpoints/${routeId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await supabase.storage.from('checkpoint-images').upload(path, file, { upsert: true });
    if (error) {
      alert('Upload failed: ' + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('checkpoint-images').getPublicUrl(data.path);
    onImageUploaded(urlData.publicUrl);
    set('image_url', urlData.publicUrl);
    setUploading(false);
  }

  return (
    <div style={styles.formCard}>
      <div style={styles.goldBar} />
      <div style={styles.formBody}>
        <h3 style={styles.formTitle}>{isEdit ? 'Edit checkpoint' : 'New checkpoint'}</h3>

        <div style={styles.fieldGrid3}>
          <Field label="Location name" required>
            <input style={styles.input} value={form.location_name} onChange={(e) => set('location_name', e.target.value)} placeholder="Sri Mariamman Temple" />
          </Field>
          <Field label="Zone label">
            <input style={styles.input} value={form.zone_label} onChange={(e) => set('zone_label', e.target.value)} placeholder="Chinatown" />
          </Field>
          <Field label="Order">
            <input style={styles.input} type="number" value={form.checkpoint_order} onChange={(e) => set('checkpoint_order', Number(e.target.value))} />
          </Field>

          <Field label="Latitude">
            <input style={styles.input} type="number" step="0.000001" value={form.lat} onChange={(e) => set('lat', Number(e.target.value))} />
          </Field>
          <Field label="Longitude">
            <input style={styles.input} type="number" step="0.000001" value={form.lng} onChange={(e) => set('lng', Number(e.target.value))} />
          </Field>
          <Field label="Geofence radius (m)">
            <input style={styles.input} type="number" min={10} max={200} value={form.radius_meters} onChange={(e) => set('radius_meters', Number(e.target.value))} />
          </Field>
        </div>

        <Field label="Riddle text" required>
          <textarea
            style={{ ...styles.input, minHeight: 80, resize: 'vertical' as const }}
            value={form.riddle_text}
            onChange={(e) => set('riddle_text', e.target.value)}
            placeholder="I am a place of worship with five colourful towers..."
          />
        </Field>

        <div style={styles.fieldGrid3}>
          <Field label="Hint 1">
            <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' as const }} value={form.hint_1_text} onChange={(e) => set('hint_1_text', e.target.value)} placeholder="Think South Bridge Road..." />
          </Field>
          <Field label="Hint 2 reveal % (image blur)">
            <input style={styles.input} type="number" min={0} max={100} value={form.hint_2_reveal_percent} onChange={(e) => set('hint_2_reveal_percent', Number(e.target.value))} />
          </Field>
          <Field label="Hint 3 answer (+15 min penalty)">
            <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' as const }} value={form.hint_3_answer_text} onChange={(e) => set('hint_3_answer_text', e.target.value)} placeholder="Sri Mariamman Temple, 244 South Bridge Road" />
          </Field>
        </div>

        {/* Map coordinate picker with visual geofence circle */}
        <Field label="Checkpoint location — click map or drag pin to set coordinates">
          <MapPicker
            lat={form.lat}
            lng={form.lng}
            onChange={(lat, lng) => onChange({ ...form, lat, lng })}
            radius={form.radius_meters}
            onRadiusChange={(r) => onChange({ ...form, radius_meters: r })}
          />
        </Field>

        {/* Image upload */}
        <Field label="Checkpoint image">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input style={{ ...styles.input, flex: 1 }} value={form.image_url ?? ''} onChange={(e) => set('image_url', e.target.value || null)} placeholder="https://... or upload below" />
            <button style={styles.btnGhost} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload file'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          </div>
          {form.image_url && (
            <img src={form.image_url} alt="preview" style={{ marginTop: 8, height: 80, objectFit: 'cover', borderRadius: 4 }} />
          )}
        </Field>

        <div style={styles.formActions}>
          <button style={styles.btnGhost} onClick={onCancel} disabled={saving}>Cancel</button>
          <button style={styles.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Add checkpoint'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={styles.fieldLabel}>{label}{required && ' *'}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: {
    background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer',
    fontSize: 13, padding: 0, marginBottom: 8, display: 'block',
  },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff' },
  btnPrimary: {
    background: '#E8192C', border: '2px solid #000', borderRadius: 4,
    color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700,
    letterSpacing: 0.5, padding: '10px 20px', boxShadow: '2px 2px 0 #000',
  },
  btnGhost: {
    background: 'transparent', border: '2px solid #3A3939', borderRadius: 4,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 13, padding: '8px 16px',
  },
  btnSm: {
    background: '#2A2A2A', border: '1px solid #3A3939', borderRadius: 2,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 12, padding: '4px 8px',
  },
  tierTabs: { display: 'flex', gap: 8, marginBottom: 24 },
  tierTab: {
    background: '#1C1B1B', border: '2px solid #2D2D2D', borderRadius: 4,
    color: '#A0A0A0', cursor: 'pointer', fontSize: 14, padding: '8px 16px',
  },
  tierTabActive: { borderColor: '#FFD100', color: '#FFD100' },
  tierCount: { fontSize: 12, opacity: 0.7 },
  errorBanner: {
    background: '#93000A', border: '1px solid #E8192C', borderRadius: 4,
    color: '#FFB4AB', padding: '10px 16px', marginBottom: 16, fontSize: 13,
  },
  empty: { color: '#A0A0A0', padding: '48px 0', textAlign: 'center' },
  cpList: { display: 'flex', flexDirection: 'column', gap: 8 },
  cpRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#1C1B1B', border: '2px solid #000', borderRadius: 8,
    padding: '12px 16px',
  },
  cpOrder: {
    width: 32, height: 32, borderRadius: 4,
    background: '#2A2A2A', border: '2px solid #000',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: 14, color: '#A0A0A0', flexShrink: 0,
  },
  cpInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  cpName: { color: '#fff', fontWeight: 600, fontSize: 15 },
  cpZone: { color: '#FFD100', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  cpCoords: { color: '#5A5A5A', fontSize: 11 },
  cpRiddle: { color: '#A0A0A0', fontSize: 13, fontStyle: 'italic' },
  cpImageThumb: { flexShrink: 0 },
  cpActions: { display: 'flex', gap: 4, flexShrink: 0 },

  formCard: {
    background: '#1C1B1B', border: '2px solid #000', borderRadius: 12,
    overflow: 'hidden', marginBottom: 24, boxShadow: '4px 4px 0 #000',
  },
  goldBar: { height: 2, background: '#FFD100' },
  formBody: { padding: 24 },
  formTitle: { fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20 },
  fieldGrid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 4 },
  fieldLabel: {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#A0A0A0',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
  },
  input: {
    width: '100%', background: '#111111', border: '2px solid #2D2D2D', borderRadius: 4,
    color: '#fff', fontSize: 14, padding: '8px 12px', boxSizing: 'border-box' as const,
  },
  formActions: { display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 },
};
