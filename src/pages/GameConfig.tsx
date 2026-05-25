import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Config {
  geofence_radius_meters: number;
  gps_update_interval_seconds: number;
  hint3_penalty_minutes: number;
  extra_hint_cost_points: number;
  taunt_cooldown_minutes: number;
  freeze_duration_minutes: number;
  freeze_violation_penalty_minutes: number;
  spy_duration_minutes: number;
  weather_alert_threshold_pct: number;
  shelter_pause_max_minutes: number;
  points_completion: number;
  points_win_bonus: number;
  points_pb_bonus: number;
  snap_enabled: boolean;
  snap_frequency: number;
  snap_timer_seconds: number;
  snap_penalty_minutes: number;
  snap_penalty_hints_lost: number;
  updated_at: string | null;
}

const DEFAULTS: Config = {
  geofence_radius_meters: 50,
  gps_update_interval_seconds: 5,
  hint3_penalty_minutes: 15,
  extra_hint_cost_points: 50,
  taunt_cooldown_minutes: 10,
  freeze_duration_minutes: 5,
  freeze_violation_penalty_minutes: 15,
  spy_duration_minutes: 2,
  weather_alert_threshold_pct: 60,
  shelter_pause_max_minutes: 30,
  points_completion: 100,
  points_win_bonus: 50,
  points_pb_bonus: 25,
  snap_enabled: true,
  snap_frequency: 1,
  snap_timer_seconds: 90,
  snap_penalty_minutes: 10,
  snap_penalty_hints_lost: 1,
  updated_at: null,
};

