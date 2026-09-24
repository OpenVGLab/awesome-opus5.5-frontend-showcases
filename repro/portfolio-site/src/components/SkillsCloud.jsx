import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useMemo, useState } from 'react';
import ReactWordcloud from 'react-wordcloud';
import 'tippy.js/dist/tippy.css';
import 'tippy.js/animations/scale.css';
import { CLOUD_WORDS } from '../content/shared';
import { useContent } from '../lib/content';
import { useTheme } from '../lib/theme';

const COLORS = {
  light: ['#141414', '#FF4D2E', '#3D5AFE', '#2A9D8F', '#3A3835', '#C2410C'],
  dark: ['#F2F0EA', '#FF6A4D', '#7C93FF', '#4FD1C5', '#D6D3CC', '#F2C14E'],
};

const MIN_SIZE = [280, 300];

// Memoised so selecting a word (parent state) never triggers a new cloud layout.
const Cloud = memo(function Cloud({ words, callbacks, options }) {
  return <ReactWordcloud words={words} callbacks={callbacks} options={options} minSize={MIN_SIZE} maxWords={60} />;
});

export default function SkillsCloud({ fontFamily }) {
  const { skills } = useContent();
  const { theme } = useTheme();
  const [selected, setSelected] = useState(null);

  const words = useMemo(() => CLOUD_WORDS.map(([text, value]) => ({ text, value })), []);
  const onWordClick = useCallback((w) => setSelected(w.text), []);
  const callbacks = useMemo(
    () => ({
      getWordTooltip: (w) => skills.cloudNotes[w.text] || w.text,
      onWordClick,
      getWordColor: (w) => {
        const palette = COLORS[theme];
        let h = 0;
        for (const ch of w.text) h = (h * 31 + ch.charCodeAt(0)) % 997;
        return w.value > 80 ? palette[1] : palette[h % palette.length];
      },
    }),
    [skills.cloudNotes, onWordClick, theme],
  );
  const options = useMemo(
    () => ({
      colors: COLORS[theme],
      deterministic: true,
      enableTooltip: true,
      enableOptimizations: true,
      fontFamily: fontFamily || 'Georgia, serif',
      fontSizes: [16, 62],
      fontStyle: 'normal',
      fontWeight: '400',
      padding: 3,
      rotations: 1,
      rotationAngles: [0, 0],
      scale: 'sqrt',
      spiral: 'archimedean',
      transitionDuration: 900,
      tooltipOptions: { theme: 'portfolio', animation: 'scale', arrow: true, maxWidth: 260 },
      svgAttributes: { role: 'img', 'aria-label': skills.cloudTitle },
    }),
    [theme, fontFamily, skills.cloudTitle],
  );

  return (
    <div className="cloud-layout">
      <div className="cloud-canvas">
        <Cloud words={words} callbacks={callbacks} options={options} />
      </div>
      <aside className="cloud-detail" aria-live="polite">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div key={selected} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <p className="cloud-detail-kicker">{skills.cloudTitle}</p>
              <p className="cloud-detail-word">{selected}</p>
              <p className="cloud-detail-note">{skills.cloudNotes[selected]}</p>
            </motion.div>
          ) : (
            <motion.p key="empty" className="cloud-detail-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {skills.cloudEmpty}
            </motion.p>
          )}
        </AnimatePresence>
        <ul className="cloud-word-list">
          {CLOUD_WORDS.slice(0, 8).map(([w]) => (
            <li key={w}>
              <button type="button" className={`chip${selected === w ? ' is-selected' : ''}`} onClick={() => setSelected(w)}>
                {w}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
