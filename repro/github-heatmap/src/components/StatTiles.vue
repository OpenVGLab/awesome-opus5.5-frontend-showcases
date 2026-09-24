<script setup>
import { computed } from 'vue';
import * as d3 from 'd3';
import Icon from './Icon.vue';

const props = defineProps({
  stats: { type: Object, required: true },
  rangeLabel: { type: String, default: '' },
  accent: { type: String, default: 'currentColor' },
});
const emit = defineEmits(['highlight', 'select']);

const fmt = d3.format(',');
const short = d3.timeFormat('%b %-d');
const medium = d3.timeFormat('%a, %b %-d');
const span = (r) => (!r?.length ? '—' : r.length === 1 ? short(r.start) : `${short(r.start)} – ${short(r.end)}`);
const days = (n) => (n === 1 ? 'day' : 'days');
const within = (r) => (d) => d.date >= r.start && d.date <= r.end;

const tiles = computed(() => {
  const s = props.stats;
  const streakTile = s.includesToday
    ? {
        id: 'current',
        icon: 'bolt',
        label: 'Current streak',
        value: fmt(s.current?.length ?? 0),
        unit: days(s.current?.length ?? 0),
        sub: s.current?.length ? `since ${short(s.current.start)}` : 'nothing yet today',
        highlight: s.current?.length ? { label: 'Current streak', test: within(s.current) } : null,
      }
    : {
        id: 'gap',
        icon: 'coffee',
        label: 'Longest break',
        value: fmt(s.gap?.length ?? 0),
        unit: days(s.gap?.length ?? 0),
        sub: span(s.gap),
        highlight: s.gap ? { label: `Longest break · ${span(s.gap)}`, test: within(s.gap) } : null,
      };

  return [
    { id: 'total', icon: 'pulse', label: 'Contributions', value: fmt(s.total), sub: props.rangeLabel },
    {
      id: 'active',
      icon: 'calendar',
      label: 'Active days',
      value: fmt(s.active),
      unit: `/ ${fmt(s.days)}`,
      sub: s.days ? `${Math.round((100 * s.active) / s.days)}% of days` : '—',
      highlight: { label: 'Days with contributions', test: (d) => d.count > 0 },
    },
    {
      id: 'longest',
      icon: 'flame',
      label: 'Longest streak',
      value: fmt(s.longest?.length ?? 0),
      unit: days(s.longest?.length ?? 0),
      sub: span(s.longest),
      highlight: s.longest ? { label: `Longest streak · ${span(s.longest)}`, test: within(s.longest) } : null,
    },
    streakTile,
    {
      id: 'best',
      icon: 'trophy',
      label: 'Best day',
      value: s.best ? fmt(s.best.count) : '—',
      unit: s.best ? (s.best.count === 1 ? 'contribution' : 'contributions') : '',
      sub: s.best ? `${medium(s.best.date)} · click to open` : 'no contributions yet',
      select: s.best?.key,
      highlight: s.best ? { label: `Best day · ${medium(s.best.date)}`, test: (d) => d.key === s.best.key } : null,
    },
    {
      id: 'average',
      icon: 'gauge',
      label: 'Daily average',
      value: s.average.toFixed(1),
      unit: '/ day',
      sub: `${s.averageActive.toFixed(1)} on active days`,
      highlight: { label: `Above average (more than ${s.average.toFixed(1)})`, test: (d) => d.count > s.average },
    },
  ];
});

function enter(tile) {
  if (tile.highlight) emit('highlight', tile.highlight);
}
function leave(tile) {
  if (tile.highlight) emit('highlight', null);
}
</script>

<template>
  <section class="tiles" aria-label="Highlights" :style="{ '--tile-accent': accent }">
    <component
      :is="tile.highlight || tile.select ? 'button' : 'div'"
      v-for="tile in tiles"
      :key="tile.id"
      class="card tile"
      :class="{ 'tile--interactive': tile.highlight || tile.select }"
      @pointerenter="enter(tile)"
      @pointerleave="leave(tile)"
      @focus="enter(tile)"
      @blur="leave(tile)"
      @click="tile.select && emit('select', tile.select)"
    >
      <span class="tile__label"><Icon :name="tile.icon" :size="14" class="tile__icon" />{{ tile.label }}</span>
      <span class="tile__value">{{ tile.value }}<small v-if="tile.unit">{{ tile.unit }}</small></span>
      <span class="tile__sub">{{ tile.sub }}</span>
    </component>
  </section>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}
.tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  padding: 10px 14px 11px;
  font: inherit;
  color: inherit;
  text-align: left;
}
.tile--interactive {
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.tile--interactive:hover,
.tile--interactive:focus-visible {
  border-color: var(--fg-subtle);
  background: var(--surface-hover);
}
.tile__label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--fg-muted);
}
.tile__icon {
  color: var(--tile-accent);
}
.tile__value {
  font-size: clamp(20px, 2.5vh, 27px);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.tile__value small {
  margin-left: 5px;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--fg-muted);
}
.tile__sub {
  max-width: 100%;
  overflow: hidden;
  font-size: 12px;
  color: var(--fg-subtle);
  white-space: nowrap;
  text-overflow: ellipsis;
}
@media (max-width: 1100px) {
  .tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
