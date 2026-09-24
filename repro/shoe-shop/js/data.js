// Catalogue, brands, brand-specific size charts and money helpers.
// All brands and products are fictional; shoe images are rendered procedurally (see shoe3d.js).

export const SALE_ENDS = (() => {
  // Brand Week always ends at the next Sunday 23:59 local time, so the countdown is live.
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  d.setHours(23, 59, 59, 0);
  return d.getTime();
})();

export const BRANDS = [
  { id: 'courtline', name: 'Courtline', tagline: 'Court classics since 1978', color: '#1f6f4a', tint: '#e3efe7', sale: 50, level: 'Platinum', chart: 'thirds', fit: 'True to size. Leather softens after a week of wear.' },
  { id: 'luma', name: 'Luma', tagline: 'Modern womenswear', color: '#b8475f', tint: '#f6e3e6', sale: 45, level: 'Platinum', chart: 'luma', offset: 0.15, fit: 'Slim Italian fit — if you have wide feet, go up half a size.' },
  { id: 'velox', name: 'Velox', tagline: 'Performance running', color: '#e2531d', tint: '#fbe6dc', sale: 40, level: 'Gold', chart: 'us', fit: 'True to size with a performance (snug) fit.' },
  { id: 'nordvik', name: 'Nordvik', tagline: 'Scandinavian boots', color: '#2e5e4e', tint: '#e0ebe6', sale: 35, level: 'Gold', chart: 'eu', offset: -0.4, fit: 'Whole EU sizes only; roomy — between sizes, go down.' },
  { id: 'kaze', name: 'Kaze', tagline: 'Japanese-engineered comfort', color: '#2f5bd3', tint: '#e2e9fb', sale: 30, level: 'Silver', chart: 'jp', offset: 0.4, fit: 'Narrow last, runs ½ size small — size up if between sizes.' },
  { id: 'drift', name: 'Drift', tagline: 'Skate & surf canvas', color: '#1c1c1c', tint: '#e9e6e0', sale: 30, level: 'Silver', chart: 'unisex', fit: 'Unisex sizing: women pick 1½ sizes above men.' },
  { id: 'pebble', name: 'Pebble', tagline: 'Shoes for growing feet', color: '#e5456b', tint: '#fde4ea', sale: 20, level: 'Bronze', chart: 'kids', fit: 'Leave a thumb’s width (≈1 cm) at the toe for growth.' },
  { id: 'orbit', name: 'Orbit', tagline: 'Everyday essentials', color: '#5b4fc4', tint: '#e8e6f8', sale: 0, level: null, chart: 'us', fit: 'True to size.' },
];
export const brandById = Object.fromEntries(BRANDS.map((b) => [b.id, b]));
export const SALE_BRANDS = BRANDS.filter((b) => b.sale > 0);
export const LEVELS = [
  { id: 'Platinum', off: 50, note: 'Up to 50% off' },
  { id: 'Gold', off: 40, note: 'Up to 40% off' },
  { id: 'Silver', off: 30, note: 'Up to 30% off' },
  { id: 'Bronze', off: 20, note: '20% off everything' },
];

// ------------------------------------------------------------------ size charts
// Rows: { label, us, uk, eu, cm }. `label` is how the brand sells the size.
const r = (label, us, uk, eu, cm) => ({ label, us, uk, eu, cm });
const MEN_US = [[7, 6, '40', 25], [7.5, 6.5, '40.5', 25.5], [8, 7, '41', 26], [8.5, 7.5, '42', 26.5], [9, 8, '42.5', 27], [9.5, 8.5, '43', 27.5], [10, 9, '44', 28], [10.5, 9.5, '44.5', 28.5], [11, 10, '45', 29], [11.5, 10.5, '45.5', 29.5], [12, 11, '46', 30], [13, 12, '47.5', 31]];
const WOMEN_US = [[5, 2.5, '35.5', 22], [5.5, 3, '36', 22.5], [6, 3.5, '36.5', 23], [6.5, 4, '37.5', 23.5], [7, 4.5, '38', 24], [7.5, 5, '38.5', 24.5], [8, 5.5, '39', 25], [8.5, 6, '40', 25.5], [9, 6.5, '40.5', 26], [9.5, 7, '41', 26.5], [10, 7.5, '42', 27], [11, 8.5, '43', 28]];

