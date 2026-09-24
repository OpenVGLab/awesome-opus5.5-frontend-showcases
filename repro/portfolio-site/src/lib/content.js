import { createContext, useContext } from 'react';

export const ContentContext = createContext(null);
export const useContent = () => useContext(ContentContext);

export function formatDate(iso, lang, opts = { year: 'numeric', month: 'short', day: 'numeric' }) {
  const d = new Date(`${iso}T12:00:00Z`);
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : 'en-GB', { ...opts, timeZone: 'UTC' }).format(d);
}

// Links from the homepage into the Astro blog (all relative, the export can live in any folder).
export const blogHref = (slug) => (slug ? `blog/${slug}/` : 'blog/');
