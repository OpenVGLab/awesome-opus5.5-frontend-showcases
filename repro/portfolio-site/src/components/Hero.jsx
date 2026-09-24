import { animate, motion, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useContent } from '../lib/content';
import { scrollToSection } from './Header';
import { ArrowDown, ArrowRight } from './HeroIcons';
import { SpringButton } from './Spring';

const ParticlesBackground = dynamic(() => import('./ParticlesBackground'), { ssr: false });

const EASE = [0.16, 1, 0.3, 1];
const title = { hidden: {}, show: { transition: { staggerChildren: 0.075, delayChildren: 0.05 } } };
const word = { hidden: { y: '112%', rotate: 4 }, show: { y: '0%', rotate: 0, transition: { duration: 1.05, ease: EASE } } };
const fade = { hidden: { opacity: 0, y: 18 }, show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE, delay: 0.55 + i * 0.08 } }) };

function Counter({ to, suffix, run }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!run || !ref.current) return undefined;
    const node = ref.current;
    const controls = animate(0, to, {
      duration: 1.6,
      ease: EASE,
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [run, to, suffix]);
  return (
    <span ref={ref}>
      {to}
      {suffix}
    </span>
  );
}

export default function Hero({ ready }) {
  const { hero } = useContent();
  const reduce = useReducedMotion();
  const [animateIn, setAnimateIn] = useState(false);
  useEffect(() => {
    if (ready) setAnimateIn(true);
  }, [ready]);
  const state = animateIn || reduce ? 'show' : 'hidden';

  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <ParticlesBackground />
      <div className="hero-glow" aria-hidden="true" />
      <div className="container hero-inner">
        <div className="hero-head">
          <motion.p className="hero-status" initial="hidden" animate={state} variants={fade} custom={0}>
            <span className="pulse-dot" aria-hidden="true" />
            {hero.status}
          </motion.p>
          <motion.h1 id="hero-title" className="display hero-title" initial="hidden" animate={state} variants={title}>
            <span className="hero-eyebrow">{hero.eyebrow}</span>
            {hero.lines.map((line, li) => (
              <span className="hero-line" key={li}>
                {line.map((w, wi) => (
                  <span className="word-mask" key={wi}>
                    <motion.span className={`word${w.em ? ' em' : ''}`} variants={word}>
                      {w.t}
                    </motion.span>
                  </span>
                ))}
              </span>
            ))}
          </motion.h1>
        </div>

        <div className="hero-row">
          <motion.p className="hero-intro" initial="hidden" animate={state} variants={fade} custom={1}>
            {hero.intro}
          </motion.p>
          <motion.div className="hero-ctas" initial="hidden" animate={state} variants={fade} custom={2}>
            <SpringButton
              as="a"
              href="#work"
              className="btn btn--primary link"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('work', reduce);
              }}
            >
              {hero.primary}
              <ArrowRight />
            </SpringButton>
            <SpringButton
              as="a"
              href="#contact"
              className="btn btn--ghost link"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contact', reduce);
              }}
            >
              {hero.secondary}
            </SpringButton>
          </motion.div>
          <motion.aside className="hero-now" initial="hidden" animate={state} variants={fade} custom={3} aria-label={hero.now}>
            <span className="hero-now-label">
              <span className="pulse-dot pulse-dot--blue" aria-hidden="true" />
              {hero.now}
            </span>
            <span className="hero-now-text">{hero.nowText}</span>
          </motion.aside>
          <motion.a
            href="#about"
            className="scroll-badge link"
            initial="hidden"
            animate={state}
            variants={fade}
            custom={4}
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('about', reduce);
            }}
          >
            <svg className="scroll-badge-ring" viewBox="0 0 120 120" aria-hidden="true">
              <defs>
                <path id="badge-circle" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" />
              </defs>
              <text>
                <textPath href="#badge-circle" textLength="289">
                  {hero.scroll}
                </textPath>
              </text>
            </svg>
            <ArrowDown className="scroll-badge-arrow" />
            <span className="sr-only">{hero.scroll.split('•')[0].trim()}</span>
          </motion.a>
        </div>

        <motion.dl className="hero-stats" initial="hidden" animate={state} variants={fade} custom={5}>
          {hero.stats.map((s) => (
            <div key={s.label} className="hero-stat">
              <dt>{s.label}</dt>
              <dd>
                <Counter to={s.value} suffix={s.suffix} run={animateIn && !reduce} />
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  );
}
