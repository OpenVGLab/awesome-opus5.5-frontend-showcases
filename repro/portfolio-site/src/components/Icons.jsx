const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

const make = (paths) =>
  function Icon(props) {
    return (
      <svg {...base} {...props}>
        {paths}
      </svg>
    );
  };

export const ArrowRight = make(<path d="M5 12h14M13 6l6 6-6 6" />);
export const ArrowUpRight = make(<path d="M7 17 17 7M8 7h9v9" />);
export const ArrowUp = make(<path d="M12 19V5M6 11l6-6 6 6" />);
export const ChevronLeft = make(<path d="m15 18-6-6 6-6" />);
export const ChevronRight = make(<path d="m9 18 6-6-6-6" />);
export const ChevronDown = make(<path d="m6 9 6 6 6-6" />);
export const Close = make(<path d="M6 6l12 12M18 6 6 18" />);
export const Check = make(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const Plus = make(<path d="M12 5v14M5 12h14" />);
export const Sun = make(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
  </>,
);
export const Moon = make(<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />);
export const Play = make(<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor" stroke="none" />);
export const Pause = make(
  <>
    <rect x="6.5" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none" />
    <rect x="13.7" y="5" width="3.8" height="14" rx="1.2" fill="currentColor" stroke="none" />
  </>,
);
export const Upload = make(<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-3" />);
export const FileIcon = make(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </>,
);
export const Star = make(<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" fill="currentColor" stroke="none" />);
export const Calendar = make(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </>,
);
export const MapPin = make(
  <>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </>,
);
export const Mail = make(
  <>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </>,
);
export const Phone = make(<path d="M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 0 0 6.1 6.1l1.4-2.3L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" />);
export const Clock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </>,
);
export const Share = make(
  <>
    <circle cx="6" cy="12" r="2.6" />
    <circle cx="18" cy="6" r="2.6" />
    <circle cx="18" cy="18" r="2.6" />
    <path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" />
  </>,
);
export const Rss = make(
  <>
    <path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14" />
    <circle cx="6" cy="18" r="1.4" fill="currentColor" />
  </>,
);
export const Trophy = make(
  <>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </>,
);
export const Globe = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5S9.5 6.1 12 3.5Z" />
  </>,
);
export const Sparkle = make(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />);
