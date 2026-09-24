import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import posts from '../data/posts.json';
import { blogHref, formatDate, useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock, Rss } from './Icons';
import { SpringButton } from './Spring';

const featured = posts.filter((p) => p.featured);
const latest = posts.slice(0, 4);
const COVER = { width: 1600, height: 840 };

const slide = {
  enter: (dir) => ({ opacity: 0, x: dir * 60 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  exit: (dir) => ({ opacity: 0, x: dir * -60, transition: { duration: 0.35, ease: [0.7, 0, 0.84, 0] } }),
};

// Featured posts carousel: swipe/drag, arrows, dots, keyboard and autoplay that pauses on hover.
function FeaturedCarousel() {
  const content = useContent();
  const { blog } = content;
  const reduce = usePrefersReducedMotion();
  const [[index, dir], setState] = useState([0, 1]);
  const [paused, setPaused] = useState(false);
  const go = useCallback((d) => setState(([i]) => [(i + d + featured.length) % featured.length, d]), []);

  useEffect(() => {
    if (paused || reduce) return undefined;
    const id = window.setInterval(() => go(1), 6500);
    return () => window.clearInterval(id);
  }, [paused, reduce, go]);

  const post = featured[index];
  return (
    <div
      className="featured"
      role="region"
      aria-roledescription="carousel"
      aria-label={blog.featured}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1);
        if (e.key === 'ArrowLeft') go(-1);
      }}
    >
      <div className="featured-viewport">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.article
            key={post.slug}
            className="featured-slide"
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            drag={reduce ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) go(1);
              else if (info.offset.x > 80) go(-1);
            }}
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${featured.length}`}
          >
            <a className="featured-media" href={blogHref(post.slug)} tabIndex={-1} aria-hidden="true" draggable={false}>
              <Image src={post.cover} alt="" width={COVER.width} height={COVER.height} sizes="(max-width: 900px) 92vw, 640px" draggable={false} />
            </a>
            <div className="featured-body">
              <p className="featured-meta">
                <span className="chip chip--accent">{blog.featured}</span>
                <time dateTime={post.pubDate}>{formatDate(post.pubDate, content.lang)}</time>
                <span className="featured-read">
                  <Clock />
                  {post.minutes} {blog.minRead}
                </span>
              </p>
              <h3 className="featured-title">
                <a href={blogHref(post.slug)} draggable={false}>
                  {post.title}
                </a>
              </h3>
              <p className="featured-desc">{post.description}</p>
              <ul className="featured-tags">
                {post.tags.map((t) => (
                  <li key={t}>
                    <a className="chip" href={`blog/tags/${t}/`}>
                      #{t}
                    </a>
                  </li>
                ))}
              </ul>
              <SpringButton as="a" className="btn btn--primary btn--sm link" href={blogHref(post.slug)} draggable={false}>
                {blog.readArticle}
                <ArrowRight />
              </SpringButton>
            </div>
          </motion.article>
        </AnimatePresence>
      </div>
      <div className="featured-controls">
        <div className="featured-dots">
          {featured.map((p, i) => (
            <button
              key={p.slug}
              type="button"
              className={`featured-dot${i === index ? ' is-active' : ''}`}
              aria-label={`${blog.goTo} ${i + 1}`}
              aria-current={i === index}
              onClick={() => setState([i, i > index ? 1 : -1])}
            >
              {i === index && !paused && !reduce && <span className="featured-dot-progress" key={`${index}-p`} />}
            </button>
          ))}
        </div>
        <div className="featured-arrows">
          <button type="button" className="icon-btn link" onClick={() => go(-1)} aria-label={blog.prev}>
            <ChevronLeft />
          </button>
          <button type="button" className="icon-btn link" onClick={() => go(1)} aria-label={blog.next}>
            <ChevronRight />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BlogSection() {
  const content = useContent();
  const { blog } = content;
  return (
    <section id="blog" className="section blog-section" aria-labelledby="blog-title">
      <div className="container">
        <div className="blog-head">
          <header className="section-head" data-aos="fade-up">
            <p className="kicker">{blog.kicker}</p>
            <h2 id="blog-title" className="section-title">
              {blog.title}
            </h2>
            <p className="section-intro">{blog.intro}</p>
          </header>
          <div className="blog-links" data-aos="fade-up">
            <a className="link-arrow link" href={blogHref()}>
              {blog.all}
              <ArrowUpRight />
            </a>
            <a className="link-arrow link muted" href="blog/rss.xml">
              <Rss />
              {blog.rss}
            </a>
          </div>
        </div>

        <div className="blog-grid">
          <div data-aos="fade-up">
            <FeaturedCarousel />
          </div>
          <div className="latest" data-aos="fade-up" data-aos-delay="100">
            <h3 className="latest-title">{blog.latest}</h3>
            <ol className="latest-list">
              {latest.map((p) => (
                <li key={p.slug}>
                  <a className="latest-item link" href={blogHref(p.slug)}>
                    <time dateTime={p.pubDate}>{formatDate(p.pubDate, content.lang)}</time>
                    <span className="latest-name">{p.title}</span>
                    <span className="latest-read">
                      {p.minutes} {blog.minRead}
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
