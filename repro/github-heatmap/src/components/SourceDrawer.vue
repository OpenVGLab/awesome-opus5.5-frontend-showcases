<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';
import heatmapSource from './CalendarHeatmap.vue?raw';
import { highlightLines } from '../lib/highlightCode.js';

const props = defineProps({ open: { type: Boolean, default: false } });
const emit = defineEmits(['close']);

const USAGE = `<script setup>
import { ref } from 'vue';
import CalendarHeatmap from './components/CalendarHeatmap.vue';

// One entry per day; missing days count as zero.
const contributions = [
  { date: '2025-03-04', count: 7 },
  { date: '2025-03-05', count: 14 },
  // …
];
const selected = ref(null);

function onSelect(day) {
  console.log(day.key, day.count, 'level', day.level);
}
<\/script>

<template>
  <!-- Omit start/end to get GitHub's rolling "last year" view. -->
  <CalendarHeatmap
    :data="contributions"
    start="2025-01-01"
    end="2025-12-31"
    :week-start="0"
    :palette="['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']"
    shape="square"
    v-model:selected="selected"
    @select="onSelect"
  />
</template>

<style>
/* Optional theme hooks (defaults suit a light page). */
:root {
  --hm-label: #7d8590;
  --hm-label-strong: #e6edf3;
  --hm-ring: #e6edf3;
  --hm-tip-bg: #3d444d;
  --hm-cell-outline: rgba(255, 255, 255, 0.05);
}
</style>
`;

const FORMATS = `// The Import button (or drag & drop) accepts JSON, CSV or TSV.

// 1. An array of daily records — "count", "contributionCount" or "value"
[{ "date": "2025-03-05", "count": 14 }, { "date": "2025-03-06", "count": 3 }]

// 2. A date → count map
{ "2025-03-05": 14, "2025-03-06": 3 }

// 3. A GitHub GraphQL response. Run this query in the GraphQL explorer
//    (docs.github.com/graphql/overview/explorer) and save the result:
query {
  user(login: "your-login") {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}

// 4. CSV / TSV with a header row; the breakdown columns are optional
//    and power the stacked bar in the day panel.
date,count,commits,pullRequests,reviews,issues
2025-03-05,14,9,2,3,0
2025-03-06,3,3,0,0,0

// Duplicate dates are summed, rows without a valid date are skipped,
// and Export writes the current data back out in format 4.
`;

const files = [
  { id: 'component', name: 'CalendarHeatmap.vue', lang: 'vue', code: heatmapSource, icon: 'code' },
  { id: 'usage', name: 'Usage.vue', lang: 'vue', code: USAGE, icon: 'braces' },
  { id: 'formats', name: 'data-formats.txt', lang: 'js', code: FORMATS, icon: 'table' },
];

const active = ref('component');
const copied = ref(false);
const closeButton = ref(null);
const codeBox = ref(null);
const file = computed(() => files.find((f) => f.id === active.value));
const lines = computed(() => highlightLines(file.value.code, file.value.lang));

watch(
  () => props.open,
  (open) => {
    if (open) nextTick(() => closeButton.value?.focus());
  },
);
watch(active, () => {
  if (codeBox.value) codeBox.value.scrollTop = 0;
});

async function copy() {
  const text = file.value.code;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  copied.value = true;
  setTimeout(() => (copied.value = false), 1600);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="open" class="drawer-backdrop" @click.self="emit('close')">
        <aside class="drawer" role="dialog" aria-modal="true" aria-label="Source code">
          <header class="drawer__head">
            <div class="drawer__title">
              <Icon name="code" />
              <div>
                <h2>Source</h2>
                <p>The heatmap component is self-contained: Vue 3 for state, D3 for scales, time math and drawing.</p>
              </div>
            </div>
            <button ref="closeButton" class="btn icon-btn" aria-label="Close" title="Close (Esc)" @click="emit('close')">
              <Icon name="close" />
            </button>
          </header>
          <nav class="drawer__tabs" role="tablist">
            <button
              v-for="f in files"
              :key="f.id"
              role="tab"
              :aria-selected="f.id === active"
              :class="{ on: f.id === active }"
              @click="active = f.id"
            >
              <Icon :name="f.icon" :size="14" />{{ f.name }}
            </button>
            <span class="drawer__spacer" />
            <span class="drawer__meta">{{ lines.length }} lines</span>
            <button class="btn" @click="copy">
              <Icon :name="copied ? 'check' : 'copy'" :size="14" />{{ copied ? 'Copied' : 'Copy' }}
            </button>
          </nav>
          <div ref="codeBox" class="drawer__code">
            <pre><code><span v-for="(line, i) in lines" :key="`${active}-${i}`" class="line" v-html="line || ' '" /></code></pre>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  background: var(--backdrop);
  backdrop-filter: blur(2px);
}
.drawer {
  display: flex;
  flex-direction: column;
  width: min(820px, 94vw);
  height: 100%;
  border-left: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow-lg);
}
.drawer__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px 12px;
}
.drawer__title {
  display: flex;
  gap: 12px;
}
.drawer__title > .icon {
  margin-top: 3px;
  color: var(--accent-fg);
}
.drawer__title h2 {
  font-size: 16px;
  font-weight: 600;
}
.drawer__title p {
  font-size: 13px;
  color: var(--fg-muted);
}
.drawer__tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 20px 10px;
  border-bottom: 1px solid var(--border);
}
.drawer__tabs [role='tab'] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  font-size: 13px;
  cursor: pointer;
}
.drawer__tabs [role='tab']:hover {
  background: var(--surface-hover);
  color: var(--fg);
}
.drawer__tabs [role='tab'].on {
  background: var(--surface-hover);
  color: var(--fg);
  font-weight: 600;
  box-shadow: inset 0 -2px 0 var(--accent-fg);
}
.drawer__spacer {
  flex: 1;
}
.drawer__meta {
  margin-right: 6px;
  font-size: 12px;
  color: var(--fg-subtle);
}
.drawer__code {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--code-bg);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.drawer__code pre {
  margin: 0;
  padding: 14px 0 24px;
  font: 12.5px/1.65 var(--font-mono);
  tab-size: 2;
  counter-reset: line;
}
.drawer__code code {
  display: block;
  min-width: max-content;
}
.line {
  display: block;
  padding-right: 24px;
  white-space: pre;
}
.line::before {
  counter-increment: line;
  content: counter(line);
  display: inline-block;
  width: 3.2em;
  margin-right: 1.4em;
  padding-right: 0.6em;
  color: var(--fg-subtle);
  text-align: right;
  opacity: 0.7;
  user-select: none;
}
.line:hover {
  background: var(--surface-hover);
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.25s ease;
}
.drawer-enter-active .drawer,
.drawer-leave-active .drawer {
  transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .drawer,
.drawer-leave-to .drawer {
  transform: translateX(40px);
}
</style>
