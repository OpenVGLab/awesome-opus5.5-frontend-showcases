import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AchievementsProvider } from '../lib/achievements';
import { initAnalytics } from '../lib/analytics';
import { initAOS } from '../lib/aos';
import { ContentContext } from '../lib/content';
import About from './About';
import AudioPlayer from './AudioPlayer';
import BlogSection from './BlogSection';
import ChatWidget from './ChatWidget';
import Contact from './Contact';
import CursorEffects from './CursorEffects';
import Experience from './Experience';
import FAQ from './FAQ';
import Footer from './Footer';
import GlobeSection from './GlobeSection';
import Header from './Header';
import Hero from './Hero';
import Loader from './Loader';
import Projects from './Projects';
import ScrollToTop from './ScrollToTop';
import Seo from './Seo';
import Skills from './Skills';
import Testimonials from './Testimonials';

// Every section is statically imported so the prerendered HTML always contains the full page;
// only client-only widgets (WebGL, charts, chat, cursor, tooltips...) are code-split below.
const SocialFab = dynamic(() => import('./SocialFab'), { ssr: false });
const Tooltips = dynamic(() => import('./Tooltips'), { ssr: false });

export default function Home({ content, fonts }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    initAOS(reduce);
    initAnalytics(content.lang === 'zh' ? '/zh' : '/');
  }, [content.lang]);

  return (
    <ContentContext.Provider value={content}>
      <AchievementsProvider>
        <Seo content={content} />
        <a className="skip-link" href="#main">
          {content.a11y.skip}
        </a>
        <Loader label={content.loader} onDone={() => setReady(true)} />
        <Header />
        <main id="main" tabIndex={-1}>
          <Hero ready={ready} />
          <About />
          <Skills cloudFont={fonts?.serif} />
          <Projects />
          <Testimonials />
          <Experience />
          <GlobeSection />
          <BlogSection />
          <FAQ />
          <Contact />
        </main>
        <Footer />
        <AudioPlayer />
        <ScrollToTop />
        <SocialFab />
        <ChatWidget />
        <CursorEffects />
        <Tooltips />
      </AchievementsProvider>
    </ContentContext.Provider>
  );
}
