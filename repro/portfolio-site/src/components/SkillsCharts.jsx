import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { useEffect, useRef } from 'react';
import { BARS, RADAR } from '../content/shared';
import { usePrefersReducedMotion } from '../lib/hooks';
import { useTheme } from '../lib/theme';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, BarController, BarElement, CategoryScale, LinearScale);

function palette() {
  const css = getComputedStyle(document.documentElement);
  const v = (n) => css.getPropertyValue(n).trim();
  return {
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    line: v('--line'),
    accent: v('--accent'),
    blue: v('--blue'),
    surface: v('--surface'),
    track: v('--bg-2'),
    font: css.getPropertyValue('--font-sans').trim() || 'system-ui',
    mono: css.getPropertyValue('--font-mono').trim() || 'monospace',
  };
}

const withAlpha = (hex, a) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// Draws the percentage at the end of each animated progress bar.
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart) {
    if (chart.config.type !== 'bar') return;
    const { ctx, chartArea, scales } = chart;
    const meta = chart.getDatasetMeta(1);
    const opts = chart.options.plugins.valueLabels || {};
    ctx.save();
    ctx.font = `500 12px ${opts.font}`;
    ctx.fillStyle = opts.color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    meta.data.forEach((bar, i) => {
      const value = chart.data.datasets[1].data[i];
      const target = scales.x.getPixelForValue(value) - chartArea.left;
      const frac = Math.min(1, Math.max(0, (bar.x - chartArea.left) / target));
      ctx.globalAlpha = frac;
      ctx.fillText(`${Math.round(value * frac)}%`, chartArea.right, bar.y - 16);
    });
    ctx.restore();
  },
};

function radarConfig(labels, c, reduce) {
  return {
    type: 'radar',
    data: {
      labels,
      datasets: [
        {
          data: RADAR,
          fill: true,
          backgroundColor: withAlpha(c.accent, 0.18),
          borderColor: c.accent,
          borderWidth: 2,
          pointBackgroundColor: c.accent,
          pointBorderColor: c.surface,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      animation: reduce ? false : { duration: 1500, easing: 'easeOutQuart' },
      scales: {
        r: {
          min: 40,
          max: 100,
          ticks: { display: false, stepSize: 15 },
          grid: { color: c.line },
          angleLines: { color: c.line },
          pointLabels: { color: c.ink2, font: { family: c.font, size: 12, weight: '500' }, padding: 10 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: c.ink, titleColor: c.surface, bodyColor: c.surface, displayColors: false, callbacks: { label: (ctx) => `${ctx.raw} / 100` } },
      },
    },
  };
}

function barsConfig(c, reduce) {
  return {
    type: 'bar',
    data: {
      labels: BARS.map((b) => b[0]),
      datasets: [
        { data: BARS.map(() => 100), backgroundColor: c.track, borderRadius: 999, borderSkipped: false, barThickness: 10, grouped: false, order: 2 },
        {
          data: BARS.map((b) => b[1]),
          backgroundColor: (ctx) => {
            const { chart } = ctx;
            if (!chart.chartArea) return c.accent;
            const g = chart.ctx.createLinearGradient(chart.chartArea.left, 0, chart.chartArea.right, 0);
            g.addColorStop(0, withAlpha(c.accent, 0.55));
            g.addColorStop(1, c.accent);
            return g;
          },
          borderRadius: 999,
          borderSkipped: false,
          barThickness: 10,
          grouped: false,
          order: 1,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      maintainAspectRatio: false,
      layout: { padding: { top: 18, right: 4 } },
      animation: reduce ? false : { duration: 1400, easing: 'easeOutQuart', delay: (ctx) => (ctx.type === 'data' && ctx.datasetIndex === 1 ? ctx.dataIndex * 110 : 0) },
      scales: {
        x: { min: 0, max: 100, display: false },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: c.ink, font: { family: c.font, size: 13, weight: '500' }, mirror: true, labelOffset: -16, padding: 0, z: 1 },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        valueLabels: { color: c.muted, font: c.mono },
      },
    },
    plugins: [valueLabels],
  };
}

// Chart.js skill charts: radar map and animated progress bars. Built when scrolled into view so
// the entrance animation is actually seen, and recoloured on theme changes.
export default function SkillsCharts({ kind, labels }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const { theme } = useTheme();
  const reduce = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || chartRef.current) return;
        const c = palette();
        chartRef.current = new Chart(canvas, kind === 'radar' ? radarConfig(labels, c, reduce) : barsConfig(c, reduce));
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(canvas);
    return () => {
      io.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [kind, labels, reduce]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const c = palette();
    const next = kind === 'radar' ? radarConfig(labels, c, true) : barsConfig(c, true);
    chart.data.datasets.forEach((ds, i) => Object.assign(ds, next.data.datasets[i], { data: ds.data }));
    chart.options.scales = next.options.scales;
    chart.options.plugins = next.options.plugins;
    chart.update('none');
  }, [theme, kind, labels]);

  return <canvas ref={canvasRef} role="img" aria-label={kind === 'radar' ? 'Radar chart of capability scores' : 'Bar chart of core stack proficiency'} />;
}
