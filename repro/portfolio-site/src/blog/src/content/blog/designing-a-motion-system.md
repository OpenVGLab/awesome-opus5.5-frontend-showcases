---
title: "Designing a Motion System: Principles for Meaningful UI Animation"
description: Tokens for duration and easing, choreography rules and reduced-motion fallbacks — how to turn one-off animations into a coherent motion system.
pubDate: 2026-06-30
updatedDate: 2026-09-02
tags: [motion, design, react]
cover: images/blog/designing-a-motion-system.webp
coverAlt: Colourful easing curves drawn on a grid with dots travelling along them
featured: true
keywords: motion design, UI animation, motion system, Framer Motion, easing, reduced motion
video:
  title: Motion system breakdown — easing, choreography and restraint
  description: A 16-second breakdown of the three principles behind this portfolio's motion system, with live easing comparisons.
  webm: media/motion-system-breakdown.webm
  mp4: media/motion-system-breakdown.mp4
  poster: media/motion-system-breakdown-poster.jpg
  captions: media/motion-system-breakdown.en.vtt
  chapters: media/motion-system-breakdown.chapters.vtt
  duration: PT16S
  uploadDate: 2026-06-30
---

Most products do not have a motion *system*. They have motion *moments*: a modal that slides, a toast that bounces, a hero that fades in — each chosen by a different person on a different day. The result feels like a room where every lamp has a different colour temperature. The short video above shows the three principles I use to fix that; this article explains them in detail.

## Motion is a language

Animation communicates relationships. When a card expands into a detail view, motion says *this is the same thing, now bigger*. When a notification slides in from the edge, it says *this came from outside what you were doing*. If motion does not explain something, it is decoration — and decoration should be cheap, short and optional.

## Start with tokens

Just like colour and spacing, durations and easing curves belong in design tokens. Four durations and three curves cover almost every interface I have built.

```css
:root {
  --dur-instant: 90ms;   /* hover, press */
  --dur-quick: 180ms;    /* toggles, small reveals */
  --dur-moderate: 320ms; /* panels, modals */
  --dur-slow: 640ms;     /* page-level choreography */

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* entering */
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);       /* leaving */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);  /* moving */
}
```

Entering elements decelerate (they arrive and settle), leaving elements accelerate (they get out of the way), and elements moving across the screen do both.

## Choreography: who moves first?

When several things animate at once, sequence them by importance. The container establishes space, then the primary content arrives, then secondary details. A small stagger — 40 to 80 milliseconds — reads as intentional without making anyone wait.

```tsx
const list = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
};
```

> [!QUOTE] Val Head, Designing Interface Animation
> Animation should support the user's goals, not compete with them.

## Springs vs. curves

Springs feel physical because they respond to velocity: interrupt a spring mid-flight and it redirects naturally. Use them for anything the user can grab — drawers, carousels, draggable cards. Use curves for choreographed, non-interruptible sequences such as page transitions, where you need exact timing to line up with other elements.

## Respect reduced motion

Some people get dizzy or nauseous from large movements. `prefers-reduced-motion` is not a request to remove all animation — it is a request to remove *movement*. Opacity and colour changes are usually fine.

```tsx
import { useReducedMotion } from 'framer-motion';

export function Reveal({ children }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
    >
      {children}
    </motion.div>
  );
}
```

> [!NOTE]
> On this site, reduced motion also disables the particle background, the custom cursor trail and the carousel autoplay.

## Watch the breakdown

The video at the top of this post compares a linear tween, an ease-out curve and a spring side by side, then shows the choreography rules in action. It uses the site's custom video player — try the keyboard shortcuts: <kbd>K</kbd> to play or pause, <kbd>J</kbd>/<kbd>L</kbd> to skip, <kbd>C</kbd> for captions and <kbd>F</kbd> for fullscreen. Curious how the images in the project viewer move? That is covered in [building WebGL page transitions](/blog/webgl-page-transitions-with-threejs/).
