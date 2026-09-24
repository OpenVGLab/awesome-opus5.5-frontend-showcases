import dynamic from 'next/dynamic';
import Head from 'next/head';
import animation from '../public/lottie/lost-in-space.json';
import en from '../content/en';
import { SITE_URL } from '../content/shared';

const LottieAnimation = dynamic(() => import('../components/LottieAnimation'), { ssr: false, loading: () => <div className="lottie-placeholder" /> });

export default function NotFound() {
  const t = en.notFound;
  return (
    <>
      <Head>
        <title>{t.title}</title>
        <meta name="robots" content="noindex, follow" />
        <meta name="description" content={t.text} />
        <link rel="canonical" href={`${SITE_URL}/404`} />
      </Head>
      <main className="not-found">
        <a className="brand not-found-brand" href="./">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">Mara Ellison</span>
        </a>
        <div className="not-found-art" aria-hidden="true">
          <LottieAnimation animationData={animation} />
        </div>
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">{t.heading}</h1>
        <p className="not-found-text">{t.text}</p>
        <nav className="not-found-links" aria-label="Helpful links">
          <a className="btn btn--primary" href="./">
            {t.home}
          </a>
          <a className="btn btn--ghost" href="./#work">
            {t.work}
          </a>
          <a className="btn btn--ghost" href="blog/">
            {t.blog}
          </a>
        </nav>
      </main>
    </>
  );
}
