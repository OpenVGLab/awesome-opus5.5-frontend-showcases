<script setup>
import { computed } from 'vue';
import * as d3 from 'd3';
import Icon from './Icon.vue';
import { describeDay } from '../lib/sampleData.js';

const props = defineProps({
  /** { date, key, count, record } */
  day: { type: Object, default: null },
  level: { type: Number, default: 0 },
  palette: { type: Array, required: true },
  /** "Top N %" rank of the day within the range. */
  rank: { type: Number, default: null },
  /** Seed of the sample data, or null for imported data (no activity feed). */
  seed: { type: Number, default: null },
  neighbors: { type: Object, default: () => ({}) },
  /** The seven days of the selected day's week: [{ date, key, count, level, future, inRange }]. */
  week: { type: Array, default: () => [] },
});
const emit = defineEmits(['step', 'jump']);

const longDate = d3.timeFormat('%A, %B %-d, %Y');
const shortDate = d3.timeFormat('%b %-d');
const weekdayShort = d3.timeFormat('%a');
const fmt = d3.format(',');

const weekMax = computed(() => d3.max(props.week, (d) => (d.future ? 0 : d.count)) || 1);
const weekTotal = computed(() => d3.sum(props.week, (d) => (d.future ? 0 : d.count)));
const barHeight = (d) => (d.future || !d.count ? 6 : 10 + (90 * d.count) / weekMax.value);

const KINDS = [
  { id: 'commits', label: 'commits', one: 'commit', color: 'var(--cat-commit)' },
  { id: 'pullRequests', label: 'pull requests', one: 'pull request', color: 'var(--cat-pr)' },
  { id: 'reviews', label: 'reviews', one: 'review', color: 'var(--cat-review)' },
  { id: 'issues', label: 'issues', one: 'issue', color: 'var(--cat-issue)' },
];
const ICON = { commit: 'commit', pr: 'pullRequest', review: 'eye', issue: 'issue' };
const STATE_LABEL = { merged: 'Merged', open: 'Open', closed: 'Closed', approved: 'Approved', commented: 'Commented', changes: 'Changes requested' };

const breakdown = computed(() => {
  const record = props.day?.record;
  if (!record || KINDS.every((k) => record[k.id] == null)) return null;
  return KINDS.map((k) => ({ ...k, value: Number(record[k.id]) || 0 }));
});
const items = computed(() => (props.seed != null && props.day?.record ? describeDay(props.day.record, props.seed) : []));
</script>

<template>
  <section class="card panel detail">
    <template v-if="day">
      <header class="detail__head">
        <div class="detail__heading">
          <p class="detail__eyebrow">Selected day</p>
          <h2 class="detail__date">{{ longDate(day.date) }}</h2>
        </div>
        <div class="detail__nav">
          <button class="btn icon-btn" :disabled="!neighbors.canPrev" aria-label="Previous day" title="Previous day" @click="emit('step', -1)">
            <Icon name="chevronLeft" />
          </button>
          <button class="btn icon-btn" :disabled="!neighbors.canNext" aria-label="Next day" title="Next day" @click="emit('step', 1)">
            <Icon name="chevronRight" />
          </button>
        </div>
      </header>

      <div :key="day.key" class="detail__body">
        <div class="detail__summary">
          <span class="detail__count">{{ fmt(day.count) }}</span>
          <span class="detail__unit">{{ day.count === 1 ? 'contribution' : 'contributions' }}</span>
          <span class="detail__chip">
            <i :style="{ background: palette[level] }" />Level {{ level }}<template v-if="rank"> · top {{ rank }}% of days</template>
          </span>
        </div>

        <template v-if="day.count">
          <div v-if="breakdown" class="detail__breakdown">
            <div class="detail__bar">
              <span v-for="part in breakdown" :key="part.id" :style="{ flexGrow: part.value, background: part.color }" />
            </div>
            <ul class="detail__legend">
              <li v-for="part in breakdown" :key="part.id" :class="{ 'is-zero': !part.value }">
                <i :style="{ background: part.color }" />{{ part.value }} {{ part.value === 1 ? part.one : part.label }}
              </li>
            </ul>
          </div>

          <ul v-if="items.length" class="detail__list">
            <li v-for="(item, i) in items" :key="i" class="act">
              <span class="act__icon" :class="[`act__icon--${item.type}`, item.state && `is-${item.state}`]">
                <Icon :name="ICON[item.type]" :size="14" />
              </span>
              <div class="act__body">
                <p class="act__title">
                  <template v-if="item.type === 'commit'">
                    Pushed <strong>{{ item.count }} {{ item.count === 1 ? 'commit' : 'commits' }}</strong> to
                  </template>
                  <template v-else-if="item.type === 'pr'">Opened pull request <strong>#{{ item.number }}</strong> in</template>
                  <template v-else-if="item.type === 'review'">Reviewed <strong>#{{ item.number }}</strong> in</template>
                  <template v-else>Opened issue <strong>#{{ item.number }}</strong> in</template>
                  <span class="act__repo"><i :style="{ background: item.repo.color }" />{{ item.repo.name }}</span>
                </p>
                <p v-if="item.title" class="act__sub">{{ item.title }}</p>
              </div>
              <span v-if="item.state" class="badge" :class="`badge--${item.state}`">{{ STATE_LABEL[item.state] }}</span>
            </li>
          </ul>
          <p v-else class="detail__note">
            <Icon name="info" :size="14" />Activity details (commits, pull requests, repositories) aren't part of imported data.
          </p>
        </template>

        <div v-else class="detail__empty">
          <p>No contributions on this day.</p>
          <div class="detail__jump">
            <button v-if="neighbors.prev" class="btn" @click="emit('jump', neighbors.prev.key)">
              <Icon name="chevronLeft" />{{ shortDate(neighbors.prev.date) }} · {{ fmt(neighbors.prev.count) }}
            </button>
            <button v-if="neighbors.next" class="btn" @click="emit('jump', neighbors.next.key)">
              {{ shortDate(neighbors.next.date) }} · {{ fmt(neighbors.next.count) }}<Icon name="chevronRight" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="week.length" class="week">
        <p class="week__title">
          Week of {{ shortDate(week[0].date) }}<span> · {{ fmt(weekTotal) }} {{ weekTotal === 1 ? 'contribution' : 'contributions' }}</span>
        </p>
        <div class="week__days">
          <button
            v-for="d in week"
            :key="d.key"
            class="week__day"
            :class="{ 'is-selected': d.key === day.key }"
            :disabled="!d.inRange || d.future"
            :title="`${longDate(d.date)}: ${d.future ? 'upcoming' : fmt(d.count)}`"
            @click="emit('jump', d.key)"
          >
            <span class="week__count">{{ d.future ? '·' : fmt(d.count) }}</span>
            <span class="week__track">
              <span class="week__fill" :style="{ height: `${barHeight(d)}%`, background: palette[d.future ? 0 : d.level] }" />
            </span>
            <span class="week__label">{{ weekdayShort(d.date) }}</span>
          </button>
        </div>
      </div>
    </template>
    <p v-else class="detail__note">Pick a day on the calendar to see what happened.</p>
  </section>
