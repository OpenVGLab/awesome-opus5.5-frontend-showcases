import { useCallback, useEffect, useRef, useState } from 'react';

export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) setValue(JSON.parse(raw));
    } catch {
      /* storage disabled or malformed: keep the initial value */
    }
    loaded.current = true;
  }, [key]);

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          /* ignore quota / privacy-mode errors */
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update, loaded];
}

export function useMediaQuery(query, fallback = false) {
  const [matches, setMatches] = useState(fallback);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export const usePrefersReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
export const useFinePointer = () => useMediaQuery('(hover: hover) and (pointer: fine)');

// True once the element has come within `margin` of the viewport (used to lazy-load heavy widgets).
export function useNearViewport(ref, margin = '300px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return undefined;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);
  return near;
}

export function useIdle(timeout = 1500) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let id;
    const done = () => setIdle(true);
    const start = () => {
      if ('requestIdleCallback' in window) id = window.requestIdleCallback(done, { timeout });
      else id = window.setTimeout(done, timeout);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      window.removeEventListener('load', start);
      if ('cancelIdleCallback' in window && id) window.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [timeout]);
  return idle;
}

export function useScrollY(threshold = 0) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    const onScroll = () => setPast(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return past;
}

export function readCssVar(name, el) {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(el || document.documentElement).getPropertyValue(name).trim();
}
