import { LottieSvg } from 'lottie-react';

// Client-only wrapper so the 404 page can lazy-load the Lottie engine without touching the DOM on the
// server. LottieSvg bundles only the SVG renderer.
export default function LottieAnimation({ animationData }) {
  return <LottieSvg src={animationData} autoplay loop rendererSettings={{ preserveAspectRatio: 'xMidYMid meet' }} className="lottie-canvas" />;
}