export const CHARTS = {
  us: {
    system: 'US', note: 'US sizing, half sizes 7–13 (men) and 5–11 (women).',
    men: MEN_US.map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
    women: WOMEN_US.map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
    kids: [[10.5, '10.5C', 10, '27.5', 17], [11, '11C', 10.5, '28', 17.5], [12, '12C', 11.5, '30', 18.5], [13, '13C', 12.5, '31', 19.5], [14, '1Y', 13.5, '32', 20.5], [15, '2Y', 1.5, '33.5', 21.5], [16, '3Y', 2.5, '35', 22.5], [17, '4Y', 3.5, '36', 23.5], [18, '5Y', 4.5, '37.5', 24], [19, '6Y', 5.5, '38.5', 24.5]].map(([k, l, uk, eu, cm]) => r(l, l, uk, eu, cm)),
  },
  thirds: {
    system: 'US', note: 'European sizes in thirds (e.g. 42⅔); UK runs ½ size above the usual US−1.',
    men: [[7, 6.5, '40', 25], [7.5, 7, '40⅔', 25.5], [8, 7.5, '41⅓', 26], [8.5, 8, '42', 26.5], [9, 8.5, '42⅔', 27], [9.5, 9, '43⅓', 27.5], [10, 9.5, '44', 28], [10.5, 10, '44⅔', 28.5], [11, 10.5, '45⅓', 29], [11.5, 11, '46', 29.5], [12, 11.5, '46⅔', 30], [13, 12.5, '48', 31]].map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
    women: [[5, 3.5, '36', 22], [5.5, 4, '36⅔', 22.5], [6, 4.5, '37⅓', 23], [6.5, 5, '38', 23.5], [7, 5.5, '38⅔', 24], [7.5, 6, '39⅓', 24.5], [8, 6.5, '40', 25], [8.5, 7, '40⅔', 25.5], [9, 7.5, '41⅓', 26], [9.5, 8, '42', 26.5], [10, 8.5, '42⅔', 27], [11, 9.5, '44', 28]].map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
    kids: [['10.5C', 10, '28', 17], ['11C', 10.5, '28⅔', 17.5], ['12C', 11.5, '30', 18.5], ['13C', 12.5, '31⅓', 19.5], ['1Y', 13.5, '32⅔', 20.5], ['2Y', 1.5, '34', 21.5], ['3Y', 2.5, '35⅓', 22.5], ['4Y', 3.5, '36⅔', 23.5], ['5Y', 4.5, '38', 24], ['6Y', 5.5, '38⅔', 24.5]].map(([l, uk, eu, cm]) => r(l, l, uk, eu, cm)),
  },
  jp: {
    system: 'US', note: 'Japanese lasts are cm-first (JP = foot length in mm) and fit ½ size small.',
    men: [[7, 6, '40', 25.25], [7.5, 6.5, '40.5', 25.5], [8, 7, '41.5', 26], [8.5, 7.5, '42', 26.5], [9, 8, '42.5', 27], [9.5, 8.5, '43.5', 27.5], [10, 9, '44', 28], [10.5, 9.5, '44.5', 28.5], [11, 10, '45', 29], [11.5, 10.5, '46', 29.5], [12, 11, '46.5', 30], [13, 12, '48', 31]].map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
    women: [[5, 3, '35.5', 21.5], [5.5, 3.5, '36', 22], [6, 4, '37', 22.5], [6.5, 4.5, '37.5', 23], [7, 5, '38', 23.5], [7.5, 5.5, '39', 24], [8, 6, '39.5', 24.5], [8.5, 6.5, '40', 25], [9, 7, '40.5', 25.5], [9.5, 7.5, '41.5', 26], [10, 8, '42', 26.5], [11, 9, '43.5', 27.5]].map(([us, uk, eu, cm]) => r(`US ${us}`, us, uk, eu, cm)),
  },
  eu: {
    system: 'EU', note: 'Sold in whole EU sizes; the last is generous, made for thick socks.',
    men: [['40', 6.5, 7.5, 25.5], ['41', 7.5, 8.5, 26.5], ['42', 8, 9, 27], ['43', 9, 10, 27.5], ['44', 9.5, 10.5, 28.5], ['45', 10.5, 11.5, 29], ['46', 11, 12, 30], ['47', 12, 13, 30.5]].map(([eu, uk, us, cm]) => r(`EU ${eu}`, us, uk, eu, cm)),
    women: [['36', 3, 5.5, 22.5], ['37', 4, 6.5, 23.5], ['38', 5, 7.5, 24], ['39', 6, 8.5, 25], ['40', 6.5, 9, 25.5], ['41', 7.5, 10, 26.5], ['42', 8, 10.5, 27]].map(([eu, uk, us, cm]) => r(`EU ${eu}`, us, uk, eu, cm)),
  },
  luma: {
    system: 'EU', note: 'Italian-style EU half sizes; foot lengths are measured, not last lengths.',
    women: [['35', 2, 4.5, 22], ['35.5', 2.5, 5, 22.3], ['36', 3, 5.5, 22.7], ['36.5', 3.5, 6, 23], ['37', 4, 6.5, 23.5], ['37.5', 4.5, 7, 23.8], ['38', 5, 7.5, 24.2], ['38.5', 5.5, 8, 24.6], ['39', 6, 8.5, 25], ['40', 7, 9.5, 25.6], ['41', 8, 10.5, 26.3], ['42', 9, 11.5, 27]].map(([eu, uk, us, cm]) => r(`EU ${eu}`, us, uk, eu, cm)),
  },
  unisex: {
    system: 'US', note: 'One unisex scale: labels show men’s / women’s US sizes.',
    men: [[4, 5.5, 3, '35', 22], [4.5, 6, 3.5, '36', 22.5], [5, 6.5, 4, '36.5', 23], [5.5, 7, 4.5, '37', 23.5], [6, 7.5, 5, '38', 24], [6.5, 8, 5.5, '38.5', 24.5], [7, 8.5, 6, '39', 25], [7.5, 9, 6.5, '40', 25.5], [8, 9.5, 7, '40.5', 26], [8.5, 10, 7.5, '41', 26.5], [9, 10.5, 8, '42', 27], [9.5, 11, 8.5, '42.5', 27.5], [10, 11.5, 9, '43', 28], [10.5, 12, 9.5, '44', 28.5], [11, 12.5, 10, '44.5', 29], [12, 13.5, 11, '46', 30]].map(([m, w, uk, eu, cm]) => r(`M ${m} / W ${w}`, `M${m}/W${w}`, uk, eu, cm)),
  },
  kids: {
    system: 'US', note: 'Little kids (C) run to 13.5C, then big kids (Y) from 1Y.',
    kids: [['10C', 9.5, '27', 16.5], ['10.5C', 10, '27.5', 17], ['11C', 10.5, '28', 17.5], ['11.5C', 11, '29', 18], ['12C', 11.5, '30', 18.5], ['12.5C', 12, '30.5', 19], ['13C', 12.5, '31', 19.5], ['13.5C', 13, '31.5', 20], ['1Y', 13.5, '32', 20.5], ['1.5Y', 1, '33', 21], ['2Y', 1.5, '33.5', 21.5], ['2.5Y', 2, '34', 22], ['3Y', 2.5, '35', 22.5], ['4Y', 3.5, '36', 23.5], ['5Y', 4.5, '37.5', 24], ['6Y', 5.5, '38.5', 24.5]].map(([l, uk, eu, cm]) => r(l, l, uk, eu, cm)),
  },
};

