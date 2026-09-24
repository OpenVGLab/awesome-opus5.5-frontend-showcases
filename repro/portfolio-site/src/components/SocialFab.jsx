// Floating action button with GSAP-animated SVG social icons (strokes draw in with DrawSVG,
// icons fan out with a stagger and wiggle on hover).
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { useEffect, useRef, useState } from 'react';
import { SOCIALS } from '../content/shared';
import { track } from '../lib/analytics';
import { useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';

gsap.registerPlugin(DrawSVGPlugin);

const ICONS = {
  github: (
    <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6Z" />
      <path d="M2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  x: (
    <>
      <path d="M4 4h4.6L20 20h-4.6L4 4Z" />
      <path d="M19.5 4 13.3 11M4.5 20l6.3-7" />
    </>
  ),
  dribbble: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8.6 2.8c4.4 6 6 9.4 8 17.7M19.1 5.1c-3.7 4.4-8.9 5.7-16.9 5.9M21.9 13c-3.5-.9-6.6-.8-9 0-2.5.9-5 2.9-7.4 6.3" />
    </>
  ),
  codepen: (
    <>
      <path d="M12 2 22 8.5v7L12 22 2 15.5v-7L12 2Z" />
      <path d="M12 22v-6.5M22 8.5l-10 7-10-7M2 15.5l10-7 10 7M12 2v6.5" />
    </>
  ),
  email: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
};

export default function SocialFab() {
  const { widgets } = useContent();
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const fabIconRef = useRef(null);
  const tlRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    const items = list.querySelectorAll('.fab-item');
    const strokes = list.querySelectorAll('.fab-item svg > *');
    gsap.set(items, { autoAlpha: 0, y: 24, scale: 0.4 });
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'back.out(1.8)' } });
    tl.to(items, { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, stagger: { each: 0.055, from: 'end' } });
    tl.fromTo(strokes, { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.out', stagger: 0.03 }, 0.08);
    tlRef.current = tl;
    return () => tl.kill();
  }, []);

  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (open) {
      if (reduce) tl.progress(1).pause();
      else tl.timeScale(1).play();
    } else if (reduce) {
      tl.progress(0).pause();
    } else tl.timeScale(1.8).reverse();
    gsap.to(fabIconRef.current, { rotate: open ? 135 : 0, duration: reduce ? 0 : 0.45, ease: 'back.out(2)' });
  }, [open, reduce]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const wiggle = (e) => {
    if (reduce) return;
    const svg = e.currentTarget.querySelector('svg');
    gsap.fromTo(svg, { rotate: 0 }, { keyframes: { rotate: [0, -14, 11, -7, 4, 0] }, duration: 0.6, ease: 'power1.inOut' });
    gsap.fromTo(svg, { scale: 1 }, { scale: 1.18, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' });
  };

  return (
    <div className={`fab${open ? ' is-open' : ''}`} ref={rootRef}>
      <ul className="fab-list" ref={listRef} id="fab-list" aria-label={widgets.social} aria-hidden={!open}>
        {SOCIALS.map((s) => (
          <li key={s.id} className="fab-item">
            <a
              className="fab-link link"
              href={s.url}
              target={s.id === 'email' ? undefined : '_blank'}
              rel={s.id === 'email' ? undefined : 'noopener noreferrer me'}
              tabIndex={open ? 0 : -1}
              onMouseEnter={wiggle}
              onFocus={wiggle}
              onClick={() => track('social_click', { network: s.id })}
              data-tooltip-id="ui-tip"
              data-tooltip-content={`${s.label} · ${s.handle}`}
              data-tooltip-place="left"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICONS[s.id]}
              </svg>
              <span className="sr-only">{s.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="fab-button link" aria-expanded={open} aria-controls="fab-list" aria-label={open ? widgets.socialClose : widgets.socialOpen} onClick={() => setOpen((v) => !v)}>
        <svg ref={fabIconRef} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
