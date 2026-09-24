<script setup>
import { computed, ref } from 'vue';
import * as d3 from 'd3';
import BarChart from './BarChart.vue';
import TrendChart from './TrendChart.vue';

const props = defineProps({
  days: { type: Array, required: true },
  weekStart: { type: Number, default: 0 },
  palette: { type: Array, required: true },
  theme: { type: String, default: 'dark' },
});
const emit = defineEmits(['highlight']);

const NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = d3.format(',');
const fmt1 = d3.format('.1f');
const monthKey = d3.timeFormat('%Y-%m');
const monthShort = d3.timeFormat('%b');
const monthLong = d3.timeFormat('%B %Y');
const shortDate = d3.timeFormat('%b %-d');

const hint = ref('');
const contributions = (n) => `${fmt(n)} ${n === 1 ? 'contribution' : 'contributions'}`;
const past = computed(() => props.days.filter((d) => !d.future));
const barColors = computed(() => (props.theme === 'dark' ? props.palette.slice(2) : props.palette.slice(1)));
const lineColor = computed(() => props.palette[props.theme === 'dark' ? 4 : 3]);

const weekdayItems = computed(() => {
  const groups = d3.group(past.value, (d) => d.date.getDay());
  return d3.range(7).map((i) => {
    const dow = (props.weekStart + i) % 7;
    const list = groups.get(dow) ?? [];
    const total = d3.sum(list, (d) => d.count);
    return { key: String(dow), label: NAMES[dow].slice(0, 3), value: list.length ? total / list.length : 0, total, dow };
  });
});

const monthItems = computed(() => {
  if (!props.days.length) return [];
  const first = props.days[0].date;
  const last = props.days[props.days.length - 1].date;
  const sums = d3.rollup(past.value, (v) => d3.sum(v, (d) => d.count), (d) => monthKey(d.date));
  return d3.timeMonth.range(d3.timeMonth.floor(first), d3.timeDay.offset(last, 1)).map((m) => {
    const key = monthKey(m);
    return { key, label: monthShort(m), value: sums.get(key) ?? 0, muted: !sums.has(key), name: monthLong(m) };
  });
});

const weekItems = computed(() => {
  const week = props.weekStart === 1 ? d3.timeMonday : d3.timeSunday;
  return d3.groups(props.days, (d) => +week.floor(d.date)).map(([start, list]) => ({
    key: String(start),
    start: new Date(start),
    end: list[list.length - 1].date,
    total: d3.sum(list, (d) => (d.future ? 0 : d.count)),
    future: list.every((d) => d.future),
  }));
});

function onWeekday(item) {
  hint.value = item ? `${NAMES[item.dow]}s · ${fmt1(item.value)} a day on average · ${fmt(item.total)} in total` : '';
  emit('highlight', item && { label: `${NAMES[item.dow]}s`, test: (d) => d.date.getDay() === item.dow });
}

function onMonth(item) {
  hint.value = item ? `${item.name} · ${contributions(item.value)}` : '';
  emit('highlight', item && { label: item.name, test: (d) => monthKey(d.date) === item.key });
}

function onWeek(item) {
  const span = item && `${shortDate(item.start)} – ${shortDate(item.end)}`;
  hint.value = item ? `Week of ${span} · ${contributions(item.total)}` : '';
  emit('highlight', item && { label: `Week of ${span}`, test: (d) => d.date >= item.start && d.date <= item.end });
}
</script>

<template>
  <section class="card panel rhythm">
    <header class="panel__head">
      <h2 class="panel__title">Rhythm</h2>
      <p class="panel__hint" :class="{ 'is-live': hint }">{{ hint || 'Hover a bar to find those days on the calendar' }}</p>
    </header>
    <div class="rhythm__body">
      <figure class="rhythm__figure">
        <figcaption>Average per weekday</figcaption>
        <BarChart :items="weekdayItems" :colors="barColors" :format="fmt1" label="Average contributions per weekday" @hover="onWeekday" />
      </figure>
      <figure class="rhythm__figure">
        <figcaption>Contributions per month</figcaption>
        <BarChart :items="monthItems" :colors="barColors" :format="fmt" label="Contributions per month" @hover="onMonth" />
      </figure>
      <figure class="rhythm__figure rhythm__trend">
        <figcaption>Weekly totals</figcaption>
        <TrendChart :weeks="weekItems" :color="lineColor" label="Contributions per week" @hover="onWeek" />
      </figure>
    </div>
  </section>
</template>

<style scoped>
.rhythm__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1.28fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 16px 22px;
}
.rhythm__figure {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.rhythm__figure figcaption {
  margin-bottom: 2px;
  font-size: 12px;
  color: var(--fg-muted);
}
.rhythm__trend {
  display: none;
  grid-column: 1 / -1;
}
.panel__hint.is-live {
  color: var(--fg);
}
/* Tall screens have room for the weekly trend under the bar charts. */
@media (min-height: 860px) and (min-width: 1021px) {
  .rhythm__body {
    grid-template-rows: minmax(0, 1.1fr) minmax(0, 1fr);
  }
  .rhythm__trend {
    display: flex;
  }
}
</style>
