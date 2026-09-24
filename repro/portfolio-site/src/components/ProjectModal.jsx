import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import FocusLock from 'react-focus-lock';
import { blogHref, useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';
import { scrollToSection } from './Header';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Close } from './Icons';
import { SpringButton } from './Spring';

const WebGLViewer = dynamic(() => import('./WebGLViewer'), { ssr: false, loading: () => <div className="viewer-loading" /> });

export default function ProjectModal({ projects, index, onIndex, onClose }) {
  const { work } = useContent();
  const reduce = usePrefersReducedMotion();
  const open = index != null && projects[index];
  const project = open ? projects[index] : null;
  const t = project ? work.items[project.id] : null;
  const dirRef = useRef(1);

  const go = (delta) => {
    if (index == null) return;
    dirRef.current = delta;
    onIndex((index + delta + projects.length) % projects.length);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <FocusLock returnFocus>
            <motion.div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-modal-title"
              initial={{ opacity: 0, y: reduce ? 0 : 40, scale: reduce ? 1 : 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduce ? 0 : 30, scale: reduce ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="icon-btn modal-close link" onClick={onClose} aria-label={work.close}>
                <Close />
              </button>

              <div className="modal-media" role="img" aria-label={t.title}>
                <WebGLViewer projects={projects} index={index} direction={dirRef.current} />
                <div className="modal-nav">
                  <button type="button" className="icon-btn modal-arrow link" onClick={() => go(-1)} aria-label={work.prev}>
                    <ChevronLeft />
                  </button>
                  <span className="modal-count" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}
                  </span>
                  <button type="button" className="icon-btn modal-arrow link" onClick={() => go(1)} aria-label={work.next}>
                    <ChevronRight />
                  </button>
                </div>
                <span className="modal-hint">{work.webglHint}</span>
              </div>

              <div className="modal-body">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: reduce ? 0 : dirRef.current * 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: reduce ? 0 : dirRef.current * -24 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="kicker">{project.categories.map((c) => work.categories[c]).join(' · ')}</p>
                    <h3 id="project-modal-title" className="modal-title" aria-live="polite">
                      {t.title}
                    </h3>
                    <p className="modal-desc">{t.description}</p>
                    <dl className="modal-meta">
                      <div>
                        <dt>{work.role}</dt>
                        <dd>{t.role}</dd>
                      </div>
                      <div>
                        <dt>{work.client}</dt>
                        <dd>{t.client}</dd>
                      </div>
                      <div>
                        <dt>{work.year}</dt>
                        <dd>{project.year}</dd>
                      </div>
                      <div>
                        <dt>{work.stack}</dt>
                        <dd>{project.stack.join(', ')}</dd>
                      </div>
                    </dl>
                    <h4 className="modal-subtitle">{work.results}</h4>
                    <ul className="modal-results">
                      {t.results.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <div className="modal-actions">
                      {project.caseStudy && (
                        <SpringButton as="a" className="btn btn--primary btn--sm link" href={blogHref(project.caseStudy)}>
                          {work.caseStudy}
                          <ArrowUpRight />
                        </SpringButton>
                      )}
                      <SpringButton
                        as="button"
                        type="button"
                        className="btn btn--ghost btn--sm link"
                        onClick={() => {
                          onClose();
                          window.setTimeout(() => scrollToSection('contact', reduce), 250);
                        }}
                      >
                        {work.similar}
                        <ArrowRight />
                      </SpringButton>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </FocusLock>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
