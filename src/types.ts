export type Difficulty = 'lepak' | 'shiok' | 'jialat' | 'siao_eh';
export type Tier = 'quickie' | 'standard' | 'fullsend';

export interface Route {
  id: string;
  name: string;
  tagline: string;
  hero_image_url: string | null;
  difficulty: Difficulty;
  zone: string;
  is_free: boolean;
  is_active: boolean;
  is_night_only: boolean;
  min_players: number;
  recommended_players: string;
  quickie_duration: string;
  standard_duration: string;
  fullsend_duration: string;
  clock_par_quickie: number;
  clock_par_standard: number;
  clock_par_fullsend: number;
}

export type RouteInput = Omit<Route, 'id'>;

export interface Checkpoint {
  id: string;
  route_id: string;
  tier: Tier;
  checkpoint_order: number;
  location_name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  riddle_text: string;
  image_url: string | null;
  hint_1_text: string;
  hint_2_reveal_percent: number;
  hint_3_answer_text: string;
  zone_label: string;
}

export type CheckpointInput = Omit<Checkpoint, 'id'>;
