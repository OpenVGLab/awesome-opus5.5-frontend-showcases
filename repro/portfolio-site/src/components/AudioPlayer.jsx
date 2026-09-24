import { useEffect, useRef, useState } from 'react';
import { useAchievements } from '../lib/achievements';
import { track } from '../lib/analytics';
import { useContent } from '../lib/content';
import { Pause, Play } from './Icons';

const BARS = 5;

// Custom background-music player; the music itself is generated live by lib/music.js.
export default function AudioPlayer() {
  const { widgets } = useContent();
  const { unlock } = useAchievements();
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const engineRef = useRef(null);
  const barsRef = useRef([]);

  useEffect(() => () => engineRef.current?.dispose(), []);

  useEffect(() => {
    if (!playing) {
      barsRef.current.forEach((b) => b && (b.style.transform = 'scaleY(0.25)'));
      return undefined;
    }
    let raf;
    const analyser = engineRef.current?.analyser;
    const bins = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
    const draw = () => {
      if (analyser) analyser.getByteFrequencyData(bins);
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const v = bins[2 + i * 5] / 255;
        bar.style.transform = `scaleY(${(0.2 + v * 0.95).toFixed(3)})`;
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = async () => {
    if (!engineRef.current) {
      const { LofiEngine } = await import('../lib/music');
      engineRef.current = new LofiEngine();
      engineRef.current.volume = volume;
    }
    const engine = engineRef.current;
    if (engine.playing) {
      engine.stop();
      setPlaying(false);
      track('music_pause');
    } else {
      await engine.start();
      setPlaying(true);
      unlock('dj');
      track('music_play');
    }
  };

  return (
    <div className={`audio-player${playing ? ' is-playing' : ''}`}>
      <button type="button" className="audio-toggle link" onClick={toggle} aria-pressed={playing} aria-label={playing ? widgets.pause : widgets.play}>
        {playing ? <Pause /> : <Play />}
      </button>
      <span className="audio-bars" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => (
          <span key={i} ref={(el) => (barsRef.current[i] = el)} />
        ))}
      </span>
      <span className="audio-text">
        <strong>{widgets.audioTitle}</strong>
        <span>{widgets.audioSub}</span>
      </span>
      <label className="audio-volume">
        <span className="sr-only">{widgets.volume}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            engineRef.current?.setVolume(v);
          }}
          style={{ '--vol': `${volume * 100}%` }}
        />
      </label>
    </div>
  );
}
