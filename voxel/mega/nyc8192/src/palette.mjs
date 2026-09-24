// Material palette shared by the generator, the packer and the viewer.
// id 0 = air; ids 1..N index this table. Flags:
//   T transparent (drawn in the blended pass)   G glassy (sky reflection in the shader)
//   E emissive (unlit)                          K keep thin features when downsampling
//   P preferred when downsampling (windows, signs, leaves: keeps facades readable from afar)
//   V vegetation (colour jitter)                I interior fill (lowest priority)
export const MATERIALS = [
  // --- ground, rock, water ---------------------------------------------------------------
  ['bedrock', '#5d5e61', ''], ['schist', '#77787a', ''], ['soil', '#6e5238', ''], ['silt', '#4f5446', ''],
  ['sand', '#d9c99a', ''], ['gravel', '#9c968a', ''], ['rock', '#8b8c88', ''], ['rock_dark', '#6a6b69', ''],
  ['grass', '#5d9a3c', 'V'], ['grass_lawn', '#6fae45', 'V'], ['grass_dry', '#8ea24e', 'V'], ['meadow', '#79b04e', 'V'],
  ['dirt_path', '#b89f78', ''], ['gravel_path', '#c3b8a2', ''], ['mulch', '#6b4a32', ''], ['infield', '#b98a5c', ''],
  ['water', '#2a6a9e', 'TW'], ['pond', '#3f7a74', 'TW'], ['fountain', '#8cc8dc', 'TW'], ['ice', '#e4f0f6', ''],
  // --- roads -----------------------------------------------------------------------------
  ['asphalt', '#3b3c3f', ''], ['asphalt_old', '#4a4b4d', ''], ['lane_white', '#d8d8d2', ''], ['lane_yellow', '#d9b43a', ''],
  ['crosswalk', '#e6e6e0', ''], ['bus_lane', '#9c4136', ''], ['bike_lane', '#4f8f5a', ''], ['cobble', '#6d6760', ''],
  ['rail_ballast', '#77705f', ''], ['rail_steel', '#5a5550', ''], ['road_concrete', '#9a9892', ''],
  // --- sidewalks and plazas ----------------------------------------------------------------
  ['sidewalk', '#b9b6ae', ''], ['sidewalk_dark', '#a3a098', ''], ['curb', '#8e8c86', ''], ['bluestone', '#7c8590', ''],
  ['plaza', '#cfcac0', ''], ['plaza_dark', '#8d8880', ''], ['brick_pave', '#9c5b45', ''], ['planks', '#a67c52', ''],
  ['planks_dark', '#7a5a3c', ''], ['tree_pit', '#5a4432', ''],
  // --- walls -------------------------------------------------------------------------------
  ['brick', '#9a4a36', ''], ['brick_dark', '#6b3529', ''], ['brick_brown', '#7d5140', ''], ['brick_orange', '#b56a45', ''],
  ['brick_buff', '#c9ad84', ''], ['brick_white', '#e2ddd2', ''], ['brownstone', '#6e4c3c', ''], ['limestone', '#d6ccb4', ''],
  ['limestone_light', '#e6dfcd', ''], ['granite_pink', '#b99288', ''], ['granite_gray', '#8f8f8c', ''], ['concrete', '#bdbab2', ''],
  ['concrete_dark', '#8a8882', ''], ['stucco', '#e8e2d4', ''], ['stucco_warm', '#d9c3a2', ''], ['terracotta', '#c98e62', ''],
  ['cast_iron', '#cfc6ae', ''], ['marble', '#eeebe4', ''], ['metal_panel', '#a9adb0', ''], ['metal_dark', '#4c5156', ''],
  ['painted_green', '#4f6e58', ''], ['painted_blue', '#5a7390', ''], ['painted_cream', '#e7dcbc', ''], ['painted_red', '#8e3b32', ''],
  // --- glass -------------------------------------------------------------------------------
  ['window', '#35424e', 'GP'], ['window_blue', '#46617a', 'GP'], ['window_warm', '#4a4238', 'GP'], ['storefront', '#6f8a99', 'GP'],
  ['glass_blue', '#4f7fa6', 'GP'], ['glass_green', '#4d8580', 'GP'], ['glass_silver', '#9fb4c2', 'GP'], ['glass_dark', '#27313b', 'GP'],
  ['glass_bronze', '#6b5a45', 'GP'], ['glass_sky', '#7fa9c9', 'GP'], ['spandrel', '#56606a', 'P'], ['glass_black', '#1c2127', 'GP'],
  // --- roofs and metals ----------------------------------------------------------------------
  ['roof_tar', '#48494c', ''], ['roof_gray', '#6f6f70', ''], ['roof_gravel', '#8d897f', ''], ['roof_green', '#6d8f4a', 'V'],
  ['roof_white', '#d4d4d0', ''], ['copper_green', '#6fa58e', ''], ['copper', '#a2643a', ''], ['slate', '#4d5058', ''],
  ['gold', '#d8b04a', 'K'], ['stainless', '#c7cdd2', 'K'], ['aluminum', '#b3b8bc', ''], ['steel', '#6c7075', ''],
  ['steel_dark', '#44484c', ''], ['spire', '#b9bfc4', 'K'], ['antenna', '#8a8f94', 'K'], ['cable', '#9c9688', 'K'],
  ['bridge_tan', '#b5a58a', ''], ['bridge_blue', '#7f93a0', ''], ['bridge_red', '#8a4a3e', ''], ['bridge_gray', '#8d9296', ''],
  ['suspender', '#8b867a', ''], ['bridge_granite', '#a59c8a', ''], ['navy_gray', '#6d747b', ''],
  // --- wood, vegetation ------------------------------------------------------------------------
  ['wood_tank', '#7a5d45', ''], ['wood_dark', '#4e3a2b', ''], ['trunk', '#5a4636', ''],
  ['leaves', '#3f7a35', 'VP'], ['leaves_dark', '#2f6230', 'VP'], ['leaves_light', '#5f9a3e', 'VP'], ['leaves_yellow', '#a7a33c', 'VP'],
  ['leaves_orange', '#c07a32', 'VP'], ['leaves_red', '#a5432f', 'VP'], ['hedge', '#3a6b33', 'VP'], ['flowers_pink', '#d487a6', 'VP'],
  ['flowers_yellow', '#e0c64a', 'VP'], ['flowers_purple', '#8e6bb0', 'VP'],
  // --- signs, lights, sports, misc -----------------------------------------------------------
  ['sign_red', '#e2402f', 'EP'], ['sign_blue', '#2f7fe0', 'EP'], ['sign_magenta', '#d63fa6', 'EP'], ['sign_yellow', '#f2c83a', 'EP'],
  ['sign_cyan', '#3ad0d8', 'EP'], ['sign_white', '#f4f1e6', 'EP'], ['sign_green', '#3fbf5f', 'EP'], ['sign_orange', '#f08a2e', 'EP'],
  ['lamp', '#ffe7a8', 'E'], ['signal', '#e8c23a', ''], ['subway_green', '#2f8a4a', ''], ['awning_red', '#a63a32', ''],
  ['awning_green', '#3a6e4a', ''], ['awning_blue', '#35557e', ''], ['track_red', '#a6503e', ''], ['turf', '#4f9a45', 'V'],
  ['court_green', '#4d7f5a', ''], ['court_blue', '#4a6d98', ''], ['bronze', '#6e5a3a', ''], ['flag_red', '#b8322c', ''],
  ['white', '#f2f0ea', ''], ['black', '#1e1f21', ''], ['yellow', '#e3b52c', ''], ['red', '#b53a2e', ''],
  ['interior', '#77716a', 'I'], ['canvas', '#e9e4d6', ''], ['hull_red', '#8c2f28', ''], ['hull_dark', '#2c3036', ''],
  ['deck_gray', '#9a9a94', ''], ['container_blue', '#3d5f8f', ''], ['container_orange', '#c9672e', ''], ['rust', '#7d4a30', ''],
];

export const M = {};
MATERIALS.forEach(([name], i) => { M[name] = i + 1; });
export const NMAT = MATERIALS.length;
if (NMAT > 250) throw new Error('palette too large');

export const FLAGS = new Uint8Array(256);
export const F_T = 1, F_G = 2, F_E = 4, F_K = 8, F_P = 16, F_V = 32, F_I = 64, F_W = 128;
MATERIALS.forEach(([, , f], i) => {
  let v = 0;
  for (const ch of f) v |= { T: F_T, G: F_G, E: F_E, K: F_K, P: F_P, V: F_V, I: F_I, W: F_W }[ch];
  FLAGS[i + 1] = v;
});

export function paletteJson() {
  return MATERIALS.map(([name, color, flags], i) => ({ id: i + 1, name, color, flags }));
}
