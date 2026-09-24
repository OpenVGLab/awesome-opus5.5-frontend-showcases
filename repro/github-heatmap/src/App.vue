<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import * as d3 from 'd3';
import CalendarHeatmap, { contributionLevels } from './components/CalendarHeatmap.vue';
import DayDetail from './components/DayDetail.vue';
import Icon from './components/Icon.vue';
import RhythmPanel from './components/RhythmPanel.vue';
import SourceDrawer from './components/SourceDrawer.vue';
import StatTiles from './components/StatTiles.vue';
import { useTween } from './composables/useTween.js';
import { formatKey, parseKey, viewRange, weekInterval } from './lib/dates.js';
import { parseContributions } from './lib/importData.js';
import { PALETTES } from './lib/palettes.js';
import { SAMPLE_START, generateSample } from './lib/sampleData.js';
import { computeStats } from './lib/stats.js';

const EXAMPLES = [
  {
    url: './examples/github-graphql-2025.json',
    name: 'github-graphql-2025.json',
    label: 'GitHub GraphQL export',
    hint: 'contributionCalendar JSON · 2025',
    icon: 'braces',
  },
  {
    url: './examples/contributions-2023-2025.csv',
    name: 'contributions-2023-2025.csv',
    label: 'CSV with breakdown',
    hint: 'date, count, commits … · 2023–2025',
    icon: 'table',
  },
];
const LOGO = [2, 4, 1, 0, 3, 4, 1, 2, 3];

const today = d3.timeDay.floor(new Date());
const fmt = d3.format(',');

function load(key, fallback, allowed) {
  try {
    const value = localStorage.getItem(key);
    return value && allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage can be unavailable (private mode, sandboxed frames)
  }
}

// ---------------------------------------------------------------------------
// State

const theme = ref(load('heatmap.theme', 'dark', ['dark', 'light']));
const paletteId = ref(load('heatmap.palette', 'green', Object.keys(PALETTES)));
const weekStart = ref(0);
const shape = ref('square');
const seed = ref(7);
const imported = ref(null); // { name, records }
const view = ref('last'); // 'last' | year
const selected = ref(null);
const highlight = ref(null);
let highlightOwner = null;
const sourceOpen = ref(false);
const importOpen = ref(false);
const dragging = ref(false);
const toast = ref(null);
const fileInput = ref(null);
const menuEl = ref(null);

watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    save('heatmap.theme', value);
  },
  { immediate: true },
);
watch(paletteId, (value) => save('heatmap.palette', value));

const palette = computed(() => PALETTES[paletteId.value][theme.value]);
const records = computed(
  () => imported.value?.records ?? generateSample({ seed: seed.value, start: SAMPLE_START, end: today }),
);
const recordByDate = computed(() => new Map(records.value.map((r) => [r.date, r])));
const range = computed(() => viewRange(view.value, today, weekStart.value));

const days = computed(() => {
  const { start, end } = range.value;
  return d3.timeDay.range(start, d3.timeDay.offset(end, 1)).map((date) => {
    const key = formatKey(date);
    const record = recordByDate.value.get(key) ?? null;
    return { date, key, record, count: record?.count ?? 0, future: date > today };
  });
});
const pastDays = computed(() => days.value.filter((d) => !d.future));
const dayByKey = computed(() => new Map(days.value.map((d) => [d.key, d])));
const stats = computed(() => computeStats(days.value, today));
const levels = computed(() => contributionLevels(pastDays.value.map((d) => d.count)));
const rangeLabel = computed(() => (view.value === 'last' ? 'in the last year' : `in ${view.value}`));
const shownTotal = useTween(computed(() => stats.value.total));

const years = computed(() => {
  const totals = d3.rollup(records.value, (v) => d3.sum(v, (r) => r.count), (r) => +r.date.slice(0, 4));
  const rolling = viewRange('last', today, weekStart.value);
  const from = formatKey(rolling.start);
  const to = formatKey(today);
  const list = [
    { id: 'last', label: 'Last year', total: d3.sum(records.value, (r) => (r.date >= from && r.date <= to ? r.count : 0)) },
  ];
  const [lo, hi] = d3.extent(totals.keys());
  for (let y = Math.min(hi, today.getFullYear()); y >= lo; y--) list.push({ id: y, label: String(y), total: totals.get(y) ?? 0 });
  return list;
});

// ---------------------------------------------------------------------------
// Selected day

