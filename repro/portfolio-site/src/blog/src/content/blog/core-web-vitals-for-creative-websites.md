---
title: "Core Web Vitals for Creative Websites: A Practical Playbook"
description: How to keep LCP, INP and CLS green on sites full of WebGL, video and animation — with budgets, lazy loading and real-user measurements.
pubDate: 2026-07-22
updatedDate: 2026-08-30
tags: [performance, seo, nextjs]
cover: images/blog/core-web-vitals-for-creative-websites.webp
coverAlt: Three circular gauges in green, amber and red representing Core Web Vitals scores
featured: true
keywords: Core Web Vitals, LCP, INP, CLS, page speed, Next.js performance, creative websites
---

Creative websites have a reputation: gorgeous, heavy and slow. It does not have to be that way. The [Aurora banking dashboard](/#work) went from a 4.1-second Largest Contentful Paint to 1.6 seconds without losing a single animation. Here is the playbook I use on every project.

## The three numbers that matter

Google's Core Web Vitals boil user experience down to three field metrics. Each one has a threshold you should hit for at least 75% of page views.

| Metric | Good | What usually hurts it |
| --- | --- | --- |
| Largest Contentful Paint (LCP) | ≤ 2.5 s | Late hero images, render-blocking fonts, client-only rendering |
| Interaction to Next Paint (INP) | ≤ 200 ms | Long JavaScript tasks, hydration of huge trees |
| Cumulative Layout Shift (CLS) | ≤ 0.1 | Images without dimensions, late-loading embeds, font swaps |

## LCP: ship the hero first

The largest element above the fold should be in the HTML, not injected by JavaScript. With static generation that is the default; the remaining work is making sure the browser fetches the right bytes first.

```tsx
import Image from 'next/image';

export function Hero() {
  return (
    <Image
      src="/images/hero.webp"
      alt="Product configurator showing a rust-coloured jacket"
      width={1600}
      height={900}
      priority
      sizes="100vw"
    />
  );
}
```

`priority` turns off lazy loading and adds a preload hint. Use it on exactly one image per page — everything else should stay lazy.

## INP: keep the main thread free

Heavy libraries — WebGL globes, charting, chat widgets — should load when they are needed, not when the page boots. On this site the globe and charts only download once their section scrolls near the viewport.

```ts
const Globe = dynamic(() => import('./WorkGlobe'), { ssr: false });

function useNearViewport(ref: React.RefObject<Element>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), {
      rootMargin: '400px',
    });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [ref]);
  return near;
}
```

For long tasks you cannot avoid, yield to the browser between chunks so input events get a chance to run.

## CLS: reserve every pixel

Layout shift is almost always a missing size. Give media an aspect ratio, give embeds a min-height, and load web fonts with metric-compatible fallbacks.

```css
.card-media {
  aspect-ratio: 4 / 3;
  background: var(--surface-2);
}

.globe-slot {
  min-height: 520px;
}
```

> [!NOTE]
> `next/font` generates `size-adjust` fallbacks automatically. If you self-host fonts elsewhere, tools like Fontaine can generate the same overrides.

## Measuring in the field

Lab tools such as Lighthouse and WebPageTest are great for debugging, but only real-user data tells you whether you pass. The `web-vitals` library reports the same numbers Chrome does.

```ts
import { onCLS, onINP, onLCP } from 'web-vitals';

function send(metric) {
  window.dataLayer?.push({ event: 'web_vitals', name: metric.name, value: metric.value });
}

onCLS(send);
onINP(send);
onLCP(send);
```

## A budget you can enforce

Budgets turn performance from a wish into a test. I run Lighthouse CI on every pull request with limits like these:

```json
{
  "ci": {
    "assert": {
      "assertions": {
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "total-byte-weight": ["warn", { "maxNumericValue": 900000 }]
      }
    }
  }
}
```

Performance is a feature your visitors feel before they see anything else. If you want to see how the same thinking applies to motion, read [how I design motion systems](/blog/designing-a-motion-system/).
