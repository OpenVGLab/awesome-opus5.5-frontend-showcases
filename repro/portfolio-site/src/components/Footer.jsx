import { useEffect, useRef } from 'react';
import { animateScroll } from 'react-scroll';
import build from '../data/build.json';
import posts from '../data/posts.json';
import { ACHIEVEMENTS, PERSON, SOCIALS } from '../content/shared';
import { useAchievements } from '../lib/achievements';
import { blogHref, formatDate, useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';
import { scrollToSection } from './Header';
import { ArrowUpRight, Trophy } from './Icons';

const BUILD_DATE = build.date;

export default function Footer() {
  const content = useContent();
  const { footer, nav } = content;
  const { unlock, unlocked } = useAchievements();
  const reduce = usePrefersReducedMotion();
  const endRef = useRef(null);

  useEffect(() => {
    const el = endRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && unlock('explorer'), { threshold: 1 });
    io.observe(el);
    return () => io.disconnect();
  }, [unlock]);

  return (
    <footer className="site-footer">
      <div className="container">
        <a
          className="footer-cta link"
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            scrollToSection('contact', reduce);
          }}
        >
          {footer.cta}
          <ArrowUpRight />
        </a>

        <div className="footer-grid">
          <div className="footer-col footer-about">
            <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); animateScroll.scrollToTop({ duration: reduce ? 0 : 800 }); }}>
              <span className="brand-mark" aria-hidden="true">M</span>
              <span className="brand-name">Mara Ellison</span>
            </a>
            <p style={{ marginTop: 16 }}>{content.meta.description}</p>
            <address>
              Mara Ellison Studio
              <br />
              {PERSON.address.street}, {PERSON.address.postalCode} {PERSON.address.city}
              <br />
              <a href={`mailto:${PERSON.email}`}>{PERSON.email}</a> · <a href={PERSON.phoneHref}>{PERSON.phone}</a>
            </address>
          </div>
          <nav className="footer-col" aria-label={footer.navigate}>
            <h2>{footer.navigate}</h2>
            <ul>
              {nav.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} onClick={(e) => { e.preventDefault(); scrollToSection(n.id, reduce); }}>
                    {n.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" onClick={(e) => { e.preventDefault(); scrollToSection('faq', reduce); }}>
                  FAQ
                </a>
              </li>
            </ul>
          </nav>
          <nav className="footer-col" aria-label={footer.writing}>
            <h2>{footer.writing}</h2>
            <ul>
              {posts.slice(0, 3).map((p) => (
                <li key={p.slug}>
                  <a href={blogHref(p.slug)}>{p.title.split(':')[0]}</a>
                </li>
              ))}
              <li>
                <a href={blogHref()}>{footer.allPosts}</a>
              </li>
              <li>
                <a href="blog/tags/">{footer.tags}</a>
              </li>
              <li>
                <a href="blog/archive/">{footer.archive}</a>
              </li>
            </ul>
          </nav>
          <nav className="footer-col" aria-label={footer.connect}>
            <h2>{footer.connect}</h2>
            <ul>
              {SOCIALS.filter((s) => s.id !== 'email').map((s) => (
                <li key={s.id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer me">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="footer-col">
            <h2>{footer.studio}</h2>
            <ul>
              <li>
                <a href="blog/rss.xml">{footer.rss}</a>
              </li>
              <li>
                <a href="sitemap.xml">{footer.sitemap}</a>
              </li>
              <li>
                <a href={content.lang === 'en' ? 'zh.html' : './'} hrefLang={content.lang === 'en' ? 'zh-Hans' : 'en'}>
                  {content.altLangName}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom" ref={endRef}>
          <span>© 2026 Mara Ellison. {footer.built}</span>
          <span className="meta">
            <span>
              {footer.updated}: <time dateTime={BUILD_DATE}>{formatDate(BUILD_DATE, content.lang)}</time>
            </span>
            <span className="eggs" title="Try the Konami code">
              <Trophy />
              {footer.eggs}: {unlocked.length}/{ACHIEVEMENTS.length}
            </span>
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                animateScroll.scrollToTop({ duration: reduce ? 0 : 900, smooth: 'easeInOutQuart' });
              }}
            >
              {footer.top} ↑
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
