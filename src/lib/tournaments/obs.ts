// An OBS scene collection with the tournament's overlays already set up as Browser Sources (right size, right address), so the broadcast team imports one file instead of making five sources by hand.
// In OBS: Scene Collection → Import, pick the file, then switch to it. The file follows OBS's own scene collection format; if a newer OBS version rejects it, the Stream tab's copy-and-paste links still work.
export interface ObsSource {
  name: string;
  url: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

const uuid = (seed: number) => `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;

export function overlaySources(urls: Record<string, string>): ObsSource[] {
  return [
    { name: 'Bracket', url: urls.bracket, width: 1920, height: 1080, x: 0, y: 0 },
    { name: 'Scoreboard', url: urls.scoreboard, width: 1920, height: 1080, x: 0, y: 0 },
    { name: 'Up Next', url: urls.next, width: 700, height: 800, x: 40, y: 40 },
    { name: 'Standings', url: urls.standings, width: 1000, height: 900, x: 460, y: 90 },
    { name: 'Champion', url: urls.champion, width: 1920, height: 1080, x: 0, y: 0 },
  ];
}

export function obsSceneCollection(tournamentName: string, urls: Record<string, string>) {
  const sources = overlaySources(urls);
  const browser = sources.map((s, i) => ({
    prev_ver: 536870913,
    name: s.name,
    uuid: uuid(i + 1),
    id: 'browser_source',
    versioned_id: 'browser_source',
    settings: { url: s.url, width: s.width, height: s.height, css: '', fps_custom: false, reroute_audio: false, restart_when_active: false, shutdown: false },
    mixers: 0,
    sync: 0,
    flags: 0,
    volume: 1.0,
    balance: 0.5,
    enabled: true,
    muted: false,
    'push-to-mute': false,
    'push-to-mute-delay': 0,
    'push-to-talk': false,
    'push-to-talk-delay': 0,
    hotkeys: {},
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    private_settings: {},
  }));
  const scene = (name: string, uid: number, names: string[]) => ({
    prev_ver: 536870913,
    name,
    uuid: uuid(uid),
    id: 'scene',
    versioned_id: 'scene',
    settings: {
      id_counter: names.length,
      custom_size: false,
      items: names.map((n, k) => {
        const s = sources.find((x) => x.name === n)!;
        return {
          name: n,
          source_uuid: uuid(sources.indexOf(s) + 1),
          visible: true,
          locked: false,
          rot: 0.0,
          scale_ref: { x: 1920.0, y: 1080.0 },
          align: 5,
          bounds_type: 0,
          bounds_align: 0,
          bounds_crop: false,
          crop_left: 0,
          crop_top: 0,
          crop_right: 0,
          crop_bottom: 0,
          id: k + 1,
          group_item_backup: false,
          pos: { x: s.x, y: s.y },
          pos_rel: { x: 0, y: 0 },
          scale: { x: 1.0, y: 1.0 },
          scale_rel: { x: 1.0, y: 1.0 },
          bounds: { x: 0.0, y: 0.0 },
          bounds_rel: { x: 0.0, y: 0.0 },
          scale_filter: 'disable',
          blend_method: 'default',
          blend_type: 'normal',
          show_transition: { duration: 0 },
          hide_transition: { duration: 0 },
        };
      }),
    },
    mixers: 0,
    sync: 0,
    flags: 0,
    volume: 1.0,
    balance: 0.5,
    enabled: true,
    muted: false,
    'push-to-mute': false,
    'push-to-mute-delay': 0,
    'push-to-talk': false,
    'push-to-talk-delay': 0,
    hotkeys: {},
    deinterlace_mode: 0,
    deinterlace_field_order: 0,
    monitoring_type: 0,
    private_settings: {},
  });
  const scenes = [scene('Match', 20, ['Scoreboard', 'Up Next']), scene('Bracket', 21, ['Bracket']), scene('Standings', 22, ['Standings']), scene('Champion', 23, ['Champion'])];
  return {
    current_scene: 'Match',
    current_program_scene: 'Match',
    scene_order: scenes.map((s) => ({ name: s.name })),
    name: `${tournamentName} (Triton Gaming)`,
    sources: [...browser, ...scenes],
    groups: [],
    quick_transitions: [],
    transitions: [],
    saved_projectors: [],
    current_transition: 'Fade',
    transition_duration: 300,
    preview_locked: false,
    scaling_enabled: false,
    scaling_level: -8,
    scaling_off_x: 0.0,
    scaling_off_y: 0.0,
    modules: {},
    version: 2,
  };
}