export function chartFor(brandId, gender) {
  const c = CHARTS[brandById[brandId].chart];
  const g = gender === 'unisex' ? (c.men ? 'men' : c.women ? 'women' : 'kids') : gender;
  return c[g] || c.men || c.women || c.kids;
}
export function chartGenders(brandId) { const c = CHARTS[brandById[brandId].chart]; return ['men', 'women', 'kids'].filter((g) => c[g]); }

// Recommend a row for a foot length (cm); fit: -1 snug, 0 regular, +1 roomy.
export function recommend(rows, footCm, fit = 0, offset = 0) {
  if (!rows || !rows.length || !footCm) return null;
  const want = footCm + offset + (fit > 0 ? 0.5 : fit < 0 ? -0.25 : 0.2);
  let best = rows[rows.length - 1];
  for (const row of rows) if (row.cm >= want - 0.001) { best = row; break; }
  return best;
}

// ------------------------------------------------------------------ products
const P = (o) => o;
export const PRODUCTS = [
  P({ id: 'velox-aerolite-3-midnight', style: 'aerolite-3', brand: 'velox', name: 'Aerolite 3', category: 'Running', gender: 'men', model: 'runner', material: 'knit', price: 140, off: 40, colorName: 'Midnight / Blaze', rating: 4.7, reviews: 1284, isNew: true,
    colors: { upper: '#1d2a44', overlay: '#2c3d5e', accent: '#ff5a1f', logo: '#ffffff', sole: '#f2efe9', outsole: '#2a2a2a', lace: '#f2efe9', lining: '#3a3a3a', collar: '#232a38', pod: '#ff5a1f', swatch: '#1d2a44', bg: '#dfe3ea' },
    blurb: 'A featherweight daily trainer with a rocker-shaped supercritical foam midsole and a breathable engineered-knit upper that locks the midfoot without pressure points.',
    specs: { Drop: '10 mm', Weight: '248 g (US 9)', Upper: 'Engineered knit', Midsole: 'Supercritical EVA foam', Outsole: 'Carbon rubber pods' } }),
  P({ id: 'velox-aerolite-3-cloud', style: 'aerolite-3', brand: 'velox', name: 'Aerolite 3', category: 'Running', gender: 'women', model: 'runner', material: 'knit', price: 140, off: 40, colorName: 'Cloud / Mint', rating: 4.8, reviews: 942,
    colors: { upper: '#eceee9', overlay: '#dde4de', accent: '#2fbf8c', logo: '#2fbf8c', sole: '#ffffff', outsole: '#b7c1bb', lace: '#ffffff', lining: '#cfd8d3', collar: '#d5ddd8', pod: '#2fbf8c', swatch: '#e7ece8', bg: '#e1ebe5' },
    blurb: 'The same rocker geometry and lively foam as the Midnight edition, cut on our women’s last with a narrower heel cup and a softer collar.',
    specs: { Drop: '10 mm', Weight: '214 g (US 7)', Upper: 'Engineered knit', Midsole: 'Supercritical EVA foam', Outsole: 'Carbon rubber pods' } }),
  P({ id: 'velox-tempo-knit-volt', style: 'tempo-knit', brand: 'velox', name: 'Tempo Knit', category: 'Running', gender: 'unisex', model: 'runner', material: 'mesh', price: 120, off: 25, colorName: 'Carbon / Volt', rating: 4.5, reviews: 611,
    colors: { upper: '#2b2d31', overlay: '#3b3e44', accent: '#d7ff3a', logo: '#d7ff3a', sole: '#eeeee6', outsole: '#1b1b1b', lace: '#2b2d31', lining: '#1b1c1f', collar: '#1b1c1f', pod: '#d7ff3a', swatch: '#2b2d31', bg: '#e4e6dc' },
    blurb: 'Uptempo sessions, sorted. Open-cell mesh keeps things cool while a firmer heel wedge gives you something to push against when the pace drops.',
    specs: { Drop: '8 mm', Weight: '232 g (US 9)', Upper: 'Open-cell mesh', Midsole: 'Dual-density foam', Outsole: 'Full-length rubber' } }),
  P({ id: 'velox-pacer-kids-sky', style: 'pacer-kids', brand: 'velox', name: 'Pacer Jr', category: 'Kids', gender: 'kids', model: 'kids', material: 'mesh', price: 65, off: 20, colorName: 'Sky / Sunny', rating: 4.6, reviews: 388,
    colors: { upper: '#3fb6e8', overlay: '#ffffff', accent: '#ffcf33', logo: '#ffffff', sole: '#ffffff', outsole: '#1e7fc2', lining: '#1e4f86', collar: '#1e4f86', strap: '#ffcf33', pod: '#ffcf33', swatch: '#3fb6e8', bg: '#def0f8' },
    blurb: 'Two hook-and-loop straps they can manage themselves, a roomy toe box for wiggling and a grippy outsole for playground sprints.',
    specs: { Closure: 'Hook & loop', Weight: '160 g (13C)', Upper: 'Breathable mesh', Midsole: 'Soft EVA', Outsole: 'Non-marking rubber' } }),

  P({ id: 'kaze-hikari-sakura', style: 'hikari', brand: 'kaze', name: 'Hikari Runner', category: 'Running', gender: 'women', model: 'runner', material: 'knit', price: 130, off: 30, colorName: 'Sakura', rating: 4.6, reviews: 503, isNew: true,
    colors: { upper: '#f3d9dc', overlay: '#ebc4ca', accent: '#d45d79', logo: '#d45d79', sole: '#fbf8f6', outsole: '#d45d79', lace: '#fbf8f6', lining: '#efe1e2', collar: '#e7c1c7', pod: '#d45d79', swatch: '#f0cfd4', bg: '#f6e3e6' },
    blurb: 'Kaze’s signature gel-infused foam in a springtime colourway. The narrow Japanese last hugs the heel — size up half if you are between sizes.',
    specs: { Drop: '9 mm', Weight: '221 g (US 7)', Upper: 'Jacquard knit', Midsole: 'Gel-infused foam', Outsole: 'AHAR rubber' } }),
  P({ id: 'kaze-hikari-indigo', style: 'hikari', brand: 'kaze', name: 'Hikari Runner', category: 'Running', gender: 'men', model: 'runner', material: 'knit', price: 130, off: 30, colorName: 'Indigo / Gold', rating: 4.6, reviews: 677,
    colors: { upper: '#253373', overlay: '#1b2657', accent: '#f4c542', logo: '#f4c542', sole: '#f7f5f0', outsole: '#253373', lace: '#f7f5f0', lining: '#1b2657', collar: '#1b2657', pod: '#f4c542', swatch: '#253373', bg: '#e0e4f1' },
    blurb: 'Deep indigo knit dyed in Okayama with a gold heel window. Smooth, stable and quietly fast.',
    specs: { Drop: '9 mm', Weight: '262 g (US 9)', Upper: 'Jacquard knit', Midsole: 'Gel-infused foam', Outsole: 'AHAR rubber' } }),
  P({ id: 'kaze-sora-court-sand', style: 'sora', brand: 'kaze', name: 'Sora Court', category: 'Lifestyle', gender: 'unisex', model: 'court', material: 'leather', price: 110, off: 20, colorName: 'Sand / Ink', rating: 4.4, reviews: 219,
    colors: { upper: '#eadfca', overlay: '#dccdb1', accent: '#1f2a44', logo: '#1f2a44', sole: '#f5efe3', outsole: '#8b6a44', lace: '#f5efe3', lining: '#e3d7c1', collar: '#e0d3bb', swatch: '#e2d5bd', bg: '#efe8dc' },
    blurb: 'Tumbled nubuck-feel leather in warm sand, finished with an ink heel tab. Minimal, softly structured, easy to live in.',
    specs: { Upper: 'Tumbled leather', Lining: 'Microsuede', Midsole: 'Cupsole', Outsole: 'Gum rubber', Weight: '410 g (US 9)' } }),

  P({ id: 'nordvik-fjell-tobacco', style: 'fjell', brand: 'nordvik', name: 'Fjell Hiker', category: 'Boots', gender: 'men', model: 'hiker', material: 'suede', price: 190, off: 35, colorName: 'Tobacco / Ember', rating: 4.8, reviews: 832,
    colors: { upper: '#8f6c4a', overlay: '#2d2a26', accent: '#5a4632', logo: '#e2a23b', sole: '#6b6258', outsole: '#1f1d1b', lace: '#d9622b', lining: '#3b3530', collar: '#3b3530', eyelet: '#8b8f94', swatch: '#8f6c4a', bg: '#e9e1d6' },
    blurb: 'Waterproof suede, a gusseted tongue and a deep-lug outsole tuned for wet granite. Broken in by lunch, not by August.',
    specs: { Waterproofing: 'Membrane bootie', Weight: '560 g (EU 42)', Upper: 'Suede + leather overlays', Midsole: 'PU with TPU shank', Outsole: '5 mm lugs' } }),
  P({ id: 'nordvik-fjell-moss', style: 'fjell', brand: 'nordvik', name: 'Fjell Hiker', category: 'Boots', gender: 'women', model: 'hiker', material: 'suede', price: 190, off: 35, colorName: 'Moss / Stone', rating: 4.7, reviews: 404,
    colors: { upper: '#6f7a5a', overlay: '#2e2f2a', accent: '#4d5540', logo: '#e8e2d0', sole: '#9c968a', outsole: '#262521', lace: '#e8e2d0', lining: '#34372e', collar: '#34372e', eyelet: '#8b8f94', swatch: '#6f7a5a', bg: '#e3e7dc' },
    blurb: 'All the grip of the Tobacco edition on a women’s last with a lower cuff height and a softer flex point.',
    specs: { Waterproofing: 'Membrane bootie', Weight: '470 g (EU 38)', Upper: 'Suede + leather overlays', Midsole: 'PU with TPU shank', Outsole: '5 mm lugs' } }),
  P({ id: 'nordvik-oslo-chestnut', style: 'oslo', brand: 'nordvik', name: 'Oslo Chelsea', category: 'Boots', gender: 'men', model: 'chelsea', material: 'leather', price: 210, off: 25, colorName: 'Chestnut', rating: 4.7, reviews: 566,
    colors: { upper: '#6a4128', overlay: '#1f1c1a', accent: '#1f1c1a', sole: '#2a2522', outsole: '#1c1a18', lining: '#8a6a4a', swatch: '#6a4128', bg: '#ece2d8' },
    blurb: 'Full-grain chestnut leather, twin elastic gores and a stacked rubber heel. Pull on, polish up, go.',
    specs: { Upper: 'Full-grain leather', Lining: 'Calf leather', Construction: 'Blake stitched', Outsole: 'Rubber', Heel: '28 mm stacked' } }),
  P({ id: 'nordvik-oslo-black', style: 'oslo', brand: 'nordvik', name: 'Oslo Chelsea', category: 'Boots', gender: 'women', model: 'chelsea', material: 'leather', price: 210, off: 25, colorName: 'Black', rating: 4.8, reviews: 721,
    colors: { upper: '#1e1d1c', overlay: '#121212', accent: '#121212', sole: '#171615', outsole: '#121212', lining: '#6b4f3a', swatch: '#1e1d1c', bg: '#e6e3df' },
    blurb: 'The everyday black boot, done properly: waxed full-grain leather that ages well and a sole you can resole.',
    specs: { Upper: 'Full-grain leather', Lining: 'Calf leather', Construction: 'Blake stitched', Outsole: 'Rubber', Heel: '28 mm stacked' } }),

  P({ id: 'courtline-rally-forest', style: 'rally', brand: 'courtline', name: 'Rally Lo', category: 'Lifestyle', gender: 'unisex', model: 'court', material: 'leather', price: 95, off: 50, colorName: 'White / Forest', rating: 4.8, reviews: 2210,
    colors: { upper: '#f5f2eb', overlay: '#f5f2eb', accent: '#1f6f4a', logo: '#1f6f4a', sole: '#f5f2eb', outsole: '#b98a4f', lace: '#f5f2eb', lining: '#e8e2d6', collar: '#efe9de', swatch: '#1f6f4a', bg: '#e3efe7' },
    blurb: 'The tennis silhouette that went everywhere. Clean white leather, three rows of perforations and our forest-green heel tab.',
    specs: { Upper: 'Nappa leather', Lining: 'Leather', Midsole: 'Stitched cupsole', Outsole: 'Gum rubber', Weight: '395 g (US 9)' } }),
  P({ id: 'courtline-rally-navy', style: 'rally', brand: 'courtline', name: 'Rally Lo', category: 'Lifestyle', gender: 'unisex', model: 'court', material: 'leather', price: 95, off: 30, colorName: 'White / Navy', rating: 4.7, reviews: 1320,
    colors: { upper: '#f5f2eb', overlay: '#f5f2eb', accent: '#1d2d55', logo: '#1d2d55', sole: '#f5f2eb', outsole: '#f0ece4', lace: '#f5f2eb', lining: '#e8e2d6', collar: '#1d2d55', swatch: '#1d2d55', bg: '#e2e6f0' },
    blurb: 'Rally Lo with a navy heel tab and collar lining — crisp with denim, sharp with tailoring.',
    specs: { Upper: 'Nappa leather', Lining: 'Leather', Midsole: 'Stitched cupsole', Outsole: 'Rubber', Weight: '395 g (US 9)' } }),
  P({ id: 'courtline-baseline-varsity', style: 'baseline', brand: 'courtline', name: 'Baseline Hi', category: 'Basketball', gender: 'men', model: 'hightop', material: 'leather', price: 125, off: 40, colorName: 'Varsity Red', rating: 4.6, reviews: 948, isNew: true,
    colors: { upper: '#f4f1ea', overlay: '#b3262b', accent: '#b3262b', logo: '#f4f1ea', sole: '#f4f1ea', outsole: '#b3262b', lace: '#f4f1ea', lining: '#222222', collar: '#1b1b1b', swatch: '#b3262b', bg: '#f1e1df' },
    blurb: 'A 1985 court archive re-issued: padded ankle collar, full-grain overlays and a pivot-circle outsole that still grips.',
    specs: { Upper: 'Full-grain leather', Collar: 'Padded foam', Midsole: 'Cupsole + air pocket', Outsole: 'Pivot-circle rubber', Weight: '520 g (US 9)' } }),
  P({ id: 'courtline-baseline-gum', style: 'baseline', brand: 'courtline', name: 'Baseline Hi', category: 'Basketball', gender: 'women', model: 'hightop', material: 'leather', price: 125, off: 40, colorName: 'Black / Gum', rating: 4.7, reviews: 615,
    colors: { upper: '#1b1b1b', overlay: '#262626', accent: '#262626', logo: '#efe9dc', sole: '#c79a5f', outsole: '#a8763e', lace: '#efe9dc', lining: '#2a2a2a', collar: '#262626', swatch: '#1b1b1b', bg: '#ebe3d8' },
    blurb: 'Tonal black leather on a gum cupsole. Cut on the women’s last with a slightly lower collar.',
    specs: { Upper: 'Full-grain leather', Collar: 'Padded foam', Midsole: 'Cupsole', Outsole: 'Gum rubber', Weight: '455 g (US 7)' } }),

  P({ id: 'luma-luna-noir', style: 'luna', brand: 'luma', name: 'Luna Ballet Flat', category: 'Flats', gender: 'women', model: 'flat', material: 'leather', price: 120, off: 45, colorName: 'Noir', rating: 4.5, reviews: 689,
    colors: { upper: '#1a1a1d', accent: '#1a1a1d', sole: '#2a2522', outsole: '#1a1a1a', lining: '#c9a58a', swatch: '#1a1a1d', bg: '#eee6e4' },
    blurb: 'Glove-soft nappa, a cushioned latex footbed and a tiny grosgrain bow. The flat you will reach for every morning.',
    specs: { Upper: 'Nappa leather', Lining: 'Goat leather', Footbed: 'Latex cushioned', Sole: 'Leather + rubber insert', Heel: '8 mm' } }),
  P({ id: 'luma-luna-scarlet', style: 'luna', brand: 'luma', name: 'Luna Ballet Flat', category: 'Flats', gender: 'women', model: 'flat', material: 'patent', price: 120, off: 45, colorName: 'Scarlet Patent', rating: 4.6, reviews: 402,
    colors: { upper: '#b01830', accent: '#8e1226', sole: '#caa184', outsole: '#6b4a36', lining: '#f0dcd3', swatch: '#b01830', bg: '#f5e2e1' },
    blurb: 'Mirror-shine patent in a confident scarlet — a statement at the office, easy on a Sunday.',
    specs: { Upper: 'Patent leather', Lining: 'Goat leather', Footbed: 'Latex cushioned', Sole: 'Leather + rubber insert', Heel: '8 mm' } }),
  P({ id: 'luma-mira-onyx', style: 'mira', brand: 'luma', name: 'Mira Block Heel', category: 'Heels', gender: 'women', model: 'pump', material: 'patent', price: 160, off: 30, colorName: 'Onyx Patent', rating: 4.4, reviews: 358,
    colors: { upper: '#15151a', accent: '#15151a', sole: '#15151a', heel: '#15151a', lining: '#b88a6a', swatch: '#15151a', bg: '#e9e5e2' },
    blurb: 'A 55 mm block heel you can actually walk in, with an almond toe and a padded, anti-slip heel lining.',
    specs: { Upper: 'Patent leather', Heel: '55 mm block', Toe: 'Almond', Lining: 'Leather', Sole: 'Leather with rubber top lift' } }),
  P({ id: 'luma-mira-almond', style: 'mira', brand: 'luma', name: 'Mira Block Heel', category: 'Heels', gender: 'women', model: 'pump', material: 'leather', price: 160, off: 30, colorName: 'Almond Nappa', rating: 4.5, reviews: 214,
    colors: { upper: '#c99a7c', accent: '#c99a7c', sole: '#8a6048', heel: '#b98a6c', lining: '#e9d3c4', swatch: '#c99a7c', bg: '#f2e7df' },
    blurb: 'Nude-toned nappa that lengthens the leg, on the same comfortable block heel as the Onyx edition.',
    specs: { Upper: 'Nappa leather', Heel: '55 mm block', Toe: 'Almond', Lining: 'Leather', Sole: 'Leather with rubber top lift' } }),

  P({ id: 'pebble-bounce-ocean', style: 'bounce', brand: 'pebble', name: 'Bounce Strap', category: 'Kids', gender: 'kids', model: 'kids', material: 'mesh', price: 58, off: 20, colorName: 'Ocean Pop', rating: 4.7, reviews: 530,
    colors: { upper: '#2dc2b3', overlay: '#ffffff', accent: '#ff5a7a', logo: '#ff5a7a', sole: '#ffffff', outsole: '#ff5a7a', lining: '#17635c', collar: '#17635c', strap: '#ff5a7a', pod: '#ffd84a', swatch: '#2dc2b3', bg: '#dcf3f0' },
    blurb: 'Machine-washable mesh, a flexible sole that bends where little feet bend, and bright straps that make getting ready a game.',
    specs: { Closure: 'Hook & loop', Weight: '150 g (12C)', Upper: 'Washable mesh', Midsole: 'Flex-groove EVA', Outsole: 'Non-marking rubber' } }),
  P({ id: 'pebble-bounce-berry', style: 'bounce', brand: 'pebble', name: 'Bounce Strap', category: 'Kids', gender: 'kids', model: 'kids', material: 'mesh', price: 58, off: 20, colorName: 'Berry Fizz', rating: 4.8, reviews: 312,
    colors: { upper: '#ff6f8f', overlay: '#ffffff', accent: '#7a4bd1', logo: '#7a4bd1', sole: '#ffffff', outsole: '#7a4bd1', lining: '#5a2f9e', collar: '#5a2f9e', strap: '#7a4bd1', pod: '#ffd84a', swatch: '#ff6f8f', bg: '#fde4ea' },
    blurb: 'Berry-pink mesh with violet straps and a sunny heel window. Same easy on-off, same happy feet.',
    specs: { Closure: 'Hook & loop', Weight: '150 g (12C)', Upper: 'Washable mesh', Midsole: 'Flex-groove EVA', Outsole: 'Non-marking rubber' } }),

  P({ id: 'drift-tidewater-black', style: 'tidewater', brand: 'drift', name: 'Tidewater Slip-On', category: 'Skate', gender: 'unisex', model: 'slipon', material: 'canvas', price: 70, off: 30, colorName: 'Black / White', rating: 4.6, reviews: 1456,
    colors: { upper: '#1c1c1c', overlay: '#1c1c1c', accent: '#1c1c1c', logo: '#f2efe9', sole: '#f4f1ea', outsole: '#b98a4f', lining: '#e0dbd2', collar: '#1c1c1c', swatch: '#1c1c1c', bg: '#e7e4de' },
    blurb: '12 oz duck canvas, elastic side gores and a vulcanised waffle sole with the board-feel skaters love.',
    specs: { Upper: '12 oz canvas', Construction: 'Vulcanised', Insole: 'Foam', Outsole: 'Waffle gum rubber', Weight: '330 g (M 9)' } }),
  P({ id: 'drift-tidewater-sage', style: 'tidewater', brand: 'drift', name: 'Tidewater Slip-On', category: 'Skate', gender: 'unisex', model: 'slipon', material: 'canvas', price: 70, off: 30, colorName: 'Sage', rating: 4.5, reviews: 388,
    colors: { upper: '#9aae95', overlay: '#9aae95', accent: '#2c3a2c', logo: '#f4f1ea', sole: '#f4f1ea', outsole: '#f4f1ea', lining: '#e8e4da', collar: '#86997f', swatch: '#9aae95', bg: '#e6ece3' },
    blurb: 'Washed sage canvas with a cream foxing stripe. Beach, boardwalk, backyard.',
    specs: { Upper: '12 oz canvas', Construction: 'Vulcanised', Insole: 'Foam', Outsole: 'Waffle rubber', Weight: '330 g (M 9)' } }),

  P({ id: 'orbit-daily-stone', style: 'daily', brand: 'orbit', name: 'Daily Runner', category: 'Running', gender: 'unisex', model: 'runner', material: 'mesh', price: 110, off: 0, colorName: 'Stone Grey', rating: 4.3, reviews: 276,
    colors: { upper: '#b9b6ae', overlay: '#a5a29a', accent: '#5b4fc4', logo: '#ffffff', sole: '#f3f1ec', outsole: '#6d6a64', lace: '#f3f1ec', lining: '#8e8b84', collar: '#8e8b84', pod: '#5b4fc4', swatch: '#b9b6ae', bg: '#e6e4df' },
    blurb: 'An honest, comfortable everyday runner. Not part of Brand Week — just a fair price all year.',
    specs: { Drop: '10 mm', Weight: '270 g (US 9)', Upper: 'Air mesh', Midsole: 'EVA', Outsole: 'Rubber' } }),
  P({ id: 'orbit-city-olive', style: 'city-hi', brand: 'orbit', name: 'City Hi', category: 'Lifestyle', gender: 'men', model: 'hightop', material: 'suede', price: 115, off: 0, colorName: 'Olive Suede', rating: 4.2, reviews: 141,
    colors: { upper: '#5f6446', overlay: '#4d5238', accent: '#e9e4d6', logo: '#e9e4d6', sole: '#efe9da', outsole: '#6d5a3f', lace: '#e9e4d6', lining: '#3a3d2c', collar: '#3a3d2c', swatch: '#5f6446', bg: '#e6e7dc' },
    blurb: 'Soft olive suede high-top on a cream cupsole. Easy, versatile, dependable.',
    specs: { Upper: 'Suede', Collar: 'Padded', Midsole: 'Cupsole', Outsole: 'Rubber', Weight: '505 g (US 9)' } }),
];
export const productById = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

