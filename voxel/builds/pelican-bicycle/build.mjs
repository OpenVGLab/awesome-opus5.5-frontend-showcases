// A pelican riding a bicycle — voxel build for a 256^3 grid (y is up).
// Bicycle runs along +x in the plane z = 128; the pelican sits on the saddle,
// wings gripping the handlebar, webbed feet on the pedals, beak pouch hanging.
export default function build(world) {
  const W = world;
  const ZC = 128;
  let seed = 20260924;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const R = Math.round;
  const put = (x, y, z, b) => W.set(R(x), R(y), R(z), b);
  const putE = (x, y, z, b) => {
    x = R(x); y = R(y); z = R(z);
    if (W.get(x, y, z) === null) W.set(x, y, z, b);
  };
  const ball = (cx, cy, cz, r, b, emptyOnly = false) => {
    const r2 = r * r;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++) {
          const dx = x - cx, dy = y - cy, dz = z - cz;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          if (emptyOnly && W.get(x, y, z) !== null) continue;
          W.set(x, y, z, b);
        }
  };
  const tube = (a, c, r0, r1, b, emptyOnly = false) => {
    const L = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = Math.max(1, Math.ceil(L * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = r0 + (r1 - r0) * t;
      const x = a[0] + (c[0] - a[0]) * t, y = a[1] + (c[1] - a[1]) * t, z = a[2] + (c[2] - a[2]) * t;
      if (r < 0.9) { if (emptyOnly) putE(x, y, z, b); else put(x, y, z, b); }
      else ball(x, y, z, r, b, emptyOnly);
    }
  };
  // Catmull-Rom through points of any dimension (extra components interpolate too)
  const spline = (pts, per) => {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let s = 0; s < per; s++) {
        const t = s / per, t2 = t * t, t3 = t2 * t;
        out.push(p1.map((_, k) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(pts[pts.length - 1].slice());
    return out;
  };
  // ellipsoid pitched about the z axis (positive pitch lifts the +x end)
  const ellipsoid = (cx, cy, cz, rx, ry, rz, pitch, color) => {
    const c = Math.cos(pitch), s = Math.sin(pitch), m = Math.max(rx, ry) + 1;
    for (let x = Math.floor(cx - m); x <= Math.ceil(cx + m); x++)
      for (let y = Math.floor(cy - m); y <= Math.ceil(cy + m); y++)
        for (let z = Math.floor(cz - rz - 1); z <= Math.ceil(cz + rz + 1); z++) {
          const dx = x - cx, dy = y - cy, dz = z - cz;
          const lx = dx * c + dy * s, ly = -dx * s + dy * c;
          if ((lx / rx) ** 2 + (ly / ry) ** 2 + (dz / rz) ** 2 > 1) continue;
          W.set(x, y, z, typeof color === 'function' ? color(lx, ly, dz) : color);
        }
  };
  // annulus in the x-y plane, extruded over z0..z1, optionally limited to an angle range (degrees)
  const ringXY = (cx, cy, z0, z1, r0, r1, b, a0, a1) => {
    for (let x = Math.floor(cx - r1); x <= Math.ceil(cx + r1); x++)
      for (let y = Math.floor(cy - r1); y <= Math.ceil(cy + r1); y++) {
        const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy);
        if (r < r0 || r > r1) continue;
        if (a0 !== undefined) {
          const a = Math.atan2(dy, dx) * 180 / Math.PI;
          const inR = (v) => v >= a0 && v <= a1;
          if (!(inR(a) || inR(a + 360) || inR(a - 360))) continue;
        }
        for (let z = z0; z <= z1; z++) W.set(x, y, z, b);
      }
  };

  // ---------------- ground: round meadow with a country road ----------------
  for (let x = 0; x < 256; x++)
    for (let z = 0; z < 256; z++) {
      const d = Math.hypot(x - 127.5, z - 127.5);
      if (d > 125) continue;
      W.set(x, 0, z, 'dirt');
      W.set(x, 1, z, 'dirt');
      let top = 'grass';
      if (z >= 100 && z <= 156) {
        top = 'asphalt';
        if (z === 103 || z === 153) top = 'white';
        else if ((z === 127 || z === 128) && (x + 4) % 20 < 11) top = 'yellow';
      } else if (z === 98 || z === 99 || z === 157 || z === 158) {
        top = 'concrete';
        W.set(x, 3, z, 'concrete');
      }
      W.set(x, 2, z, top);
    }
  const flowerCols = ['yellow', 'white', 'pink', 'red', 'magenta', 'light_blue', 'orange'];
  for (let i = 0; i < 520; i++) {
    const x = R(rnd() * 255), z = R(rnd() * 255);
    if (Math.hypot(x - 127.5, z - 127.5) > 121 || (z >= 95 && z <= 161)) continue;
    if (rnd() < 0.5) {
      W.set(x, 3, z, 'green');
      W.set(x, 4, z, flowerCols[Math.floor(rnd() * flowerCols.length)]);
    } else {
      W.set(x, 3, z, rnd() < 0.5 ? 'green' : 'lime');
      if (rnd() < 0.3) W.set(x, 4, z, 'green');
    }
  }
  const bush = (bx, bz, r, blossom) => {
    for (let x = bx - r; x <= bx + r; x++)
      for (let z = bz - r; z <= bz + r; z++)
        for (let y = 3; y <= 3 + r; y++) {
          const dx = (x - bx) / r, dy = (y - 3) / (r * 0.8), dz = (z - bz) / r;
          const n = dx * dx + dy * dy + dz * dz;
          if (n > 1 || (n > 0.8 && rnd() < 0.35)) continue;
          let b = rnd() < 0.15 ? 'green' : 'leaves';
          if (blossom && n > 0.6 && rnd() < 0.12) b = blossom;
          W.set(x, y, z, b);
        }
  };
  bush(34, 52, 11, 'pink'); bush(62, 30, 8); bush(206, 44, 12, 'white'); bush(230, 76, 8);
  bush(48, 200, 10); bush(80, 228, 7, 'yellow'); bush(210, 206, 11, 'pink'); bush(182, 232, 8);

  // ---------------- bicycle ----------------
  const RA = [78, 37], FA = [176, 37], BB = [122, 32];
  const ax = (y) => 176 - 0.32 * (y - 37); // steering axis through the front axle
  const wheel = ([cx, cy], phase) => {
    for (let dz = -2; dz <= 2; dz++) {
      const e = Math.abs(dz) === 2;
      ringXY(cx, cy, ZC + dz, ZC + dz, e ? 31.2 : 29.8, e ? 33.4 : 34.3, 'black');
    }
    ringXY(cx, cy, ZC - 1, ZC + 1, 27.2, 29.8, 'steel');
    for (let i = 0; i < 24; i++) {
      const a = phase + (i / 24) * Math.PI * 2;
      const side = i % 2 ? 2 : -2, a2 = a + (side > 0 ? 0.18 : -0.18);
      tube([cx + 2.5 * Math.cos(a), cy + 2.5 * Math.sin(a), ZC + side],
        [cx + 27.6 * Math.cos(a2), cy + 27.6 * Math.sin(a2), ZC], 0, 0, 'light_gray');
    }
    for (let z = -3; z <= 3; z++) ringXY(cx, cy, ZC + z, ZC + z, 0, Math.abs(z) === 3 ? 3.3 : 2.2, 'steel');
    tube([cx, cy, ZC - 6], [cx, cy, ZC + 6], 0, 0, 'dark_gray');
  };
  wheel(RA, 0.1);
  wheel(FA, 0.25);
  // mudguards with stays
  ringXY(RA[0], RA[1], ZC - 3, ZC + 3, 35.6, 37.2, 'white', 40, 200);
  ringXY(FA[0], FA[1], ZC - 3, ZC + 3, 35.6, 37.2, 'white', -15, 140);
  for (const dz of [-4, 4]) {
    tube([RA[0] + 36.4 * Math.cos(200 * Math.PI / 180), RA[1] + 36.4 * Math.sin(200 * Math.PI / 180), ZC + dz], [RA[0], RA[1], ZC + dz], 0, 0, 'steel');
    tube([FA[0] + 36.4 * Math.cos(-15 * Math.PI / 180), FA[1] + 36.4 * Math.sin(-15 * Math.PI / 180), ZC + dz], [FA[0], FA[1], ZC + dz], 0, 0, 'steel');
  }
  // frame (teal)
  const F = 'cyan';
  tube([BB[0], BB[1], ZC], [104, 86, ZC], 1.6, 1.6, F);                 // seat tube
  tube([106, 80, ZC], [ax(86), 86, ZC], 1.5, 1.5, F);                     // top tube
  tube([ax(76), 76, ZC], [BB[0], BB[1], ZC], 1.9, 1.9, F);                // down tube
  tube([ax(73), 73, ZC], [ax(91), 91, ZC], 2.3, 2.3, F);                  // head tube
  for (const s of [-1, 1]) {
    tube([107, 77, ZC + 2 * s], [RA[0], RA[1], ZC + 4.5 * s], 1.1, 1.1, F);   // seat stays
    tube([BB[0], BB[1], ZC + 2 * s], [RA[0], RA[1], ZC + 4.5 * s], 1.1, 1.1, F); // chain stays
    tube([ax(71), 71, ZC + 5 * s], [FA[0], FA[1], ZC + 4.5 * s], 1.2, 1.2, F); // fork blades
  }
  tube([ax(71), 71, ZC - 6], [ax(71), 71, ZC + 6], 1.6, 1.6, F);         // fork crown
  tube([BB[0], BB[1], ZC - 4], [BB[0], BB[1], ZC + 4], 2.6, 2.6, F);     // bottom bracket shell
  // cockpit
  tube([ax(91), 91, ZC], [ax(97), 97, ZC], 1.2, 1.2, 'steel');           // steerer
  tube([ax(97), 97, ZC], [164, 99, ZC], 1.3, 1.3, 'steel');              // stem
  tube([164, 99, 109], [164, 99, 147], 1, 1, 'steel');                    // handlebar
  tube([164, 99, 106], [164, 99, 113], 1.4, 1.4, 'brown');                // grips
  tube([164, 99, 143], [164, 99, 150], 1.4, 1.4, 'brown');
  ball(163, 101.5, 118, 1.6, 'gold');                                     // bell
  tube([104, 86, ZC], [102.5, 91, ZC], 1.1, 1.1, 'steel');                // seat post
  // drivetrain on the +z side
  ringXY(BB[0], BB[1], 135, 135, 6.5, 9.4, 'steel');
  ringXY(BB[0], BB[1], 135, 135, 9.4, 10.6, 'dark_gray');
  for (let i = 0; i < 5; i++) {
    const a = i * 2 * Math.PI / 5 + 0.3;
    tube([BB[0], BB[1], 135], [BB[0] + 7 * Math.cos(a), BB[1] + 7 * Math.sin(a), 135], 0, 0, 'steel');
  }
  ringXY(RA[0], RA[1], 135, 135, 0, 4.4, 'steel');
  ringXY(RA[0], RA[1], 135, 135, 4.4, 5.4, 'dark_gray');
  tube([BB[0], BB[1] + 10.5, 135], [RA[0], RA[1] + 5.2, 135], 0, 0, 'dark_gray'); // chain
  tube([BB[0], BB[1] - 10.5, 135], [RA[0], RA[1] - 5.2, 135], 0, 0, 'dark_gray');
  const pedR = [BB[0] + 15 * Math.cos(-35 * Math.PI / 180), BB[1] + 15 * Math.sin(-35 * Math.PI / 180)];
  const pedL = [BB[0] + 15 * Math.cos(145 * Math.PI / 180), BB[1] + 15 * Math.sin(145 * Math.PI / 180)];
  tube([BB[0], BB[1], 119], [BB[0], BB[1], 137], 1, 1, 'gray');          // spindle
  tube([BB[0], BB[1], 137], [pedR[0], pedR[1], 137], 1, 1, 'gray');      // cranks
  tube([BB[0], BB[1], 119], [pedL[0], pedL[1], 119], 1, 1, 'gray');
  W.fill(R(pedR[0]) - 3, R(pedR[1]) - 1, 139, R(pedR[0]) + 3, R(pedR[1]) + 1, 144, 'dark_gray');
  W.fill(R(pedL[0]) - 3, R(pedL[1]) - 1, 112, R(pedL[0]) + 3, R(pedL[1]) + 1, 117, 'dark_gray');
  // front basket full of fish, on a rack down to the front axle
  const bx0 = 168, bx1 = 190, by0 = 80, by1 = 96, bz0 = 117, bz1 = 139;
  for (let x = bx0; x <= bx1; x++)
    for (let y = by0; y <= by1; y++)
      for (let z = bz0; z <= bz1; z++) {
        const edge = x === bx0 || x === bx1 || z === bz0 || z === bz1;
        if (y === by0) W.set(x, y, z, 'wood');
        else if (edge) W.set(x, y, z, y === by1 ? 'brown' : ((y + ((x + z) >> 1)) % 3 === 0 ? 'wood' : 'planks'));
        else if (y <= 92) W.set(x, y, z, rnd() < 0.45 ? 'light_gray' : rnd() < 0.6 ? 'steel' : 'light_blue');
      }
  for (const s of [-1, 1]) {
    tube([bx0 + 2, by0, ZC + 6 * s], [FA[0], FA[1], ZC + 6 * s], 0, 0, 'steel');
    tube([bx1 - 2, by0, ZC + 6 * s], [FA[0], FA[1], ZC + 6 * s], 0, 0, 'steel');
    tube([164, 99, ZC + 4 * s], [bx0, 93, ZC + 4 * s], 0, 0, 'steel');
  }
  const fishTail = (x, y, z, b) => {
    for (let dx = 0; dx <= 1; dx++) {
      for (let k = 0; k <= 3; k++) put(x + dx, y + k, z, b);
      for (const s of [-1, 1]) { put(x + dx, y + 4, z + s, b); put(x + dx, y + 5, z + 2 * s, b); put(x + dx, y + 5, z + s, b); }
    }
  };
  fishTail(173, 93, 123, 'steel'); fishTail(181, 93, 134, 'light_gray'); fishTail(186, 93, 124, 'steel');
  ball(177, 94, 129, 2.3, 'light_blue');
  put(177, 95, 126.6, 'black'); put(177, 95, 131.4, 'black');

  // ---------------- pelican ----------------
  const PITCH = 10 * Math.PI / 180;
  ellipsoid(110, 110, ZC, 28, 17, 16, PITCH, (lx, ly) => (ly < -12 && lx < 2 ? 'light_gray' : 'white'));
  // tail feathers
  for (let i = 0; i <= 14; i++) {
    const x = 86 - i, y = 106 - i * 0.3, hz = 5 + i * 0.3;
    for (let dz = -Math.floor(hz); dz <= Math.floor(hz); dz++)
      for (let dy = 0; dy <= (i < 10 ? 2 : 1); dy++)
        put(x, y + dy, ZC + dz, i > 10 ? 'light_gray' : 'white');
  }
  // legs: feathered thighs, orange shanks, webbed feet on the pedals
  const legs = [
    { hip: [116, 98, 134], knee: [140, 64, 138], ank: [R(pedR[0]) - 3, R(pedR[1]) + 4, 141], fy: R(pedR[1]) + 2, fz: 141, fx: R(pedR[0]) - 5 },
    { hip: [112, 98, 122], knee: [134, 72, 118], ank: [R(pedL[0]) - 2, R(pedL[1]) + 4, 116], fy: R(pedL[1]) + 2, fz: 116, fx: R(pedL[0]) - 4 },
  ];
  for (const L of legs) {
    ball(L.hip[0], L.hip[1], L.hip[2], 5.5, 'white');
    tube(L.hip, L.knee, 2.6, 2.2, 'orange');
    ball(L.knee[0], L.knee[1], L.knee[2], 2.8, 'orange');
    tube(L.knee, L.ank, 2.1, 1.6, 'orange');
    tube(L.ank, [L.fx + 1, L.fy + 1, L.fz], 1.5, 1.2, 'orange');
    for (let i = 0; i <= 13; i++) {
      const hw = Math.round(1 + i * 0.42);
      for (let dz = -hw; dz <= hw; dz++) put(L.fx + i, L.fy, L.fz + dz, 'orange');
    }
    for (const dz of [-6, 0, 6]) {
      tube([L.fx + 1, L.fy + 1, L.fz], [L.fx + 13, L.fy + 1, L.fz + dz], 0, 0, 'orange');
      put(L.fx + 14, L.fy, L.fz + dz, 'dark_gray');
    }
  }
  // S-curved neck (x, y, z, radius)
  const neck = spline([[128, 112, ZC, 8.5], [136, 124, ZC, 7.6], [141, 136, ZC, 6.6], [140, 147, ZC, 6.1],
    [136, 156, ZC, 5.9], [138, 164, ZC, 5.9], [144, 170, ZC, 6.2]], 6);
  for (const p of neck) ball(p[0], p[1], p[2], p[3], 'white');
  // head with a shaggy crest
  ellipsoid(147, 173, ZC, 10.5, 8.5, 7.5, 0, 'white');
  tube([138, 178, ZC], [132, 181, ZC], 1.2, 0.8, 'light_gray');
  tube([139, 180, ZC], [134, 185, ZC], 1.1, 0.8, 'white');
  tube([140, 181, ZC - 1], [136, 186, ZC - 2], 1, 0, 'light_gray');
  // long bill: yellow upper mandible, big orange throat pouch
  const B0 = [155, 174.5], B1 = [205, 162];
  const nb = Math.ceil(Math.hypot(B1[0] - B0[0], B1[1] - B0[1]) * 2);
  for (let i = 0; i <= nb; i++) {
    const t = i / nb, x = B0[0] + (B1[0] - B0[0]) * t, y = B0[1] + (B1[1] - B0[1]) * t;
    const w = 4.2 - 2 * t;
    if (t > 0.03 && t < 0.86) {
      const tt = (t - 0.03) / 0.83;
      const D = 21 * Math.pow(Math.sin(Math.PI * Math.pow(tt, 0.8)), 0.75);
      for (let k = 0; k <= D; k++) {
        const s = k / (D + 0.001);
        const hz = (w + 1.2 * Math.sin(Math.PI * Math.min(1, s * 1.6))) * Math.sqrt(Math.max(0, 1 - s * s));
        for (let dz = -Math.floor(hz); dz <= Math.floor(hz); dz++) put(x, y - 2 - k, ZC + dz, 'orange');
      }
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -Math.floor(w); dz <= Math.floor(w); dz++)
        put(x, y + dy, ZC + dz, dy === 1 && dz === 0 ? 'orange' : 'yellow');
    put(x, y - 2, ZC - Math.floor(w), 'yellow');
    put(x, y - 2, ZC + Math.floor(w), 'yellow');
  }
  tube([B1[0] - 1, B1[1] + 1, ZC], [B1[0] + 1.5, B1[1] - 3, ZC], 1.2, 1, 'orange'); // hooked tip
  // wings reach forward to the grips; white coverts, black flight feathers
  for (const s of [-1, 1]) {
    const mz = (z) => ZC + s * (ZC - z);
    const arm = spline([[121, 117, mz(114)], [129, 113, mz(108)], [141, 107, mz(105)], [153, 102, mz(107)], [160, 100.5, mz(110)]], 8);
    arm.forEach((p, i) => ball(p[0], p[1], p[2], 5.5 - 3 * (i / (arm.length - 1)), 'white'));
    arm.forEach((p, i) => {
      const u = i / (arm.length - 1), r = 5.5 - 3 * u, d = Math.round(13 * (1 - u) + 3);
      for (let k = 1; k <= d; k++)
        for (let dz = -1; dz <= 1; dz++) putE(p[0], p[1] - r + 1 - k, p[2] + dz, k > d - 5 ? 'black' : 'white');
    });
    const wr = [160, 100.5, mz(110)];
    for (const e of [[168, 102, mz(107)], [169, 99, mz(109)], [168, 96, mz(111)], [165, 95, mz(113)]]) tube(wr, e, 1.2, 0.8, 'black');
  }
  // red scarf with a fluttering tail
  let sc = neck[0];
  for (const p of neck) if (Math.abs(p[1] - 127) < Math.abs(sc[1] - 127)) sc = p;
  const sr = sc[3] + 1.6;
  for (let dy = -2; dy <= 2; dy++)
    for (let x = Math.floor(sc[0] - sr); x <= Math.ceil(sc[0] + sr); x++)
      for (let z = Math.floor(ZC - sr); z <= Math.ceil(ZC + sr); z++)
        if (Math.hypot(x - sc[0], z - ZC) <= sr) W.set(x, R(sc[1]) + dy, z, dy === 0 ? 'white' : 'red');
  const scarf = spline([[sc[0] - sc[3], sc[1] + 1, ZC], [sc[0] - 16, sc[1] + 4, ZC - 3], [sc[0] - 28, sc[1] + 9, ZC - 1],
    [sc[0] - 38, sc[1] + 12, ZC - 4], [sc[0] - 46, sc[1] + 17, ZC - 2]], 8);
  scarf.forEach((p, i) => {
    for (let dy = -2; dy <= 1; dy++)
      for (let dz = 0; dz <= 1; dz++) put(p[0], p[1] + dy, p[2] + dz, i % 12 < 3 ? 'white' : 'red');
  });
  // eyes: pink facial skin with a black eye, painted onto the head surface
  const paintZ = (x, y, fromZ, dir, b) => {
    for (let z = fromZ, n = 0; n < 40; z += dir, n++)
      if (W.get(x, y, z) !== null) { W.set(x, y, z, b); return; }
  };
  for (const [fz, dir] of [[110, 1], [146, -1]]) {
    for (let x = 150; x <= 153; x++) for (let y = 175; y <= 177; y++) paintZ(x, y, fz, dir, 'pink');
    for (let x = 151; x <= 152; x++) for (let y = 176; y <= 177; y++) paintZ(x, y, fz, dir, 'black');
  }
  // saddle last so it shows under the bird
  for (let x = 92; x <= 112; x++) {
    const hz = Math.round(5.5 - 3.5 * (x - 92) / 20);
    for (let dz = -hz; dz <= hz; dz++) {
      put(x, 91, ZC + dz, 'brown');
      put(x, 92, ZC + dz, 'brown');
      putE(x, 93, ZC + dz, 'brown');
      if (x <= 94) putE(x, 94, ZC + dz, 'brown');
    }
  }
}
