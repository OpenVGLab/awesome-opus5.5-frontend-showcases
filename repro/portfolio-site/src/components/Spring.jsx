// react-spring microinteractions for buttons and links: magnetic hover, lift and press squash.
import { animated, to, useSpring } from '@react-spring/web';
import { forwardRef } from 'react';
import { usePrefersReducedMotion } from '../lib/hooks';

const chain = (...fns) => (e) => fns.forEach((fn) => fn && fn(e));

export function usePressSpring({ hover = 1.035, press = 0.955, lift = -2, magnet = 0.16 } = {}) {
  const reduce = usePrefersReducedMotion();
  const [s, api] = useSpring(() => ({ scale: 1, x: 0, y: 0, config: { tension: 420, friction: 24 } }));
  const handlers = {
    onPointerEnter: () => !reduce && api.start({ scale: hover, y: lift }),
    onPointerMove: (e) => {
      if (reduce || !magnet || e.pointerType !== 'mouse') return;
      const r = e.currentTarget.getBoundingClientRect();
      api.start({ x: (e.clientX - r.left - r.width / 2) * magnet, y: (e.clientY - r.top - r.height / 2) * magnet + lift });
    },
    onPointerLeave: () => api.start({ scale: 1, x: 0, y: 0 }),
    onPointerDown: () => !reduce && api.start({ scale: press, config: { tension: 600, friction: 20 } }),
    onPointerUp: () => !reduce && api.start({ scale: hover, config: { tension: 420, friction: 24 } }),
    onFocus: (e) => !reduce && e.currentTarget.matches(':focus-visible') && api.start({ scale: hover, y: lift }),
    onBlur: () => api.start({ scale: 1, x: 0, y: 0 }),
  };
  const transform = to([s.x, s.y, s.scale], (x, y, sc) => `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${sc.toFixed(4)})`);
  return { transform, handlers };
}

function mergeHandlers(props, handlers) {
  const merged = { ...props };
  for (const [key, fn] of Object.entries(handlers)) merged[key] = chain(props[key], fn);
  return merged;
}

export const SpringButton = forwardRef(function SpringButton({ as = 'button', style, magnet, ...props }, ref) {
  const { transform, handlers } = usePressSpring({ magnet: magnet ?? 0.16 });
  const Comp = animated[as];
  return <Comp ref={ref} style={{ ...style, transform }} {...mergeHandlers(props, handlers)} />;
});

// Underline that springs in from the left on hover / keyboard focus.
export function useUnderlineSpring() {
  const reduce = usePrefersReducedMotion();
  const [s, api] = useSpring(() => ({ scale: 0, config: { tension: 380, friction: 26 } }));
  const handlers = {
    onMouseEnter: () => api.start({ scale: 1, immediate: reduce }),
    onMouseLeave: () => api.start({ scale: 0, immediate: reduce }),
    onFocus: () => api.start({ scale: 1, immediate: reduce }),
    onBlur: () => api.start({ scale: 0, immediate: reduce }),
  };
  const underline = <animated.span className="nav-underline" aria-hidden="true" style={{ transform: s.scale.to((v) => `scaleX(${v})`) }} />;
  return { handlers, underline };
}

export function SpringLink({ children, className = '', ...props }) {
  const { handlers, underline } = useUnderlineSpring();
  return (
    <a className={`spring-link ${className}`} {...mergeHandlers(props, handlers)}>
      <span>{children}</span>
      {underline}
    </a>
  );
}
