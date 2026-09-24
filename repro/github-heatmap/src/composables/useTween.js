import { onBeforeUnmount, ref, watch } from 'vue';
import * as d3 from 'd3';

/** A number that eases towards `source` whenever it changes (driven by d3.timer). */
export function useTween(source, duration = 700) {
  const value = ref(source.value);
  let timer = null;

  watch(source, (to) => {
    timer?.stop();
    const interpolate = d3.interpolateNumber(value.value, to);
    timer = d3.timer((elapsed) => {
      const t = Math.min(1, elapsed / duration);
      value.value = interpolate(d3.easeCubicOut(t));
      if (t === 1) {
        timer.stop();
        timer = null;
      }
    });
  });

  onBeforeUnmount(() => timer?.stop());
  return value;
}