export const SIZE_GENDER = (p) => (p.gender === 'unisex' ? 'men' : p.gender);
export function sizesFor(p) { return chartFor(p.brand, SIZE_GENDER(p)); }
// deterministic "sold out" sizes so the size grid looks realistic
export function soldOut(p) {
  const rows = sizesFor(p);
  let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out = new Set();
  out.add(rows[h % rows.length].label);
  if (rows.length > 9) out.add(rows[(h >>> 5) % rows.length].label);
  out.delete(rows[Math.floor(rows.length / 2)].label);
  return out;
}

export function salePrice(p) { return p.off ? Math.round(p.price * (100 - p.off)) / 100 : p.price; }
export function fmt(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
export function fmt0(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

export function forGender(p, g) { return g === 'all' || !g ? true : p.gender === g || (p.gender === 'unisex' && (g === 'men' || g === 'women')); }
export function variantsOf(p) { return PRODUCTS.filter((q) => q.style === p.style); }
export function specFor(p) { return { id: p.id, model: p.model, material: p.material, logo: p.brand, brandName: brandById[p.brand].name, gender: p.gender, colors: p.colors }; }

// Deterministic sample reviews
const NAMES = ['Maya R.', 'Jonas K.', 'Priya S.', 'Tom W.', 'Aiko M.', 'Lucas F.', 'Sofia G.', 'Daniel O.', 'Hannah B.', 'Mateo L.', 'Chloe D.', 'Ethan P.'];
const LINES = [
  ['Comfortable straight out of the box', 'Wore them for a full day at a conference and my feet were fine. Colour is exactly like the photos.'],
  ['Great fit after using the Size Assistant', 'I measured my foot like the guide said and ordered the recommended size — perfect.'],
  ['Looks even better in person', 'The 360° view sold me, and it matched what arrived. Build quality feels premium.'],
  ['Runs a touch narrow', 'Beautiful shoe but I’d go half a size up if you have wide feet.'],
  ['Bought two sizes, kept one', 'Merged both sizes into one cart entry, returned the bigger pair for free. Easy.'],
  ['Worth it at the sale price', 'Brand Week discount plus 3 interest-free installments made this a no-brainer.'],
];
export function reviewsFor(p) {
  let h = 7; for (const ch of p.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const out = [];
  for (let i = 0; i < 3; i++) {
    const l = LINES[(h + i * 5) % LINES.length];
    out.push({ name: NAMES[(h + i * 7) % NAMES.length], stars: 5 - ((h >>> (i + 2)) % 3 === 0 ? 1 : 0), title: l[0], body: l[1], fit: ['True to size', 'Slightly small', 'True to size'][(h + i) % 3], date: `${['Aug', 'Jul', 'Jun'][i]} ${((h >>> i) % 26) + 2}, 2026` });
  }
  return out;
}
