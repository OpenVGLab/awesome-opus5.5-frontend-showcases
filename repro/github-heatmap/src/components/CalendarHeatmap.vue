<script>
import * as d3 from 'd3';

/**
 * GitHub-style contribution levels: 0 for no activity, then 1–4 split at the
 * quartiles of the non-zero daily counts. Returns a d3 threshold scale.
 */
export function contributionLevels(counts) {
  const active = counts.filter((c) => c > 0).sort(d3.ascending);
  const cuts = [1];
  for (const p of [0.25, 0.5, 0.75]) {
    const q = active.length ? Math.ceil(d3.quantileSorted(active, p)) : 0;
    cuts.push(Math.max(cuts[cuts.length - 1] + 1, q));
  }
  return d3.scaleThreshold().domain(cuts).range([0, 1, 2, 3, 4]);
}

/** Daily-count range covered by one level of a contributionLevels() scale, e.g. "4–8". */
export function levelRange(scale, level) {
  if (level === 0) return '0';
  const bounds = [...scale.domain(), Infinity];
  const lo = bounds[level - 1];
  const hi = bounds[level] - 1;
  if (hi === Infinity) return `${lo}+`;
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}
</script>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  /** Daily totals: [{ date: 'YYYY-MM-DD' | Date, count: Number }]. Missing days count as 0. */
  data: { type: Array, required: true },
  /** First and last day shown. Defaults to GitHub's rolling year ending `today`. */
  start: { type: [Date, String], default: null },
  end: { type: [Date, String], default: null },
  /** 0 = weeks start on Sunday (GitHub), 1 = Monday. */
  weekStart: { type: Number, default: 0 },
  /** Five colours, from "no contributions" to "most contributions". */
  palette: { type: Array, default: () => ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'] },
  /** 'square' or 'circle'. */
  shape: { type: String, default: 'square' },
  /** Selected day as 'YYYY-MM-DD' (use with v-model:selected). */
  selected: { type: String, default: null },
  /** Optional emphasis from outside: { label: String, test: (day) => Boolean }. */
  highlight: { type: Object, default: null },
  /** Days after this date are drawn as empty placeholders. */
  today: { type: Date, default: () => d3.timeDay.floor(new Date()) },
  /** Upper bound for cell size + gap, in px. Cells shrink to fit narrower containers. */
  maxPitch: { type: Number, default: 28 },
});

const emit = defineEmits(['update:selected', 'select', 'hover']);

const PAD = 3; // room for the selection ring around edge cells
const LABEL_W = 32;
const MONTH_H = 20;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const formatKey = d3.timeFormat('%Y-%m-%d');
const parseKey = d3.timeParse('%Y-%m-%d');
const monthKey = d3.timeFormat('%Y-%m');
const monthName = d3.timeFormat('%b');
const monthYear = d3.timeFormat('%B %Y');
const longDate = d3.timeFormat('%A, %B %-d, %Y');
const fmt = d3.format(',');
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');

const root = ref(null);
const svgEl = ref(null);
const tipEl = ref(null);
const width = ref(0);
const hover = ref(null); // { day, source: 'pointer' | 'keyboard', x, y, shift }
const local = ref(null); // emphasis coming from month / weekday labels and the legend

// ---------------------------------------------------------------------------
// Data → day cells

const toDay = (v) => d3.timeDay.floor(v instanceof Date ? v : parseKey(String(v).slice(0, 10)));
const week = computed(() => (props.weekStart === 1 ? d3.timeMonday : d3.timeSunday));

const range = computed(() => {
  const end = props.end ? toDay(props.end) : props.today;
  const start = props.start ? toDay(props.start) : week.value.offset(week.value.floor(end), -52);
  return { start, end };
});

const totals = computed(() => {
  const map = new Map();
  for (const d of props.data) {
    const key = d.date instanceof Date ? formatKey(d.date) : String(d.date).slice(0, 10);
    map.set(key, (map.get(key) || 0) + (Number(d.count) || 0));
  }
  return map;
});

const days = computed(() => {
  const { start, end } = range.value;
  const first = week.value.floor(start);
  return d3.timeDay.range(start, d3.timeDay.offset(end, 1)).map((date) => {
    const key = formatKey(date);
    return {
      date,
      key,
      count: totals.value.get(key) || 0,
      col: week.value.count(first, date),
      row: (date.getDay() - props.weekStart + 7) % 7,
      future: date > props.today,
    };
  });
});

