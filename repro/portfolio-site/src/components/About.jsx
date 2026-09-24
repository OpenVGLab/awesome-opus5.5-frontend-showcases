import Image from 'next/image';
import { PERSON } from '../content/shared';
import { useContent } from '../lib/content';

export default function About() {
  const { about } = useContent();
  return (
    <section id="about" className="section about" aria-labelledby="about-title">
      <div className="container">
        <div className="about-grid">
          <div className="about-portrait" data-aos="fade-up">
            <div className="portrait-frame">
              <Image
                src={PERSON.headshot.src}
                alt={about.portraitAlt}
                width={PERSON.headshot.width}
                height={PERSON.headshot.height}
                sizes="(max-width: 900px) 80vw, 420px"
              />
            </div>
            <span className="portrait-badge" aria-hidden="true">
              {about.badge}
            </span>
            <span className="portrait-orbit" aria-hidden="true" />
          </div>

          <div className="about-copy">
            <header className="section-head" data-aos="fade-up">
              <p className="kicker">{about.kicker}</p>
              <h2 id="about-title" className="section-title">
                {about.title}
              </h2>
            </header>
            {about.bio.map((p, i) => (
              <p key={i} className="about-bio" data-aos="fade-up" data-aos-delay={80 + i * 80}>
                {p}
              </p>
            ))}
            <dl className="about-facts" data-aos="fade-up" data-aos-delay="220">
              {about.facts.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="story">
          <h3 className="story-title" data-aos="fade-up">
            {about.storyTitle}
          </h3>
          <ol className="story-list">
            {about.story.map((s, i) => (
              <li key={s.year} className="story-item" data-aos="fade-up" data-aos-delay={i * 90} data-aos-anchor-placement="top-bottom">
                <span className="story-year">{s.year}</span>
                <span className="story-dot" aria-hidden="true" />
                <div>
                  <h4 className="story-heading">{s.title}</h4>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
