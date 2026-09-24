// The road: a closed path built like a turtle drawing (straight, pitch, yaw), with its own "down".
// Frame convention (also used by every model): +X = right (b), +Y = up (n), -Z = forward (t).
import * as THREE from 'three';
import { HW, THICK, BAR } from './config.js';

const DEG = Math.PI / 180;

export function makeFrame() {
  return { p: new THREE.Vector3(), t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3(), q: new THREE.Quaternion() };
}

export class Track {
  constructor() {
    const rf = 10;
    const foldLen = Math.PI / 2 * rf;
    const Lst = 9 * BAR;
    const Lcoda = 13 * BAR;
    const R = Lcoda / Math.PI;
    // Ground street: two swerves, then the fold up the wall.
    const rg = 60, thg = 30 * DEG;
    const aSum = Lst - 8 * rg * thg - foldLen;
    // Wall street: its climb must equal the loop's diameter minus the two folds.
    const thw = 50 * DEG;
    const Wnet = 2 * R - 2 * rf;
    const rw = (Lst - foldLen - Wnet) / (8 * (thw - Math.sin(thw)));
    const bSum = Lst - foldLen - 8 * rw * thw;
    // Ceiling street: must travel back exactly as far as the ground street went.
    const D0 = aSum + 8 * rg * Math.sin(thg);
    const thc = 45 * DEG;
    const rc = (Lst - D0) / (8 * (thc - Math.sin(thc)));
    const cSum = Lst - 8 * rc * thc;

    const segs = [];
    const S = (len) => segs.push({ t: 0, len, ang: 0 });
    const P = (ang, r) => segs.push({ t: 1, len: Math.abs(ang) * r, ang });
    const Y = (ang, r) => segs.push({ t: 2, len: Math.abs(ang) * r, ang });
    const swerve = (dir, th, r) => { Y(dir * th, r); Y(-2 * dir * th, r); Y(dir * th, r); };

    S(aSum * 0.30); swerve(1, thg, rg); S(aSum * 0.34); swerve(-1, thg, rg); S(aSum * 0.36); P(Math.PI / 2, rf);
    S(bSum * 0.30); swerve(-1, thw, rw); S(bSum * 0.30); swerve(1, thw, rw); S(bSum * 0.40); P(Math.PI / 2, rf);
    S(cSum * 0.30); swerve(1, thc, rc); S(cSum * 0.35); swerve(-1, thc, rc); S(cSum * 0.35);
    P(Math.PI, R);

    // Integrate (midpoint rule).
    const dS = [0];
    const dP = [new THREE.Vector3(0, THICK, 0)];
    const dQ = [new THREE.Quaternion()];
    const p = dP[0].clone();
    const q = new THREE.Quaternion();
    const f = new THREE.Vector3();
    const dq = new THREE.Quaternion();
    const AX = new THREE.Vector3(1, 0, 0);
    const AY = new THREE.Vector3(0, 1, 0);
    let s = 0;
    for (const g of segs) {
      const n = Math.max(1, Math.ceil(g.len / 0.2));
      const ds = g.len / n;
      if (g.t) dq.setFromAxisAngle(g.t === 1 ? AX : AY, g.ang / n / 2);
      for (let i = 0; i < n; i++) {
        if (g.t) q.multiply(dq);
        f.set(0, 0, -1).applyQuaternion(q);
        p.addScaledVector(f, ds);
        if (g.t) q.multiply(dq);
        q.normalize();
        s += ds;
        dS.push(s); dP.push(p.clone()); dQ.push(q.clone());
      }
    }
    const L = s;
    this.L = L;
    this.closureError = dP[dP.length - 1].distanceTo(dP[0]);
    const err = dP[dP.length - 1].clone().sub(dP[0]);
    for (let i = 0; i < dP.length; i++) dP[i].addScaledVector(err, -dS[i] / L);

    // The sheet-music loop twists once around its own centre line.
    const coda0 = 3 * Lst;
    const tw0 = coda0 + Lcoda * 0.22;
    const tw1 = coda0 + Lcoda * 0.78;
    const roll = (x) => {
      if (x <= tw0 || x >= tw1) return 0;
      let u = (x - tw0) / (tw1 - tw0);
      u = u * u * u * (u * (u * 6 - 15) + 10);
      return u * Math.PI * 2;
    };

    // Resample onto a uniform grid.
    const N = Math.round(L / 0.5);
    this.N = N;
    this.ds = L / N;
    this.P = new Float32Array((N + 1) * 3);
    this.T = new Float32Array((N + 1) * 3);
    this.Nn = new Float32Array((N + 1) * 3);
    this.B = new Float32Array((N + 1) * 3);
    this.Q = new Float32Array((N + 1) * 4);
    const qa = new THREE.Quaternion();
    const qr = new THREE.Quaternion();
    const AZ = new THREE.Vector3(0, 0, 1);
    const v = new THREE.Vector3();
    const pp = new THREE.Vector3();
    let j = 0;
    for (let i = 0; i < N; i++) {
      const src = i * this.ds;
      while (j < dS.length - 2 && dS[j + 1] < src) j++;
      const t = Math.min(1, Math.max(0, (src - dS[j]) / (dS[j + 1] - dS[j])));
      pp.lerpVectors(dP[j], dP[j + 1], t);
      qa.slerpQuaternions(dQ[j], dQ[j + 1], t);
      qr.setFromAxisAngle(AZ, roll(src));
      qa.multiply(qr).normalize();
      this.P.set([pp.x, pp.y, pp.z], i * 3);
      v.set(0, 0, -1).applyQuaternion(qa); this.T.set([v.x, v.y, v.z], i * 3);
      v.set(0, 1, 0).applyQuaternion(qa); this.Nn.set([v.x, v.y, v.z], i * 3);
      v.set(1, 0, 0).applyQuaternion(qa); this.B.set([v.x, v.y, v.z], i * 3);
      this.Q.set([qa.x, qa.y, qa.z, qa.w], i * 4);
    }
    for (const arr of [this.P, this.T, this.Nn, this.B]) arr.copyWithin(N * 3, 0, 3);
    this.Q.copyWithin(N * 4, 0, 4);

    const fr = makeFrame();
    this.frame(Lst * 1.5, fr);
    const zWallRoad = fr.p.z;
    this.frame(Lst * 2.5, fr);
    const yCeilRoad = fr.p.y;
    this.dims = {
      L, R, rf, Lst, Lcoda, zWallRoad, yCeilRoad,
      streets: [0, Lst, 2 * Lst, 3 * Lst, L],
      folds: [Lst - foldLen, 2 * Lst - foldLen],
      twist: [tw0, tw1],
      musicPts: [[0, 0], [Lst - 25, 0.1], [Lst + 25, 0.25], [2 * Lst - 30, 0.45], [2 * Lst + 30, 0.6],
        [3 * Lst - 35, 0.85], [3 * Lst + 20, 1], [L - 65, 1], [L, 0]],
    };
    // Wall road centre x as a function of height, for placing things on the facade.
    this.wallProfile = [];
    for (let x = Lst; x <= 2 * Lst; x += 2) {
      this.frame(x, fr);
      this.wallProfile.push([fr.p.y, fr.p.x]);
    }
  }

