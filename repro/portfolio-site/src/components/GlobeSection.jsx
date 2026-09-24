import dynamic from 'next/dynamic';
import { useRef, useState } from 'react';
import { LOCATIONS } from '../content/shared';
import { useContent } from '../lib/content';
import { useNearViewport } from '../lib/hooks';
import { track } from '../lib/analytics';
import { MapPin } from './Icons';

const WorkGlobe = dynamic(() => import('./WorkGlobe'), { ssr: false });

export default function GlobeSection() {
  const { globe } = useContent();
  const ref = useRef(null);
  const near = useNearViewport(ref, '400px');
  const [selected, setSelected] = useState(null);
  const active = selected || 'lisbon';

  const select = (id) => {
    setSelected(id);
    track('globe_select', { id });
  };

  return (
    <section id="locations" className="section globe-section" aria-labelledby="globe-title">
      <div className="container">
        <div className="globe-card" ref={ref}>
          <div className="globe-copy">
            <p className="kicker">{globe.kicker}</p>
            <h2 id="globe-title" className="section-title">
              {globe.title}
            </h2>
            <p className="section-intro">{globe.intro}</p>
            <dl className="globe-stats">
              {globe.stats.map(([n, l]) => (
                <div key={l}>
                  <dt>{l}</dt>
                  <dd>{n}</dd>
                </div>
              ))}
            </dl>
            <ul className="globe-places">
              {LOCATIONS.map((l) => (
                <li key={l.id}>
                  <button type="button" className={`globe-place link${active === l.id ? ' is-active' : ''}`} aria-pressed={active === l.id} onClick={() => select(l.id)}>
                    {l.home && <MapPin />}
                    {globe.places[l.id][0]}
                  </button>
                </li>
              ))}
            </ul>
            <p className="globe-active" aria-live="polite">
              <strong>{globe.places[active][0]}</strong>
              <span>{globe.places[active][1]}</span>
            </p>
          </div>
          <div className="globe-stage">
            {near ? (
              <WorkGlobe places={globe.places} homeLabel={globe.home} selected={selected} onSelect={select} />
            ) : (
              <div className="globe-placeholder">{globe.loading}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
