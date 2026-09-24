/* global echarts */
import chinaMap from '../data/china-map.js';

export const FONT = "Inter, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', 'Noto Sans SC', system-ui, sans-serif";
export const SERIES_COLORS = ['#38bdf8', '#f472b6', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#60a5fa', '#f97316', '#2dd4bf', '#c084fc', '#facc15', '#4ade80', '#e879f9', '#93c5fd', '#fda4af', '#bef264', '#fdba74', '#67e8f9', '#d8b4fe', '#86efac'];
// pollutant line colours, chosen to stay distinct from the six AQI level colours
export const POL_COLORS = ['#38bdf8', '#a78bfa', '#2dd4bf', '#f9a8d4', '#cbd5e1', '#94a3b8'];

const axisCommon = {
  axisLine: { lineStyle: { color: '#243452' } },
  axisTick: { show: false },
  axisLabel: { color: '#7d8fab', fontSize: 11 },
  splitLine: { lineStyle: { color: 'rgba(148,178,226,0.08)', type: 'dashed' } },
  nameTextStyle: { color: '#6b7c98', fontSize: 11 },
};

echarts.registerTheme('aq', {
  color: SERIES_COLORS,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: FONT, color: '#9fb0c8' },
  legend: { textStyle: { color: '#9fb0c8', fontSize: 11 }, inactiveColor: '#3a4862', itemWidth: 14, itemHeight: 8, icon: 'roundRect' },
  tooltip: {
    backgroundColor: 'rgba(9,16,31,0.96)',
    borderColor: 'rgba(120,160,220,0.28)',
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: '#e6edf7', fontSize: 12 },
    extraCssText: 'border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.45);',
  },
  categoryAxis: { ...axisCommon, splitLine: { show: false } },
  valueAxis: { ...axisCommon, axisLine: { show: false } },
  timeAxis: axisCommon,
  line: { symbol: 'circle', symbolSize: 4, smooth: 0.25 },
  dataZoom: {
    backgroundColor: 'rgba(15,24,43,0.6)', borderColor: 'rgba(120,160,220,0.18)', fillerColor: 'rgba(56,189,248,0.14)',
    handleStyle: { color: '#38bdf8', borderColor: '#38bdf8' }, textStyle: { color: '#7d8fab' },
    dataBackground: { lineStyle: { color: '#35507a' }, areaStyle: { color: 'rgba(56,120,200,0.18)' } },
  },
});
echarts.registerMap('china', chinaMap);

const observed = new Map();
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const c = observed.get(e.target);
    if (c && e.contentRect.width > 0 && e.contentRect.height > 0) c.resize();
  }
});

export function makeChart(el) {
  const c = echarts.init(el, 'aq', { renderer: 'canvas' });
  observed.set(el, c);
  ro.observe(el);
  return c;
}

export function tooltipRow(color, label, value) {
  return `<div style="display:flex;align-items:center;gap:8px;min-width:150px"><span style="width:8px;height:8px;border-radius:2px;background:${color};flex:none"></span><span style="color:#9fb0c8;flex:1">${label}</span><b style="font-variant-numeric:tabular-nums">${value}</b></div>`;
}

export const gridStd = { left: 44, right: 16, top: 34, bottom: 28, containLabel: false };