  wrap(s) { const L = this.L; return ((s % L) + L) % L; }

  frame(s, o) {
    s = this.wrap(s);
    const fi = s / this.ds;
    let i = Math.floor(fi);
    if (i >= this.N) i = this.N - 1;
    const t = fi - i;
    const i3 = i * 3, j3 = i3 + 3;
    const P = this.P, T = this.T, Nn = this.Nn, B = this.B;
    o.p.set(P[i3] + (P[j3] - P[i3]) * t, P[i3 + 1] + (P[j3 + 1] - P[i3 + 1]) * t, P[i3 + 2] + (P[j3 + 2] - P[i3 + 2]) * t);
    o.t.set(T[i3] + (T[j3] - T[i3]) * t, T[i3 + 1] + (T[j3 + 1] - T[i3 + 1]) * t, T[i3 + 2] + (T[j3 + 2] - T[i3 + 2]) * t).normalize();
    o.n.set(Nn[i3] + (Nn[j3] - Nn[i3]) * t, Nn[i3 + 1] + (Nn[j3 + 1] - Nn[i3 + 1]) * t, Nn[i3 + 2] + (Nn[j3 + 2] - Nn[i3 + 2]) * t).normalize();
    o.b.set(B[i3] + (B[j3] - B[i3]) * t, B[i3 + 1] + (B[j3 + 1] - B[i3 + 1]) * t, B[i3 + 2] + (B[j3 + 2] - B[i3 + 2]) * t).normalize();
    if (o.q) {
      const Q = this.Q, a = i * 4, b = a + 4;
      let bx = Q[b], by = Q[b + 1], bz = Q[b + 2], bw = Q[b + 3];
      if (Q[a] * bx + Q[a + 1] * by + Q[a + 2] * bz + Q[a + 3] * bw < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
      o.q.set(Q[a] + (bx - Q[a]) * t, Q[a + 1] + (by - Q[a + 1]) * t, Q[a + 2] + (bz - Q[a + 2]) * t, Q[a + 3] + (bw - Q[a + 3]) * t).normalize();
    }
    return o;
  }

  point(s, x, h, out, fr = this._fr || (this._fr = makeFrame())) {
    this.frame(s, fr);
    return out.copy(fr.p).addScaledVector(fr.b, x).addScaledVector(fr.n, h);
  }

  streetAt(s) {
    const d = this.dims.streets;
    s = this.wrap(s);
    for (let i = 0; i < 4; i++) if (s < d[i + 1]) return i;
    return 3;
  }

  musicness(s) {
    s = this.wrap(s);
    const pts = this.dims.musicPts;
    for (let i = 1; i < pts.length; i++) {
      if (s < pts[i][0]) {
        const [s0, m0] = pts[i - 1], [s1, m1] = pts[i];
        return m0 + (m1 - m0) * (s - s0) / (s1 - s0);
      }
    }
    return 0;
  }

  wallRoadX(y) {
    const w = this.wallProfile;
    if (y <= w[0][0]) return w[0][1];
    for (let i = 1; i < w.length; i++) {
      if (w[i][0] >= y) {
        const t = (y - w[i - 1][0]) / Math.max(1e-6, w[i][0] - w[i - 1][0]);
        return w[i - 1][1] + (w[i][1] - w[i - 1][1]) * t;
      }
    }
    return w[w.length - 1][1];
  }
}

// The road strip: top, two edges, underside. aRoad = (lateral x, distance s, face, edge v).
export function buildRoadGeometry(track, step = 1) {
  const n = Math.round(track.L / step);
  const ring = 8;
  const pos = new Float32Array((n + 1) * ring * 3);
  const nor = new Float32Array((n + 1) * ring * 3);
  const road = new Float32Array((n + 1) * ring * 4);
  const idx = [];
  const fr = makeFrame();
  const tmp = new THREE.Vector3();
  const layout = [
    [-HW, 0, 'n', 1, 0, 0], [HW, 0, 'n', 1, 0, 0],
    [HW, 0, 'b', 1, 1, 0], [HW, -THICK, 'b', 1, 1, 1],
    [HW, -THICK, 'n', -1, 2, 0], [-HW, -THICK, 'n', -1, 2, 0],
    [-HW, -THICK, 'b', -1, 1, 1], [-HW, 0, 'b', -1, 1, 0],
  ];
  for (let i = 0; i <= n; i++) {
    const s = i * track.L / n;
    track.frame(s, fr);
    for (let k = 0; k < ring; k++) {
      const [x, h, axis, sign, face, ev] = layout[k];
      tmp.copy(fr.p).addScaledVector(fr.b, x).addScaledVector(fr.n, h);
      const o = (i * ring + k);
      pos.set([tmp.x, tmp.y, tmp.z], o * 3);
      const a = axis === 'n' ? fr.n : fr.b;
      nor.set([a.x * sign, a.y * sign, a.z * sign], o * 3);
      road.set([x, s, face, ev], o * 4);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * ring, b = a + ring;
    idx.push(a, a + 1, b + 1, a, b + 1, b);
    idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2);
    idx.push(a + 4, a + 5, b + 5, a + 4, b + 5, b + 4);
    idx.push(a + 6, a + 7, b + 7, a + 6, b + 7, b + 6);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aRoad', new THREE.BufferAttribute(road, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// A strip that hugs the road surface between s0..s1 and x0..x1 (x0 < x1).
// uvFn(u along s, j: 0 = x0 edge / 1 = x1 edge) -> [u, v]
export function appendRoadStrip(arrays, track, s0, s1, x0, x1, lift, segs, uvFn, extra) {
  const fr = makeFrame();
  const tmp = new THREE.Vector3();
  const base = arrays.pos.length / 3;
  for (let i = 0; i <= segs; i++) {
    const u = i / segs;
    track.frame(s0 + (s1 - s0) * u, fr);
    for (let j = 0; j < 2; j++) {
      tmp.copy(fr.p).addScaledVector(fr.b, j ? x1 : x0).addScaledVector(fr.n, lift);
      arrays.pos.push(tmp.x, tmp.y, tmp.z);
      arrays.nor.push(fr.n.x, fr.n.y, fr.n.z);
      const uv = uvFn(u, j);
      arrays.uv.push(uv[0], uv[1]);
      if (extra) extra(arrays, u, j);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = base + i * 2, b = a + 2;
    arrays.idx.push(a, a + 1, b + 1, a, b + 1, b);
  }
}

export function stripGeometry(arrays, extraAttrs = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arrays.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uv, 2));
  for (const [name, [data, size]] of Object.entries(extraAttrs)) g.setAttribute(name, new THREE.Float32BufferAttribute(data, size));
  g.setIndex(arrays.idx);
  g.computeBoundingSphere();
  return g;
}
