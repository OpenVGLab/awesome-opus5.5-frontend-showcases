import * as d3 from 'd3';

/** Totals, streaks and records for the (non-future) days of a range. */
export function computeStats(days, today) {
  const past = days.filter((d) => !d.future);
  const total = d3.sum(past, (d) => d.count);
  const active = past.reduce((n, d) => n + (d.count > 0 ? 1 : 0), 0);

  let longest = null;
  let gap = null;
  let run = null;
  let idle = null;
  for (const d of past) {
    if (d.count > 0) {
      run = run ? { ...run, end: d.date, length: run.length + 1 } : { start: d.date, end: d.date, length: 1 };
      if (!longest || run.length > longest.length) longest = run;
      idle = null;
    } else {
      idle = idle ? { ...idle, end: d.date, length: idle.length + 1 } : { start: d.date, end: d.date, length: 1 };
      if (!gap || idle.length > gap.length) gap = idle;
      run = null;
    }
  }

  const last = past[past.length - 1];
  const includesToday = Boolean(last) && +last.date === +today;
  let current = null;
  if (includesToday) {
    // A streak is still "current" if it ended yesterday and today is not over yet.
    let end = past.length - 1;
    if (past[end].count === 0) end--;
    let begin = end;
    while (begin >= 0 && past[begin].count > 0) begin--;
    current = end > begin ? { start: past[begin + 1].date, end: past[end].date, length: end - begin } : { length: 0 };
  }

  const best = past.length ? d3.greatest(past, (d) => d.count) : null;
  return {
    total,
    days: past.length,
    active,
    longest,
    gap,
    current,
    includesToday,
    best: best && best.count > 0 ? best : null,
    average: past.length ? total / past.length : 0,
    averageActive: active ? total / active : 0,
  };
}
