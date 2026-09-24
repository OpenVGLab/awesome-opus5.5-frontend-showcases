import * as d3 from 'd3';

export const formatKey = d3.timeFormat('%Y-%m-%d');
export const parseKey = d3.timeParse('%Y-%m-%d');

export const weekInterval = (weekStart) => (weekStart === 1 ? d3.timeMonday : d3.timeSunday);

/**
 * Date window for a calendar view: 'last' is GitHub's rolling year (53 week
 * columns ending today), a number is that calendar year.
 */
export function viewRange(view, today, weekStart = 0) {
  if (view === 'last') {
    const week = weekInterval(weekStart);
    return { start: week.offset(week.floor(today), -52), end: today };
  }
  return { start: new Date(view, 0, 1), end: new Date(view, 11, 31) };
}
