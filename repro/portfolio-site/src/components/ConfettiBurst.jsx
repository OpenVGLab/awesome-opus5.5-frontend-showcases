import Confetti from 'react-confetti';
import { useEffect, useState } from 'react';

const COLORS = ['#FF4D2E', '#FF8A5B', '#3D5AFE', '#2A9D8F', '#E9C46A', '#F4F1EA', '#141414'];

export default function ConfettiBurst({ pieces = 300, onDone }) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const measure = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  if (!size.width) return null;
  return (
    <Confetti
      className="confetti-layer"
      width={size.width}
      height={size.height}
      numberOfPieces={pieces}
      recycle={false}
      gravity={0.22}
      initialVelocityY={14}
      tweenDuration={4000}
      colors={COLORS}
      confettiSource={{ x: size.width / 2 - 120, y: size.height * 0.35, w: 240, h: 10 }}
      onConfettiComplete={(c) => {
        c?.reset();
        onDone?.();
      }}
    />
  );
}