const byKey = computed(() => new Map(days.value.map((d) => [d.key, d])));
const byCell = computed(() => new Map(days.value.map((d) => [d.col * 7 + d.row, d])));
const levels = computed(() => contributionLevels(days.value.filter((d) => !d.future).map((d) => d.count)));
const levelOf = (d) => (d.future ? 0 : levels.value(d.count));
const total = computed(() => d3.sum(days.value, (d) => (d.future ? 0 : d.count)));

// Month label above the first column whose week starts in that month.
const months = computed(() => {
  const labels = [];
  let previous = null;
  days.value.forEach((d, i) => {
    if (i > 0 && d.row !== 0) return;
    const key = monthKey(d.date);
    if (key !== previous) labels.push({ key, col: d.col, date: d.date });
    previous = key;
  });
  return labels.filter((l, i) => (labels[i + 1] ? labels[i + 1].col - l.col >= 3 : cols.value - l.col >= 2));
});

// ---------------------------------------------------------------------------
// Responsive geometry

const cols = computed(() => (days.value.length ? days.value[days.value.length - 1].col + 1 : 53));
const pitch = computed(() => {
  const fit = Math.floor((width.value - LABEL_W - 2 * PAD) / cols.value);
  return Math.max(11, Math.min(props.maxPitch, fit || 11));
});
const gap = computed(() => Math.max(2, Math.round(pitch.value * 0.17)));
const cell = computed(() => pitch.value - gap.value);
const radius = computed(() => (props.shape === 'circle' ? cell.value / 2 : Math.max(2, Math.round(cell.value * 0.2))));
const svgWidth = computed(() => 2 * PAD + LABEL_W + cols.value * pitch.value - gap.value);
const svgHeight = computed(() => 2 * PAD + MONTH_H + 7 * pitch.value - gap.value);

// ---------------------------------------------------------------------------
// Tooltip, caption and emphasis

const emphasis = computed(() => local.value || props.highlight || null);
const emphasisSummary = computed(() => {
  const h = emphasis.value;
  if (!h) return null;
  const hit = days.value.filter((d) => !d.future && h.test(d));
  return { label: h.label, days: hit.length, total: d3.sum(hit, (d) => d.count) };
});

const countText = (n) => (n === 0 ? 'No contributions' : `${fmt(n)} contribution${n === 1 ? '' : 's'}`);
const liveText = computed(() =>
  hover.value?.source === 'keyboard' ? `${countText(hover.value.day.count)} on ${longDate(hover.value.day.date)}` : '',
);
const tipStyle = computed(() => ({
  left: `${hover.value.x + hover.value.shift}px`,
  top: `${hover.value.y}px`,
  '--arrow-x': `${-hover.value.shift}px`,
}));

function showLevel(level) {
  const span = levelRange(levels.value, level);
  local.value = {
    label: level === 0 ? 'Days without contributions' : `Level ${level} · ${span} a day`,
    test: (d) => levelOf(d) === level,
  };
}

function setHover(day, source) {
  if (!day) {
    if (hover.value) {
      hover.value = null;
      emit('hover', null);
    }
    return;
  }
  if (hover.value?.day.key === day.key && hover.value.source === source) return;
  const s = svgEl.value.getBoundingClientRect();
  const r = root.value.getBoundingClientRect();
  hover.value = {
    day,
    source,
    shift: 0,
    x: s.left - r.left + PAD + LABEL_W + day.col * pitch.value + cell.value / 2,
    y: s.top - r.top + PAD + MONTH_H + day.row * pitch.value,
  };
  emit('hover', day);
  nextTick(keepTipOnScreen);
}

function keepTipOnScreen() {
  const tip = tipEl.value;
  if (!tip || !hover.value) return;
  const half = tip.offsetWidth / 2;
  const r = root.value.getBoundingClientRect();
  const min = 8 + half - r.left;
  const max = document.documentElement.clientWidth - 8 - half - r.left;
  hover.value.shift = Math.min(Math.max(hover.value.x, min), max) - hover.value.x;
}

function choose(day) {
  emit('update:selected', day.key);
  emit('select', { ...day, level: levelOf(day) });
}

function onKeydown(event) {
  const list = days.value;
  const last = list.findLastIndex((d) => !d.future);
  if (last < 0) return;
  const from = byKey.value.get(hover.value?.day.key ?? props.selected);
  let i = from ? list.indexOf(from) : last;
  const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
  if (step !== undefined) i = Math.min(last, Math.max(0, i + step));
  else if (event.key === 'Home') i = 0;
  else if (event.key === 'End') i = last;
  else if (event.key === 'Enter' || event.key === ' ') choose(list[i]);
  else if (event.key === 'Escape') {
    setHover(null);
    local.value = null;
    return;
  } else return;
  event.preventDefault();
  setHover(list[i], 'keyboard');
}

