<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: Number, default: 16 },
});

const dot = (cx, cy, r = 0.9) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="currentColor" stroke="none"/>`;

const ICONS = {
  sun: '<circle cx="8" cy="8" r="2.75"/><path d="M8 1.5v1.25M8 13.25v1.25M1.5 8h1.25M13.25 8h1.25M3.4 3.4l.9.9M11.7 11.7l.9.9M3.4 12.6l.9-.9M11.7 4.3l.9-.9"/>',
  moon: '<path d="M13.25 9.6A5.5 5.5 0 0 1 6.4 2.75a5.5 5.5 0 1 0 6.85 6.85z"/>',
  dice: `<rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5"/>${dot(5.4, 5.4)}${dot(8, 8)}${dot(10.6, 10.6)}`,
  upload: '<path d="M8 10.25V2.75M5 5.5l3-3 3 3M2.75 10.5v1.75c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1V10.5"/>',
  download: '<path d="M8 2.5v7.75M5 7.25l3 3 3-3M2.75 10.5v1.75c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1V10.5"/>',
  code: '<path d="M5.25 4.5 1.75 8l3.5 3.5M10.75 4.5l3.5 3.5-3.5 3.5M9.1 2.75l-2.2 10.5"/>',
  chevronLeft: '<path d="M10 3.5 5.5 8l4.5 4.5"/>',
  chevronRight: '<path d="m6 3.5 4.5 4.5L6 12.5"/>',
  chevronDown: '<path d="m4 6 4 4 4-4"/>',
  close: '<path d="m4 4 8 8M12 4l-8 8"/>',
  copy: '<rect x="5.25" y="5.25" width="8.5" height="8.5" rx="1.5"/><path d="M10.75 5.25v-1.5c0-.83-.67-1.5-1.5-1.5h-5.5c-.83 0-1.5.67-1.5 1.5v5.5c0 .83.67 1.5 1.5 1.5h1.5"/>',
  check: '<path d="m3 8.5 3 3 7-7"/>',
  commit: '<circle cx="8" cy="8" r="2.5"/><path d="M1.5 8h4M10.5 8h4"/>',
  pullRequest:
    '<circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M4 5v6M12 11V6.5c0-1.1-.9-2-2-2H7.5M9 3 7.5 4.5 9 6"/>',
  issue: `<circle cx="8" cy="8" r="6"/>${dot(8, 8, 1.3)}`,
  eye: '<path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/>',
  flame:
    '<path d="M8 14.5c2.6 0 4.5-1.8 4.5-4.4 0-2.8-2.1-4.4-3.2-7.6-1.5 1-2.5 2.6-2.6 4.3-.8-.5-1.3-1.4-1.4-2.4C4.1 5.9 3.5 7.9 3.5 10.1c0 2.6 1.9 4.4 4.5 4.4z"/>',
  bolt: '<path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8l1-5.5z"/>',
  coffee: '<path d="M2.75 6h8v3.75a3.5 3.5 0 0 1-3.5 3.5h-1a3.5 3.5 0 0 1-3.5-3.5V6zM10.75 7h.75a1.75 1.75 0 0 1 0 3.5h-.9M5.25 1.75v2M8.25 1.75v2"/>',
  trophy:
    '<path d="M5 2.5h6v3.75a3 3 0 0 1-6 0V2.5zM5 4H3.25a2 2 0 0 0 2 2.75M11 4h1.75a2 2 0 0 1-2 2.75M8 9.25v3M5.5 13.5h5"/>',
  calendar: '<rect x="2" y="3" width="12" height="11" rx="1.75"/><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3"/>',
  pulse: '<path d="M1.5 8.5h2.75L6 4l3.25 8 1.75-3.5h3.5"/>',
  gauge: '<path d="M2.5 11.5a5.5 5.5 0 1 1 11 0"/><path d="m8 11.5 2.75-3.5"/>',
  square: '<rect x="3.5" y="3.5" width="9" height="9" rx="1.5"/>',
  circle: '<circle cx="8" cy="8" r="4.75"/>',
  file: '<path d="M9.5 1.75H4.25c-.55 0-1 .45-1 1v10.5c0 .55.45 1 1 1h7.5c.55 0 1-.45 1-1V5z"/><path d="M9.5 1.75V5h3.25"/>',
  braces:
    '<path d="M5.5 2.25H5c-1 0-1.75.75-1.75 1.75v1.5c0 .83-.67 1.5-1.5 1.5v2c.83 0 1.5.67 1.5 1.5V12c0 1 .75 1.75 1.75 1.75h.5M10.5 2.25h.5c1 0 1.75.75 1.75 1.75v1.5c0 .83.67 1.5 1.5 1.5v2c-.83 0-1.5.67-1.5 1.5V12c0 1-.75 1.75-1.75 1.75h-.5"/>',
  table: '<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M2 6.25h12M2 9.75h12M6.5 6.25v7.25"/>',
  info: '<circle cx="8" cy="8" r="6.25"/><path d="M8 7.25v4M8 4.9v.1"/>',
  alert: '<path d="M8 2 1.75 13.25h12.5z"/><path d="M8 6.5v3M8 11.4v.1"/>',
};
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    v-html="ICONS[name]"
  />
</template>

<style scoped>
.icon {
  flex: none;
  display: block;
}
</style>
