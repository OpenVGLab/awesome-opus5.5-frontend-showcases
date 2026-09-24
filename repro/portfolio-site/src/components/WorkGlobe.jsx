// Interactive globe of work locations (react-globe.gl on the vendored Three.js build).
import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import * as THREE from 'three';
import { feature } from 'topojson-client';
import countries110m from 'world-atlas/countries-110m.json';
import { LOCATIONS } from '../content/shared';
import { usePrefersReducedMotion } from '../lib/hooks';

const HOME = LOCATIONS.find((l) => l.home);

// The 110m atlas contains a few zero-area slivers (e.g. one North Korea ring collapses to a single
// point) that make H3's polygonToCells throw, so drop any polygon with fewer than 3 distinct points.
function sanitize(features) {
  const distinct = (ring) => new Set(ring.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`)).size;
  return features
    .map((f) => {
      const g = f.geometry;
      if (!g) return null;
      const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).filter((p) => distinct(p[0]) >= 3);
      if (!polys.length) return null;
      return { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } };
    })
    .filter(Boolean);
}

export default function WorkGlobe({ places, homeLabel, selected, onSelect }) {
  const globeRef = useRef(null);
  const wrapRef = useRef(null);
  const [size, setSize] = useState(null);
  const reduce = usePrefersReducedMotion();

  const countries = useMemo(
    () => sanitize(feature(countries110m, countries110m.objects.countries).features.filter((f) => f.properties.name !== 'Antarctica')),
    [],
  );
  const arcs = useMemo(
    () => LOCATIONS.filter((l) => !l.home).map((l) => ({ id: l.id, startLat: HOME.lat, startLng: HOME.lng, endLat: l.lat, endLng: l.lng })),
    [],
  );
  const material = useMemo(() => new THREE.MeshPhongMaterial({ color: '#16193a', emissive: '#0a0b1c', emissiveIntensity: 0.6, shininess: 12, specular: '#3a3f7a' }), []);
  const selectedLoc = LOCATIONS.find((l) => l.id === selected) || HOME;
  const rings = useMemo(() => (selectedLoc.id === HOME.id ? [HOME] : [HOME, selectedLoc]), [selectedLoc]);
  const tags = useMemo(() => (selectedLoc.id === HOME.id ? [HOME] : [HOME, selectedLoc]), [selectedLoc]);

  useEffect(() => {
    const el = wrapRef.current;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setSize({ w, h: Math.round(entry.contentRect.height) || w });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !size) return;
    const controls = g.controls();
    controls.enableZoom = false;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.55;
    const stop = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stop);
    return () => controls.removeEventListener('start', stop);
  }, [size, reduce]);

  useEffect(() => {
    const g = globeRef.current;
    if (!g || !size) return;
    if (!selected) {
      g.pointOfView({ lat: 34, lng: -18, altitude: 2.25 }, 0);
      return;
    }
    g.controls().autoRotate = false;
    g.pointOfView({ lat: selectedLoc.lat, lng: selectedLoc.lng, altitude: 1.9 }, reduce ? 0 : 1400);
  }, [selected, selectedLoc, size, reduce]);

  return (
    <div ref={wrapRef} className="globe-canvas">
      {size && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor="#ff7a5c"
          atmosphereAltitude={0.16}
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.55}
          hexPolygonUseDots
          hexPolygonAltitude={0.004}
          hexPolygonColor={() => 'rgba(236, 232, 255, 0.62)'}
          pointsData={LOCATIONS}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={(d) => (d.id === selectedLoc.id ? 0.09 : 0.03)}
          pointRadius={(d) => (d.home ? 0.75 : 0.5)}
          pointColor={(d) => (d.home ? '#ff6a4d' : d.id === selectedLoc.id ? '#ffffff' : '#ffd166')}
          pointLabel={(d) => `<div class="globe-tip"><strong>${places[d.id][0]}</strong><span>${places[d.id][1]}</span></div>`}
          onPointClick={(d) => onSelect(d.id)}
          pointsTransitionDuration={600}
          arcsData={arcs}
          arcColor={(d) => (d.id === selectedLoc.id ? ['rgba(255,106,77,1)', 'rgba(255,255,255,1)'] : ['rgba(255,106,77,0.75)', 'rgba(255,209,102,0.75)'])}
          arcStroke={(d) => (d.id === selectedLoc.id ? 0.9 : 0.45)}
          arcDashLength={0.45}
          arcDashGap={0.18}
          arcDashInitialGap={(d) => (d.id.length % 5) / 5}
          arcDashAnimateTime={reduce ? 0 : 2800}
          arcAltitudeAutoScale={0.42}
          ringsData={rings}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t) => `rgba(255,106,77,${(1 - t).toFixed(2)})`}
          ringMaxRadius={4.2}
          ringPropagationSpeed={2.4}
          ringRepeatPeriod={reduce ? 0 : 1300}
          htmlElementsData={tags}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={0.1}
          htmlElement={(d) => {
            const el = document.createElement('div');
            el.className = `globe-tag${d.home ? ' is-home' : ''}`;
            const label = document.createElement('span');
            label.textContent = d.home ? `${places[d.id][0]} · ${homeLabel}` : places[d.id][0];
            el.appendChild(label);
            return el;
          }}
        />
      )}
    </div>
  );
}