function onFocus() {
  if (!svgEl.value.matches(':focus-visible')) return;
  const day = byKey.value.get(props.selected) ?? days.value.findLast((d) => !d.future);
  if (day) setHover(day, 'keyboard');
}

function onBlur() {
  if (hover.value?.source === 'keyboard') setHover(null);
}

// ---------------------------------------------------------------------------
// D3 rendering

let svg;
let gMonths;
let gWeekdays;
let gCells;
let gRings;
let ringSelect;
let ringHover;
let observer;
let frame = 0;
let previous = null;

function dayAt(event) {
  const [x, y] = d3.pointer(event, gCells.node());
  if (x < 0 || y < 0) return null;
  const col = Math.floor(x / pitch.value);
  const row = Math.floor(y / pitch.value);
  return row < 7 ? byCell.value.get(col * 7 + row) ?? null : null;
}

function renderMode() {
  const next = { days: days.value, palette: props.palette.join(), pitch: pitch.value, shape: props.shape };
  const prev = previous;
  previous = next;
  if (!prev) return 'enter';
  if (prev.days !== next.days) return 'wave';
  if (prev.pitch !== next.pitch) return 'resize';
  if (prev.shape !== next.shape) return 'shape';
  return 'recolor';
}

function render() {
  if (!svg) return;
  const mode = renderMode();
  const p = pitch.value;
  const c = cell.value;
  const r = radius.value;
  const fill = (d) => props.palette[levelOf(d)];

  svg.attr('width', svgWidth.value).attr('height', svgHeight.value);
  if (mode === 'enter' || mode === 'wave') {
    // On narrow screens the grid scrolls; start at the most recent weeks, like GitHub.
    const scroller = svgEl.value.parentElement;
    scroller.scrollLeft = scroller.scrollWidth;
  }
  const origin = `translate(${PAD + LABEL_W},${PAD + MONTH_H})`;
  gCells.attr('transform', origin);
  gRings.attr('transform', origin);

  // Colour sweeps diagonally across the grid, week by week.
  const wave = (d) => d.col * 11 + d.row * 7;
  const delay = { enter: wave, wave, recolor: (d) => wave(d) * 0.6, shape: (d) => d.col * 5, resize: 0 }[mode];
  const duration = reducedMotion?.matches ? 0 : { enter: 520, wave: 420, recolor: 360, shape: 380, resize: 0 }[mode];

  const cells = gCells.selectAll('rect.hm-day').data(days.value, (d) => d.col * 7 + d.row);

  cells
    .exit()
    .attr('class', 'hm-day-exit')
    .interrupt('layout')
    .transition('layout')
    .duration(duration ? 200 : 0)
    .attr('opacity', 0)
    .remove();

  const entered = cells
    .enter()
    .append('rect')
    .attr('class', 'hm-day')
    .attr('x', (d) => d.col * p + c / 2)
    .attr('y', (d) => d.row * p + c / 2)
    .attr('width', 0)
    .attr('height', 0)
    .attr('rx', 0)
    .attr('fill', fill);

  entered.merge(cells).classed('is-future', (d) => d.future);

  const grow = duration
    ? entered.transition('layout').delay(delay).duration(duration + 120).ease(d3.easeBackOut.overshoot(1.7))
    : entered;
  grow
    .attr('x', (d) => d.col * p)
    .attr('y', (d) => d.row * p)
    .attr('width', c)
    .attr('height', c)
    .attr('rx', r);

  const update = duration
    ? cells.transition('layout').delay(delay).duration(duration).ease(d3.easeCubicOut)
    : cells.interrupt('layout');
  update
    .attr('x', (d) => d.col * p)
    .attr('y', (d) => d.row * p)
    .attr('width', c)
    .attr('height', c)
    .attr('rx', r)
    .attr('fill', fill);

  renderLabels(duration > 0);
  applyEmphasis(false);
  if (mode === 'wave' || mode === 'resize') setHover(null);
  placeSelectRing(mode !== 'resize');
  placeHoverRing();
}

