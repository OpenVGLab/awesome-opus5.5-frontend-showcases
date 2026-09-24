import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import FocusLock from 'react-focus-lock';
import { Link as ScrollLink, animateScroll, scroller } from 'react-scroll';
import { SOCIALS } from '../content/shared';
import { useAchievements } from '../lib/achievements';
import { useContent } from '../lib/content';
import { usePrefersReducedMotion, useScrollY } from '../lib/hooks';
import { useTheme } from '../lib/theme';
import { ArrowRight, Moon, Sun } from './Icons';
import { SpringButton, useUnderlineSpring } from './Spring';

export const SCROLL_OFFSET = -72;

export function scrollToSection(id, reduce) {
  scroller.scrollTo(id, { duration: reduce ? 0 : 900, smooth: 'easeInOutQuart', offset: SCROLL_OFFSET });
}

function NavItem({ id, label, reduce, onNavigate }) {
  const { handlers, underline } = useUnderlineSpring();
  return (
    <li>
      <ScrollLink
        to={id}
        href={`#${id}`}
        spy
        smooth="easeInOutQuart"
        duration={reduce ? 0 : 900}
        offset={SCROLL_OFFSET}
        activeClass="is-active"
        className="nav-link link"
        onClick={onNavigate}
        {...handlers}
      >
        <span>{label}</span>
        {underline}
      </ScrollLink>
    </li>
  );
}

function ThemeToggle() {
  const { isDark, toggle, ready } = useTheme();
  const { unlock } = useAchievements();
  const { a11y } = useContent();
  return (
    <button
      type="button"
      className="icon-btn theme-toggle link"
      onClick={() => {
        toggle();
        unlock('night-owl');
      }}
      aria-label={isDark ? a11y.themeToLight : a11y.themeToDark}
      aria-pressed={isDark}
      data-tooltip-id="ui-tip"
      data-tooltip-content={isDark ? a11y.themeToLight : a11y.themeToDark}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ready && isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{ display: 'grid' }}
        >
          {ready && isDark ? <Moon /> : <Sun />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}

function Hamburger({ open, onClick, label, buttonRef }) {
  const line = { transition: { type: 'spring', stiffness: 420, damping: 30 } };
  return (
    <button ref={buttonRef} type="button" className="icon-btn hamburger" onClick={onClick} aria-expanded={open} aria-controls={open ? 'mobile-menu' : undefined} aria-label={label}>
      <span className="hamburger-box" aria-hidden="true">
        <motion.span className="hamburger-line" animate={open ? { y: 6, rotate: 45 } : { y: 0, rotate: 0 }} {...line} />
        <motion.span className="hamburger-line" animate={open ? { opacity: 0, scaleX: 0.2 } : { opacity: 1, scaleX: 1 }} {...line} />
        <motion.span className="hamburger-line" animate={open ? { y: -6, rotate: -45 } : { y: 0, rotate: 0 }} {...line} />
      </span>
    </button>
  );
}

const menuVariants = {
  closed: { clipPath: 'circle(0px at calc(100% - 44px) 36px)', transition: { duration: 0.45, ease: [0.65, 0, 0.35, 1] } },
  open: { clipPath: 'circle(160% at calc(100% - 44px) 36px)', transition: { duration: 0.65, ease: [0.65, 0, 0.35, 1], staggerChildren: 0.05, delayChildren: 0.18 } },
};
const itemVariants = {
  closed: { opacity: 0, y: 24 },
  open: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export default function Header() {
  const content = useContent();
  const { nav, a11y, headerCta } = content;
  const scrolled = useScrollY(12);
  const reduce = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const burgerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const root = document.documentElement;
    root.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      root.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1021px)');
    const onChange = () => mq.matches && setOpen(false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const altHref = content.lang === 'en' ? 'zh.html' : './';

  return (
    <header className={`site-header${scrolled || open ? ' is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a
          className="brand link"
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setOpen(false);
            animateScroll.scrollToTop({ duration: reduce ? 0 : 800, smooth: 'easeInOutQuart' });
          }}
        >
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">Mara Ellison</span>
        </a>

        <nav className="primary-nav" aria-label={a11y.primaryNav}>
          <ul>
            {nav.map((item) => (
              <NavItem key={item.id} {...item} reduce={reduce} />
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <a
            className="icon-btn lang-switch link"
            href={altHref}
            hrefLang={content.lang === 'en' ? 'zh-Hans' : 'en'}
            lang={content.lang === 'en' ? 'zh-Hans' : 'en'}
            aria-label={`${content.altLangLabel} — ${content.altLangName}`}
            data-tooltip-id="ui-tip"
            data-tooltip-content={content.altLangName}
          >
            {content.altLangLabel}
          </a>
          <ThemeToggle />
          <SpringButton
            as="a"
            href="#contact"
            className="btn btn--primary btn--sm header-cta link"
            onClick={(e) => {
              e.preventDefault();
              scrollToSection('contact', reduce);
            }}
          >
            {headerCta}
            <ArrowRight />
          </SpringButton>
          <Hamburger open={open} onClick={() => setOpen((v) => !v)} label={open ? a11y.closeMenu : a11y.openMenu} buttonRef={burgerRef} />
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <FocusLock returnFocus shards={[burgerRef]}>
            <motion.div
              id="mobile-menu"
              className="mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label={a11y.primaryNav}
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
            >
              <nav className="container mobile-menu-inner" aria-label={a11y.primaryNav}>
                <ul className="mobile-nav">
                  {nav.map((item, i) => (
                    <motion.li key={item.id} variants={itemVariants}>
                      <a
                        href={`#${item.id}`}
                        className="mobile-nav-link"
                        onClick={(e) => {
                          e.preventDefault();
                          setOpen(false);
                          window.setTimeout(() => scrollToSection(item.id, reduce), 80);
                        }}
                      >
                        <span className="mobile-nav-index">0{i + 1}</span>
                        {item.label}
                      </a>
                    </motion.li>
                  ))}
                </ul>
                <motion.div className="mobile-menu-foot" variants={itemVariants}>
                  <ul className="mobile-socials">
                    {SOCIALS.filter((s) => s.id !== 'email').map((s) => (
                      <li key={s.id}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                  <a className="btn btn--accent" href="#contact" onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    window.setTimeout(() => scrollToSection('contact', reduce), 80);
                  }}>
                    {headerCta}
                    <ArrowRight />
                  </a>
                </motion.div>
              </nav>
            </motion.div>
          </FocusLock>
        )}
      </AnimatePresence>
    </header>
  );
}