</template>

<style scoped>
.detail__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.detail__heading {
  min-width: 0;
}
.detail__eyebrow {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--fg-subtle);
}
.detail__date {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.detail__nav {
  display: flex;
  flex: none;
  gap: 6px;
}
.detail__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  animation: rise 0.28s ease-out;
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
.detail__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 6px 0 10px;
}
.detail__count {
  font-size: 30px;
  font-weight: 650;
  line-height: 1.05;
  letter-spacing: -0.02em;
}
.detail__unit {
  color: var(--fg-muted);
}
.detail__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  font-size: 12px;
  color: var(--fg-muted);
  white-space: nowrap;
}
.detail__chip i {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  outline: 1px solid var(--cell-outline);
  outline-offset: -1px;
}
.detail__bar {
  display: flex;
  gap: 2px;
  height: 8px;
  overflow: hidden;
  border-radius: 4px;
}
.detail__bar span {
  flex-basis: 0;
  min-width: 0;
}
.detail__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--fg-muted);
}
.detail__legend li.is-zero {
  opacity: 0.55;
}
.detail__legend i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}
.detail__list {
  flex: 1;
  min-height: 0;
  /* Long feeds scroll inside the panel instead of stretching the page. */
  contain: size;
  mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent);
  margin: 10px 0 0;
  padding: 0 4px 0 0;
  overflow-y: auto;
  list-style: none;
  border-top: 1px solid var(--border-muted);
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.act {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
  border-bottom: 1px solid var(--border-muted);
}
.act__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface-hover);
  color: var(--fg-muted);
}
.act__icon--pr.is-merged,
.act__icon--issue.is-closed {
  color: var(--cat-pr);
}
.act__icon--pr.is-open,
.act__icon--issue.is-open,
.act__icon--review.is-approved {
  color: var(--cat-issue);
}
.act__icon--review.is-changes {
  color: var(--danger);
}
.act__body {
  flex: 1;
  min-width: 0;
}
.act__title,
.act__sub {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.act__title {
  font-size: 13px;
  line-height: 1.35;
}
.act__title strong {
  font-weight: 600;
}
.act__repo {
  margin-left: 4px;
  font-weight: 600;
  color: var(--accent-fg);
}
.act__repo i {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 5px;
  border-radius: 50%;
  vertical-align: 0;
}
.act__sub {
  font-size: 12px;
  color: var(--fg-muted);
}
.badge {
  flex: none;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
}
.badge--merged,
.badge--closed {
  color: var(--cat-pr);
}
.badge--open,
.badge--approved {
  color: var(--cat-issue);
}
.badge--commented {
  color: var(--fg-muted);
}
.badge--changes {
  color: var(--danger);
}
.detail__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  font-size: 13px;
  color: var(--fg-muted);
}
.detail__note .icon {
  margin-top: 2px;
}
.detail__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-muted);
  color: var(--fg-muted);
}
.detail__jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Week at a glance — only on screens tall enough to spare the room. */
.week {
  display: none;
  flex: none;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border-muted);
}
.week__title {
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
}
.week__title span {
  font-weight: 400;
  color: var(--fg-muted);
}
.week__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.week__day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 0 2px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s;
}
.week__day:hover:not(:disabled) {
  background: var(--surface-hover);
}
.week__day:disabled {
  cursor: default;
  opacity: 0.45;
}
.week__day.is-selected {
  border-color: var(--border);
  background: var(--surface-hover);
}
.week__count {
  font-size: 12px;
  font-weight: 600;
}
.week__track {
  display: flex;
  align-items: flex-end;
  width: 60%;
  max-width: 34px;
  height: 58px;
}
.week__fill {
  width: 100%;
  border-radius: 4px;
  outline: 1px solid var(--cell-outline);
  outline-offset: -1px;
  transition: height 0.35s ease, background-color 0.35s;
}
.week__label {
  font-size: 11px;
  color: var(--fg-muted);
}
.week__day.is-selected .week__label {
  color: var(--fg);
  font-weight: 600;
}
@media (min-height: 860px) and (min-width: 1021px) {
  .week {
    display: block;
  }
}
</style>
