// Cover artwork for the nine portfolio projects (vector compositions rendered to WebP).
import { fonts, text, svg, linear, radial, blur, shadow, rng, smoothPath } from './lib.mjs';

const f = fonts;

function aurora() {
  const W = 1600, H = 1200;
  const defs =
    linear('bg', [[0, '#090E2B'], [1, '#171C4D']], 0, 0, 1, 1) +
    blur('glow', 110) +
    linear('area', [[0, '#7C8CFF', 0.5], [1, '#7C8CFF', 0]]) +
    linear('line', [[0, '#5EEAD4'], [0.55, '#7C8CFF'], [1, '#F472B6']], 0, 0, 1, 0) +
    shadow('win', 40, 50, 0.5);
  const r = rng(7);
  const chartX = 400, chartY = 600, chartW = 640, chartH = 300;
  const pts = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const v = 0.45 + 0.22 * Math.sin(t * 5.2 + 0.6) + 0.12 * Math.sin(t * 13) + t * 0.18;
    return [chartX + t * chartW, chartY + chartH - v * chartH];
  });
  const line = smoothPath(pts);
  const area = `${line} L${chartX + chartW} ${chartY + chartH} L${chartX} ${chartY + chartH} Z`;
  const grid = [0, 1, 2, 3].map((i) => `<line x1="${chartX}" x2="${chartX + chartW}" y1="${chartY + (i * chartH) / 3}" y2="${chartY + (i * chartH) / 3}" stroke="#fff" stroke-opacity="0.07" stroke-width="2"/>`).join('');
  const kpi = [
    ['Balance', '€2.48M', '#5EEAD4'],
    ['Revenue · 30d', '+18.2%', '#A5B4FC'],
    ['Transactions', '1,284', '#F9A8D4'],
  ]
    .map(([label, value, c], i) => {
      const x = 370 + i * 360;
      const spark = smoothPath(Array.from({ length: 8 }, (_, k) => [x + 190 + k * 17, 400 - (Math.sin(k * 1.3 + i) * 0.5 + 0.5) * 36 - k * 3]));
      return `<rect x="${x}" y="300" width="330" height="150" rx="24" fill="#171D4C" stroke="#fff" stroke-opacity="0.06"/>
        ${text(f.sans, label, x + 28, 350, 22, { fill: '#8F98D0' })}
        ${text(f.sansSemi, value, x + 28, 415, 46, { fill: '#fff' })}
        <path d="${spark}" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/>`;
    })
    .join('');
  const bars = Array.from({ length: 7 }, (_, i) => {
    const h = 40 + r() * 110;
    return `<rect x="${1140 + i * 36}" y="${960 - h}" width="20" height="${h}" rx="6" fill="${i === 5 ? '#F472B6' : '#3B4488'}"/>`;
  }).join('');
  const circ = 2 * Math.PI * 88;
  const seg = (frac, offset, color) =>
    `<circle cx="1260" cy="640" r="88" fill="none" stroke="${color}" stroke-width="30" stroke-dasharray="${(frac * circ).toFixed(1)} ${circ.toFixed(1)}" stroke-dashoffset="${(-offset * circ).toFixed(1)}" transform="rotate(-90 1260 640)" stroke-linecap="butt"/>`;
  const nav = [0, 1, 2, 3, 4].map((i) => `<rect x="160" y="${330 + i * 70}" width="${i === 0 ? 124 : 100}" height="18" rx="9" fill="#fff" fill-opacity="${i === 0 ? 0.9 : 0.14}"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <ellipse cx="300" cy="170" rx="460" ry="210" fill="#2DD4BF" opacity="0.38" filter="url(#glow)"/>
    <ellipse cx="1320" cy="220" rx="520" ry="230" fill="#8B5CF6" opacity="0.42" filter="url(#glow)"/>
    <ellipse cx="880" cy="1150" rx="640" ry="190" fill="#EC4899" opacity="0.2" filter="url(#glow)"/>
    <g filter="url(#win)">
      <rect x="120" y="150" width="1360" height="900" rx="38" fill="#10153A" stroke="#fff" stroke-opacity="0.09"/>
    </g>
    <path d="M158 150 H320 V1050 H158 A38 38 0 0 1 120 1012 V188 A38 38 0 0 1 158 150 Z" fill="#0C1031"/>
    <circle cx="176" cy="220" r="24" fill="url(#line)"/>
    ${text(f.sansSemi, 'Aurora', 212, 229, 26, { fill: '#fff' })}
    ${nav}
    <rect x="150" y="990" width="140" height="34" rx="17" fill="#fff" fill-opacity="0.08"/>
    ${text(f.sansMedium, 'Good morning, Priya', 370, 230, 36, { fill: '#fff' })}
    ${text(f.sans, 'Here’s your business at a glance', 370, 268, 22, { fill: '#8F98D0' })}
    <rect x="1240" y="198" width="200" height="54" rx="27" fill="#7C8CFF"/>
    ${text(f.sansMedium, 'New transfer', 1340, 233, 22, { fill: '#0B0F2E', anchor: 'middle' })}
    ${kpi}
    <rect x="370" y="480" width="700" height="520" rx="26" fill="#161C4B" stroke="#fff" stroke-opacity="0.06"/>
    ${text(f.sansMedium, 'Cash flow', 400, 530, 26, { fill: '#fff' })}
    ${text(f.sans, 'Last 12 months', 400, 562, 20, { fill: '#8F98D0' })}
    <circle cx="880" cy="523" r="7" fill="#5EEAD4"/>${text(f.sans, 'In', 895, 530, 20, { fill: '#C7CCF0' })}
    <circle cx="950" cy="523" r="7" fill="#F472B6"/>${text(f.sans, 'Out', 965, 530, 20, { fill: '#C7CCF0' })}
    ${grid}
    <path d="${area}" fill="url(#area)"/>
    <path d="${line}" fill="none" stroke="url(#line)" stroke-width="6" stroke-linecap="round"/>
    <circle cx="${pts[9][0]}" cy="${pts[9][1]}" r="11" fill="#fff" stroke="#7C8CFF" stroke-width="5"/>
    <rect x="${pts[9][0] - 70}" y="${pts[9][1] - 78}" width="140" height="50" rx="12" fill="#fff"/>
    ${text(f.sansSemi, '€412k', pts[9][0], pts[9][1] - 44, 24, { fill: '#10153A', anchor: 'middle' })}
    ${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => text(f.sans, m, chartX + 8 + i * (chartW / 11.4), chartY + chartH + 44, 18, { fill: '#6D76B3' })).join('')}
    <rect x="1100" y="480" width="340" height="520" rx="26" fill="#161C4B" stroke="#fff" stroke-opacity="0.06"/>
    ${text(f.sansMedium, 'Spending', 1130, 530, 26, { fill: '#fff' })}
    <circle cx="1260" cy="640" r="88" fill="none" stroke="#252C63" stroke-width="30"/>
    ${seg(0.46, 0, '#7C8CFF')}${seg(0.28, 0.47, '#5EEAD4')}${seg(0.2, 0.76, '#F472B6')}
    ${text(f.sansSemi, '64%', 1260, 652, 34, { fill: '#fff', anchor: 'middle' })}
    ${bars}
    ${text(f.sans, 'Weekly', 1130, 800, 20, { fill: '#8F98D0' })}
  `;
  return svg(W, H, body, defs);
}

