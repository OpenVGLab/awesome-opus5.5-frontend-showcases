import dynamic from 'next/dynamic';
import { useFinePointer, useIdle, usePrefersReducedMotion } from '../lib/hooks';

const CursorInner = dynamic(() => import('./CursorInner'), { ssr: false });

// Custom cursor + particle trail only for precise pointers without a reduced-motion preference.
export default function CursorEffects() {
  const fine = useFinePointer();
  const reduce = usePrefersReducedMotion();
  const idle = useIdle(600);
  if (!fine || reduce || !idle) return null;
  return <CursorInner />;
}
