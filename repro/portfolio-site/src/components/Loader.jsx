import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

const MIN_MS = 1100;
const SESSION_KEY = 'me-loaded';

// Branded loading screen: the monogram is drawn with SVG stroke animations while fonts load.
export default function Loader({ label, onDone }) {
  const [visible, setVisible] = useState(true);
  const [pct, setPct] = useState(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let skip = false;
    try {
      skip = window.sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      /* ignore */
    }
    if (skip || document.documentElement.classList.contains('skip-loader')) {
      setVisible(false);
      doneRef.current?.();
      return undefined;
    }
    const start = performance.now();
    let raf;
    let finished = false;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / MIN_MS);
      setPct(Math.round((1 - Math.pow(1 - t, 2)) * (finished ? 100 : 92)));
      if (t < 1 || !finished) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
    const timeout = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Promise.all([fontsReady, new Promise((r) => setTimeout(r, MIN_MS))]), timeout]).then(() => {
      finished = true;
      setPct(100);
      try {
        window.sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      setTimeout(() => setVisible(false), 180);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence onExitComplete={() => doneRef.current?.()}>
      {visible && (
        <motion.div
          className="site-loader"
          role="status"
          aria-live="polite"
          aria-label={label}
          initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{ clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
        >
          <svg className="site-loader-logo" viewBox="0 0 120 120" aria-hidden="true">
            <circle className="site-loader-ring" cx="60" cy="60" r="52" pathLength="1" />
            <path className="site-loader-m" d="M34 82V40l26 30 26-30v42" pathLength="1" />
            <circle className="site-loader-dot" cx="92" cy="80" r="5" />
          </svg>
          <div className="site-loader-meta">
            <span className="site-loader-name">Mara Ellison</span>
            <span className="site-loader-pct" aria-hidden="true">{String(pct).padStart(3, '0')}</span>
          </div>
          <div className="site-loader-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <span className="sr-only">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
