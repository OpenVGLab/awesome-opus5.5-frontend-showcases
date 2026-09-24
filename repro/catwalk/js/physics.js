// Deterministic 2D platforming for the cat. World units are metres: x runs along the
// catwalk, y is up. Nothing here touches three.js, so the same code drives the game,
// the autopilot and the headless level validator.

export const STEP = 1 / 120;

export const PHYS = {
  halfW: 0.22,        // hitbox half width
  height: 0.36,       // hitbox height
  jumpVel: 7.0,
  gHold: 18,          // gravity while the jump button is held on the way up
  gFall: 30,
  holdMin: 0.05,      // a tap still gives a small hop
  holdMax: 0.30,
  cut: 0.5,           // upward speed kept when the button is released early
  maxFall: 16,
  coyote: 0.085,
  buffer: 0.13,
  bounceVel: 11.4,    // awnings
  catchK: 1.6,        // how hard the cat runs to get back to its place on screen
  boostMax: 1.45,
  groundAccel: 8,
  airAccel: 1.2,
  stepAssist: 0.14,
};

export class Collision {
  constructor(stage) {
    this.cell = 2;
    this.n = Math.ceil((stage.length + 12) / this.cell) + 1;
    this.stamp = 0;
    this.solids = this.grid(stage.solids);
    this.oneways = this.grid(stage.oneways);
    this.hazards = this.grid(stage.hazards);
    this.bufA = [];
    this.bufB = [];
  }

  grid(list) {
    const g = Array.from({ length: this.n }, () => []);
    for (const it of list) {
      it._q = 0;
      const a = Math.max(0, Math.floor(it.x0 / this.cell));
      const b = Math.min(this.n - 1, Math.floor(it.x1 / this.cell));
      for (let c = a; c <= b; c++) g[c].push(it);
    }
    return g;
  }

  near(grid, x0, x1, out) {
    out.length = 0;
    const st = ++this.stamp;
    const a = Math.max(0, Math.floor(x0 / this.cell));
    const b = Math.min(this.n - 1, Math.floor(x1 / this.cell));
    for (let c = a; c <= b; c++) {
      const cellList = grid[c];
      for (let i = 0; i < cellList.length; i++) {
        const it = cellList[i];
        if (it._q !== st) { it._q = st; out.push(it); }
      }
    }
    return out;
  }
}

export function makeBody(x, y) {
  return {
    x, y, vx: 0, vy: 0,
    grounded: true, groundRef: null,
    coyote: PHYS.coyote, buffer: 0,
    holding: false, holdT: 0, bouncing: false,
    airT: 0, blocked: false, blockedT: 0,
  };
}

export function cloneBody(b) {
  return { ...b };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// One fixed step. input = { pressed, held }; env = { col, scrollX, vScroll, dt }.
export function stepBody(b, input, env, events) {
  const P = PHYS;
  const dt = env.dt;

  if (input.pressed) b.buffer = P.buffer;
  else if (b.buffer > 0) b.buffer -= dt;
  if (b.grounded) b.coyote = P.coyote;
  else if (b.coyote > 0) b.coyote -= dt;

  if (b.buffer > 0 && b.coyote > 0) {
    b.vy = P.jumpVel;
    b.grounded = false;
    b.coyote = 0;
    b.buffer = 0;
    b.holding = true;
    b.holdT = 0;
    b.bouncing = false;
    b.airT = 0;
    if (events) events.push({ type: 'jump', x: b.x, y: b.y });
  }

  if (b.holding) {
    b.holdT += dt;
    if (b.holdT >= P.holdMin && !input.held) {
      if (b.vy > 0) b.vy *= P.cut;
      b.holding = false;
    } else if (b.holdT >= P.holdMax || b.vy <= 0) {
      b.holding = false;
    }
  }

  if (!b.grounded) {
    const g = b.holding && b.vy > 0 ? P.gHold : P.gFall;
    b.vy = Math.max(b.vy - g * dt, -P.maxFall);
    b.airT += dt;
  } else {
    b.vy = 0;
  }

  const desired = clamp(env.vScroll + P.catchK * (env.scrollX - b.x), 0, Math.max(0, env.vScroll) * P.boostMax);
  const acc = b.grounded ? P.groundAccel : P.airAccel;
  b.vx += (desired - b.vx) * Math.min(1, acc * dt);

  moveX(b, b.vx * dt, env, events);
  if (b.blocked) b.blockedT += dt; else b.blockedT = 0;
  if (!b.grounded) moveY(b, b.vy * dt, env, events);
  else checkSupport(b, env);
}

function overlapsSolid(env, x, y) {
  const hw = PHYS.halfW, H = PHYS.height;
  const list = env.col.near(env.col.solids, x - hw - 0.1, x + hw + 0.1, env.col.bufB);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (x + hw <= s.x0 || x - hw >= s.x1) continue;
    if (y + H <= s.y0 + 1e-4 || y >= s.y1 - 1e-4) continue;
    return true;
  }
  return false;
}

