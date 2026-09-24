/* Hand-drawn product "photos": every thumbnail is an SVG rendered to a data URI. */
(function () {
  'use strict';
  const cache = new Map();

  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  const stops = (s) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
  const lg = (id, s, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
  const rg = (id, s, cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`;
  const txt = (x, y, size, fill, s, extra = '') => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="middle" font-family="PingFang SC,Microsoft YaHei,Noto Sans CJK SC,sans-serif" ${extra}>${s}</text>`;

  const ARTS = {
    tshirt({ c = '#2b2b2b', long = false, print = '' }) {
      const hi = shade(c, 0.22), lo = shade(c, -0.22), edge = shade(c, c === '#ffffff' || c === '#f5f5f5' ? -0.3 : -0.4);
      const d = long
        ? 'M39 16 L24 21 L14 44 L11 82 L20 83 L24 50 L29 40 L29 86 L71 86 L71 40 L76 50 L80 83 L89 82 L86 44 L76 21 L61 16 Q50 26 39 16 Z'
        : 'M39 16 L24 21 L11 38 L21 46 L29 39 L29 85 L71 85 L71 39 L79 46 L89 38 L76 21 L61 16 Q50 26 39 16 Z';
      const prints = {
        badge: '<rect x="57" y="30" width="7" height="7" rx="1" fill="#e60012"/><path d="M58.5 33.5h4" stroke="#fff" stroke-width=".9"/>',
        run: txt(50, 45, 8, '#ffffff', 'RUN', 'font-weight="800" font-style="italic" letter-spacing="1"') + '<path d="M38 49 H62" stroke="#ff6a00" stroke-width="2"/>',
      };
      return {
        defs: lg('g', [[0, hi], [0.55, c], [1, lo]], 0, 0, 1, 1) + lg('sh', [[0, '#fff', 0.3], [0.5, '#fff', 0]], 0, 0, 1, 0),
        body: `<path d="${d}" fill="url(#g)" stroke="${edge}" stroke-width=".7" stroke-linejoin="round"/>
          <path d="${d}" fill="url(#sh)"/>
          <path d="M40.5 16.4 Q50 20 59.5 16.4 Q50 23.5 40.5 16.4Z" fill="${edge}" opacity=".5"/>
          <path d="M39 16 Q50 27 61 16" fill="none" stroke="${edge}" stroke-width="2.4"/>
          <path d="M24 21 L29 40 M76 21 L71 40" stroke="${edge}" stroke-width=".7" opacity=".45"/>
          <path d="M33 50 Q35 66 33 82 M66 52 Q64 68 67 82" stroke="${edge}" stroke-width=".8" fill="none" opacity=".22"/>
          ${long ? `<path d="M11.3 79 L20.2 80 M79.8 80 L88.7 79" stroke="${edge}" stroke-width="2" opacity=".6"/>` : ''}
          ${prints[print] || ''}`,
        fw: 27,
      };
    },

    sneaker({ c = '#f6f6f6', a = '#ff6a00', s = '#ffffff' }) {
      const lo = shade(c, -0.16), edge = shade(c, -0.38);
      return {
        defs: lg('u', [[0, shade(c, 0.12)], [1, lo]]) + lg('so', [[0, s], [1, shade(s, -0.14)]]),
        body: `<g transform="rotate(-6 50 64)">
          <path d="M11 66 L93 66 Q95 73 89 77 L19 77 Q10 76 11 66 Z" fill="url(#so)" stroke="#cdcdcd" stroke-width=".7"/>
          <path d="M12 71.5 L93.5 70.5" stroke="${a}" stroke-width="1.6" opacity=".85"/>
          <path d="M16 45 Q22 41 30 44 L42 33 Q47 30 51 34 L59 45 Q75 51 87 56 Q94 59 93 66 L12 66 Q9 55 16 45 Z" fill="url(#u)" stroke="${edge}" stroke-width=".8" stroke-linejoin="round"/>
          <path d="M22 61 Q48 60 80 49 Q62 60 26 64.5 Z" fill="${a}"/>
          <path d="M44 36.5 l6.5-2.2 M47 40.5 l6.5-2.2 M50.5 44.2 l6.5-2.2" stroke="${edge}" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M14 49 Q11.5 57 13.5 64" stroke="${a}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M79 54.5 Q84 60 82 66" stroke="${edge}" stroke-width=".7" fill="none" opacity=".6"/>
          <path d="M30 44 Q34 47 42 34" stroke="${edge}" stroke-width=".8" fill="none" opacity=".5"/>
        </g>`,
        fw: 38, fy: 84,
      };
    },

    earbuds({ c = '#f7f7f7' }) {
      const lo = shade(c, -0.14), edge = shade(c, c === '#f7f7f7' ? -0.3 : 0.25), tip = c === '#f7f7f7' ? '#b9b9b9' : '#111';
      const bud = (x, rot, tx) => `<g transform="rotate(${rot} ${x} 34)">
          <rect x="${x - 3.5}" y="31" width="7" height="20" rx="3.5" fill="url(#k)" stroke="${edge}" stroke-width=".7"/>
          <ellipse cx="${x}" cy="29" rx="8" ry="7.2" fill="url(#k)" stroke="${edge}" stroke-width=".7"/>
          <ellipse cx="${tx}" cy="28" rx="3.2" ry="3.8" fill="${tip}" opacity=".85"/></g>`;
      return {
        defs: lg('k', [[0, shade(c, 0.22)], [1, lo]]),
        body: `<rect x="26" y="46" width="48" height="36" rx="17" fill="url(#k)" stroke="${edge}" stroke-width=".8"/>
          <path d="M27.5 59 H72.5" stroke="${edge}" stroke-width=".8"/>
          <circle cx="50" cy="68" r="1.4" fill="#5ad16f"/>
          ${bud(38, -14, 33.5)}${bud(62, 14, 66.5)}`,
        fw: 28,
      };
    },

    headphones({ c = '#2b2b2b', a = '#8a8a8a' }) {
      const hi = shade(c, 0.25), lo = shade(c, -0.25);
      return {
        defs: lg('h', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<path d="M23 56 Q22 17 50 17 Q78 17 77 56" stroke="${c}" stroke-width="6" fill="none" stroke-linecap="round"/>
          <path d="M25 50 Q25 22 50 21" stroke="#fff" stroke-width="1.2" fill="none" opacity=".25"/>
          <rect x="14" y="48" width="18" height="30" rx="8" fill="url(#h)"/>
          <rect x="68" y="48" width="18" height="30" rx="8" fill="url(#h)"/>
          <rect x="27" y="51" width="7" height="24" rx="3.5" fill="${lo}"/>
          <rect x="66" y="51" width="7" height="24" rx="3.5" fill="${lo}"/>
          <circle cx="23" cy="63" r="3" fill="${a}" opacity=".7"/><circle cx="77" cy="63" r="3" fill="${a}" opacity=".7"/>`,
        fw: 32,
      };
    },

    snack({ c = '#e0892e', label = '每日坚果', sub = 'DAILY NUTS · 30袋' }) {
      const lo = shade(c, -0.25), hi = shade(c, 0.18);
      return {
        defs: lg('p', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<path d="M27 20 H73 L76 82 Q76 86 72 86 H28 Q24 86 24 82 Z" fill="url(#p)"/>
          <path d="M27 20 H73 V26 H27 Z" fill="${lo}"/>
          <path d="M27 22.5 H73" stroke="#fff" stroke-dasharray="1.2 1.2" stroke-width=".8" opacity=".6"/>
          ${txt(50, 41, 9.5, '#fff', label, 'font-weight="700"')}
          ${txt(50, 47.5, 3.6, '#fff', sub, 'opacity=".85" letter-spacing=".5"')}
          <ellipse cx="50" cy="66" rx="17" ry="13" fill="#fff8ec" stroke="${lo}" stroke-width="1"/>
          <ellipse cx="43" cy="63" rx="4.5" ry="3" fill="#c98b4a" transform="rotate(-20 43 63)"/>
          <ellipse cx="55" cy="61" rx="4.5" ry="3" fill="#b8763c" transform="rotate(25 55 61)"/>
          <path d="M46 70 q4 -6 8 0" stroke="#e9c28c" stroke-width="3" fill="none" stroke-linecap="round"/>
          <circle cx="58" cy="69" r="2.4" fill="#c0283b"/><circle cx="41" cy="70" r="2" fill="#7a3a1c"/><circle cx="50" cy="59" r="1.8" fill="#6b8e23"/>
          <path d="M30 26 L32 80" stroke="#fff" stroke-width="2.5" opacity=".18" stroke-linecap="round"/>`,
        fw: 28,
      };
    },

    books() {
      const book = (x, y, w, h, c, n) => `<path d="M${x} ${y} L${x + 4} ${y - 4} H${x + w + 4} L${x + w} ${y} Z" fill="#f1ead9" stroke="#d8cfb9" stroke-width=".5"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>
        <rect x="${x}" y="${y + 5}" width="${w}" height="1.2" fill="#d9b25f"/><rect x="${x}" y="${y + h - 8}" width="${w}" height="1.2" fill="#d9b25f"/>
        ${txt(x + w / 2, y + 18, 7, '#e8c77a', '三', 'font-weight="700"')}${txt(x + w / 2, y + 26, 7, '#e8c77a', '体', 'font-weight="700"')}
        ${txt(x + w / 2, y + h - 12, 5, '#e8c77a', n)}`;
      return {
        body: `${book(20, 30, 19, 54, '#1c2b4d', 'Ⅰ')}${book(39, 24, 20, 60, '#151515', 'Ⅱ')}${book(59, 32, 19, 52, '#6e1b1b', 'Ⅲ')}
          <path d="M78 32 L82 28 V80 L78 84 Z" fill="#4a1111"/>
          <rect x="21" y="31" width="2" height="52" fill="#fff" opacity=".12"/>`,
        fw: 34,
      };
    },

    serum({ c = '#e8872a' }) {
      const lo = shade(c, -0.25);
      return {
        defs: lg('liq', [[0, shade(c, 0.25)], [1, lo]]) + lg('gl', [[0, '#fff', 0.55], [0.4, '#fff', 0.05], [1, '#fff', 0.25]], 0, 0, 1, 0) + lg('cap', [[0, '#555'], [0.5, '#1d1d1d'], [1, '#3a3a3a']], 0, 0, 1, 0),
        body: `<path d="M44 34 V21 Q44 13 50 13 Q56 13 56 21 V34 Z" fill="url(#cap)"/>
          <rect x="42" y="33" width="16" height="9" rx="1.5" fill="#d8b46a"/><rect x="42" y="36" width="16" height="1" fill="#b8913f"/>
          <rect x="35" y="41" width="30" height="44" rx="6" fill="url(#liq)"/>
          <rect x="35" y="41" width="30" height="44" rx="6" fill="url(#gl)"/>
          <rect x="38" y="55" width="24" height="17" rx="1.5" fill="#fffdf8"/>
          ${txt(50, 63.5, 6, '#c0392b', '双抗', 'font-weight="700"')}${txt(50, 69, 3, '#8a6d3b', 'ESSENCE 30ml', 'letter-spacing=".3"')}
          <rect x="38.5" y="44" width="3" height="36" rx="1.5" fill="#fff" opacity=".35"/>`,
        fw: 20,
      };
    },

    thermos({ c = '#2f5d8a' }) {
      const lo = shade(c, -0.3), hi = shade(c, 0.35);
      return {
        defs: lg('b', [[0, lo], [0.35, hi], [0.6, c], [1, lo]], 0, 0, 1, 0) + lg('st', [[0, '#9a9a9a'], [0.35, '#f2f2f2'], [0.65, '#c9c9c9'], [1, '#8e8e8e']], 0, 0, 1, 0),
        body: `<rect x="37" y="15" width="26" height="13" rx="3.5" fill="url(#st)"/>
          <rect x="36" y="27" width="28" height="4" fill="url(#st)"/>
          <rect x="36" y="30" width="28" height="56" rx="5" fill="url(#b)"/>
          <rect x="36" y="78" width="28" height="4" fill="${lo}" opacity=".5"/>
          <circle cx="50" cy="46" r="3.2" fill="none" stroke="#fff" stroke-width="1" opacity=".75"/>
          ${txt(50, 56, 3.6, '#fff', '500ml', 'opacity=".8" letter-spacing=".4"')}`,
        fw: 18,
      };
    },

    keyboard({ c = '#e9e9e9', kc = '#ffffff', a = '#6aa9ff' }) {
      const x0 = 12.2, y0 = 35, kw = 6.4, kh = 6.2, g = 1.3;
      const rows = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [1.5, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.8, 1, 1, 1, 1, 1, 1, 2.2], [1.3, 1.3, 4.8, 1.3, 1.3]];
      let keys = '';
      rows.forEach((row, r) => {
        let x = x0;
        row.forEach((w, i) => {
          const wid = kw * w + g * (w - 1);
          const acc = (r === 0 && i === 0) || (r === 2 && i === row.length - 1);
          keys += `<rect x="${x.toFixed(1)}" y="${(y0 + r * (kh + g)).toFixed(1)}" width="${wid.toFixed(1)}" height="${kh}" rx="1.3" fill="${acc ? a : kc}" stroke="${shade(c, -0.18)}" stroke-width=".35"/>`;
          x += wid + g;
        });
      });
      return {
        defs: lg('b', [[0, shade(c, 0.1)], [1, shade(c, -0.1)]]),
        body: `<g transform="translate(0 6) rotate(-7 50 50)">
          <rect x="9" y="35" width="82" height="36" rx="5" fill="${shade(c, -0.25)}"/>
          <rect x="9" y="31" width="82" height="36" rx="5" fill="url(#b)"/>${keys}</g>`,
        fw: 38,
      };
    },

    tissue() {
      return {
        defs: lg('t', [[0, '#f4f9ff'], [1, '#cfe2f7']]),
        body: `<rect x="26" y="46" width="60" height="36" rx="10" fill="#dcebfa" stroke="#b9d0ea" stroke-width=".8"/>
          <rect x="16" y="40" width="64" height="38" rx="11" fill="url(#t)" stroke="#b5cde8" stroke-width=".8"/>
          <rect x="16" y="60" width="64" height="9" fill="#2f7fd3" opacity=".9"/>
          ${txt(48, 66.6, 5, '#fff', '超韧3层 · 120抽', 'font-weight="700"')}
          ${txt(48, 56, 6.5, '#2f7fd3', '柔韧', 'font-weight="700"')}
          <ellipse cx="48" cy="45" rx="15" ry="3.6" fill="#fff" stroke="#c5d8ee" stroke-width=".7"/>
          <path d="M38 45 Q38 32 47 29 Q55 31 59 45 Z" fill="#fff" stroke="#dde7f2" stroke-width=".7"/>
          <path d="M46 30 Q49 38 48 45" stroke="#e6edf5" stroke-width=".8" fill="none"/>`,
        fw: 34,
      };
    },

    airfryer({ c = '#2d2d2d' }) {
      const hi = shade(c, 0.25), lo = shade(c, -0.3);
      return {
        defs: lg('a', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<rect x="25" y="18" width="50" height="66" rx="15" fill="url(#a)"/>
          <rect x="33" y="25" width="34" height="13" rx="5" fill="#111"/>
          <text x="50" y="34.2" font-size="7" text-anchor="middle" fill="#ff8a3d" font-family="monospace" font-weight="700">200°</text>
          <rect x="32" y="45" width="36" height="21" rx="6" fill="#1b1b1b" stroke="${hi}" stroke-width=".8"/>
          <rect x="35" y="48" width="30" height="15" rx="4" fill="#3a2a1a"/>
          <path d="M38 60 l4-8 M42 61 l3-9 M47 60 l2-8 M51 61 l4-8 M56 60 l3-7 M60 61 l2-6" stroke="#f0b64a" stroke-width="1.6" stroke-linecap="round"/>
          <rect x="35" y="48" width="30" height="15" rx="4" fill="#fff" opacity=".08"/>
          <rect x="39" y="71" width="22" height="6" rx="3" fill="${lo}" stroke="${hi}" stroke-width=".6"/>
          <rect x="28" y="22" width="3" height="56" rx="1.5" fill="#fff" opacity=".12"/>`,
        fw: 28,
      };
    },

    petfood({ c = '#c8102e' }) {
      const lo = shade(c, -0.28), hi = shade(c, 0.18);
      return {
        defs: lg('p', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<path d="M27 17 H73 L77 85 H23 Z" fill="url(#p)"/>
          <path d="M27 17 H73 L73.6 25 H26.4 Z" fill="${lo}"/>
          <path d="M40 62 Q40 50 50 50 Q60 50 60 62 Q60 71 50 71 Q40 71 40 62 Z M41 55 L42 45 L48 51 Z M59 55 L58 45 L52 51 Z" fill="#fff"/>
          <circle cx="46" cy="60" r="1.3" fill="${c}"/><circle cx="54" cy="60" r="1.3" fill="${c}"/><path d="M48.5 64 L51.5 64 L50 65.5 Z" fill="${c}"/>
          ${txt(50, 38, 8, '#fff', 'CAT', 'font-weight="800" letter-spacing="1"')}
          ${txt(50, 80, 4.5, '#fff', '室内成猫 2kg', 'opacity=".9"')}
          <path d="M30 20 L27 82" stroke="#fff" stroke-width="3" opacity=".15" stroke-linecap="round"/>`,
        fw: 30,
      };
    },

    plant() {
      const leaf = (x, y, a, s, c) => `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})"><path d="M0 0 C-3 2 -9 1 -10 -5 C-11 -11 -5 -16 0 -19 C5 -16 11 -11 10 -5 C9 1 3 2 0 0 Z" fill="${c}"/><path d="M0 -1 L0 -17" stroke="#fff" stroke-width=".7" opacity=".45"/><path d="M0 -4 C-3 -6 -5 -9 -6 -12 M0 -4 C3 -6 5 -9 6 -12" stroke="#fff" stroke-width=".4" opacity=".3" fill="none"/></g>`;
      const L = [[50, 56, 0, 1.2, '#3a9d4f'], [40, 58, -40, 1.1, '#2f8a45'], [60, 58, 40, 1.1, '#48ad5a'], [34, 64, -75, 1, '#6cbf4f'], [66, 64, 75, 1, '#2e7d3c'],
        [45, 50, -15, 0.95, '#57b35e'], [56, 50, 20, 0.9, '#3f9a4b'], [30, 77, -115, 0.85, '#4aa655'], [71, 75, 108, 0.8, '#62b85a']];
      return {
        defs: lg('pot', [[0, '#ffffff'], [1, '#dcdcdc']], 0, 0, 1, 0),
        body: `<path d="M33 70 Q26 80 22 88" stroke="#3d8b40" stroke-width="1.1" fill="none"/>
          ${L.map((l) => leaf(...l)).join('')}
          <path d="M33 62 H67 L63 87 Q62 89 60 89 H40 Q38 89 37 87 Z" fill="url(#pot)" stroke="#d0d0d0" stroke-width=".7"/>
          <rect x="31" y="58" width="38" height="6" rx="2" fill="#f7f7f7" stroke="#d4d4d4" stroke-width=".7"/>
          <ellipse cx="50" cy="58.6" rx="16" ry="1.5" fill="#5b3b22"/>`,
        fw: 20, fy: 90,
      };
    },

    charger() {
      return {
        defs: lg('f', [[0, '#ffffff'], [1, '#ececec']]),
        body: `<path d="M52 27 l2.5 -9 M61 27 l2.5 -9" stroke="#bdbdbd" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M31 33 L39 25 H75 L67 33 Z" fill="#ffffff" stroke="#d6d6d6" stroke-width=".7"/>
          <path d="M67 33 L75 25 V71 L67 79 Z" fill="#e2e2e2" stroke="#d2d2d2" stroke-width=".7"/>
          <rect x="31" y="33" width="36" height="46" rx="3" fill="url(#f)" stroke="#d2d2d2" stroke-width=".7"/>
          <rect x="45" y="42" width="8" height="3" rx="1.5" fill="#3a3a3a"/><rect x="45" y="50" width="8" height="3" rx="1.5" fill="#3a3a3a"/>
          <rect x="44" y="58" width="10" height="4" rx=".6" fill="#3a3a3a"/><rect x="45.5" y="59" width="7" height="1.4" fill="#2f7fe0"/>
          ${txt(49, 72.5, 5, '#a0a0a0', '65W', 'font-weight="700"')}`,
        fw: 24,
      };
    },

    teatin({ c = '#2d7a4f' }) {
      const lo = shade(c, -0.3), hi = shade(c, 0.3);
      return {
        defs: lg('b', [[0, lo], [0.35, hi], [0.7, c], [1, lo]], 0, 0, 1, 0) + lg('gd', [[0, '#a8842f'], [0.4, '#f3d98b'], [1, '#a07a25']], 0, 0, 1, 0),
        body: `<rect x="31" y="20" width="38" height="11" rx="3" fill="url(#gd)"/>
          <rect x="33" y="30" width="34" height="56" rx="3" fill="url(#b)"/>
          <rect x="33" y="80" width="34" height="3" fill="url(#gd)" opacity=".9"/>
          <rect x="38" y="40" width="24" height="30" rx="2" fill="#f7f1e1"/>
          ${txt(50, 53, 8.5, lo, '龙井', 'font-weight="800"')}${txt(50, 62, 4, '#8a7650', '明前特级 250g')}
          <rect x="55.5" y="64" width="4.5" height="4.5" fill="#c0392b"/>
          <path d="M20 87 q5 -7 11 -3 q-5 5 -11 3Z M70 88 q4 -8 11 -5 q-4 6 -11 5Z" fill="#6aa84f"/>`,
        fw: 26,
      };
    },

    oranges() {
      const o = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#o)"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#dots)" opacity=".3"/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.3}" ry="${r * 0.17}" fill="#fff" opacity=".4" transform="rotate(-30 ${x - r * 0.35} ${y - r * 0.4})"/>`;
      return {
        defs: rg('o', [[0, '#ffc15a'], [0.6, '#ff8c1a'], [1, '#e0620b']], 0.38, 0.35, 0.7) + '<pattern id="dots" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".35" fill="#b34700"/></pattern>',
        body: `${o(36, 66, 16)}${o(64, 67, 15)}${o(50, 45, 15.5)}
          <path d="M50 30 q1 -4 3 -6" stroke="#6b4a1e" stroke-width="1.4" fill="none" stroke-linecap="round"/>
          <path d="M52 27 q10 -8 17 -2 q-8 7 -17 2Z" fill="#3f9b3f"/><path d="M52 27 q8 -3 15 -2" stroke="#2f7a2f" stroke-width=".6" fill="none"/>`,
        fw: 34,
      };
    },

    dress({ c = '#3d6db5' }) {
      const lo = shade(c, -0.25);
      const d = 'M41 13 L43 27 Q37 33 39 44 L22 85 Q50 91 78 85 L61 44 Q63 33 57 27 L59 13 L56.5 13 L54 25 Q50 27.5 46 25 L43.5 13 Z';
      return {
        defs: `<pattern id="fl" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="${c}"/><circle cx="2.5" cy="2.5" r="1.3" fill="#fff" opacity=".9"/><circle cx="2.5" cy="2.5" r=".5" fill="#ffd166"/><circle cx="7" cy="6.8" r="1" fill="#ffc8dd" opacity=".9"/></pattern>` + lg('sh', [[0, '#000', 0], [1, '#000', 0.22]], 0, 0, 1, 0),
        body: `<path d="${d}" fill="url(#fl)" stroke="${lo}" stroke-width=".7" stroke-linejoin="round"/><path d="${d}" fill="url(#sh)"/>
          <path d="M39 44 Q50 47 61 44" stroke="${lo}" stroke-width="2" fill="none"/>
          <path d="M44 48 Q40 66 34 86 M56 48 Q60 66 66 86 M50 47 V89" stroke="${lo}" stroke-width=".7" fill="none" opacity=".35"/>`,
        fw: 30,
      };
    },

    bricks() {
      const brick = (x, y, w, h, c, n) => {
        const hi = shade(c, 0.25), lo = shade(c, -0.22);
        let studs = '';
        const sw = (w - 4) / n;
        for (let i = 0; i < n; i++) studs += `<rect x="${x + 2 + i * sw + sw * 0.15}" y="${y - 5}" width="${sw * 0.7}" height="6" rx="1.4" fill="${c}"/><rect x="${x + 2 + i * sw + sw * 0.15}" y="${y - 5}" width="${sw * 0.7}" height="1.6" rx=".8" fill="${hi}"/>`;
        return `${studs}<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${c}"/><rect x="${x}" y="${y}" width="${w}" height="2" fill="${hi}" opacity=".7"/><rect x="${x}" y="${y + h - 3}" width="${w}" height="3" fill="${lo}"/>`;
      };
      return { body: brick(16, 60, 68, 22, '#d7261e', 4) + brick(30, 40, 34, 20, '#f5c400', 2) + brick(64, 44, 18, 16, '#1e6fd9', 1), fw: 36 };
    },

    lipstick({ c = '#b5121b' }) {
      const hi = shade(c, 0.3), lo = shade(c, -0.25);
      return {
        defs: lg('gold', [[0, '#9c7a2f'], [0.45, '#f5dc93'], [1, '#8e6b22']], 0, 0, 1, 0) + lg('bk', [[0, '#3a3a3a'], [0.45, '#0e0e0e'], [1, '#2a2a2a']], 0, 0, 1, 0) + lg('lp', [[0, hi], [1, lo]], 0, 0, 1, 0),
        body: `<g transform="rotate(-8 50 60)">
          <path d="M42 42 V27 L57 19 V42 Z" fill="url(#lp)"/>
          <rect x="40.5" y="40" width="18" height="12" rx="1" fill="url(#gold)"/>
          <rect x="39" y="51" width="21" height="35" rx="2" fill="url(#bk)"/><rect x="39" y="51" width="21" height="2.5" fill="url(#gold)"/>
          <rect x="42" y="55" width="2" height="28" rx="1" fill="#fff" opacity=".18"/></g>
          <g transform="rotate(12 72 71)"><rect x="64" y="56" width="17" height="30" rx="2" fill="url(#bk)"/><rect x="64" y="56" width="17" height="3" fill="url(#gold)"/></g>`,
        fw: 28,
      };
    },

    lamp() {
      return {
        defs: rg('glow', [[0, '#fff3b8', 0.95], [1, '#fff3b8', 0]], 0.5, 0, 1) + lg('m', [[0, '#fdfdfd'], [1, '#d6d6d6']]),
        body: `<path d="M61 35 L87 39 L98 88 L40 88 Z" fill="url(#glow)" opacity=".85"/>
          <ellipse cx="36" cy="84" rx="17" ry="4.5" fill="#dcdcdc"/>
          <rect x="20" y="78" width="32" height="6" rx="3" fill="url(#m)" stroke="#cfcfcf" stroke-width=".6"/>
          <path d="M36 79 L44 46 L70 30" stroke="#cfcfcf" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M36 79 L44 46 L70 30" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
          <circle cx="44" cy="46" r="3" fill="#e9e9e9" stroke="#cfcfcf" stroke-width=".7"/>
          <path d="M62 27 L88 31 Q90 32 89 34 L87 38 L60 34 Z" fill="url(#m)" stroke="#cdcdcd" stroke-width=".7"/>
          <path d="M61 34 L87 38" stroke="#ffe680" stroke-width="1.6"/>`,
        fw: 26, fy: 88,
      };
    },

    umbrella({ c = '#1f3b63' }) {
      const hi = shade(c, 0.32), lo = shade(c, -0.25);
      return {
        defs: rg('u', [[0, hi], [1, lo]], 0.4, 0.15, 0.95),
        body: `<path d="M50 70 V86 Q50 90 46 90 Q42.5 90 42.5 86.5" stroke="#6b4a2b" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M50 19 V72" stroke="#8a8a8a" stroke-width="1.6"/><path d="M50 19 V13" stroke="#777" stroke-width="1.8" stroke-linecap="round"/>
          <path d="M14 52 Q17 22 50 19 Q83 22 86 52 Q80 47 74 52 Q68 47 62 52 Q56 47 50 52 Q44 47 38 52 Q32 47 26 52 Q20 47 14 52 Z" fill="url(#u)"/>
          <path d="M50 19 Q30 27 26 52 M50 19 Q40 28 38 52 M50 19 V52 M50 19 Q60 28 62 52 M50 19 Q70 27 74 52" stroke="${lo}" stroke-width=".8" fill="none" opacity=".6"/>
          <path d="M22 40 Q28 26 44 22" stroke="#fff" stroke-width="1.6" fill="none" opacity=".25" stroke-linecap="round"/>`,
        fw: 22, fy: 91,
      };
    },

    watch({ c = '#1f1f1f', s = '#3b3b3b' }) {
      return {
        defs: lg('st', [[0, shade(s, 0.15)], [1, shade(s, -0.2)]], 0, 0, 1, 0) + lg('bz', [[0, '#e6e6e6'], [0.5, '#8f8f8f'], [1, '#d0d0d0']], 0, 0, 1, 1),
        body: `<rect x="39" y="8" width="22" height="30" rx="5" fill="url(#st)"/><rect x="39" y="62" width="22" height="31" rx="5" fill="url(#st)"/>
          <circle cx="50" cy="73" r="1.2" fill="#1a1a1a"/><circle cx="50" cy="79" r="1.2" fill="#1a1a1a"/><circle cx="50" cy="85" r="1.2" fill="#1a1a1a"/>
          <rect x="69" y="45" width="4" height="8" rx="1.5" fill="#9a9a9a"/>
          <circle cx="50" cy="50" r="21" fill="url(#bz)"/><circle cx="50" cy="50" r="18" fill="${c}"/>
          <circle cx="50" cy="50" r="14.5" fill="none" stroke="#2c2c2c" stroke-width="2"/>
          <path d="M50 35.5 A14.5 14.5 0 1 1 36.2 45.5" fill="none" stroke="#ff6a3d" stroke-width="2" stroke-linecap="round"/>
          ${txt(50, 52.5, 8.5, '#fff', '10:08', 'font-weight="700"')}${txt(50, 58.5, 3.4, '#9adf8f', '♥72 · 8642步')}`,
        fw: 20, fy: 94,
      };
    },

    toothbrush({ a = '#35a0e0' }) {
      return {
        defs: lg('h', [[0, '#dcdcdc'], [0.4, '#ffffff'], [1, '#d3d3d3']], 0, 0, 1, 0),
        body: `<ellipse cx="50" cy="86" rx="13" ry="3.5" fill="#e0e0e0"/>
          <rect x="43" y="36" width="14" height="50" rx="7" fill="url(#h)" stroke="#d3d3d3" stroke-width=".6"/>
          <rect x="47" y="15" width="6" height="23" rx="3" fill="url(#h)" stroke="#d3d3d3" stroke-width=".6"/>
          <rect x="45.5" y="10" width="9" height="11" rx="2.5" fill="${a}" opacity=".85"/>
          <path d="M46.8 12 v7 M48.8 12 v7 M50.8 12 v7 M52.8 12 v7" stroke="#fff" stroke-width=".8" opacity=".7"/>
          <circle cx="50" cy="55" r="3" fill="${a}"/><circle cx="50" cy="55" r="1.2" fill="#fff" opacity=".8"/>
          <rect x="43" y="67" width="14" height="2" fill="${a}" opacity=".8"/>`,
        fw: 16, fy: 88,
      };
    },

    brushheads({ a = '#35a0e0' }) {
      const head = (x) => `<rect x="${x - 3}" y="30" width="6" height="42" rx="3" fill="url(#h)" stroke="#d3d3d3" stroke-width=".6"/>
        <rect x="${x - 4.5}" y="22" width="9" height="11" rx="2.5" fill="${a}" opacity=".85"/><rect x="${x - 3}" y="62" width="6" height="2" fill="${a}"/>`;
      return {
        defs: lg('h', [[0, '#dcdcdc'], [0.4, '#ffffff'], [1, '#d3d3d3']], 0, 0, 1, 0),
        body: `<rect x="24" y="16" width="52" height="68" rx="4" fill="#f4f8fc" stroke="#cfdbe8" stroke-width=".8"/>${head(38)}${head(50)}${head(62)}
          ${txt(50, 80, 4.5, '#35a0e0', '替换刷头 ×3', 'font-weight="700"')}`,
        fw: 30,
      };
    },

    water() {
      const b = (x, dy) => `<g transform="translate(${x} ${dy})">
        <path d="M-7 32 Q-7 25 -3 23 V17 H3 V23 Q7 25 7 32 V83 Q7 87 3 87 H-3 Q-7 87 -7 83 Z" fill="url(#w)" stroke="#9cc9ea" stroke-width=".7"/>
        <rect x="-3.8" y="12" width="7.6" height="6" rx="1.2" fill="#e63946"/>
        <rect x="-7" y="50" width="14" height="15" fill="#e63946"/><path d="M-5 62 L-1.5 55 L1 58.5 L2.5 56.5 L5 62 Z" fill="#fff"/>
        <path d="M-4.5 35 V80" stroke="#fff" stroke-width="1.6" opacity=".6" stroke-linecap="round"/></g>`;
      return { defs: lg('w', [[0, '#e8f5ff'], [1, '#bcdcf5']], 0, 0, 1, 0), body: b(35, -2) + b(65, -2) + b(50, 2), fw: 30, fy: 90 };
    },

    backpack({ c = '#34424a' }) {
      const hi = shade(c, 0.2), lo = shade(c, -0.25);
      return {
        defs: lg('b', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<path d="M44 17 Q50 9 56 17" stroke="${lo}" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M27 32 Q27 17 42 16 H58 Q73 17 73 32 V80 Q73 87 66 87 H34 Q27 87 27 80 Z" fill="url(#b)"/>
          <path d="M31 38 Q50 32 69 38" stroke="${shade(c, -0.45)}" stroke-width="1.2" fill="none"/>
          <rect x="33" y="52" width="34" height="28" rx="7" fill="${hi}" stroke="${lo}" stroke-width=".8"/>
          <path d="M36 58 H64" stroke="#d0d0d0" stroke-width=".7" stroke-dasharray="1 1"/>
          <rect x="45" y="65" width="10" height="5" rx="1" fill="#f2f2f2"/><rect x="61" y="56" width="1.6" height="6" rx=".8" fill="#ddd"/>
          <path d="M30 26 Q28 50 30 78" stroke="#fff" stroke-width="2" opacity=".12" fill="none"/>`,
        fw: 28,
      };
    },

    pillow() {
      let holes = '';
      for (let y = 45; y <= 63; y += 6) for (let x = 24; x <= 76; x += 6.5) {
        const dx = (x - 50) / 33, dy = (y - 54) / 17;
        if (dx * dx + dy * dy < 0.8) holes += `<circle cx="${x + (y % 12 ? 3 : 0)}" cy="${y}" r=".9" fill="#dcc9a5"/>`;
      }
      return {
        defs: lg('p', [[0, '#fffaf0'], [1, '#ecdcbf']]),
        body: `<path d="M14 54 Q12 36 30 35 Q50 30 70 35 Q88 36 86 54 Q88 72 70 72 Q50 76 30 72 Q12 72 14 54 Z" fill="url(#p)" stroke="#dfcca8" stroke-width=".8"/>
          <path d="M20 47 Q50 37 80 47 M19 60 Q50 52 81 60" stroke="#e3d2b0" stroke-width="1" fill="none"/>${holes}`,
        fw: 36, fy: 80,
      };
    },

    sunglasses() {
      const lens = (m) => `<path d="M${50 + m * 36} 40 H${50 + m * 6} Q${50 + m * 4} 40 ${50 + m * 4} 43 Q${50 + m * 5} 58 ${50 + m * 17} 60 Q${50 + m * 30} 61 ${50 + m * 34} 50 Z" fill="url(#l)" stroke="#1a1a1a" stroke-width="2"/>`;
      return {
        defs: lg('l', [[0, '#5b6b7c'], [1, '#10161b']]),
        body: `<path d="M14 42 L5 36 M86 42 L95 36" stroke="#1d1d1d" stroke-width="2.4" stroke-linecap="round"/>
          ${lens(-1)}${lens(1)}
          <path d="M46 43 Q50 39.5 54 43" stroke="#1a1a1a" stroke-width="2.2" fill="none"/>
          <path d="M19 44 L28 44 L20 55 Z M59 44 L68 44 L60 55 Z" fill="#fff" opacity=".16"/>`,
        fw: 34, fy: 74,
      };
    },

    phonecase({ c = '#9fbad6' }) {
      const lo = shade(c, -0.2), hi = shade(c, 0.25);
      return {
        defs: lg('c', [[0, hi], [1, lo]], 0, 0, 1, 1),
        body: `<rect x="29" y="10" width="42" height="80" rx="9" fill="url(#c)" stroke="${shade(c, -0.35)}" stroke-width=".8"/>
          <rect x="33" y="14" width="19" height="19" rx="5" fill="${shade(c, -0.3)}" opacity=".9"/>
          <circle cx="38.5" cy="19.5" r="3.4" fill="#1b1b1b" stroke="#6a6a6a" stroke-width=".8"/>
          <circle cx="38.5" cy="28" r="3.4" fill="#1b1b1b" stroke="#6a6a6a" stroke-width=".8"/>
          <circle cx="46.5" cy="23.7" r="3.4" fill="#1b1b1b" stroke="#6a6a6a" stroke-width=".8"/><circle cx="46.5" cy="17.5" r="1" fill="#f5f0d0"/>
          <circle cx="50" cy="56" r="11" fill="none" stroke="#fff" stroke-width="1.3" opacity=".7"/><path d="M50 68 V73" stroke="#fff" stroke-width="1.3" opacity=".7"/>
          <rect x="32" y="12" width="3" height="74" rx="1.5" fill="#fff" opacity=".2"/>`,
        fw: 22, fy: 92,
      };
    },

    box() {
      return {
        body: `<path d="M20 38 L50 26 L80 38 L50 50 Z" fill="#e2b77c"/><path d="M20 38 V74 L50 86 V50 Z" fill="#c9965a"/><path d="M80 38 V74 L50 86 V50 Z" fill="#b8844a"/>
          <path d="M35 32 L65 44 V54 L59 51 V44" fill="none" stroke="#f3dcb4" stroke-width="3"/>`,
        fw: 30,
      };
    },
  };

  function build(spec) {
    const r = (ARTS[spec.k] || ARTS.box)(spec);
    const bg = spec.bg || ['#fcfcfc', '#eeeeee'];
    const floor = `<ellipse cx="50" cy="${r.fy || 87}" rx="${r.fw || 30}" ry="3.6" fill="#000" opacity=".15" filter="url(#blur)"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${rg('bg', [[0, bg[0]], [1, bg[1]]], 0.5, 0.38, 0.78)}<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>${r.defs || ''}</defs><rect width="100" height="100" fill="url(#bg)"/>${floor}${r.body}</svg>`;
  }

  function url(spec) {
    const key = JSON.stringify(spec);
    if (!cache.has(key)) cache.set(key, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(build(spec).replace(/\s{2,}/g, ' ')));
    return cache.get(key);
  }

  const AVATAR = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><rect width="64" height="64" fill="#fff1e6"/>
    <path d="M13 34 L16 13 L29 25 Z M51 34 L48 13 L35 25 Z" fill="#ffa24c"/><path d="M17 29 L18.5 18 L25 25 Z M47 29 L45.5 18 L39 25 Z" fill="#ffd2b0"/>
    <ellipse cx="32" cy="39" rx="21" ry="18" fill="#ffa24c"/><path d="M27 23 v6 M32 22 v7 M37 23 v6" stroke="#e67e22" stroke-width="2.2" stroke-linecap="round"/>
    <ellipse cx="32" cy="46" rx="11" ry="8" fill="#fff4e8"/>
    <ellipse cx="24.5" cy="38" rx="2.4" ry="3" fill="#3c2a1e"/><ellipse cx="39.5" cy="38" rx="2.4" ry="3" fill="#3c2a1e"/>
    <circle cx="25.3" cy="37" r=".8" fill="#fff"/><circle cx="40.3" cy="37" r=".8" fill="#fff"/>
    <path d="M30.3 43 h3.4 l-1.7 2z" fill="#ff7f8a"/><path d="M29 47 q1.5 1.8 3 0 q1.5 1.8 3 0" stroke="#3c2a1e" stroke-width="1.1" fill="none" stroke-linecap="round"/>
    <circle cx="19" cy="45" r="3" fill="#ff8a8a" opacity=".45"/><circle cx="45" cy="45" r="3" fill="#ff8a8a" opacity=".45"/></svg>`;

  window.Art = { url, svg: build, shade, avatar: () => AVATAR };
})();