function lumen() {
  const W = 1600, H = 2000;
  const defs = linear('bg', [[0, '#FFF3EA'], [1, '#FFE2D2']], 0, 0, 0.4, 1) + linear('card', [[0, '#FFB59E'], [1, '#FF6B4A']], 0, 0, 1, 1) + shadow('sh', 26, 34, 0.12, '#7A2E14') + shadow('sm', 10, 14, 0.1, '#7A2E14');
  const ink = '#1D1A22', coral = '#FF6B4A', muted = '#7B6D66';
  const toggle = (x, y, on) =>
    `<rect x="${x}" y="${y}" width="104" height="58" rx="29" fill="${on ? coral : '#E7D8CF'}"/><circle cx="${on ? x + 75 : x + 29}" cy="${y + 29}" r="22" fill="#fff" filter="url(#sm)"/>`;
  const swatches = [['#FF6B4A', 'coral-500'], ['#FFB59E', 'coral-200'], ['#1D1A22', 'ink-900'], ['#7B6D66', 'ink-500'], ['#3D5AFE', 'indigo-500'], ['#2A9D8F', 'teal-500']]
    .map(([c, n], i) => {
      const x = 880 + (i % 3) * 196, y = 780 + Math.floor(i / 3) * 190;
      return `<rect x="${x}" y="${y}" width="172" height="120" rx="22" fill="${c}"/>${text(f.mono, n, x + 4, y + 158, 22, { fill: muted })}`;
    })
    .join('');
  const lines = (x, y, ws) => ws.map((w, i) => `<rect x="${x}" y="${y + i * 34}" width="${w}" height="16" rx="8" fill="#E9DCD4"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="1450" cy="160" r="260" fill="#FFD4C2" opacity="0.7"/>
    ${text(f.serif, 'Lumen UI', 120, 300, 170, { fill: ink })}
    ${text(f.sans, 'Design system starter kit · v2.0', 126, 370, 36, { fill: muted })}
    <rect x="1170" y="236" width="190" height="64" rx="32" fill="#fff" filter="url(#sm)"/>
    ${text(f.sansSemi, 'WCAG AA', 1265, 279, 26, { fill: '#2A9D8F', anchor: 'middle' })}

    <rect x="120" y="440" width="300" height="92" rx="46" fill="${coral}" filter="url(#sm)"/>
    ${text(f.sansSemi, 'Get started', 270, 499, 32, { fill: '#fff', anchor: 'middle' })}
    <rect x="450" y="440" width="330" height="92" rx="46" fill="none" stroke="${ink}" stroke-width="3"/>
    ${text(f.sansMedium, 'Documentation', 615, 499, 32, { fill: ink, anchor: 'middle' })}
    ${text(f.sansMedium, 'Cancel', 880, 499, 32, { fill: muted, anchor: 'middle' })}
    ${toggle(1010, 457, true)}${toggle(1140, 457, false)}
    <rect x="1290" y="455" width="62" height="62" rx="16" fill="${coral}"/>
    <path d="M1305 487 l12 12 l22 -24" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>

    <rect x="120" y="600" width="1360" height="120" rx="28" fill="#fff" filter="url(#sm)"/>
    ${text(f.sansMedium, 'Email', 160, 648, 24, { fill: muted })}
    ${text(f.sans, 'you@studio.com', 160, 690, 32, { fill: '#B5A69E' })}
    <rect x="1250" y="628" width="200" height="64" rx="32" fill="${ink}"/>
    ${text(f.sansSemi, 'Subscribe', 1350, 670, 26, { fill: '#fff', anchor: 'middle' })}

    <g filter="url(#sh)"><rect x="120" y="780" width="700" height="640" rx="36" fill="#fff"/></g>
    <path d="M156 780 H784 A36 36 0 0 1 820 816 V1100 H120 V816 A36 36 0 0 1 156 780 Z" fill="url(#card)"/>
    <circle cx="330" cy="960" r="120" fill="#fff" opacity="0.28"/>
    <rect x="470" y="870" width="240" height="160" rx="28" fill="#fff" opacity="0.35"/>
    <rect x="160" y="820" width="96" height="44" rx="22" fill="#fff"/>
    ${text(f.sansSemi, 'New', 208, 850, 22, { fill: coral, anchor: 'middle' })}
    ${text(f.sansSemi, 'Aurora report', 160, 1170, 42, { fill: ink })}
    ${lines(160, 1205, [520, 460, 300])}
    ${[0, 1, 2].map((i) => `<circle cx="${190 + i * 52}" cy="1360" r="30" fill="${['#3D5AFE', '#2A9D8F', coral][i]}" stroke="#fff" stroke-width="6"/>`).join('')}
    ${text(f.sans, '+12 collaborators', 330, 1370, 26, { fill: muted })}

    ${swatches}
    <rect x="880" y="1170" width="560" height="250" rx="32" fill="#fff" filter="url(#sm)"/>
    ${text(f.serif, 'Aa', 910, 1370, 210, { fill: ink })}
    ${text(f.sansMedium, 'Instrument Serif', 1140, 1260, 28, { fill: ink })}
    ${text(f.sans, 'Geist Sans', 1140, 1305, 28, { fill: muted })}
    ${text(f.mono, 'Geist Mono', 1140, 1350, 26, { fill: muted })}

    <rect x="120" y="1480" width="660" height="120" rx="26" fill="#E5F6F3"/>
    <circle cx="190" cy="1540" r="26" fill="#2A9D8F"/>
    <path d="M178 1540 l9 9 l17 -19" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(f.sansMedium, 'Changes saved successfully', 240, 1552, 30, { fill: '#1F6F66' })}
    <rect x="120" y="1640" width="660" height="120" rx="26" fill="#FFF0D6"/>
    <circle cx="190" cy="1700" r="26" fill="#E9A23B"/>
    ${text(f.sansSemi, '!', 190, 1712, 34, { fill: '#fff', anchor: 'middle' })}
    ${text(f.sansMedium, 'Your trial ends in 3 days', 240, 1712, 30, { fill: '#8A5A12' })}

    <rect x="880" y="1480" width="560" height="280" rx="32" fill="#fff" filter="url(#sm)"/>
    ${['Overview', 'Tokens', 'Usage'].map((t, i) => text(f.sansMedium, t, 920 + i * 170, 1545, 28, { fill: i === 0 ? ink : muted })).join('')}
    <rect x="920" y="1565" width="112" height="6" rx="3" fill="${coral}"/>
    <rect x="920" y="1640" width="480" height="12" rx="6" fill="#F0E4DC"/>
    <rect x="920" y="1640" width="300" height="12" rx="6" fill="${coral}"/>
    <circle cx="1220" cy="1646" r="22" fill="#fff" stroke="${coral}" stroke-width="6"/>
    ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${1080 + i * 40}" cy="1715" r="${i === 1 ? 10 : 7}" fill="${i === 1 ? ink : '#D8C9C0'}"/>`).join('')}
    ${text(f.sans, '60+ components · Figma · Storybook', 120, 1880, 30, { fill: muted })}
  `;
  return svg(W, H, body, defs);
}

function tidal() {
  const W = 1600, H = 1600;
  const cx = 800, cy = 760, R = 520;
  const defs =
    radial('bg', [[0, '#0C3D5E'], [1, '#021524']], 0.5, 0.45, 0.75) +
    linear('temp', [[0, '#1E40AF'], [0.22, '#0EA5E9'], [0.38, '#2EC4B6'], [0.5, '#FFD166'], [0.58, '#FF7B54'], [0.7, '#2EC4B6'], [0.86, '#0EA5E9'], [1, '#1E3A8A']]) +
    radial('shade', [[0, '#fff', 0.28], [0.45, '#fff', 0], [1, '#000', 0.55]], 0.32, 0.28, 0.85) +
    linear('legend', [[0, '#1E40AF'], [0.35, '#2EC4B6'], [0.65, '#FFD166'], [1, '#FF5A36']], 0, 0, 1, 0) +
    blur('atm', 26) + blur('soft', 6) +
    `<clipPath id="globe"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>`;
  const r = rng(11);
  const land = [
    [[560, 480], [700, 420], [780, 520], [720, 640], [610, 660], [540, 580]],
    [[860, 560], [1010, 520], [1120, 620], [1080, 760], [950, 780], [880, 690]],
    [[640, 820], [760, 800], [820, 920], [760, 1080], [660, 1040], [620, 930]],
    [[980, 900], [1110, 880], [1190, 980], [1120, 1080], [1000, 1060]],
  ]
    .map((p) => `<path d="${smoothPath(p, true)}" fill="#062338" opacity="0.62"/>`)
    .join('');
  const lat = [-0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8]
    .map((t) => {
      const y = cy + t * R;
      const rx = Math.sqrt(1 - t * t) * R;
      return `<ellipse cx="${cx}" cy="${y}" rx="${rx}" ry="${rx * 0.08}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="2"/>`;
    })
    .join('');
  const lon = [0.2, 0.45, 0.7, 0.92].map((t) => `<ellipse cx="${cx}" cy="${cy}" rx="${R * t}" ry="${R}" fill="none" stroke="#fff" stroke-opacity="0.13" stroke-width="2"/>`).join('');
  const dots = Array.from({ length: 90 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(1 + r() * 2.4).toFixed(1)}" fill="#BDF2FF" opacity="${(0.1 + r() * 0.35).toFixed(2)}"/>`).join('');
  const hot = Array.from({ length: 26 }, () => {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.9;
    const x = cx + Math.cos(a) * d, y = cy + (r() - 0.5) * R * 0.5;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(8 + r() * 30).toFixed(0)}" fill="#FF5A36" opacity="${(0.12 + r() * 0.25).toFixed(2)}" filter="url(#soft)"/>`;
  }).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${dots}
    <circle cx="${cx}" cy="${cy}" r="${R + 24}" fill="none" stroke="#5EEAD4" stroke-width="30" opacity="0.28" filter="url(#atm)"/>
    <g clip-path="url(#globe)">
      <rect x="${cx - R}" y="${cy - R}" width="${2 * R}" height="${2 * R}" fill="url(#temp)"/>
      ${hot}
      ${land}
      ${lat}${lon}
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#shade)"/>
    </g>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#9FF3E8" stroke-opacity="0.35" stroke-width="3"/>
    <circle cx="990" cy="700" r="16" fill="#fff"/><circle cx="990" cy="700" r="36" fill="none" stroke="#fff" stroke-width="3" opacity="0.6"/>
    <rect x="1030" y="640" width="330" height="110" rx="22" fill="#021524" fill-opacity="0.82" stroke="#5EEAD4" stroke-opacity="0.4"/>
    ${text(f.mono, 'N 12.4° / W 38.1°', 1056, 684, 24, { fill: '#8EE6DA' })}
    ${text(f.sansSemi, '28.6 °C  +1.9', 1056, 728, 32, { fill: '#fff' })}
    ${text(f.mono, 'TIDAL', 110, 150, 44, { fill: '#fff', tracking: 0.3 })}
    ${text(f.sans, 'Sea-surface temperature · 1985–2025', 112, 198, 28, { fill: '#8EC6D8' })}
    <rect x="500" y="1400" width="600" height="18" rx="9" fill="url(#legend)"/>
    ${text(f.mono, '−2°C', 490, 1470, 26, { fill: '#8EC6D8', anchor: 'end' })}
    ${text(f.mono, '32°C', 1110, 1470, 26, { fill: '#8EC6D8' })}
    <rect x="600" y="1380" width="4" height="58" rx="2" fill="#fff"/>
    ${[1985, 1995, 2005, 2015, 2025].map((y, i) => text(f.mono, String(y), 500 + i * 150, 1520, 22, { fill: '#5C8FA6', anchor: 'middle' })).join('')}
  `;
  return svg(W, H, body, defs);
}

function nordlys() {
  const W = 1600, H = 2134;
  const defs =
    linear('bg', [[0, '#12232A'], [0.55, '#1F3B42'], [1, '#0D1A1E']]) +
    blur('aur', 60) +
    linear('coat', [[0, '#F5D98A'], [0.5, '#E9C46A'], [1, '#B98F2E']], 0, 0, 1, 1) +
    linear('coatDark', [[0, '#C9A13F'], [1, '#9A7322']], 0, 0, 1, 1) +
    shadow('sh', 40, 60, 0.5);
  const ribbon = (y, amp, color, op) => {
    const pts = Array.from({ length: 9 }, (_, i) => [i * 200, y + Math.sin(i * 0.9) * amp]);
    return `<path d="${smoothPath(pts)}" fill="none" stroke="${color}" stroke-width="140" stroke-linecap="round" opacity="${op}" filter="url(#aur)"/>`;
  };
  const r = rng(5);
  const stars = Array.from({ length: 70 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 900).toFixed(0)}" r="${(1 + r() * 2).toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`).join('');
  const swatch = (x, c, sel) =>
    `${sel ? `<circle cx="${x}" cy="1790" r="46" fill="none" stroke="#fff" stroke-width="4"/>` : ''}<circle cx="${x}" cy="1790" r="34" fill="${c}"/>`;
  const sizes = ['XS', 'S', 'M', 'L', 'XL']
    .map((s, i) => {
      const x = 860 + i * 104;
      const sel = s === 'M';
      return `<rect x="${x}" y="1752" width="88" height="76" rx="18" fill="${sel ? '#fff' : 'none'}" stroke="#fff" stroke-opacity="${sel ? 1 : 0.3}" stroke-width="3"/>${text(f.sansSemi, s, x + 44, 1802, 28, { fill: sel ? '#12232A' : '#fff', anchor: 'middle' })}`;
    })
    .join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${stars}
    ${ribbon(260, 90, '#52B788', 0.55)}${ribbon(420, 120, '#2EC4B6', 0.35)}${ribbon(160, 60, '#B7E4C7', 0.3)}
    <path d="M0 1380 L260 1120 L420 1250 L640 980 L860 1230 L1040 1060 L1280 1300 L1600 1080 V1500 H0 Z" fill="#0B171B" opacity="0.9"/>
    <path d="M640 980 L700 1040 L660 1050 L610 1010 Z M1040 1060 L1090 1110 L1040 1100 Z" fill="#E8F1F2" opacity="0.8"/>
    <ellipse cx="800" cy="1400" rx="420" ry="46" fill="#000" opacity="0.35"/>
    <g filter="url(#sh)">
      <path d="M520 560 C470 640 420 900 400 1220 C398 1260 430 1280 470 1270 L560 1250 L600 720 Z" fill="url(#coatDark)"/>
      <path d="M1080 560 C1130 640 1180 900 1200 1220 C1202 1260 1170 1280 1130 1270 L1040 1250 L1000 720 Z" fill="url(#coatDark)"/>
      <path d="M600 470 C640 420 960 420 1000 470 L1080 560 C1060 800 1060 1100 1070 1360 C900 1400 700 1400 530 1360 C540 1100 540 800 520 560 Z" fill="url(#coat)"/>
      <path d="M640 470 C640 330 960 330 960 470 C930 520 670 520 640 470 Z" fill="url(#coatDark)"/>
      <path d="M680 470 C690 380 910 380 920 470 C880 500 720 500 680 470 Z" fill="#3A2C12" opacity="0.55"/>
    </g>
    <path d="M800 500 V1380" stroke="#7A5A1A" stroke-width="8"/>
    <path d="M800 500 V1380" stroke="#F8E3A6" stroke-width="2" stroke-dasharray="6 10"/>
    <rect x="600" y="980" width="150" height="120" rx="20" fill="#C9A13F" opacity="0.7"/>
    <rect x="850" y="980" width="150" height="120" rx="20" fill="#C9A13F" opacity="0.7"/>
    <path d="M540 700 C640 740 960 740 1060 700" fill="none" stroke="#FFF3CC" stroke-opacity="0.35" stroke-width="6"/>
    <rect x="1130" y="420" width="170" height="66" rx="33" fill="#fff" fill-opacity="0.12" stroke="#fff" stroke-opacity="0.35"/>
    ${text(f.sansSemi, '360°', 1215, 464, 30, { fill: '#fff', anchor: 'middle' })}
    <rect x="160" y="1500" width="1280" height="520" rx="44" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.14"/>
    ${text(f.serif, 'Arctic Parka', 220, 1620, 80, { fill: '#fff' })}
    ${text(f.sansSemi, '€349', 1380, 1612, 54, { fill: '#E9C46A', anchor: 'end' })}
    ${text(f.sans, 'Colour · Mustard', 220, 1700, 28, { fill: '#A9C2C6' })}
    ${swatch(260, '#E9C46A', true)}${swatch(370, '#2D6A4F')}${swatch(480, '#1D3557')}${swatch(590, '#BC4749')}${swatch(700, '#F1FAEE')}
    ${text(f.sans, 'Size', 860, 1700, 28, { fill: '#A9C2C6' })}
    ${sizes}
    <rect x="220" y="1880" width="1160" height="96" rx="48" fill="#E9C46A"/>
    ${text(f.sansSemi, 'Add to cart', 800, 1941, 34, { fill: '#12232A', anchor: 'middle' })}
  `;
  return svg(W, H, body, defs);
}

function sonic() {
  const W = 1600, H = 1000;
  const defs =
    radial('bg', [[0, '#1A1030'], [1, '#05040A']], 0.5, 0.55, 0.8) +
    radial('petal', [[0, '#F0ABFC'], [1, '#7C3AED']], 0.5, 0.2, 0.9) +
    radial('petal2', [[0, '#67E8F9'], [1, '#2563EB']], 0.5, 0.2, 0.9) +
    radial('petal3', [[0, '#FDA4AF'], [1, '#DB2777']], 0.5, 0.2, 0.9) +
    blur('glow', 26) + blur('soft', 3);
  const r = rng(21);
  const flower = (x, y, s, fill, n, rot) => {
    const petals = Array.from({ length: n }, (_, i) => {
      const a = rot + (i * 360) / n;
      return `<ellipse cx="${x}" cy="${y - 60 * s}" rx="${24 * s}" ry="${62 * s}" fill="url(#${fill})" opacity="0.85" transform="rotate(${a.toFixed(1)} ${x} ${y})"/>`;
    }).join('');
    return `<g filter="url(#glow)" opacity="0.8">${petals}</g><g>${petals}</g><circle cx="${x}" cy="${y}" r="${18 * s}" fill="#FFF7D6"/><circle cx="${x}" cy="${y}" r="${34 * s}" fill="none" stroke="#FFF7D6" stroke-opacity="0.5" stroke-width="2"/>`;
  };
  const stems = [[380, 470, 330, 960], [800, 360, 860, 960], [1210, 500, 1180, 960], [600, 640, 560, 960], [1010, 660, 1050, 960]]
    .map(([x1, y1, x2, y2]) => `<path d="M${x1} ${y1} C${x1 - 40} ${y1 + 200} ${x2 + 60} ${y2 - 220} ${x2} ${y2}" fill="none" stroke="#3DDC97" stroke-width="6" opacity="0.55"/>`)
    .join('');
  const wave = (y, amp, freq, color, op, sw) => {
    const pts = Array.from({ length: 41 }, (_, i) => [i * 40, y + Math.sin(i * freq) * amp * Math.sin((i / 40) * Math.PI)]);
    return `<path d="${smoothPath(pts)}" fill="none" stroke="${color}" stroke-width="${sw}" opacity="${op}"/>`;
  };
  const particles = Array.from({ length: 140 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.8 + r() * 2.6).toFixed(1)}" fill="${['#F0ABFC', '#67E8F9', '#FDE68A'][Math.floor(r() * 3)]}" opacity="${(0.2 + r() * 0.6).toFixed(2)}"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${particles}
    ${stems}
    ${wave(820, 60, 0.55, '#67E8F9', 0.55, 3)}${wave(850, 90, 0.35, '#C084FC', 0.5, 3)}${wave(880, 40, 0.9, '#FDA4AF', 0.45, 2)}
    ${flower(380, 470, 1.25, 'petal', 9, 8)}
    ${flower(800, 360, 1.6, 'petal2', 12, 0)}
    ${flower(1210, 500, 1.3, 'petal3', 8, 20)}
    ${flower(600, 640, 0.8, 'petal3', 7, 12)}
    ${flower(1010, 660, 0.9, 'petal', 10, 5)}
    ${text(f.mono, 'SONIC GARDEN', 80, 100, 30, { fill: '#E9D5FF', tracking: 0.35 })}
    <circle cx="1400" cy="90" r="9" fill="#FF4D6D"/>
    ${text(f.mono, 'ROOM 3 · LIVE', 1520, 100, 24, { fill: '#E9D5FF', anchor: 'end', tracking: 0.2 })}
  `;
  return svg(W, H, body, defs);
}

