import { createContext, createElement, useCallback, useContext, useEffect, useState } from 'react';

export const THEME_KEY = 'me-theme';

// Runs in <head> before first paint so the stored/system theme never flashes.
export const themeInitScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var s=localStorage.getItem('${THEME_KEY}');var dark=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;d.setAttribute('data-theme',dark?'dark':'light');if(dark){var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content','#0E0E10');}if(sessionStorage.getItem('me-loaded')==='1')d.classList.add('skip-loader');}catch(e){d.setAttribute('data-theme','light');}})();`;

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  root.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0E0E10' : '#F4F1EA');
  window.setTimeout(() => root.classList.remove('theme-transition'), 450);
  window.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

// Custom hook: dark mode persisted in localStorage, falling back to the OS preference.
export function useDarkMode() {
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    setReady(true);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystem = (e) => {
      let stored = null;
      try {
        stored = window.localStorage.getItem(THEME_KEY);
      } catch {
        /* ignore */
      }
      if (stored) return;
      const next = e.matches ? 'dark' : 'light';
      applyTheme(next);
      setTheme(next);
    };
    mq.addEventListener('change', onSystem);
    return () => mq.removeEventListener('change', onSystem);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { theme, isDark: theme === 'dark', toggle, ready };
}

const ThemeContext = createContext({ theme: 'light', isDark: false, toggle: () => {}, ready: false });

export function ThemeProvider({ children }) {
  const value = useDarkMode();
  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = () => useContext(ThemeContext);
