'use strict';
// Scene 2 · 望月: she looks up; the camera tilts past the window bars to a paper moon.
(function () {
  const MA = window.MA;
  const { C, seg, smooth, easeIn, easeOut, easeInOut, lerp } = MA;
  const P = MA.paper, E = MA.el;
  const S = (MA.scenes = MA.scenes || {});
  const moon = (S.moon = {});

  moon.build = function (L) {
    const { W, H } = L;
    const A = (moon.A = {});
    A.R = L.P ? 290 : 300;
    A.mx = L.P ? W * 0.52 : W * 0.63;
    A.my = L.P ? H * 0.3 : H * 0.4;
    A.sky = E.sky(W, Math.ceil(H * 1.5), [[0, '#0b1230'], [0.45, C.night1], [1, '#27396f']], {
      halftone: { cell: 12, angle: 0.5, color: MA.hex(C.indigoL, 0.45), f: (x, y) => smooth((y - H * 0.7) / (H * 0.8)) * 0.5 },
    });
    A.moon = E.moon(A.R, { res: 1.6, seed: 5, legend: true });
    A.halo = E.halo(A.R, { n: 4, alpha: 0.1 });
    A.clouds = [
      E.cloud(L.P ? 560 : 760, 120, { seed: 31, color: '#e9dcc0', shade: '#6d7fae' }),
      E.cloud(L.P ? 420 : 560, 96, { seed: 32, color: '#d8cdb8', shade: '#5b6c9c' }),
      E.cloud(L.P ? 380 : 520, 90, { seed: 33, color: '#c9c3c0', shade: '#4d5e8e' }),
    ];
    // window: the frame with its panes cut out, in the foreground
    const vx = L.P ? W * 0.64 : W * 0.37, hy = L.P ? H * 0.66 : H * 0.78;
    A.frame = P.piece({
      pts: P.rect(-40, -40, W + 80, H + 80), color: '#0b1127', cut: true, grain: 0.35, shadow: { x: 10, y: 0, blur: 24, a: 0.5 },
      paint(g) {
        g.save();
        g.globalCompositeOperation = 'destination-out';
        const m = L.P ? 26 : 30, b = L.P ? 22 : 26;
        g.fillRect(m, m, vx - b / 2 - m, hy - b / 2 - m);
        g.fillRect(vx + b / 2, m, W - m - vx - b / 2, hy - b / 2 - m);
        g.fillRect(m, hy + b / 2, vx - b / 2 - m, H - m - hy - b / 2);
        g.fillRect(vx + b / 2, hy + b / 2, W - m - vx - b / 2, H - m - hy - b / 2);
        g.restore();
        g.fillStyle = MA.hex(C.indigoP, 0.18);
        g.fillRect(vx - 2, 0, 3, H);
        g.fillRect(0, hy - 2, W, 3);
      },
    });
    A.her = MA.fig.back('#070b1c');
    A.herRim = MA.fig.back(C.goldP);
  };

  // Camera: tilt up from the city to the moon, drift in, then fall into the moon.
  moon.camera = function (t, L) {
    const up = easeInOut(seg(t, 8.6, 11.2));
    const push = smooth(seg(t, 11, 14.1));
    const dive = easeIn(seg(t, 14.05, 14.98));
    return { tilt: (1 - up) * L.H, z: 1 + 0.1 * push + 9 * dive * dive, dive };
  };

  moon.draw = function (ctx, t, L) {
    const { W, H } = L;
    const A = moon.A;
    const cam = moon.camera(t, L);
    const fx = lerp(W / 2, A.mx, smooth(seg(t, 11, 14.9))), fy = lerp(H / 2, A.my, smooth(seg(t, 11, 14.9)));
    // looking up: far things drop into view faster than the window and the girl in front of it
    const layer = (d, tiltK, fn) => { ctx.save(); ctx.translate(0, -cam.tilt * tiltK); MA.cam(ctx, L, fx, fy, cam.z, d); fn(); ctx.restore(); };
    ctx.fillStyle = '#27396f';
    ctx.fillRect(0, 0, W, H);
    layer(0.3, 0.35, () => {
      ctx.drawImage(A.sky, 0, -H * 0.5);
      E.stars(ctx, t, { n: 90, seed: 12, x0: 0, x1: W, y0: -H * 0.4, y1: H * 0.7 });
    });
    // moon + halo
    layer(0.85, 0.78, () => {
      const breathe = 1 + 0.015 * Math.sin(t * 1.3);
      MA.glow(ctx, A.mx, A.my, A.R * 2.6, C.goldP, 0.5, 'screen');
      MA.draw(ctx, A.halo, A.mx, A.my, 0, breathe, breathe, 0.9);
      MA.draw(ctx, A.clouds[2], A.mx - A.R * 1.9 + t * 9, A.my - A.R * 0.55);
      MA.draw(ctx, A.moon, A.mx + MA.boil(51, t, 0.6), A.my + MA.boil(52, t, 0.6));
      MA.draw(ctx, A.clouds[1], A.mx + A.R * 0.2 - t * 12, A.my + A.R * 0.52);
      MA.draw(ctx, A.clouds[0], A.mx - A.R * 1.8 + (t - 9) * 16, A.my + A.R * 0.2);
    });
    // the city below, seen through the glass
    const N = MA.scenes.night.A;
    layer(0.9, 0.5, () => {
      const yf = H * (L.P ? 0.5 : 0.52), ym = H * (L.P ? 0.64 : 0.66);
      MA.draw(ctx, N.far, -W * 0.05, yf);
      ctx.fillStyle = '#33467e';
      ctx.fillRect(-W * 0.1, yf + N.far.h - 4, W * 1.2, H);
      MA.draw(ctx, N.mid, -W * 0.04, ym);
      ctx.fillStyle = '#1f2d5a';
      ctx.fillRect(-W * 0.1, ym + N.mid.h - 4, W * 1.2, H);
    });
    const d = cam.dive;
    if (d < 0.97) {
      // glass sheen
      layer(1, 0.3, () => {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = 'rgba(200,215,255,0.05)';
        ctx.beginPath(); ctx.moveTo(W * 0.52, 0); ctx.lineTo(W * 0.6, 0); ctx.lineTo(W * 0.3, H); ctx.lineTo(W * 0.22, H); ctx.fill();
        ctx.fillStyle = 'rgba(200,215,255,0.035)';
        ctx.beginPath(); ctx.moveTo(W * 0.64, 0); ctx.lineTo(W * 0.66, 0); ctx.lineTo(W * 0.36, H); ctx.lineTo(W * 0.34, H); ctx.fill();
        ctx.restore();
        MA.draw(ctx, A.frame, 0, 0);
      });
      // her, closest to us; head tips back as the moon appears
      layer(1.12, 0.08, () => {
        const hx = L.P ? W * 0.3 : W * 0.21, hy = H + 10;
        const sc = L.P ? 1.05 : 1.1;
        const lookUp = smooth(seg(t, 9.6, 11.4));
        const rim = 0.4 + 0.6 * smooth(seg(t, 9.8, 11.5));
        const Hf = A.her, Hr = A.herRim;
        ctx.save();
        ctx.translate(hx, hy);
        ctx.scale(sc, sc);
        const head = (F, dx, dy) => { ctx.save(); ctx.translate(F.neck[0] + dx, F.neck[1] + dy); ctx.rotate(-0.05 * lookUp); ctx.translate(0, -8 * lookUp); MA.draw(ctx, F.head, -F.neck[0], -F.neck[1]); ctx.restore(); };
        ctx.globalAlpha = rim;
        MA.draw(ctx, Hr.body, 4, -3);
        head(Hr, 5, -4);
        ctx.globalAlpha = 1;
        MA.draw(ctx, Hf.body, 0, 0);
        head(Hf, 0, 0);
        ctx.save(); ctx.translate(Hf.neck[0], Hf.neck[1]); ctx.rotate(-0.05 * lookUp); ctx.translate(0, -8 * lookUp); MA.draw(ctx, Hf.pin, -Hf.neck[0], -Hf.neck[1]); ctx.restore();
        ctx.restore();
      });
    }
    // falling into the moon: flat gold with printed dots takes over
    if (d > 0.35) {
      const a = smooth((d - 0.35) / 0.55);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = C.goldL;
      ctx.fillRect(0, 0, W, H);
      P.halftone(ctx, 0, 0, W, H, { cell: 16 + 30 * d, angle: 0.26, color: MA.hex('#c47a2a', 0.35), f: (x, y) => 0.25 + 0.25 * Math.sin(x * 0.004 + y * 0.003) });
      ctx.restore();
    }
  };
})();
