import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ACHIEVEMENTS } from '../content/shared';
import { useLocalStorage, usePrefersReducedMotion } from './hooks';
import { track } from './analytics';
import { useContent } from './content';

const ConfettiBurst = dynamic(() => import('../components/ConfettiBurst'), { ssr: false });

const AchievementsContext = createContext({ unlock: () => {}, celebrate: () => {}, unlocked: [] });
export const useAchievements = () => useContext(AchievementsContext);

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export function AchievementsProvider({ children }) {
  const { widgets } = useContent();
  const [unlocked, setUnlocked] = useLocalStorage('me-achievements', []);
  const unlockedRef = useRef(new Set());
  const [toasts, setToasts] = useState([]);
  const [burst, setBurst] = useState(null);
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    unlockedRef.current = new Set(unlocked);
  }, [unlocked]);

  const celebrate = useCallback(
    (pieces = 320) => {
      if (reduce) return;
      setBurst({ key: Date.now(), pieces });
    },
    [reduce],
  );

  const unlock = useCallback(
    (id) => {
      if (!ACHIEVEMENTS.includes(id) || unlockedRef.current.has(id)) return;
      unlockedRef.current.add(id);
      setUnlocked((prev) => (prev.includes(id) ? prev : [...prev, id]));
      const toastId = `${id}-${Date.now()}`;
      setToasts((t) => [...t, { id: toastId, key: id }]);
      window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toastId)), 4200);
      celebrate(id === 'konami' ? 700 : 260);
      track('achievement_unlocked', { id });
    },
    [celebrate, setUnlocked],
  );

  useEffect(() => {
    let pos = 0;
    const onKey = (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      pos = key === KONAMI[pos] ? pos + 1 : key === KONAMI[0] ? 1 : 0;
      if (pos === KONAMI.length) {
        pos = 0;
        unlock('konami');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [unlock]);

  return (
    <AchievementsContext.Provider value={{ unlock, celebrate, unlocked }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const [title, text] = widgets.achievements[t.key];
            return (
              <motion.div
                key={t.id}
                className="toast"
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              >
                <span className="toast-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
                    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
                  </svg>
                </span>
                <span>
                  <span className="toast-label">{widgets.achievement}</span>
                  <strong>{title}</strong>
                  <span className="toast-text">{text}</span>
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {burst && <ConfettiBurst key={burst.key} pieces={burst.pieces} onDone={() => setBurst(null)} />}
    </AchievementsContext.Provider>
  );
}
