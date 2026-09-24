import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { EVENTS } from '../content/shared';
import { refreshAOS } from '../lib/aos';
import { formatDate, useContent } from '../lib/content';
import { Calendar, ChevronDown, MapPin } from './Icons';

const FILTERS = ['all', 'work', 'education', 'award', 'talk'];

function TimelineItem({ item, labels, index }) {
  const [open, setOpen] = useState(false);
  const panelId = `tl-${item.id}`;
  return (
    <li className={`timeline-item timeline-item--${item.type}`} data-aos={index % 2 ? 'fade-left' : 'fade-up'} data-aos-delay={Math.min(index, 3) * 60}>
      <span className="timeline-dot" aria-hidden="true" />
      <div className="timeline-card">
        <div className="timeline-meta">
          <span className="timeline-period">
            {item.start}
            {item.end ? ` — ${item.end}` : item.type === 'work' ? ` — ${labels.present}` : ''}
          </span>
          <span className="chip">{labels.filters[item.type]}</span>
        </div>
        <h3 className="timeline-title">{item.title}</h3>
        <p className="timeline-org">
          {item.org} <span aria-hidden="true">·</span> {item.place}
        </p>
        <p className="timeline-summary">{item.summary}</p>
        <button type="button" className="timeline-toggle link" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => setOpen((v) => !v)}>
          {open ? labels.less : labels.more}
          <motion.span animate={{ rotate: open ? 180 : 0 }} style={{ display: 'inline-grid' }}>
            <ChevronDown />
          </motion.span>
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              className="timeline-details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <ul>
                {item.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <ul className="timeline-tags">
                {item.tags.map((t) => (
                  <li key={t} className="chip">
                    {t}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

function icsFor(event, text) {
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const location = event.mode === 'online' ? 'Online' : `${event.venue}, ${event.city}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mara Ellison//Portfolio//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@maraellison.dev`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(event.end)}`,
    `SUMMARY:${text.name}`,
    `DESCRIPTION:${text.description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function downloadIcs(event, text) {
  const blob = new Blob([icsFor(event, text)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.id}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Experience() {
  const content = useContent();
  const { experience } = content;
  const [filter, setFilter] = useState('all');
  const items = useMemo(() => (filter === 'all' ? experience.items : experience.items.filter((i) => i.type === filter)), [filter, experience.items]);

  useEffect(() => {
    refreshAOS();
  }, [filter]);

  return (
    <section id="experience" className="section experience" aria-labelledby="experience-title">
      <div className="container experience-grid">
        <div className="experience-aside">
          <header className="section-head" data-aos="fade-up">
            <p className="kicker">{experience.kicker}</p>
            <h2 id="experience-title" className="section-title">
              {experience.title}
            </h2>
            <p className="section-intro">{experience.intro}</p>
          </header>
          <LayoutGroup id="exp-filters">
            <div className="filters filters--compact" role="group" aria-label={experience.kicker}>
              {FILTERS.map((f) => (
                <button key={f} type="button" className={`filter${filter === f ? ' is-active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {filter === f && <motion.span layoutId="exp-pill" className="filter-pill" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="filter-label">{experience.filters[f]}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>

          <div className="events card" data-aos="fade-up">
            <h3 className="card-title">{experience.eventsTitle}</h3>
            <ul className="events-list">
              {EVENTS.map((ev) => {
                const text = experience.events[ev.id];
                const date = ev.start.slice(0, 10);
                return (
                  <li key={ev.id} className="event">
                    <span className="event-date" aria-hidden="true">
                      <span>{formatDate(date, content.lang, { day: '2-digit' })}</span>
                      <span>{formatDate(date, content.lang, { month: 'short' })}</span>
                    </span>
                    <div>
                      <p className="event-name">{text.name}</p>
                      <p className="event-place">
                        <MapPin />
                        <time dateTime={ev.start}>{formatDate(date, content.lang)}</time> · {text.place}
                      </p>
                      <button type="button" className="event-cal link" onClick={() => downloadIcs(ev, text)}>
                        <Calendar />
                        {experience.addToCalendar}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <ol className="timeline" aria-live="polite">
          {items.map((item, i) => (
            <TimelineItem key={`${filter}-${item.id}`} item={item} index={i} labels={experience} />
          ))}
        </ol>
      </div>
    </section>
  );
}
