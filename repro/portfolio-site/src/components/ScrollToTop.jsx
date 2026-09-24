import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animateScroll } from 'react-scroll';
import { useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';
import { ArrowUp } from './Icons';

const R = 21;
const C = 2 * Math.PI * R;

// Appears after scrolling down; the ring shows reading progress through the page.
export default function ScrollToTop() {
  const { widgets } = useContent();
  const reduce = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const ringRef = useRef(null);
  const progressRef = useRef(0);

  const paint = () => {
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(C * (1 - progressRef.current));
  };
  const attachRing = useCallback((el) => {
    ringRef.current = el;
    paint();
  }, []);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      setVisible(window.scrollY > 640);
      paint();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className="to-top link"
          aria-label={widgets.toTop}
          initial={{ opacity: 0, y: 16, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.8 }}
          whileHover={reduce ? undefined : { y: -3 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => animateScroll.scrollToTop({ duration: reduce ? 0 : 900, smooth: 'easeInOutQuart' })}
        >
          <svg className="to-top-ring" viewBox="0 0 48 48" aria-hidden="true">
            <circle cx="24" cy="24" r={R} className="to-top-track" />
            <circle ref={attachRing} cx="24" cy="24" r={R} className="to-top-progress" strokeDasharray={C} strokeDashoffset={C} />
          </svg>
          <ArrowUp />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
