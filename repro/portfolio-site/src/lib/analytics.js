// Privacy-friendly analytics layer. Events use the GA4 `dataLayer` shape so a tag manager can be
// attached in production; in this static demo nothing leaves the browser — events are kept in
// memory and a rolling log in sessionStorage (inspect with `window.__analytics`).
const LOG_KEY = 'me-analytics';

function store(entry) {
  try {
    const log = JSON.parse(window.sessionStorage.getItem(LOG_KEY) || '[]');
    log.push(entry);
    window.sessionStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-100)));
  } catch {
    /* storage unavailable */
  }
}

export function track(event, params = {}) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  const entry = { event, ...params, ts: Date.now() };
  window.dataLayer.push(entry);
  store(entry);
}

export async function initAnalytics(page) {
  if (typeof window === 'undefined' || window.__analytics) return;
  window.dataLayer = window.dataLayer || [];
  window.__analytics = {
    get events() {
      return window.dataLayer.slice();
    },
    vitals: {},
  };
  track('page_view', { page, lang: document.documentElement.lang, referrer: document.referrer || null });
  const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
  const report = (metric) => {
    window.__analytics.vitals[metric.name] = { value: Math.round(metric.value * 1000) / 1000, rating: metric.rating };
    track('web_vitals', { name: metric.name, value: metric.value, rating: metric.rating, id: metric.id });
  };
  onCLS(report);
  onINP(report);
  onLCP(report);
  onFCP(report);
  onTTFB(report);
}
