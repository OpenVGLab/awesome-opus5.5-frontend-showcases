<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  /** [{ key, start: Date, end: Date, total, future }] — one entry per calendar week. */
  weeks: { type: Array, required: true },
  color: { type: String, required: true },
  label: { type: String, default: '' },
});
const emit = defineEmits(['hover']);

const id = `trend-${Math.random().toString(36).slice(2, 10)}`;
const M = { top: 12, right: 10, bottom: 20, left: 30 };
const shortDate = d3.timeFormat('%b %-d');
const monthName = d3.timeFormat('%b');

const box = ref(null);
const svgEl = ref(null);

let svg;
let plot;
let gradientStops;
let clipRect;
let gGrid;
let areaPath;
let linePath;
let gAverage;
let gMonths;
let gCursor;
let overlay;
let observer;
let frame = 0;
let size = { w: 0, h: 0 };
let drawn = false;
let scales = null;
let active = null;

function render(animate) {
  const { w, h } = size;
  const data = props.weeks.filter((d) => !d.future);
  if (!svg || w < 120 || h < 60 || !data.length) return;
  const iw = w - M.left - M.right;
  const ih = h - M.top - M.bottom;
  const first = props.weeks[0].start;
  const last = props.weeks[props.weeks.length - 1].start;

  const x = d3.scaleTime().domain([first, last]).range([0, iw]);
  const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.total) || 1]).nice(3).range([ih, 0]);
  scales = { x, y, ih, iw, data };

  svg.attr('width', w).attr('height', h);
  plot.attr('transform', `translate(${M.left},${M.top})`);
  gradientStops.attr('stop-color', props.color);

  gGrid
    .selectAll('g')
    .data(y.ticks(3), (d) => d)
    .join((enter) =>
      enter.append('g').call((g) => {
        g.append('line');
        g.append('text').attr('x', -8).attr('dy', '0.32em');
      }),
    )
    .attr('transform', (d) => `translate(0,${y(d)})`)
    .call((g) => g.select('line').attr('x2', iw))
    .call((g) => g.select('text').text(d3.format(y.domain()[1] >= 1000 ? '~s' : '~g')));

  const area = d3.area().x((d) => x(d.start)).y0(ih).y1((d) => y(d.total)).curve(d3.curveMonotoneX);
  const line = d3.line().x((d) => x(d.start)).y((d) => y(d.total)).curve(d3.curveMonotoneX);
  areaPath.attr('d', area(data));
  linePath.attr('d', line(data)).attr('stroke', props.color);

  // Wipe in from the left whenever the data changes, like the calendar's colour sweep.
  clipRect.attr('height', h).attr('y', -M.top).attr('x', -4);
  if (animate) clipRect.attr('width', 0).transition().duration(900).ease(d3.easeCubicInOut).attr('width', iw + 8);
  else clipRect.interrupt().attr('width', iw + 8);

  const mean = d3.mean(data, (d) => d.total);
  gAverage.attr('transform', `translate(0,${y(mean)})`);
  gAverage.select('line').attr('x2', iw);
  gAverage.select('text').attr('x', iw).text(`avg ${d3.format('.0f')(mean)} / week`);

  const months = d3.timeMonth.range(d3.timeMonth.ceil(first), d3.timeDay.offset(last, 7));
  gMonths
    .selectAll('text')
    .data(months, (d) => +d)
    .join('text')
    .attr('x', (d) => x(d))
    .attr('y', ih + 15)
    .text((d, i) => (iw / months.length < 30 && i % 2 ? '' : monthName(d)));

  overlay.attr('width', iw).attr('height', ih + M.bottom).attr('y', 0);
  drawn = true;
  drawCursor();
}