export function GameConfigPage() {
  const [config, setConfig] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadConfig(); }, []);

  async function loadConfig() {
    const { data, error } = await supabase.from('game_config').select('*').eq('id', 1).maybeSingle();
    if (error) setError('Table not found — run game_config_migration.sql first. Error: ' + error.message);
    if (data) setConfig(data as Config);
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('game_config')
      .update({ ...config, updated_at: new Date().toISOString() })
      .eq('id', 1);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setToast('Config saved ✓');
    setTimeout(() => setToast(null), 3000);
    loadConfig();
  }

  function setNum<K extends keyof Config>(key: K, val: string) {
    setConfig((c) => ({ ...c, [key]: Number(val) }));
  }

  if (loading) return <p style={{ color: '#A0A0A0' }}>Loading config...</p>;

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.pageTitle}>Game Config</h2>
        {config.updated_at && (
          <span style={s.updated}>Last saved: {new Date(config.updated_at).toLocaleString('en-SG')}</span>
        )}
      </div>

      {error && <div style={s.errorBanner}>{error}</div>}
      {toast && <div style={s.toastBanner}>{toast}</div>}

      <Section title="GPS & Geofencing">
        <Row label="Geofence radius (metres)" desc="How close a player must be to trigger a checkpoint">
          <input style={s.input} type="number" value={config.geofence_radius_meters} onChange={(e) => setNum('geofence_radius_meters', e.target.value)} />
        </Row>
        <Row label="GPS update interval (seconds)" desc="How often to broadcast location to teammates">
          <input style={s.input} type="number" value={config.gps_update_interval_seconds} onChange={(e) => setNum('gps_update_interval_seconds', e.target.value)} />
        </Row>
      </Section>

      <Section title="Hints & Penalties">
        <Row label="Hint 3 penalty (minutes)" desc="Time added to finishing time when the answer hint is used">
          <input style={s.input} type="number" value={config.hint3_penalty_minutes} onChange={(e) => setNum('hint3_penalty_minutes', e.target.value)} />
        </Row>
        <Row label="Extra hint cost (SIA Points)" desc="Points deducted when buying an extra hint beyond the 3 free ones">
          <input style={s.input} type="number" value={config.extra_hint_cost_points} onChange={(e) => setNum('extra_hint_cost_points', e.target.value)} />
        </Row>
      </Section>

      <Section title="Powerups">
        <Row label="Spy duration (minutes)" desc="How long the Spy powerup reveals opponent location">
          <input style={s.input} type="number" value={config.spy_duration_minutes} onChange={(e) => setNum('spy_duration_minutes', e.target.value)} />
        </Row>
        <Row label="Freeze duration (minutes)" desc="How long the Freeze powerup immobilises opponents">
          <input style={s.input} type="number" value={config.freeze_duration_minutes} onChange={(e) => setNum('freeze_duration_minutes', e.target.value)} />
        </Row>
        <Row label="Freeze violation penalty (minutes)" desc="Time penalty if frozen team moves during Freeze">
          <input style={s.input} type="number" value={config.freeze_violation_penalty_minutes} onChange={(e) => setNum('freeze_violation_penalty_minutes', e.target.value)} />
        </Row>
      </Section>

      <Section title="Taunts">
        <Row label="Taunt cooldown (minutes)" desc="Minimum time between taunts per team">
          <input style={s.input} type="number" value={config.taunt_cooldown_minutes} onChange={(e) => setNum('taunt_cooldown_minutes', e.target.value)} />
        </Row>
      </Section>

      <Section title="SIA Points">
        <Row label="Points for completing a route" desc="Base points awarded when the last checkpoint is reached">
          <input style={s.input} type="number" value={config.points_completion} onChange={(e) => setNum('points_completion', e.target.value)} />
        </Row>
        <Row label="Win bonus points" desc="Extra points for winning a Team vs Team game">
          <input style={s.input} type="number" value={config.points_win_bonus} onChange={(e) => setNum('points_win_bonus', e.target.value)} />
        </Row>
        <Row label="Personal best bonus" desc="Extra points for beating your own fastest time">
          <input style={s.input} type="number" value={config.points_pb_bonus} onChange={(e) => setNum('points_pb_bonus', e.target.value)} />
        </Row>
      </Section>

      <Section title="Weather">
        <Row label="Weather alert threshold (%)" desc="Rain probability % above which a weather warning is shown">
          <input style={s.input} type="number" value={config.weather_alert_threshold_pct} onChange={(e) => setNum('weather_alert_threshold_pct', e.target.value)} />
        </Row>
        <Row label="Max shelter pause (minutes)" desc="Maximum time a game can be paused for bad weather">
          <input style={s.input} type="number" value={config.shelter_pause_max_minutes} onChange={(e) => setNum('shelter_pause_max_minutes', e.target.value)} />
        </Row>
      </Section>

      <Section title="Snap Challenge">
        <Row label="Snap enabled" desc="Toggle the Snap Challenge feature on/off">
          <label style={s.toggle}>
            <input type="checkbox" checked={config.snap_enabled} onChange={(e) => setConfig((c) => ({ ...c, snap_enabled: e.target.checked }))} />
            <span style={{ marginLeft: 8, color: config.snap_enabled ? '#00C853' : '#5A5A5A' }}>{config.snap_enabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </Row>
        <Row label="Snap frequency (per route)" desc="How many snap challenges appear per route">
          <input style={s.input} type="number" value={config.snap_frequency} onChange={(e) => setNum('snap_frequency', e.target.value)} />
        </Row>
        <Row label="Snap timer (seconds)" desc="How long players have to take the snap photo">
          <input style={s.input} type="number" value={config.snap_timer_seconds} onChange={(e) => setNum('snap_timer_seconds', e.target.value)} />
        </Row>
        <Row label="Snap penalty (minutes)" desc="Time penalty for failing a snap challenge">
          <input style={s.input} type="number" value={config.snap_penalty_minutes} onChange={(e) => setNum('snap_penalty_minutes', e.target.value)} />
        </Row>
        <Row label="Snap penalty (hints lost)" desc="Hints deducted for failing a snap challenge">
          <input style={s.input} type="number" value={config.snap_penalty_hints_lost} onChange={(e) => setNum('snap_penalty_hints_lost', e.target.value)} />
        </Row>
      </Section>

      <div style={s.footer}>
        <button style={s.saveBtn} onClick={saveConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>{title}</div>
      <div style={s.sectionBody}>{children}</div>
    </div>
  );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div style={s.row}>
      <div style={s.rowLeft}>
        <div style={s.rowLabel}>{label}</div>
        <div style={s.rowDesc}>{desc}</div>
      </div>
      <div style={s.rowRight}>{children}</div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 },
  pageTitle: { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  updated: { fontSize: 13, color: '#5A5A5A' },
  errorBanner: { background: '#93000A', border: '1px solid #E8192C', borderRadius: 4, color: '#FFB4AB', padding: '10px 16px', marginBottom: 16, fontSize: 13 },
  toastBanner: { background: '#1A4D2E', border: '1px solid #00C853', borderRadius: 4, color: '#00C853', padding: '10px 16px', marginBottom: 16, fontSize: 13 },
  section: { background: '#1C1B1B', border: '2px solid #000', borderRadius: 8, overflow: 'hidden', marginBottom: 24 },
  sectionHeader: { padding: '12px 20px', fontSize: 13, fontWeight: 700, color: '#FFD100', textTransform: 'uppercase', letterSpacing: 1, background: '#181717', borderBottom: '1px solid #2D2D2D' },
  sectionBody: { padding: '8px 0' },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #1A1A1A' },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 14, color: '#E0E0E0', marginBottom: 2 },
  rowDesc: { fontSize: 12, color: '#5A5A5A' },
  rowRight: { width: 140, flexShrink: 0 },
  input: { width: '100%', background: '#111', border: '2px solid #2D2D2D', borderRadius: 4, color: '#fff', fontSize: 14, padding: '8px 10px', boxSizing: 'border-box' },
  toggle: { display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14 },
  footer: { display: 'flex', justifyContent: 'flex-end', paddingTop: 8 },
  saveBtn: { background: '#E8192C', border: '2px solid #000', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: 700, padding: '14px 32px', boxShadow: '3px 3px 0 #000', letterSpacing: 0.5 },
};
