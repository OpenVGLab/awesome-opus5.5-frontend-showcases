import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useTheme } from '../lib/theme';

const PALETTE = {
  light: { ink: '#141414', accent: '#FF4D2E', blue: '#3D5AFE' },
  dark: { ink: '#F2F0EA', accent: '#FF6A4D', blue: '#7C93FF' },
};

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

function config(colors) {
  return {
    particles: {
      number: { value: 72, density: { enable: true, value_area: 1100 } },
      color: { value: [colors.ink, colors.ink, colors.accent, colors.blue] },
      shape: { type: 'circle' },
      opacity: { value: 0.55, random: true, anim: { enable: true, speed: 0.5, opacity_min: 0.12, sync: false } },
      size: { value: 3.2, random: true },
      line_linked: { enable: true, distance: 150, color: colors.ink, opacity: 0.13, width: 1 },
      move: { enable: true, speed: 1.1, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false },
    },
    interactivity: {
      detect_on: 'window',
      events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
      modes: { grab: { distance: 190, line_linked: { opacity: 0.42 } }, push: { particles_nb: 4 } },
    },
    retina_detect: true,
  };
}

function destroyAll() {
  const list = window.pJSDom || [];
  list.forEach((d) => {
    try {
      d.pJS.fn.vendors.destroypJS();
    } catch {
      /* already gone */
    }
  });
  window.pJSDom = [];
}

// Hero background powered by particles.js (loaded lazily, paused when off-screen).
export default function ParticlesBackground({ id = 'particles-js' }) {
  const ref = useRef(null);
  const { theme, ready } = useTheme();
  const reduce = usePrefersReducedMotion();
  const instance = useRef(null);

  useEffect(() => {
    if (reduce || !ready) return undefined;
    let cancelled = false;
    let io;
    import('particles.js').then(() => {
      if (cancelled || !ref.current) return;
      if (!Array.isArray(window.pJSDom)) window.pJSDom = [];
      window.particlesJS(id, config(PALETTE[document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light']));
      instance.current = window.pJSDom[window.pJSDom.length - 1]?.pJS || null;
      io = new IntersectionObserver(([entry]) => {
        const p = instance.current;
        if (!p) return;
        const visible = entry.isIntersecting;
        p.interactivity.events.onclick.enable = visible;
        if (visible && !p.particles.move.enable) {
          p.particles.move.enable = true;
          p.fn.vendors.draw();
        } else if (!visible) {
          p.particles.move.enable = false;
        }
      });
      io.observe(ref.current);
    });
    return () => {
      cancelled = true;
      io?.disconnect();
      instance.current = null;
      destroyAll();
    };
  }, [id, reduce, ready]);

  useEffect(() => {
    const p = instance.current;
    if (!p) return;
    const c = PALETTE[theme];
    const pool = [c.ink, c.ink, c.accent, c.blue];
    p.particles.array.forEach((particle, i) => {
      particle.color.rgb = hexToRgb(pool[i % pool.length]);
    });
    p.particles.color.value = pool;
    p.particles.line_linked.color = c.ink;
    p.particles.line_linked.color_rgb_line = hexToRgb(c.ink);
  }, [theme]);

  return <div id={id} ref={ref} className="hero-particles" aria-hidden="true" />;
}
