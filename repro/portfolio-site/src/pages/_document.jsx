import { Head, Html, Main, NextScript } from 'next/document';
import { themeInitScript } from '../lib/theme';

// Three.js always comes from the shared vendored build next to the site folder.
const importMap = {
  imports: {
    three: '../vendor/three/build/three.module.js',
    'three/addons/': '../vendor/three/jsm/',
  },
};

const noscriptCss = `.site-loader{display:none!important}[data-aos]{opacity:1!important;transform:none!important}.word,.hero-status,.hero-intro,.hero-ctas,.hero-now,.scroll-badge,.hero-stats,.project-card{opacity:1!important;transform:none!important}`;

export default function Document(props) {
  const lang = props.__NEXT_DATA__?.page === '/zh' ? 'zh-Hans' : 'en';
  return (
    <Html lang={lang} data-theme="light">
      <Head>
        <script type="importmap" dangerouslySetInnerHTML={{ __html: JSON.stringify(importMap) }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <meta name="theme-color" content="#F4F1EA" />
        <meta name="color-scheme" content="light dark" />
        <meta name="format-detection" content="telephone=no" />
        <link rel="icon" href="favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
        <link rel="manifest" href="site.webmanifest" />
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: noscriptCss }} />
        </noscript>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