const selectedDay = computed(() => dayByKey.value.get(selected.value) ?? null);
const selectedLevel = computed(() => (selectedDay.value ? levels.value(selectedDay.value.count) : 0));
const selectedRank = computed(() => {
  const day = selectedDay.value;
  if (!day?.count) return null;
  const atLeast = pastDays.value.filter((d) => d.count >= day.count).length;
  return Math.max(1, Math.round((100 * atLeast) / pastDays.value.length));
});
const selectedWeek = computed(() => {
  const day = selectedDay.value;
  if (!day) return [];
  const start = weekInterval(weekStart.value).floor(day.date);
  return d3.timeDay.range(start, d3.timeDay.offset(start, 7)).map((date) => {
    const key = formatKey(date);
    const count = recordByDate.value.get(key)?.count ?? 0;
    return { date, key, count, level: levels.value(count), future: date > today, inRange: dayByKey.value.has(key) };
  });
});
const neighbors = computed(() => {
  const list = pastDays.value;
  const i = list.findIndex((d) => d.key === selected.value);
  return {
    prev: i > 0 ? list.slice(0, i).findLast((d) => d.count > 0) ?? null : null,
    next: i >= 0 ? list.slice(i + 1).find((d) => d.count > 0) ?? null : null,
    canPrev: i > 0,
    canNext: i >= 0 && i < list.length - 1,
  };
});

// Each view opens on its busiest day; a selection that is still visible is kept.
watch(
  days,
  (list) => {
    const current = dayByKey.value.get(selected.value);
    if (current && !current.future) return;
    const past = list.filter((d) => !d.future);
    const best = d3.greatest(past, (d) => d.count);
    selected.value = (best?.count ? best : past[past.length - 1])?.key ?? null;
  },
  { immediate: true },
);

// Several panels can emphasise days on the calendar; a panel may only clear its own emphasis
// (e.g. a stat tile losing focus must not wipe the highlight from a hovered chart bar).
function setHighlight(value, owner) {
  if (value) {
    highlight.value = value;
    highlightOwner = owner;
  } else if (highlightOwner === owner) {
    clearHighlight();
  }
}

function clearHighlight() {
  highlight.value = null;
  highlightOwner = null;
}

function stepDay(delta) {
  const list = pastDays.value;
  const i = list.findIndex((d) => d.key === selected.value);
  const next = list[Math.min(list.length - 1, Math.max(0, (i < 0 ? list.length - 1 : i) + delta))];
  if (next) selected.value = next.key;
}

// ---------------------------------------------------------------------------
// Data: sample, import, export

let toastTimer = 0;
function notify(text, kind = 'info') {
  toast.value = { text, kind };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 3800);
}

function shuffle() {
  imported.value = null;
  clearHighlight();
  let next = seed.value;
  while (next === seed.value) next = 1 + Math.floor(Math.random() * 9998);
  seed.value = next;
}

function resetSample() {
  imported.value = null;
  clearHighlight();
  view.value = 'last';
  notify('Showing the sample data again');
}

function importText(text, name) {
  try {
    const { records: rows, skipped } = parseContributions(text, name);
    imported.value = { name, records: rows };
    clearHighlight();
    selected.value = null;
    const last = parseKey(rows[rows.length - 1].date);
    view.value = d3.timeDay.count(last, today) <= 60 ? 'last' : Math.min(last.getFullYear(), today.getFullYear());
    notify(`Imported ${fmt(rows.length)} days from ${name}${skipped ? ` · ${fmt(skipped)} rows skipped` : ''}`, 'success');
  } catch (error) {
    notify(error.message || 'That file could not be read.', 'error');
  }
}

async function loadExample(example) {
  importOpen.value = false;
  try {
    const response = await fetch(example.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    importText(await response.text(), example.name);
  } catch (error) {
    notify(`Could not load the example (${error.message})`, 'error');
  }
}

function chooseFile() {
  importOpen.value = false;
  fileInput.value?.click();
}

async function onFileChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) importText(await file.text(), file.name);
}

