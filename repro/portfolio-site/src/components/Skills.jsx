import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { useContent } from '../lib/content';
import { useNearViewport } from '../lib/hooks';

const SkillsCharts = dynamic(() => import('./SkillsCharts'), { ssr: false });
const SkillsCloud = dynamic(() => import('./SkillsCloud'), { ssr: false });

export default function Skills({ cloudFont }) {
  const { skills } = useContent();
  const chartsRef = useRef(null);
  const cloudRef = useRef(null);
  const chartsNear = useNearViewport(chartsRef, '200px');
  const cloudNear = useNearViewport(cloudRef, '250px');

  return (
    <section id="skills" className="section skills" aria-labelledby="skills-title">
      <div className="container">
        <header className="section-head" data-aos="fade-up">
          <p className="kicker">{skills.kicker}</p>
          <h2 id="skills-title" className="section-title">
            {skills.title}
          </h2>
          <p className="section-intro">{skills.intro}</p>
        </header>

        <div className="skills-grid" ref={chartsRef}>
          <figure className="card chart-card" data-aos="fade-up">
            <figcaption className="card-title">{skills.radarTitle}</figcaption>
            <div className="chart-box chart-box--radar">{chartsNear && <SkillsCharts kind="radar" labels={skills.radarLabels} />}</div>
            <ul className="sr-only">
              {skills.radarLabels.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </figure>
          <figure className="card chart-card" data-aos="fade-up" data-aos-delay="100">
            <figcaption className="card-title">{skills.barsTitle}</figcaption>
            <div className="chart-box chart-box--bars">{chartsNear && <SkillsCharts kind="bars" />}</div>
          </figure>
        </div>

        <div className="card cloud-card" ref={cloudRef} data-aos="fade-up">
          <div className="cloud-head">
            <h3 className="card-title">{skills.cloudTitle}</h3>
            <span className="chip">{skills.cloudHint}</span>
          </div>
          <div className="cloud-body">
            {cloudNear ? <SkillsCloud fontFamily={cloudFont} /> : <div className="cloud-placeholder" />}
          </div>
        </div>

        <div className="chips-block" data-aos="fade-up">
          <h3 className="chips-title">{skills.chipsTitle}</h3>
          <ul className="skill-chips">
            {skills.chips.map((c) => (
              <li key={c.name}>
                <button
                  type="button"
                  className="skill-chip link"
                  data-tooltip-id="skill-tip"
                  data-tooltip-content={c.note}
                  data-years={c.years}
                  data-name={c.name}
                  aria-describedby={`skill-note-${c.name.replace(/\W+/g, '')}`}
                >
                  {c.name}
                  <span className="skill-chip-years">{c.years}</span>
                </button>
                <span id={`skill-note-${c.name.replace(/\W+/g, '')}`} className="sr-only">
                  {c.note}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