function drawCursor() {
  if (!scales) return;
  const { x, y, ih, iw } = scales;
  const d = active;
  gCursor.attr('display', d ? null : 'none');
  if (!d) return;
  const cx = x(d.start);
  const cy = y(d.total);
  gCursor.select('line').attr('x1', cx).attr('x2', cx).attr('y1', 0).attr('y2', ih);
  gCursor.select('circle').attr('cx', cx).attr('cy', cy).attr('stroke', props.color);
  const text = gCursor.select('text').text(`${shortDate(d.start)} – ${shortDate(d.end)} · ${d3.format(',')(d.total)}`);
  const tw = text.node().getComputedTextLength() + 16;
  const lx = Math.max(0, Math.min(iw - tw, cx - tw / 2));
  const ly = cy - 30 < 0 ? cy + 12 : cy - 30;
  gCursor.select('rect').attr('x', lx).attr('y', ly).attr('width', tw).attr('height', 20);
  text.attr('x', lx + tw / 2).attr('y', ly + 14);
}

function setActive(d) {
  if (d === active) return;
  active = d;
  drawCursor();
  emit('hover', d);
}

onMounted(() => {
  svg = d3.select(svgEl.value);
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient').attr('id', `${id}-fill`).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  gradient.append('stop').attr('offset', '0%').attr('stop-opacity', 0.45);
  gradient.append('stop').attr('offset', '100%').attr('stop-opacity', 0.02);
  gradientStops = gradient.selectAll('stop');
  clipRect = defs.append('clipPath').attr('id', `${id}-clip`).append('rect');

  plot = svg.append('g');
  gGrid = plot.append('g').attr('class', 'tc-grid');
  const series = plot.append('g').attr('clip-path', `url(#${id}-clip)`);
  areaPath = series.append('path').attr('fill', `url(#${id}-fill)`);
  linePath = series.append('path').attr('class', 'tc-line');
  gAverage = plot.append('g').attr('class', 'tc-average');
  gAverage.append('line');
  gAverage.append('text').attr('text-anchor', 'end').attr('dy', '-0.45em');
  gMonths = plot.append('g').attr('class', 'tc-months');
  gCursor = plot.append('g').attr('class', 'tc-cursor').attr('display', 'none');
  gCursor.append('line');
  gCursor.append('circle').attr('r', 4.5);
  gCursor.append('rect').attr('rx', 5);
  gCursor.append('text').attr('text-anchor', 'middle');
  overlay = plot
    .append('rect')
    .attr('fill', 'transparent')
    .on('pointermove', (event) => {
      if (!scales) return;
      const [mx] = d3.pointer(event);
      const i = d3.bisector((d) => d.start).center(scales.data, scales.x.invert(mx));
      setActive(scales.data[i] ?? null);
    })
    .on('pointerleave', () => setActive(null));

  observer = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w === size.w && h === size.h) return;
      size = { w, h };
      render(!drawn);
    });
  });
  observer.observe(box.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
  svg?.selectAll('*').interrupt();
});

watch(
  () => props.weeks,
  () => {
    active = null;
    render(true);
  },
);
watch(() => props.color, () => render(false));
</script>

<template>
  <div ref="box" class="tc">
    <svg ref="svgEl" class="tc__svg" role="img" :aria-label="label" />
  </div>
</template>

<style scoped>
.tc {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.tc__svg {
  position: absolute;
  inset: 0;
  overflow: visible;
  font-size: 11px;
}
.tc__svg :deep(.tc-grid line) {
  stroke: var(--border-muted);
  stroke-dasharray: 2 3;
}
.tc__svg :deep(.tc-grid text) {
  fill: var(--fg-subtle);
  text-anchor: end;
}
.tc__svg :deep(.tc-line) {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
}
.tc__svg :deep(.tc-average line) {
  stroke: var(--fg-subtle);
  stroke-dasharray: 5 4;
  opacity: 0.8;
}
.tc__svg :deep(.tc-average text) {
  fill: var(--fg-muted);
  paint-order: stroke;
  stroke: var(--surface);
  stroke-width: 4px;
  stroke-linejoin: round;
}
.tc__svg :deep(.tc-months text) {
  fill: var(--fg-muted);
}
.tc__svg :deep(.tc-cursor line) {
  stroke: var(--fg-subtle);
}
.tc__svg :deep(.tc-cursor circle) {
  fill: var(--surface);
  stroke-width: 2;
}
.tc__svg :deep(.tc-cursor rect) {
  fill: var(--hm-tip-bg);
}
.tc__svg :deep(.tc-cursor text) {
  fill: #fff;
  font-weight: 500;
}
</style>
