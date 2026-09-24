// Facade styles for generic buildings. rows: one entry per metre of a storey, bottom first:
// 0 wall, 1 window glass, 2 trim / spandrel. bay: facade period (m) with the first `pier` metres solid wall.
import { M } from './palette.mjs';

const S = (name, wall, glass, trim, roof, rows, bay, pier, opts = {}) => ({
  name, wall: M[wall], glass: M[glass], trim: M[trim], roof: M[roof], rows, floorH: rows.length, bay, pier,
  store: !!opts.store, cornice: opts.cornice ? M[opts.cornice] : 0, fire: !!opts.fire, stoop: !!opts.stoop,
  modern: !!opts.modern, crown: opts.crown ? M[opts.crown] : 0, lobby: opts.lobby || 0,
});

export const STYLES = [
  S('tenement_red', 'brick', 'window', 'brick_dark', 'roof_tar', [0, 1, 1], 2, 1, { store: true, cornice: 'painted_cream', fire: true }),
  S('tenement_brown', 'brick_brown', 'window', 'brick_dark', 'roof_tar', [0, 1, 1], 2, 1, { store: true, cornice: 'brick_dark', fire: true }),
  S('tenement_buff', 'brick_buff', 'window', 'brick_brown', 'roof_tar', [0, 1, 1], 2, 1, { store: true, cornice: 'metal_dark', fire: true }),
  S('brownstone', 'brownstone', 'window_warm', 'brick_dark', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'wood_dark', stoop: true }),
  S('brick_row', 'brick', 'window_warm', 'limestone', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'limestone', stoop: true }),
  S('prewar_buff', 'brick_buff', 'window', 'limestone', 'roof_gravel', [0, 1, 1], 3, 1, { cornice: 'limestone', lobby: 5 }),
  S('prewar_limestone', 'limestone', 'window_blue', 'limestone_light', 'roof_gravel', [0, 1, 1, 0], 3, 1, { cornice: 'limestone_light', lobby: 6 }),
  S('prewar_red', 'brick', 'window', 'limestone', 'roof_gravel', [0, 1, 1], 3, 1, { cornice: 'limestone', lobby: 5 }),
  S('cast_iron', 'cast_iron', 'window', 'painted_cream', 'roof_tar', [0, 1, 1, 1], 3, 1, { store: true, cornice: 'painted_cream' }),
  S('cast_iron_gray', 'granite_gray', 'window', 'metal_panel', 'roof_tar', [0, 1, 1, 1], 3, 1, { store: true, cornice: 'metal_panel' }),
  S('loft_brick', 'brick_brown', 'window_blue', 'brick_dark', 'roof_tar', [0, 1, 1, 1], 4, 1, { store: true, cornice: 'brick_dark' }),
  S('warehouse', 'brick_orange', 'window', 'brick_dark', 'roof_tar', [0, 1, 1, 0], 3, 1, { cornice: 'brick_dark' }),
  S('white_brick', 'brick_white', 'window', 'concrete', 'roof_gravel', [0, 1, 1], 3, 1, { lobby: 4 }),
  S('curtain_blue', 'glass_blue', 'glass_blue', 'spandrel', 'roof_white', [1, 1, 1, 2], 0, 0, { modern: true, lobby: 8 }),
  S('curtain_green', 'glass_green', 'glass_green', 'spandrel', 'roof_white', [1, 1, 1, 2], 0, 0, { modern: true, lobby: 8 }),
  S('curtain_silver', 'metal_panel', 'glass_silver', 'metal_panel', 'roof_white', [2, 1, 1, 1], 0, 0, { modern: true, lobby: 8 }),
  S('curtain_dark', 'glass_dark', 'glass_dark', 'glass_black', 'roof_gray', [1, 1, 1, 2], 0, 0, { modern: true, lobby: 8 }),
  S('bronze', 'bronze', 'glass_bronze', 'bronze', 'roof_gray', [1, 1, 1, 2], 2, 1, { modern: true, lobby: 8 }),
  S('fins', 'metal_panel', 'glass_sky', 'metal_panel', 'roof_white', [1, 1, 1, 2], 3, 1, { modern: true, lobby: 8 }),
  S('concrete_ribbon', 'concrete', 'window_blue', 'concrete', 'roof_gravel', [0, 1, 1], 0, 0, { lobby: 5 }),
  S('granite_office', 'granite_pink', 'window_blue', 'granite_gray', 'roof_gravel', [0, 1, 1, 1], 3, 1, { lobby: 7 }),
  S('terracotta', 'terracotta', 'window', 'limestone', 'roof_gravel', [0, 1, 1, 0], 3, 1, { cornice: 'limestone', lobby: 6 }),
  S('white_frame', 'white', 'glass_sky', 'white', 'roof_white', [2, 1, 1, 1], 3, 1, { modern: true, lobby: 8 }),
  S('projects', 'brick_orange', 'window', 'brick', 'roof_tar', [0, 1, 1], 3, 1, {}),
  S('row_cream', 'painted_cream', 'window_warm', 'white', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'white', stoop: true }),
  S('row_blue', 'painted_blue', 'window_warm', 'white', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'white', stoop: true }),
  S('row_green', 'painted_green', 'window_warm', 'white', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'white', stoop: true }),
  S('row_red', 'painted_red', 'window_warm', 'white', 'roof_tar', [0, 1, 1], 2, 1, { cornice: 'white', stoop: true }),
  S('industrial', 'concrete_dark', 'window', 'metal_panel', 'roof_gray', [0, 0, 1, 1, 0], 4, 2, {}),
  S('shed', 'metal_panel', 'window', 'metal_dark', 'roof_white', [0, 0, 0, 1, 0], 6, 3, {}),
  S('stucco', 'stucco', 'window', 'stucco_warm', 'roof_tar', [0, 1, 1], 3, 2, {}),
  S('hotel_tan', 'brick_buff', 'window_blue', 'brick_brown', 'roof_gravel', [0, 1, 1], 2, 1, { lobby: 5 }),
  S('glass_residential', 'glass_sky', 'glass_sky', 'white', 'roof_white', [1, 1, 2], 4, 1, { modern: true, lobby: 6 }),
  S('civic_granite', 'granite_gray', 'window', 'limestone', 'roof_gray', [0, 1, 1, 0], 3, 1, { cornice: 'limestone', lobby: 6 }),
];
export const STYLE = {};
STYLES.forEach((s, i) => { STYLE[s.name] = i; });