function renderLabels(animate) {
  const p = pitch.value;
  const c = cell.value;

  gMonths
    .selectAll('text')
    .data(months.value, (d) => `${d.key}:${d.col}`)
    .join(
      (enter) =>
        enter
          .append('text')
          .attr('class', 'hm-label')
          .attr('opacity', 0)
          .text((d) => monthName(d.date))
          .on('pointerenter', (event, d) => {
            local.value = { label: monthYear(d.date), test: (x) => monthKey(x.date) === d.key };
          })
          .on('pointerleave', () => {
            local.value = null;
          })
          .call((s) => (animate ? s.transition().duration(350) : s).attr('opacity', 1)),
      (update) => update,
      (exit) => exit.remove(),
    )
    .attr('x', (d) => PAD + LABEL_W + d.col * p)
    .attr('y', PAD + MONTH_H - 7);

  const rows = [1, 3, 5].map((dow) => ({ dow, row: (dow - props.weekStart + 7) % 7 }));
  const labels = gWeekdays
    .selectAll('text')
    .data(rows, (d) => d.dow)
    .join((enter) =>
      enter
        .append('text')
        .attr('class', 'hm-label')
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .attr('y', (d) => PAD + MONTH_H + d.row * p + c / 2)
        .text((d) => WEEKDAYS[d.dow].slice(0, 3))
        .on('pointerenter', (event, d) => {
          local.value = { label: `${WEEKDAYS[d.dow]}s`, test: (x) => x.date.getDay() === d.dow };
        })
        .on('pointerleave', () => {
          local.value = null;
        }),
    )
    .attr('x', PAD + LABEL_W - 6);
  (animate ? labels.transition().duration(350) : labels).attr('y', (d) => PAD + MONTH_H + d.row * p + c / 2);
}

function applyEmphasis(animate = true) {
  const h = emphasis.value;
  const cells = gCells.selectAll('rect.hm-day');
  (animate ? cells.transition('fade').duration(180) : cells.interrupt('fade')).attr(
    'opacity',
    (d) => (d.future ? 0.4 : 1) * (!h || h.test(d) ? 1 : 0.16),
  );
}

function placeRing(ring, day, pad, smooth) {
  if (!day || day.future) {
    ring.interrupt('move').attr('opacity', 0);
    return;
  }
  const p = pitch.value;
  const c = cell.value;
  const target =
    smooth && +ring.attr('opacity') > 0
      ? ring.transition('move').duration(220).ease(d3.easeCubicOut)
      : ring.interrupt('move');
  target
    .attr('x', day.col * p - pad)
    .attr('y', day.row * p - pad)
    .attr('width', c + 2 * pad)
    .attr('height', c + 2 * pad)
    .attr('rx', radius.value + pad);
  ring.attr('opacity', 1);
}

const placeSelectRing = (smooth) => placeRing(ringSelect, byKey.value.get(props.selected), 2.5, smooth);
const placeHoverRing = () => {
  const day = hover.value && byKey.value.get(hover.value.day.key);
  placeRing(ringHover, day && day.key !== props.selected ? day : null, 1.5, false);
};

onMounted(() => {
  svg = d3.select(svgEl.value);
  gMonths = svg.append('g');
  gWeekdays = svg.append('g');
  gCells = svg.append('g');
  gRings = svg.append('g').attr('pointer-events', 'none');
  ringSelect = gRings.append('rect').attr('class', 'hm-ring hm-ring--select').attr('opacity', 0);
  ringHover = gRings.append('rect').attr('class', 'hm-ring hm-ring--hover').attr('opacity', 0);

  svg
    .on('pointermove', (event) => {
      const d = dayAt(event);
      if (d && !d.future) setHover(d, 'pointer');
      else if (hover.value?.source === 'pointer') setHover(null);
    })
    .on('pointerleave', () => {
      if (hover.value?.source === 'pointer') setHover(null);
    })
    .on('click', (event) => {
      const d = dayAt(event);
      if (d && !d.future) choose(d);
    });

  width.value = root.value.clientWidth;
  // Resize on the next frame so the layout change never feeds back into the same observation.
  observer = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      width.value = Math.round(entry.contentRect.width);
    });
  });
  observer.observe(root.value);
  render();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  cancelAnimationFrame(frame);
  svg?.selectAll('*').interrupt();
});

watch([days, pitch, radius, () => props.palette], render);
watch(emphasis, () => svg && applyEmphasis());
watch(() => props.selected, () => {
  if (!svg) return;
  placeSelectRing(true);
  placeHoverRing();
});
watch(hover, () => svg && placeHoverRing());
</script>

