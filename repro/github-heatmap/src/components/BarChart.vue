<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';

const props = defineProps({
  /** [{ key, label, value, muted? }] — muted bars (e.g. future months) are drawn as placeholders. */
  items: { type: Array, required: true },
  /** Colour stops from the lowest to the highest value, interpolated in HCL. */
  colors: { type: Array, required: true },
  format: { type: Function, default: d3.format(',') },
  label: { type: String, default: '' },
});
const emit = defineEmits(['hover']);

const M = { top: 18, right: 2, bottom: 22, left: 30 };
const box = ref(null);
const svgEl = ref(null);

let svg;
let plot;
let gGrid;
let gBars;
let gValues;
let gTicks;
let gHits;
let observer;
let frame = 0;
let size = { w: 0, h: 0 };
let drawn = false;
let active = null;
let showAllValues = true;

function barPath(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function render(animate) {
  const { w, h } = size;
  if (!svg || w < 80 || h < 70) return;
  const iw = w - M.left - M.right;
  const ih = h - M.top - M.bottom;
  const items = props.items;

  const x = d3.scaleBand().domain(items.map((d) => d.key)).range([0, iw]).paddingInner(0.28).paddingOuter(0.12);
  const max = d3.max(items, (d) => d.value) || 1;
  const y = d3.scaleLinear().domain([0, max]).nice(4).range([ih, 0]);
  const stops = props.colors.map((c, i) => (max * i) / (props.colors.length - 1));
  const color = d3.scaleLinear().domain(stops).range(props.colors).interpolate(d3.interpolateHcl).clamp(true);
  const bw = x.bandwidth();
  const radius = Math.min(4, bw / 4);
  const cx = (d) => x(d.key) + bw / 2;
  const top = (d) => (d.muted ? ih - 2 : Math.min(ih - (d.value > 0 ? 2 : 0), y(d.value)));
  const t = svg.transition('chart').duration(animate ? 650 : 0).ease(d3.easeCubicOut);
  const stagger = (d, i) => (animate ? i * 28 : 0);
  showAllValues = bw >= 24;

  svg.attr('width', w).attr('height', h);
  plot.attr('transform', `translate(${M.left},${M.top})`);

  const tickFormat = d3.format(y.domain()[1] >= 1000 ? '~s' : '~g');
  gGrid
    .selectAll('g')
    .data(y.ticks(4), (d) => d)
    .join((enter) =>
      enter.append('g').call((g) => {
        g.append('line');
        g.append('text').attr('x', -8).attr('dy', '0.32em');
      }),
    )
    .attr('transform', (d) => `translate(0,${y(d)})`)
    .call((g) => g.select('line').attr('x2', iw))
    .call((g) => g.select('text').text(tickFormat));

  gBars
    .selectAll('path.bc-bar')
    .data(items, (d) => d.key)
    .join(
      (enter) => enter.append('path').attr('class', 'bc-bar').attr('d', (d) => barPath(x(d.key), ih, bw, 0, radius)),
      (update) => update,
      (exit) => exit.attr('class', 'bc-bar-exit').transition(t).attr('opacity', 0).remove(),
    )
    .classed('is-muted', (d) => Boolean(d.muted))
    .transition(t)
    .delay(stagger)
    .attr('d', (d) => barPath(x(d.key), top(d), bw, ih - top(d), radius))
    .attr('fill', (d) => color(d.value));

  gValues
    .selectAll('text')
    .data(items, (d) => d.key)
    .join((enter) => enter.append('text').attr('y', ih - 6))
    .attr('x', cx)
    .text((d) => (d.muted ? '' : props.format(d.value)))
    .transition(t)
    .delay(stagger)
    .attr('y', (d) => top(d) - 6);

  gTicks
    .selectAll('text')
    .data(items, (d) => d.key)
    .join('text')
    .attr('x', cx)
    .attr('y', ih + 15)
    .text((d) => (x.step() < 24 ? d.label.slice(0, 1) : d.label));

  gHits
    .selectAll('rect')
    .data(items, (d) => d.key)
    .join('rect')
    .attr('x', (d) => x(d.key) - (x.step() - bw) / 2)
    .attr('width', x.step())
    .attr('y', -M.top)
    .attr('height', ih + M.top + M.bottom)
    .attr('fill', 'transparent')
    .on('pointerenter', (event, d) => setActive(d))
    .on('pointerleave', () => setActive(null));

  drawn = true;
  applyActive();
}

function setActive(d) {
  const key = d && !d.muted ? d.key : null;
  if (key === active) return;
  active = key;
  applyActive();
  emit('hover', key ? d : null);
}

function applyActive() {
  gBars.selectAll('path.bc-bar').classed('is-dim', (d) => active !== null && d.key !== active);
  gValues
    .selectAll('text')
    .classed('is-active', (d) => d.key === active)
    .classed('is-hidden', (d) => !showAllValues && d.key !== active);
  gTicks.selectAll('text').classed('is-active', (d) => d.key === active);
}

onMounted(() => {
  svg = d3.select(svgEl.value);
  plot = svg.append('g');
  gGrid = plot.append('g').attr('class', 'bc-grid');
  gBars = plot.append('g').attr('class', 'bc-bars');
  gValues = plot.append('g').attr('class', 'bc-values');
  gTicks = plot.append('g').attr('class', 'bc-ticks');
  gHits = plot.append('g');
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

watch(() => [props.items, props.colors], () => render(true));
</script>

<template>
  <div ref="box" class="bc">
    <svg ref="svgEl" class="bc__svg" role="img" :aria-label="label" />
  </div>
</template>

<style scoped>
.bc {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.bc__svg {
  position: absolute;
  inset: 0;
  overflow: visible;
  font-size: 11px;
}
.bc__svg :deep(.bc-grid line) {
  stroke: var(--border-muted);
  stroke-dasharray: 2 3;
}
.bc__svg :deep(.bc-grid text) {
  fill: var(--fg-subtle);
  text-anchor: end;
}
.bc__svg :deep(.bc-bar) {
  transition: opacity 0.15s;
}
.bc__svg :deep(.bc-bar.is-dim) {
  opacity: 0.35;
}
.bc__svg :deep(.bc-bar.is-muted) {
  fill: var(--border);
}
.bc__svg :deep(.bc-values text) {
  fill: var(--fg-muted);
  text-anchor: middle;
  transition: opacity 0.15s;
}
.bc__svg :deep(.bc-values text.is-hidden) {
  opacity: 0;
}
.bc__svg :deep(.bc-ticks text) {
  fill: var(--fg-muted);
  text-anchor: middle;
}
.bc__svg :deep(.bc-values text.is-active),
.bc__svg :deep(.bc-ticks text.is-active) {
  fill: var(--fg);
  font-weight: 600;
}
</style>
