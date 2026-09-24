import localFont from 'next/font/local';
import 'aos/dist/aos.css';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/home.css';
import '../styles/widgets.css';
import { ThemeProvider } from '../lib/theme';

const serif = localFont({
  src: [
    { path: '../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2', weight: '400', style: 'italic' },
  ],
  display: 'swap',
  fallback: ['Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

const sans = localFont({
  src: '../node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

const mono = localFont({
  src: '../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
  adjustFontFallback: false,
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-serif: ${serif.style.fontFamily};
          --font-sans: ${sans.style.fontFamily};
          --font-mono: ${mono.style.fontFamily};
        }
      `}</style>
      <ThemeProvider>
        <Component {...pageProps} fonts={{ serif: serif.style.fontFamily }} />
      </ThemeProvider>
    </>
  );
}