function exportCsv() {
  const extras = ['commits', 'pullRequests', 'reviews', 'issues'].filter((k) => records.value.some((r) => r[k] != null));
  const csv = d3.csvFormat(records.value, ['date', 'count', ...extras]);
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const base = imported.value ? imported.value.name.replace(/\.\w+$/, '') : `sample-seed-${seed.value}`;
  const link = Object.assign(document.createElement('a'), { href: url, download: `contributions-${base}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  notify(`Exported ${fmt(records.value.length)} days as CSV`, 'success');
}

// Drag & drop anywhere on the page.
let dragDepth = 0;
const hasFiles = (event) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
function onDragEnter(event) {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  dragging.value = true;
}
function onDragOver(event) {
  if (hasFiles(event)) event.preventDefault();
}
function onDragLeave(event) {
  if (!hasFiles(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging.value = false;
}
async function onDrop(event) {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dragging.value = false;
  const file = event.dataTransfer.files[0];
  if (file) importText(await file.text(), file.name);
}
function onKeydown(event) {
  if (event.key === 'Escape') {
    importOpen.value = false;
    sourceOpen.value = false;
  }
}
function onPointerDown(event) {
  if (importOpen.value && !menuEl.value?.contains(event.target)) importOpen.value = false;
}

onMounted(() => {
  window.addEventListener('dragenter', onDragEnter);
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);
  window.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onPointerDown);
});
onBeforeUnmount(() => {
  window.removeEventListener('dragenter', onDragEnter);
  window.removeEventListener('dragover', onDragOver);
  window.removeEventListener('dragleave', onDragLeave);
  window.removeEventListener('drop', onDrop);
  window.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointerdown', onPointerDown);
  clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app">
    <header class="topbar">
      <div class="topbar__inner">
        <div class="brand">
          <svg class="brand__mark" viewBox="0 0 22 22" aria-hidden="true">
            <rect
              v-for="(level, i) in LOGO"
              :key="i"
              :x="(i % 3) * 7.75"
              :y="Math.floor(i / 3) * 7.75"
              width="6.5"
              height="6.5"
              rx="1.6"
              :fill="palette[level]"
            />
          </svg>
          <div class="brand__text">
            <h1>Contribution Calendar</h1>
            <p>GitHub-style heatmap · Vue 3 + D3.js</p>
          </div>
        </div>

        <div class="toolbar">
          <div class="source-chip" :class="{ 'is-imported': imported }" :title="imported ? imported.name : 'Generated sample data'">
            <Icon :name="imported ? 'file' : 'dice'" :size="14" />
            <span v-if="imported" class="source-chip__text">{{ imported.name }}</span>
            <span v-else class="source-chip__text">Sample data · seed {{ seed }}</span>
            <button v-if="imported" class="source-chip__x" aria-label="Back to sample data" title="Back to sample data" @click="resetSample">
              <Icon name="close" :size="12" />
            </button>
          </div>
          <button class="btn" title="Generate a new random sample" @click="shuffle"><Icon name="dice" />Shuffle</button>
          <div ref="menuEl" class="menu">
            <button class="btn" :aria-expanded="importOpen" aria-haspopup="menu" @click="importOpen = !importOpen">
              <Icon name="upload" />Import<Icon name="chevronDown" :size="12" class="menu__caret" />
            </button>
            <Transition name="pop">
              <div v-if="importOpen" class="menu__panel" role="menu">
                <button class="menu__item" role="menuitem" @click="chooseFile">
                  <Icon name="upload" />
                  <span><strong>Choose a file…</strong><small>JSON, CSV or TSV — or drop it anywhere</small></span>
                </button>
                <p class="menu__label">Try an example</p>
                <button v-for="example in EXAMPLES" :key="example.url" class="menu__item" role="menuitem" @click="loadExample(example)">
                  <Icon :name="example.icon" />
                  <span><strong>{{ example.label }}</strong><small>{{ example.hint }}</small></span>
                </button>
              </div>
            </Transition>
          </div>
          <button class="btn icon-btn" title="Export data as CSV" aria-label="Export data as CSV" @click="exportCsv">
            <Icon name="download" />
          </button>

          <span class="toolbar__sep" />

          <div class="palettes" role="radiogroup" aria-label="Colour palette">
            <button
              v-for="(p, id) in PALETTES"
              :key="id"
              class="palette"
              :class="{ on: id === paletteId }"
              role="radio"
              :aria-checked="id === paletteId"
              :aria-label="p.name"
              :title="p.name"
              @click="paletteId = id"
            >
              <i v-for="level in 4" :key="level" :style="{ background: p[theme][level] }" />
            </button>
          </div>
          <button
            class="btn icon-btn"
            :title="theme === 'dark' ? 'Light theme' : 'Dark theme'"
            :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="theme = theme === 'dark' ? 'light' : 'dark'"
          >
            <Icon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
          <button class="btn btn--primary" @click="sourceOpen = true"><Icon name="code" />Source</button>
        </div>
      </div>
    </header>

    <main class="main">
      <section class="overview">
        <div class="card calendar-card">
          <header class="calendar-card__head">
            <h2 class="calendar-card__title">
              <strong>{{ fmt(Math.round(shownTotal)) }}</strong> contributions {{ rangeLabel }}
            </h2>
            <div class="calendar-card__options">
              <span class="option-label">Week starts</span>
              <div class="seg" role="radiogroup" aria-label="First day of the week">
                <button role="radio" :aria-checked="weekStart === 0" :class="{ on: weekStart === 0 }" @click="weekStart = 0">Sun</button>
                <button role="radio" :aria-checked="weekStart === 1" :class="{ on: weekStart === 1 }" @click="weekStart = 1">Mon</button>
              </div>
              <div class="seg" role="radiogroup" aria-label="Cell shape">
                <button role="radio" :aria-checked="shape === 'square'" :class="{ on: shape === 'square' }" title="Squares" aria-label="Squares" @click="shape = 'square'">
                  <Icon name="square" :size="14" />
                </button>
                <button role="radio" :aria-checked="shape === 'circle'" :class="{ on: shape === 'circle' }" title="Dots" aria-label="Dots" @click="shape = 'circle'">
                  <Icon name="circle" :size="14" />
                </button>
              </div>
            </div>
          </header>

          <CalendarHeatmap
            v-model:selected="selected"
            :data="records"
            :start="range.start"
            :end="range.end"
            :week-start="weekStart"
            :palette="palette"
            :shape="shape"
            :today="today"
            :highlight="highlight"
          />
        </div>

        <nav class="years" aria-label="Year">
          <div class="years__list">
            <button
              v-for="year in years"
              :key="year.id"
              class="year"
              :class="{ on: view === year.id }"
              :aria-pressed="view === year.id"
              @click="view = year.id"
            >
              <span>{{ year.label }}</span>
              <small>{{ fmt(year.total) }}</small>
            </button>
          </div>
        </nav>
      </section>

      <StatTiles
        :stats="stats"
        :range-label="rangeLabel"
        :accent="palette[theme === 'dark' ? 4 : 3]"
        @highlight="(value) => setHighlight(value, 'tiles')"
        @select="selected = $event"
      />

      <section class="insights">
        <RhythmPanel
          :days="days"
          :week-start="weekStart"
          :palette="palette"
          :theme="theme"
          @highlight="(value) => setHighlight(value, 'rhythm')"
        />
        <DayDetail
          :day="selectedDay"
          :level="selectedLevel"
          :palette="palette"
          :rank="selectedRank"
          :seed="imported ? null : seed"
          :neighbors="neighbors"
          :week="selectedWeek"
          @step="stepDay"
          @jump="selected = $event"
        />
      </section>
    </main>

    <SourceDrawer :open="sourceOpen" @close="sourceOpen = false" />

    <input ref="fileInput" type="file" accept=".json,.csv,.tsv,.txt,application/json,text/csv" hidden @change="onFileChange" />

    <Transition name="fade">
      <div v-if="dragging" class="dropzone">
        <div class="dropzone__box">
          <Icon name="upload" :size="28" />
          <p><strong>Drop a JSON or CSV file</strong><br />to draw it on the calendar</p>
        </div>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" :key="toast.text" class="toast" :class="`toast--${toast.kind}`" role="status">
        <Icon :name="toast.kind === 'error' ? 'alert' : toast.kind === 'success' ? 'check' : 'info'" :size="14" />{{ toast.text }}
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Top bar ----------------------------------------------------------------- */
.topbar {
  position: relative;
  z-index: 30;
  flex: none;
  border-bottom: 1px solid var(--border);
  background: var(--bg-top);
  transition: background-color 0.3s, border-color 0.3s;
}
.topbar__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: var(--page-max);
  height: 58px;
  margin: 0 auto;
  padding: 0 var(--page-pad);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.brand__mark {
  flex: none;
  width: 26px;
  height: 26px;
}
.brand__mark rect {
  transition: fill 0.4s;
}
.brand__text {
  min-width: 0;
}
.brand h1 {
  font-size: 15px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.005em;
  white-space: nowrap;
}
.brand p {
  font-size: 12px;
  color: var(--fg-muted);
  white-space: nowrap;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toolbar__sep {
  width: 1px;
  height: 22px;
  margin: 0 4px;
  background: var(--border);
}
.source-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 230px;
  height: 30px;
  padding: 0 10px;
  border: 1px dashed var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--fg-muted);
}
.source-chip.is-imported {
  border-style: solid;
  border-color: color-mix(in srgb, var(--accent-fg) 55%, transparent);
  color: var(--fg);
}
.source-chip__text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.source-chip__x {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  margin-right: -4px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
}
.source-chip__x:hover {
  background: var(--surface-hover);
  color: var(--fg);
}

.menu {
  position: relative;
}
.menu__caret {
  margin-left: -2px;
  opacity: 0.7;
}
.menu__panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 290px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--overlay);
  box-shadow: var(--shadow-lg);
}
.menu__label {
  margin: 6px 10px 2px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.menu__item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.menu__item:hover,
.menu__item:focus-visible {
  background: var(--surface-hover);
}
.menu__item .icon {
  margin-top: 2px;
  color: var(--fg-muted);
}
.menu__item strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}
.menu__item small {
  display: block;
  font-size: 12px;
  color: var(--fg-muted);
}

.palettes {
  display: flex;
  gap: 4px;
}
.palette {
  display: grid;
  grid-template-columns: repeat(2, 7px);
  gap: 2px;
  place-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.palette i {
  width: 7px;
  height: 7px;
  border-radius: 2px;
}
.palette:hover {
  background: var(--surface-hover);
}
.palette.on {
  border-color: var(--fg-muted);
  background: var(--surface-hover);
}

/* Layout ------------------------------------------------------------------ */
.main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: var(--page-max);
  min-height: 0;
  margin: 0 auto;
  padding: 16px var(--page-pad) 16px;
}
.overview {
  display: flex;
  gap: 12px;
}
.calendar-card {
  flex: 1;
  min-width: 0;
  padding: 14px 16px 12px;
}
.calendar-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 6px;
}
.calendar-card__title {
  font-size: 17px;
  font-weight: 400;
  white-space: nowrap;
}
.calendar-card__title strong {
  font-weight: 650;
}
.calendar-card__options {
  display: flex;
  align-items: center;
  gap: 8px;
}
.option-label {
  font-size: 12px;
  color: var(--fg-muted);
}

.years {
  position: relative;
  flex: none;
  width: 124px;
}
.years__list {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  overflow-y: auto;
  scrollbar-width: none;
}
.year {
  display: flex;
  flex: none;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  white-space: nowrap;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.year small {
  font-size: 11px;
  opacity: 0.8;
}
.year:hover {
  background: var(--surface-hover);
  color: var(--fg);
}
.year.on {
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.insights {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.42fr) minmax(0, 1fr);
  gap: 12px;
  min-height: 250px;
}

/* Overlays ---------------------------------------------------------------- */
.dropzone {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--backdrop);
  backdrop-filter: blur(3px);
}
.dropzone__box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 56px;
  border: 2px dashed var(--accent-fg);
  border-radius: 16px;
  background: var(--surface);
  color: var(--fg-muted);
  text-align: center;
}
.dropzone__box .icon {
  color: var(--accent-fg);
}
.dropzone__box strong {
  color: var(--fg);
  font-size: 16px;
}
.toast {
  position: fixed;
  bottom: 22px;
  left: 50%;
  z-index: 95;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(560px, calc(100vw - 32px));
  padding: 9px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--overlay);
  box-shadow: var(--shadow-lg);
  font-size: 13px;
  transform: translateX(-50%);
}
.toast--success .icon {
  color: var(--cat-issue);
}
.toast--error {
  border-color: color-mix(in srgb, var(--danger) 60%, transparent);
}
.toast--error .icon {
  color: var(--danger);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.14s, transform 0.14s;
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Smaller screens ---------------------------------------------------------- */
@media (max-width: 1180px) {
  .brand p,
  .option-label {
    display: none;
  }
}
@media (max-width: 1020px) {
  .topbar__inner {
    flex-wrap: wrap;
    height: auto;
    padding-top: 10px;
    padding-bottom: 10px;
  }
  .toolbar {
    flex-wrap: wrap;
  }
  .overview {
    flex-direction: column-reverse;
  }
  .years {
    width: auto;
  }
  .years__list {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }
  .insights {
    grid-template-columns: minmax(0, 1fr);
  }
  .insights > * {
    min-height: 300px;
  }
}
@media (max-width: 640px) {
  .source-chip,
  .toolbar__sep {
    display: none;
  }
  .calendar-card {
    padding: 12px;
  }
  .calendar-card__head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
