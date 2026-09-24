// Illustrated headshot of the (fictional) portfolio owner, drawn as flat vector shapes.
import { svg, linear, radial, blur, rng } from './lib.mjs';

export function portrait({ W = 1600, H = 2000 } = {}) {
  const skin = '#F2C4A4', skinShade = '#E0A47F', hair = '#1E1719', hairLight = '#3A2B2C';
  const sweater = '#B5452B', sweaterDark = '#8F3220', ink = '#231A1A';
  const r = rng(9);
  const defs =
    linear('bg', [[0, '#F7E3D3'], [1, '#EFC7AC']], 0, 0, 0.6, 1) +
    radial('halo', [[0, '#FF6A4D', 0.55], [1, '#FF6A4D', 0]], 0.5, 0.5, 0.5) +
    linear('sweater', [[0, sweater], [1, sweaterDark]], 0, 0, 0, 1) +
    linear('hair', [[0, hairLight], [0.4, hair], [1, hair]], 0, 0, 1, 1) +
    linear('lens', [[0, '#FFFFFF', 0.45], [1, '#FFFFFF', 0.05]], 0, 0, 1, 1) +
    blur('soft', 18);
  const dots = Array.from({ length: 60 }, (_, i) => {
    const x = 120 + (i % 10) * 36, y = 180 + Math.floor(i / 10) * 36;
    return `<circle cx="${x}" cy="${y}" r="4" fill="#B5452B" opacity="0.28"/>`;
  }).join('');
  const confetti = Array.from({ length: 14 }, () => {
    const x = 1100 + r() * 400, y = 1300 + r() * 500, s = 10 + r() * 16;
    return `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${s.toFixed(0)}" height="${(s * 0.4).toFixed(0)}" rx="3" fill="${['#FF6A4D', '#3D5AFE', '#2A9D8F', '#E9C46A'][Math.floor(r() * 4)]}" opacity="0.7" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
  }).join('');
  const body = `
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${dots}
    <circle cx="800" cy="930" r="640" fill="url(#halo)"/>
    <circle cx="800" cy="900" r="520" fill="#FFF4EC" opacity="0.55"/>
    <path d="M1260 330 a90 90 0 1 1 -0.1 0" fill="none" stroke="#3D5AFE" stroke-width="10" opacity="0.5"/>
    <path d="M200 1500 q60 -60 120 0 t120 0 t120 0" fill="none" stroke="#2A9D8F" stroke-width="12" stroke-linecap="round" opacity="0.6"/>
    ${confetti}

    <path d="M455 800 C430 520 610 330 812 330 C1020 330 1180 500 1150 800 L1175 1190 C1120 1230 1030 1225 985 1185 L620 1185 C575 1225 485 1230 430 1190 Z" fill="url(#hair)"/>

    <path d="M705 1080 L705 1330 C760 1370 840 1370 895 1330 L895 1080 Z" fill="${skinShade}"/>
    <path d="M300 2000 C300 1640 420 1450 650 1385 C720 1365 880 1365 950 1385 C1180 1450 1300 1640 1300 2000 Z" fill="url(#sweater)"/>
    <path d="M660 1290 C660 1250 940 1250 940 1290 L960 1420 C890 1460 710 1460 640 1420 Z" fill="${sweater}"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${690 + i * 32} 1280 L${680 + i * 34} 1440" stroke="${sweaterDark}" stroke-width="5" opacity="0.5"/>`).join('')}
    <path d="M660 1290 C720 1320 880 1320 940 1290" fill="none" stroke="${sweaterDark}" stroke-width="6" opacity="0.6"/>

    <ellipse cx="572" cy="885" rx="38" ry="62" fill="${skinShade}"/>
    <ellipse cx="1028" cy="885" rx="38" ry="62" fill="${skinShade}"/>
    <path d="M800 540 C955 540 1035 665 1035 845 C1035 1010 935 1150 800 1160 C665 1150 565 1010 565 845 C565 665 645 540 800 540 Z" fill="${skin}"/>
    <path d="M620 1050 C680 1150 740 1165 800 1168 C860 1165 920 1150 980 1050 C940 1130 880 1170 800 1172 C720 1170 660 1130 620 1050 Z" fill="${skinShade}" opacity="0.6"/>

    <path d="M560 900 C530 640 650 460 815 455 C990 450 1085 610 1052 900 C1040 790 1010 715 955 668 C880 720 745 725 648 672 C600 725 575 800 560 900 Z" fill="url(#hair)"/>
    <path d="M648 672 C700 600 790 560 900 575 C860 600 820 640 800 700 C740 710 690 695 648 672 Z" fill="${hairLight}" opacity="0.55"/>
    <path d="M540 900 C520 1000 530 1110 560 1180 L610 1180 C585 1100 575 1000 590 900 Z" fill="${hair}"/>
    <path d="M1060 900 C1080 1000 1070 1110 1040 1180 L990 1180 C1015 1100 1025 1000 1010 900 Z" fill="${hair}"/>

    <path d="M655 772 Q705 745 752 766" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>
    <path d="M848 766 Q895 745 945 772" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round"/>
    <ellipse cx="705" cy="850" rx="17" ry="20" fill="${ink}"/>
    <ellipse cx="895" cy="850" rx="17" ry="20" fill="${ink}"/>
    <circle cx="711" cy="843" r="5" fill="#fff"/><circle cx="901" cy="843" r="5" fill="#fff"/>
    <path d="M682 822 Q705 812 728 822" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    <path d="M872 822 Q895 812 918 822" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity="0.6"/>

    <circle cx="705" cy="852" r="74" fill="url(#lens)" stroke="#1A1414" stroke-width="12"/>
    <circle cx="895" cy="852" r="74" fill="url(#lens)" stroke="#1A1414" stroke-width="12"/>
    <path d="M779 846 Q800 828 821 846" fill="none" stroke="#1A1414" stroke-width="11" stroke-linecap="round"/>
    <path d="M631 838 L574 826" stroke="#1A1414" stroke-width="10" stroke-linecap="round"/>
    <path d="M969 838 L1026 826" stroke="#1A1414" stroke-width="10" stroke-linecap="round"/>
    <path d="M660 810 Q680 792 705 790" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.7"/>
    <path d="M850 810 Q870 792 895 790" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.7"/>

    <path d="M800 880 C792 935 786 962 800 978 C812 984 826 980 834 970" fill="none" stroke="${skinShade}" stroke-width="9" stroke-linecap="round"/>
    <ellipse cx="655" cy="975" rx="48" ry="26" fill="#F0857A" opacity="0.35"/>
    <ellipse cx="945" cy="975" rx="48" ry="26" fill="#F0857A" opacity="0.35"/>
    <path d="M742 1040 Q800 1082 858 1040 Q800 1064 742 1040 Z" fill="#C4574A"/>
    <path d="M760 1044 Q800 1060 840 1044" fill="none" stroke="#fff" stroke-width="5" opacity="0.8"/>

    <circle cx="566" cy="960" r="15" fill="#E9C46A"/>
    <circle cx="1034" cy="960" r="15" fill="#E9C46A"/>
    <circle cx="566" cy="960" r="6" fill="#fff" opacity="0.6"/>
  `;
  return svg(W, H, body, defs);
}
