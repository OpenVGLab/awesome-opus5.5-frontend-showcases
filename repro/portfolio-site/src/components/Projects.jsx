import { LayoutGroup, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useCallback, useMemo, useState } from 'react';
import Masonry from 'react-masonry-css';
import { PROJECT_CATEGORIES, PROJECTS } from '../content/shared';
import { useAchievements } from '../lib/achievements';
import { useContent } from '../lib/content';
import { track } from '../lib/analytics';
import { ArrowUpRight } from './Icons';

const ProjectModal = dynamic(() => import('./ProjectModal'), { ssr: false });

const BREAKPOINTS = { default: 3, 1080: 2, 680: 1 };

export default function Projects() {
  const { work } = useContent();
  const { unlock } = useAchievements();
  const [filter, setFilter] = useState('all');
  const [openIndex, setOpenIndex] = useState(null);
  const [modalLoaded, setModalLoaded] = useState(false);

  const visible = useMemo(() => (filter === 'all' ? PROJECTS : PROJECTS.filter((p) => p.categories.includes(filter))), [filter]);
  const counts = useMemo(() => Object.fromEntries(PROJECT_CATEGORIES.map((c) => [c, PROJECTS.filter((p) => p.categories.includes(c)).length])), []);

  const open = useCallback(
    (i) => {
      setModalLoaded(true);
      setOpenIndex(i);
      unlock('curator');
      track('project_open', { id: visible[i].id });
    },
    [visible, unlock],
  );

  return (
    <section id="work" className="section work" aria-labelledby="work-title">
      <div className="container">
        <div className="work-head">
          <header className="section-head" data-aos="fade-up">
            <p className="kicker">{work.kicker}</p>
            <h2 id="work-title" className="section-title">
              {work.title}
            </h2>
            <p className="section-intro">{work.intro}</p>
          </header>
          <LayoutGroup id="filters">
            <div className="filters" role="group" aria-label={work.kicker} data-aos="fade-up" data-aos-delay="100">
              {['all', ...PROJECT_CATEGORIES].map((c) => {
                const active = filter === c;
                return (
                  <button key={c} type="button" className={`filter${active ? ' is-active' : ''}`} aria-pressed={active} onClick={() => setFilter(c)}>
                    {active && <motion.span layoutId="filter-pill" className="filter-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="filter-label">{c === 'all' ? work.all : work.categories[c]}</span>
                    <span className="filter-count">{c === 'all' ? PROJECTS.length : counts[c]}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        <p className="sr-only" aria-live="polite">
          {visible.length} / {PROJECTS.length}
        </p>

        <Masonry breakpointCols={BREAKPOINTS} className="masonry" columnClassName="masonry-col">
          {visible.map((p, i) => {
            const t = work.items[p.id];
            return (
              <motion.article
                key={`${filter}-${p.id}`}
                className="project-card"
                style={{ '--project-accent': p.accent }}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: i * 0.05 }}
              >
                <div className="project-media">
                  <Image
                    src={p.image.src}
                    alt={`${t.title} — ${t.summary}`}
                    width={p.image.width}
                    height={p.image.height}
                    sizes="(max-width: 680px) 92vw, (max-width: 1080px) 46vw, 400px"
                  />
                  <span className="project-view" aria-hidden="true">
                    {work.view}
                    <ArrowUpRight />
                  </span>
                </div>
                <div className="project-info">
                  <h3 className="project-title">
                    <button type="button" className="project-hit link" onClick={() => open(i)} aria-haspopup="dialog">
                      {t.title}
                    </button>
                  </h3>
                  <span className="project-year">{p.year}</span>
                </div>
                <p className="project-summary">{t.summary}</p>
                <ul className="project-tags" aria-label={work.stack}>
                  {p.categories.map((c) => (
                    <li key={c} className="chip chip--accent">
                      {work.categories[c]}
                    </li>
                  ))}
                  {p.stack.slice(0, 2).map((s) => (
                    <li key={s} className="chip">
                      {s}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </Masonry>
      </div>
      {modalLoaded && <ProjectModal projects={visible} index={openIndex} onIndex={setOpenIndex} onClose={() => setOpenIndex(null)} />}
    </section>
  );
}
