// react-custom-cursor provides the cursor markup contract (.cursor / .cursor-follower), its styles
// and hover states for `.link` elements; it ships without movement code, so the follow loop below
// recreates the lerped GSAP ticker from the package's demo. react-mouse-particles adds the trail.
import { gsap } from 'gsap';
import { useEffect } from 'react';
import CustomCursor from 'react-custom-cursor/src/App';
import MouseParticles from 'react-mouse-particles';

const HOVER = 'a, button, [role="button"], [role="checkbox"], summary, label, select, .link';
const TRAIL = ['#FF5A3C', '#5B73FF', '#EBAA3F', '#35B3A4'];

export default function CursorInner() {
  useEffect(() => {
    const root = document.documentElement;
    const cursor = document.querySelector('.cursor');
    const follower = document.querySelector('.cursor-follower');
    if (!cursor || !follower) return undefined;
    root.classList.add('has-custom-cursor');

    let mx = -100, my = -100, fx = -100, fy = -100;
    const setCx = gsap.quickSetter(cursor, 'left', 'px');
    const setCy = gsap.quickSetter(cursor, 'top', 'px');
    const setFx = gsap.quickSetter(follower, 'left', 'px');
    const setFy = gsap.quickSetter(follower, 'top', 'px');
    const tick = () => {
      fx += (mx - fx) / 9;
      fy += (my - fy) / 9;
      setCx(mx - 4);
      setCy(my - 4);
      setFx(fx - 18);
      setFy(fy - 18);
    };
    gsap.ticker.add(tick);

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
      if (root.classList.contains('cursor-hidden')) root.classList.remove('cursor-hidden');
    };
    const setActive = (on) => {
      cursor.classList.toggle('active', on);
      follower.classList.toggle('active', on);
    };
    // Delegated hover so elements rendered after the package's one-time jQuery binding also react.
    const onOver = (e) => setActive(Boolean(e.target.closest?.(HOVER)));
    const onLeaveWindow = () => root.classList.add('cursor-hidden');
    const onDown = () => follower.classList.add('pressed');
    const onUp = () => follower.classList.remove('pressed');

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    document.documentElement.addEventListener('mouseleave', onLeaveWindow);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      gsap.ticker.remove(tick);
      root.classList.remove('has-custom-cursor', 'cursor-hidden');
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      document.documentElement.removeEventListener('mouseleave', onLeaveWindow);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  return (
    <>
      <div className="cursor" aria-hidden="true" />
      <div className="cursor-follower" aria-hidden="true" />
      <CustomCursor />
      <MouseParticles g={1.4} num={2} radius={5} life={1.1} v={0.8} alpha={0.55} color={TRAIL} cull="no-trail,rcw-widget-container,modal,fab,audio-player" level={8} />
    </>
  );
}