<template>
  <div ref="root" class="hm" :style="{ '--hm-swatch': `${Math.min(cell, 12)}px` }">
    <div class="hm__scroll">
      <svg
        ref="svgEl"
        class="hm__svg"
        role="application"
        tabindex="0"
        :aria-label="`Contribution calendar, ${fmt(total)} contributions. Arrow keys move between days, Enter selects.`"
        @keydown="onKeydown"
        @focus="onFocus"
        @blur="onBlur"
      />
    </div>

    <Transition name="hm-tip">
      <div v-if="hover" ref="tipEl" class="hm__tip" :style="tipStyle" role="tooltip">
        <strong>{{ countText(hover.day.count) }}</strong> on {{ longDate(hover.day.date) }}
      </div>
    </Transition>

    <div class="hm__footer" :style="{ width: `${svgWidth}px` }">
      <p class="hm__caption">
        <template v-if="emphasisSummary">
          <strong>{{ emphasisSummary.label }}</strong>
          · {{ fmt(emphasisSummary.days) }} {{ emphasisSummary.days === 1 ? 'day' : 'days' }}
          <template v-if="emphasisSummary.total">· {{ countText(emphasisSummary.total).toLowerCase() }}</template>
        </template>
        <slot v-else name="caption">Hover or use the arrow keys to inspect a day · click to select it</slot>
      </p>
      <div class="hm__legend" @pointerleave="local = null">
        <span>Less</span>
        <i
          v-for="(color, i) in palette"
          :key="i"
          class="hm__swatch"
          :style="{ background: color }"
          @pointerenter="showLevel(i)"
        />
        <span>More</span>
      </div>
    </div>

    <p class="hm__sr" aria-live="polite">{{ liveText }}</p>
  </div>
</template>

<style scoped>
.hm {
  position: relative;
}
.hm__scroll {
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.hm__svg {
  display: block;
  margin: 0 auto;
  overflow: visible;
  outline: none;
  border-radius: 6px;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.hm__svg:focus-visible {
  outline: 2px solid var(--hm-focus, #2f81f7);
  outline-offset: -2px;
}
.hm__svg :deep(.hm-day) {
  stroke: var(--hm-cell-outline, rgba(27, 31, 36, 0.06));
  stroke-width: 1;
  cursor: pointer;
}
.hm__svg :deep(.hm-day.is-future) {
  cursor: default;
}
.hm__svg :deep(.hm-label) {
  fill: var(--hm-label, #59636e);
  font-size: 12px;
  cursor: default;
  transition: fill 0.15s;
}
.hm__svg :deep(.hm-label:hover) {
  fill: var(--hm-label-strong, #1f2328);
}
.hm__svg :deep(.hm-ring) {
  fill: none;
}
.hm__svg :deep(.hm-ring--select) {
  stroke: var(--hm-ring, #1f2328);
  stroke-width: 2;
}
.hm__svg :deep(.hm-ring--hover) {
  stroke: var(--hm-ring-hover, rgba(31, 35, 40, 0.5));
  stroke-width: 1.25;
}

.hm__tip {
  position: absolute;
  z-index: 20;
  transform: translate(-50%, calc(-100% - 9px));
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--hm-tip-bg, #25292e);
  color: var(--hm-tip-fg, #fff);
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.28);
  transition: left 0.07s ease-out, top 0.07s ease-out;
}
.hm__tip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: calc(50% + var(--arrow-x, 0px));
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--hm-tip-bg, #25292e);
}
.hm__tip strong {
  font-weight: 600;
}
.hm-tip-enter-from,
.hm-tip-leave-to {
  opacity: 0;
}
.hm-tip-enter-active,
.hm-tip-leave-active {
  transition: opacity 0.12s;
}

.hm__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 100%;
  margin: 8px auto 0;
  padding: 0 3px;
  font-size: 12px;
  color: var(--hm-label, #59636e);
}
.hm__caption {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hm__caption strong {
  color: var(--hm-label-strong, #1f2328);
  font-weight: 600;
}
.hm__legend {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
}
.hm__legend span:first-child {
  margin-right: 3px;
}
.hm__legend span:last-child {
  margin-left: 3px;
}
.hm__swatch {
  width: var(--hm-swatch);
  height: var(--hm-swatch);
  border-radius: 3px;
  outline: 1px solid var(--hm-cell-outline, rgba(27, 31, 36, 0.06));
  outline-offset: -1px;
  cursor: pointer;
  transition: transform 0.12s;
}
.hm__swatch:hover {
  transform: scale(1.3);
}
.hm__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
