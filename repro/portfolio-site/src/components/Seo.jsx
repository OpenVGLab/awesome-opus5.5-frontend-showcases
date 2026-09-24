import Head from 'next/head';
import { PERSON } from '../content/shared';
import { abs, homeJsonLd, pageUrl } from '../lib/seo';

export default function Seo({ content: c }) {
  const url = pageUrl(c.lang);
  const og = abs(PERSON.ogImage);
  const jsonLd = homeJsonLd(c);
  return (
    <Head>
      <title>{c.meta.title}</title>
      <meta name="description" content={c.meta.description} />
      <meta name="keywords" content={c.meta.keywords} />
      <meta name="author" content="Mara Ellison" />
      <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
      <link rel="canonical" href={url} />
      <link rel="alternate" hrefLang="en" href={pageUrl('en')} />
      <link rel="alternate" hrefLang="zh-Hans" href={pageUrl('zh')} />
      <link rel="alternate" hrefLang="x-default" href={pageUrl('en')} />
      <link rel="alternate" type="application/rss+xml" title="Mara Ellison — Blog" href="blog/rss.xml" />
      <link rel="sitemap" type="application/xml" href="sitemap.xml" />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Mara Ellison" />
      <meta property="og:title" content={c.meta.title} />
      <meta property="og:description" content={c.meta.description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={og} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={c.meta.ogAlt} />
      <meta property="og:locale" content={c.locale} />
      <meta property="og:locale:alternate" content={c.lang === 'en' ? 'zh_CN' : 'en_US'} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@maraellison" />
      <meta name="twitter:creator" content="@maraellison" />
      <meta name="twitter:title" content={c.meta.title} />
      <meta name="twitter:description" content={c.meta.description} />
      <meta name="twitter:image" content={og} />

      <meta name="geo.region" content="PT-11" />
      <meta name="geo.placename" content="Lisbon" />
      <meta name="geo.position" content={`${PERSON.geo.lat};${PERSON.geo.lng}`} />
      <meta name="ICBM" content={`${PERSON.geo.lat}, ${PERSON.geo.lng}`} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </Head>
  );
}