function moveX(b, dx, env, events) {
  if (dx === 0) { b.blocked = false; return; }
  const hw = PHYS.halfW, H = PHYS.height;
  b.x += dx;
  let hit = false;
  const list = env.col.near(env.col.solids, b.x - hw - 0.2, b.x + hw + 0.2, env.col.bufA);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (b.x + hw <= s.x0 || b.x - hw >= s.x1) continue;
    if (b.y + H <= s.y0 + 1e-4 || b.y >= s.y1 - 1e-4) continue;
    if (dx > 0) {
      if (b.grounded && s.y1 - b.y <= PHYS.stepAssist && !overlapsSolid(env, b.x, s.y1 + 1e-4)) {
        b.y = s.y1;
        continue;
      }
      b.x = s.x0 - hw - 1e-5;
    } else {
      b.x = s.x1 + hw + 1e-5;
    }
    hit = true;
  }
  if (hit) {
    if (!b.blocked && events) events.push({ type: 'bump', grounded: b.grounded, x: b.x, y: b.y });
    b.blocked = true;
    b.vx = 0;
  } else {
    b.blocked = false;
  }
}

function moveY(b, dy, env, events) {
  if (dy === 0) return;
  const hw = PHYS.halfW, H = PHYS.height;
  const y0 = b.y;
  const y1 = y0 + dy;
  const col = env.col;
  if (dy < 0) {
    let land = -Infinity, ref = null, oneway = false;
    const list = col.near(col.solids, b.x - hw - 0.1, b.x + hw + 0.1, col.bufA);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (b.x + hw <= s.x0 || b.x - hw >= s.x1) continue;
      if (y0 >= s.y1 - 1e-4 && y1 < s.y1 && s.y1 > land) { land = s.y1; ref = s; oneway = false; }
    }
    const ow = col.near(col.oneways, b.x - hw - 0.1, b.x + hw + 0.1, col.bufB);
    for (let i = 0; i < ow.length; i++) {
      const o = ow[i];
      if (b.x + hw <= o.x0 || b.x - hw >= o.x1) continue;
      if (y0 >= o.y - 1e-4 && y1 <= o.y && o.y > land) { land = o.y; ref = o; oneway = true; }
    }
    if (ref) {
      b.y = land;
      const impact = -b.vy;
      if (oneway && ref.bouncy) {
        b.vy = PHYS.bounceVel;
        b.grounded = false;
        b.bouncing = true;
        b.holding = false;
        b.airT = 0;
        if (events) events.push({ type: 'bounce', ref, x: b.x, y: b.y });
        return;
      }
      b.vy = 0;
      b.grounded = true;
      b.groundRef = ref;
      b.bouncing = false;
      b.holding = false;
      if (events) events.push({ type: 'land', impact, airT: b.airT, x: b.x, y: b.y, oneway });
      b.airT = 0;
      return;
    }
    b.y = y1;
  } else {
    let ceil = Infinity, ref = null;
    const list = col.near(col.solids, b.x - hw - 0.1, b.x + hw + 0.1, col.bufA);
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (b.x + hw <= s.x0 || b.x - hw >= s.x1) continue;
      if (y0 + H <= s.y0 + 1e-4 && y1 + H > s.y0 && s.y0 < ceil) { ceil = s.y0; ref = s; }
    }
    if (ref) {
      b.y = ceil - H - 1e-5;
      b.vy = -0.5;
      b.holding = false;
      if (events) events.push({ type: 'bonk', ref, x: b.x, y: b.y });
      return;
    }
    b.y = y1;
  }
}

function checkSupport(b, env) {
  const hw = PHYS.halfW;
  const col = env.col;
  const list = col.near(col.solids, b.x - hw - 0.1, b.x + hw + 0.1, col.bufA);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (b.x + hw <= s.x0 || b.x - hw >= s.x1) continue;
    if (Math.abs(b.y - s.y1) < 2e-3) { b.groundRef = s; return; }
  }
  const ow = col.near(col.oneways, b.x - hw - 0.1, b.x + hw + 0.1, col.bufB);
  for (let i = 0; i < ow.length; i++) {
    const o = ow[i];
    if (b.x + hw <= o.x0 || b.x - hw >= o.x1) continue;
    if (Math.abs(b.y - o.y) < 2e-3) { b.groundRef = o; return; }
  }
  b.grounded = false;
  b.groundRef = null;
}

// Steam vents puff on a cycle measured in scroll distance, so a cat that keeps pace
// always meets them between bursts; falling behind is what gets you scalded.
export function ventPhase(h, scrollX) {
  const p = ((scrollX - h.cx) / h.period + h.offset) % 1;
  return p < 0 ? p + 1 : p;
}

export function ventPower(h, scrollX) {
  const p = ventPhase(h, scrollX);
  if (p >= h.duty) return 0;
  const a = Math.min(1, p / 0.08);
  const r = Math.min(1, (h.duty - p) / 0.1);
  return Math.min(a, r);
}

export function hazardHit(col, b, scrollX) {
  const hw = PHYS.halfW * 0.8, H = PHYS.height * 0.85;
  const list = col.near(col.hazards, b.x - 1, b.x + 1, col.bufA);
  for (let i = 0; i < list.length; i++) {
    const h = list[i];
    let top = h.y1;
    if (h.kind === 'vent') {
      const pw = ventPower(h, scrollX);
      if (pw < 0.35) continue;
      top = h.y0 + (h.y1 - h.y0) * pw;
    }
    if (b.x + hw <= h.x0 || b.x - hw >= h.x1) continue;
    if (b.y + H <= h.y0 || b.y >= top) continue;
    return h;
  }
  return null;
}