function kinetic() {
  const W = 1600, H = 1200;
  const defs = shadow('sh', 20, 26, 0.14, '#5A2A12');
  const word = 'Motion';
  const size = 430;
  const trails = [5, 4, 3, 2, 1]
    .map((i) => {
      const d = f.serifItalic.getPath(word, 130 - i * 46, 620 + i * 10, size, { kerning: true }).toPathData(1);
      return `<path d="${d}" fill="none" stroke="#FF4D2E" stroke-width="3" opacity="${(0.18 + (5 - i) * 0.14).toFixed(2)}"/>`;
    })
    .join('');
  const solid = f.serifItalic.getPath(word, 130, 620, size, { kerning: true }).toPathData(1);
  const keyframes = [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${170 + i * 120}" y="${930}" width="22" height="22" fill="${i === 3 ? '#FF4D2E' : '#161616'}" transform="rotate(45 ${181 + i * 120} 941)"/>`).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="#F4EFE6"/>
    <circle cx="1380" cy="210" r="140" fill="#FF4D2E"/>
    <circle cx="1380" cy="210" r="210" fill="none" stroke="#161616" stroke-width="2" stroke-dasharray="4 12"/>
    ${text(f.mono, 'KINETIC TYPE', 130, 150, 30, { fill: '#161616', tracking: 0.3 })}
    ${text(f.sans, 'v3.2 · open source', 130, 196, 26, { fill: '#6F6860' })}
    ${trails}
    <path d="${solid}" fill="#161616"/>
    <line x1="150" x2="880" y1="941" y2="941" stroke="#161616" stroke-width="3"/>
    ${keyframes}
    <rect x="522" y="890" width="4" height="102" fill="#FF4D2E"/>
    ${text(f.mono, '00:01.24', 150, 1040, 26, { fill: '#6F6860' })}
    <g filter="url(#sh)"><rect x="990" y="740" width="490" height="340" rx="28" fill="#fff"/></g>
    ${[0, 1, 2, 3].map((i) => `<line x1="1030" x2="1440" y1="${800 + i * 70}" y2="${800 + i * 70}" stroke="#EFE8DE" stroke-width="2"/>`).join('')}
    <path d="M1040 1010 C1160 1010 1180 800 1430 800" fill="none" stroke="#161616" stroke-width="6" stroke-linecap="round"/>
    <line x1="1040" y1="1010" x2="1160" y2="1010" stroke="#FF4D2E" stroke-width="3"/>
    <line x1="1430" y1="800" x2="1190" y2="820" stroke="#FF4D2E" stroke-width="3"/>
    <circle cx="1160" cy="1010" r="13" fill="#FF4D2E"/><circle cx="1190" cy="820" r="13" fill="#FF4D2E"/>
    <circle cx="1040" cy="1010" r="9" fill="#161616"/><circle cx="1430" cy="800" r="9" fill="#161616"/>
    ${text(f.mono, 'spring(1, 80, 10)', 1030, 1060, 24, { fill: '#6F6860' })}
  `;
  return svg(W, H, body, defs);
}

function atlas() {
  const W = 1600, H = 2134;
  const defs =
    linear('bg', [[0, '#E3F5FF'], [1, '#BFE6F6']]) +
    linear('photo1', [[0, '#FDBA74'], [1, '#F97316']], 0, 0, 1, 1) +
    linear('photo2', [[0, '#86EFAC'], [1, '#16A34A']], 0, 0, 1, 1) +
    linear('photo3', [[0, '#93C5FD'], [1, '#6366F1']], 0, 0, 1, 1) +
    shadow('phone', 50, 60, 0.3, '#0B3A52') + shadow('card', 16, 24, 0.14, '#0B3A52') +
    `<clipPath id="screen"><rect x="462" y="252" width="676" height="1456" rx="78"/></clipPath>`;
  const contours = [0, 1, 2, 3, 4, 5]
    .map((i) => `<path d="${smoothPath([[0, 300 + i * 300], [400, 250 + i * 310], [800, 330 + i * 290], [1200, 260 + i * 305], [1600, 320 + i * 300]])}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="3"/>`)
    .join('');
  const route = smoothPath([[560, 1060], [650, 900], [800, 860], [900, 700], [1040, 620]]);
  const pin = (x, y, c) => `<circle cx="${x}" cy="${y}" r="26" fill="${c}" stroke="#fff" stroke-width="8"/>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${contours}
    <g filter="url(#phone)"><rect x="430" y="220" width="740" height="1520" rx="104" fill="#0F172A"/></g>
    <g clip-path="url(#screen)">
      <rect x="462" y="252" width="676" height="1456" fill="#EAF2E3"/>
      <path d="M462 520 C600 560 700 460 820 520 C940 580 1040 520 1138 560 V720 C1030 690 940 740 820 690 C700 640 600 720 462 690 Z" fill="#A5DCF2"/>
      <path d="M520 900 C600 820 720 840 760 930 C800 1020 680 1080 600 1050 C520 1020 480 960 520 900 Z" fill="#CDE8C4"/>
      <path d="M900 980 C980 940 1080 980 1100 1060 C1110 1130 1000 1160 940 1120 C880 1080 860 1010 900 980 Z" fill="#CDE8C4"/>
      <path d="M462 800 L1138 760 M620 252 L700 1708 M462 1180 L1138 1100 M960 252 L900 1708" stroke="#fff" stroke-width="22"/>
      <path d="M462 800 L1138 760 M620 252 L700 1708 M462 1180 L1138 1100 M960 252 L900 1708" stroke="#DCE5D7" stroke-width="3"/>
      <path d="${route}" fill="none" stroke="#FF6B4A" stroke-width="10" stroke-linecap="round" stroke-dasharray="4 22"/>
      ${pin(560, 1060, '#FF6B4A')}${pin(800, 860, '#6366F1')}${pin(1040, 620, '#16A34A')}
      <circle cx="900" cy="700" r="46" fill="#3B82F6" opacity="0.18"/><circle cx="900" cy="700" r="16" fill="#3B82F6" stroke="#fff" stroke-width="6"/>
      <rect x="462" y="252" width="676" height="120" fill="#F8FAFC" fill-opacity="0.9"/>
      ${text(f.sansSemi, '9:41', 540, 318, 30, { fill: '#0F172A' })}
      <rect x="1030" y="296" width="60" height="26" rx="8" fill="none" stroke="#0F172A" stroke-width="3"/><rect x="1035" y="301" width="38" height="16" rx="4" fill="#0F172A"/>
      <g filter="url(#card)"><rect x="492" y="1170" width="616" height="510" rx="48" fill="#fff"/></g>
      <rect x="760" y="1192" width="80" height="10" rx="5" fill="#CBD5E1"/>
      ${text(f.serif, 'Day 4 — Sintra', 532, 1290, 62, { fill: '#0F172A' })}
      ${text(f.sans, '12.4 km · 6 photos · Offline', 534, 1340, 28, { fill: '#64748B' })}
      <rect x="532" y="1380" width="170" height="150" rx="24" fill="url(#photo1)"/>
      <rect x="717" y="1380" width="170" height="150" rx="24" fill="url(#photo2)"/>
      <rect x="902" y="1380" width="170" height="150" rx="24" fill="url(#photo3)"/>
      <circle cx="600" cy="1440" r="26" fill="#fff" opacity="0.5"/>
      <path d="M740 1510 L790 1440 L830 1490 L850 1470 L880 1510 Z" fill="#fff" opacity="0.6"/>
      <rect x="532" y="1570" width="520" height="16" rx="8" fill="#E2E8F0"/>
      <rect x="532" y="1604" width="420" height="16" rx="8" fill="#E2E8F0"/>
    </g>
    <rect x="690" y="238" width="220" height="40" rx="20" fill="#0F172A"/>
    <g filter="url(#card)"><rect x="1080" y="380" width="380" height="104" rx="52" fill="#fff"/></g>
    <circle cx="1136" cy="432" r="26" fill="#16A34A"/>
    <path d="M1124 432 l9 9 l16 -18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    ${text(f.sansSemi, 'Offline ready', 1180, 443, 32, { fill: '#0F172A' })}
    <g filter="url(#card)"><rect x="120" y="1500" width="400" height="104" rx="52" fill="#fff"/></g>
    <circle cx="176" cy="1552" r="26" fill="#6366F1"/>
    <path d="M166 1552 a10 10 0 1 1 10 10" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
    ${text(f.sansMedium, 'Synced 2 min ago', 220, 1563, 30, { fill: '#0F172A' })}
  `;
  return svg(W, H, body, defs);
}

function pulse() {
  const W = 1600, H = 1600;
  const green = '#2D6A4F', mint = '#52B788', ink = '#10231A';
  const defs = linear('bg', [[0, '#EAF8F0'], [1, '#D2F0E0']], 0, 0, 1, 1) + shadow('sh', 30, 40, 0.14, '#0B3D26');
  const option = (y, label, sel) => `
    <rect x="410" y="${y}" width="780" height="104" rx="26" fill="${sel ? '#E6F6EC' : '#fff'}" stroke="${sel ? mint : '#DDE8E1'}" stroke-width="${sel ? 4 : 3}"/>
    <circle cx="470" cy="${y + 52}" r="20" fill="${sel ? mint : '#fff'}" stroke="${sel ? mint : '#A9BDB1'}" stroke-width="4"/>
    ${sel ? `<path d="M460 ${y + 52} l7 7 l14 -15" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
    ${text(f.sansMedium, label, 520, y + 64, 34, { fill: ink })}`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <circle cx="1340" cy="260" r="200" fill="#B7E4C7" opacity="0.6"/>
    <path d="M1250 250 c0 -60 80 -80 100 -20 c20 -60 100 -40 100 20 c0 70 -100 120 -100 120 s-100 -50 -100 -120 Z" fill="#fff"/>
    <path d="M1150 330 H1270 L1300 280 L1340 380 L1370 320 H1520" fill="none" stroke="${green}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="360" y="330" width="880" height="1040" rx="48" fill="#fff" opacity="0.5" transform="rotate(-6 800 850)"/>
    <rect x="360" y="330" width="880" height="1040" rx="48" fill="#fff" opacity="0.75" transform="rotate(3 800 850)"/>
    <g filter="url(#sh)"><rect x="360" y="300" width="880" height="1060" rx="48" fill="#fff"/></g>
    ${text(f.sansMedium, 'Step 2 of 4', 410, 390, 28, { fill: '#5B7A69' })}
    <rect x="410" y="420" width="780" height="14" rx="7" fill="#E3EFE7"/>
    <rect x="410" y="420" width="390" height="14" rx="7" fill="${mint}"/>
    ${text(f.serif, 'How are you', 410, 540, 76, { fill: ink })}
    ${text(f.serif, 'feeling today?', 410, 620, 76, { fill: ink })}
    ${option(680, 'Energetic', false)}${option(804, 'Calm', true)}${option(928, 'Tired', false)}${option(1052, 'Stressed', false)}
    <rect x="410" y="1200" width="780" height="100" rx="50" fill="${green}"/>
    ${text(f.sansSemi, 'Continue', 800, 1263, 34, { fill: '#fff', anchor: 'middle' })}
    ${text(f.sans, 'Keyboard: ↑ ↓ to choose, Enter to continue', 800, 1440, 28, { fill: '#5B7A69', anchor: 'middle' })}
    <circle cx="200" cy="1330" r="90" fill="${green}"/>
    <circle cx="200" cy="1290" r="14" fill="#fff"/>
    <path d="M150 1316 H250 M200 1316 V1360 M200 1360 L175 1400 M200 1360 L225 1400" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  `;
  return svg(W, H, body, defs);
}

function orbit() {
  const W = 1600, H = 1000;
  const defs =
    linear('bg', [[0, '#0C0220'], [1, '#27094A']], 0, 0, 1, 1) +
    radial('planet', [[0, '#FF7AD9'], [0.45, '#C026D3'], [1, '#3A0CA3']], 0.35, 0.3, 0.8) +
    radial('moon', [[0, '#A5F3FC'], [1, '#0891B2']], 0.35, 0.3, 0.8) +
    radial('glowG', [[0, '#F72585', 0.55], [1, '#F72585', 0]]) +
    `<clipPath id="front"><rect x="0" y="640" width="1600" height="400"/></clipPath>`;
  const r = rng(3);
  const stars = Array.from({ length: 160 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(0.6 + r() * 1.8).toFixed(1)}" fill="#fff" opacity="${(0.2 + r() * 0.7).toFixed(2)}"/>`).join('');
  const ring = `<ellipse cx="1250" cy="640" rx="520" ry="120" fill="none" stroke="#FFD6FF" stroke-width="16" opacity="0.55" transform="rotate(-16 1250 640)"/>`;
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${stars}
    <ellipse cx="820" cy="560" rx="760" ry="300" fill="none" stroke="#fff" stroke-opacity="0.1" stroke-width="2"/>
    <ellipse cx="820" cy="560" rx="560" ry="200" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="2"/>
    <circle cx="1250" cy="640" r="520" fill="url(#glowG)"/>
    ${ring}
    <circle cx="1250" cy="640" r="320" fill="url(#planet)"/>
    <path d="M950 600 C1080 560 1400 620 1560 580" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="30"/>
    <path d="M960 720 C1100 690 1380 760 1540 720" fill="none" stroke="#000" stroke-opacity="0.12" stroke-width="40"/>
    <g clip-path="url(#front)">${ring}</g>
    <circle cx="330" cy="230" r="64" fill="url(#moon)"/>
    <circle cx="840" cy="170" r="26" fill="#FFD166"/>
    ${text(f.sansSemi, 'ORBIT', 110, 520, 200, { fill: '#fff', tracking: -0.02 })}
    ${text(f.serifItalic, '26', 745, 520, 230, { fill: '#F72585' })}
    ${text(f.sans, 'São Paulo · 14–16 Oct 2025', 118, 600, 38, { fill: '#D9CCFF' })}
    <rect x="118" y="650" width="260" height="84" rx="42" fill="#F72585"/>
    ${text(f.sansSemi, 'Get tickets', 248, 704, 30, { fill: '#fff', anchor: 'middle' })}
    <rect x="398" y="650" width="230" height="84" rx="42" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="3"/>
    ${text(f.sansMedium, 'Schedule', 513, 704, 30, { fill: '#fff', anchor: 'middle' })}
    ${text(f.mono, '48 SPEAKERS · 3 STAGES', 118, 860, 24, { fill: '#9D8BD6', tracking: 0.2 })}
  `;
  return svg(W, H, body, defs);
}

export const projectArt = { aurora, lumen, tidal, nordlys, sonic, kinetic, atlas, pulse, orbit };
