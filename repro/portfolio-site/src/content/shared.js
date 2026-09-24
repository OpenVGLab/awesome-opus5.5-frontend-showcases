// Language-independent data for the portfolio. Localized copy lives in en.js / zh.js.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://maraellison.dev').replace(/\/$/, '');

export const PERSON = {
  name: 'Mara Ellison',
  email: 'hello@maraellison.dev',
  phone: '+351 912 345 678',
  phoneHref: 'tel:+351912345678',
  address: {
    street: 'Rua das Flores 28',
    postalCode: '1200-195',
    city: 'Lisboa',
    region: 'Lisboa',
    country: 'PT',
  },
  geo: { lat: 38.7101, lng: -9.143 },
  headshot: { src: 'images/mara-ellison-creative-frontend-developer-headshot.webp', width: 1200, height: 1500 },
  ogImage: 'images/og/mara-ellison-portfolio-og.jpg',
};

export const SOCIALS = [
  { id: 'github', label: 'GitHub', handle: '@maraellison', url: 'https://github.com/maraellison' },
  { id: 'linkedin', label: 'LinkedIn', handle: 'in/maraellison', url: 'https://www.linkedin.com/in/maraellison' },
  { id: 'x', label: 'X (Twitter)', handle: '@maraellison', url: 'https://x.com/maraellison' },
  { id: 'dribbble', label: 'Dribbble', handle: 'maraellison', url: 'https://dribbble.com/maraellison' },
  { id: 'codepen', label: 'CodePen', handle: 'maraellison', url: 'https://codepen.io/maraellison' },
  { id: 'email', label: 'Email', handle: 'hello@maraellison.dev', url: 'mailto:hello@maraellison.dev' },
];

export const PROJECT_CATEGORIES = ['web-app', 'webgl', 'ecommerce', 'design-system', 'open-source'];

// `image` is the base path handed to next/image; the loader appends -<width> for each rendition.
export const PROJECTS = [
  {
    id: 'aurora',
    categories: ['web-app'],
    year: 2024,
    image: { src: 'images/projects/aurora-real-time-banking-dashboard.webp', width: 1600, height: 1200 },
    stack: ['Next.js', 'TypeScript', 'D3.js', 'WebSockets'],
    accent: '#6C7BFF',
    transition: 0,
    caseStudy: 'core-web-vitals-for-creative-websites',
  },
  {
    id: 'lumen',
    categories: ['design-system'],
    year: 2025,
    image: { src: 'images/projects/lumen-ui-design-system-starter-kit.webp', width: 1600, height: 2000 },
    stack: ['React', 'Radix UI', 'Design Tokens', 'Storybook'],
    accent: '#FF8A5B',
    transition: 1,
    caseStudy: 'json-ld-structured-data-recipes',
    product: { sku: 'LUMEN-UI-2', price: '79.00', currency: 'EUR' },
  },
  {
    id: 'tidal',
    categories: ['webgl'],
    year: 2023,
    image: { src: 'images/projects/tidal-ocean-temperature-webgl-globe.webp', width: 1600, height: 1600 },
    stack: ['Three.js', 'GLSL', 'Web Workers', 'Astro'],
    accent: '#2EC4B6',
    transition: 2,
    caseStudy: 'webgl-page-transitions-with-threejs',
  },
  {
    id: 'nordlys',
    categories: ['ecommerce'],
    year: 2024,
    image: { src: 'images/projects/nordlys-3d-outdoor-gear-configurator.webp', width: 1600, height: 2134 },
    stack: ['Next.js', 'Three.js', 'Shopify Storefront API', 'Zustand'],
    accent: '#E9C46A',
    transition: 3,
    caseStudy: 'webgl-page-transitions-with-threejs',
  },
  {
    id: 'sonic',
    categories: ['webgl'],
    year: 2022,
    image: { src: 'images/projects/sonic-garden-generative-audio-installation.webp', width: 1600, height: 1000 },
    stack: ['Web Audio API', 'WebGL', 'TypeScript', 'MIDI'],
    accent: '#B388FF',
    transition: 1,
    caseStudy: 'generative-music-with-the-web-audio-api',
  },
  {
    id: 'kinetic',
    categories: ['open-source'],
    year: 2023,
    image: { src: 'images/projects/kinetic-type-motion-typography-tool.webp', width: 1600, height: 1200 },
    stack: ['React', 'Framer Motion', 'Canvas API', 'Vite'],
    accent: '#FF4D2E',
    transition: 0,
    caseStudy: 'designing-a-motion-system',
  },
  {
    id: 'atlas',
    categories: ['web-app'],
    year: 2022,
    image: { src: 'images/projects/atlas-offline-travel-journal-pwa.webp', width: 1600, height: 2134 },
    stack: ['React', 'IndexedDB', 'MapLibre GL', 'Workbox'],
    accent: '#4CC9F0',
    transition: 2,
    caseStudy: 'astro-or-nextjs-for-content-sites',
  },
  {
    id: 'pulse',
    categories: ['web-app'],
    year: 2025,
    image: { src: 'images/projects/pulse-accessible-health-onboarding.webp', width: 1600, height: 1600 },
    stack: ['React', 'XState', 'axe-core', 'Playwright'],
    accent: '#52B788',
    transition: 3,
    caseStudy: 'accessible-custom-cursors',
  },
  {
    id: 'orbit',
    categories: ['webgl'],
    year: 2025,
    image: { src: 'images/projects/orbit-26-conference-website.webp', width: 1600, height: 1000 },
    stack: ['Astro', 'Three.js', 'GSAP', 'Stripe'],
    accent: '#F72585',
    transition: 2,
    caseStudy: 'designing-a-motion-system',
  },
];

export const RADAR = [95, 90, 86, 93, 89, 87];
export const BARS = [
  ['React / Next.js', 96],
  ['CSS & Motion', 95],
  ['TypeScript', 92],
  ['Three.js / GLSL', 88],
  ['Astro', 85],
  ['Figma', 82],
  ['Node.js', 76],
];

// Word cloud weights; the localized notes are looked up by `text`.
export const CLOUD_WORDS = [
  ['React', 100], ['Next.js', 88], ['TypeScript', 86], ['Three.js', 84], ['CSS', 92], ['WebGL', 78],
  ['GLSL', 66], ['Astro', 64], ['Framer Motion', 70], ['GSAP', 66], ['Accessibility', 76], ['Performance', 80],
  ['Design Systems', 72], ['Figma', 64], ['Node.js', 56], ['Web Audio', 48], ['D3.js', 52], ['SVG', 62],
  ['Canvas API', 54], ['Storybook', 44], ['Vite', 48], ['Playwright', 40], ['WebXR', 30], ['Svelte', 32],
  ['Blender', 34], ['i18n', 34], ['SEO', 58], ['Motion Design', 68], ['Tailwind', 42], ['Shopify', 30],
];

export const TESTIMONIAL_META = [
  { id: 'priya', name: 'Priya Raman', company: 'Northwind Finance', project: 'aurora', rating: 5, date: '2024-11-04' },
  { id: 'tomas', name: 'Tomás Ferreira', company: 'Blue Current Foundation', project: 'tidal', rating: 5, date: '2023-09-18' },
  { id: 'hannah', name: 'Hannah Okafor', company: 'Fieldnote', project: 'lumen', rating: 5, date: '2025-05-12' },
  { id: 'daniel', name: 'Daniel Kim', company: 'Pulse Health', project: 'pulse', rating: 5, date: '2025-08-27' },
  { id: 'sofie', name: 'Sofie Lindgren', company: 'Nordlys Outdoor', project: 'nordlys', rating: 5, date: '2024-06-03' },
  { id: 'ines', name: 'Inês Moreira', company: 'Museu de Luz', project: 'sonic', rating: 5, date: '2022-12-15' },
];

export const LOCATIONS = [
  { id: 'lisbon', lat: 38.7223, lng: -9.1393, home: true },
  { id: 'porto', lat: 41.1579, lng: -8.6291 },
  { id: 'london', lat: 51.5072, lng: -0.1276 },
  { id: 'berlin', lat: 52.52, lng: 13.405 },
  { id: 'stockholm', lat: 59.3293, lng: 18.0686 },
  { id: 'newyork', lat: 40.7128, lng: -74.006 },
  { id: 'sanfrancisco', lat: 37.7749, lng: -122.4194 },
  { id: 'saopaulo', lat: -23.5505, lng: -46.6333 },
  { id: 'tokyo', lat: 35.6762, lng: 139.6503 },
  { id: 'singapore', lat: 1.3521, lng: 103.8198 },
  { id: 'sydney', lat: -33.8688, lng: 151.2093 },
];

export const EVENTS = [
  {
    id: 'motion-summit',
    start: '2026-11-12T14:30:00+00:00',
    end: '2026-11-12T15:15:00+00:00',
    mode: 'offline',
    venue: 'LX Factory, Rua Rodrigues de Faria 103',
    city: 'Lisboa',
    country: 'PT',
    postalCode: '1300-501',
    price: '149.00',
    url: '#experience',
  },
  {
    id: 'webgl-workshop',
    start: '2026-12-03T16:00:00+00:00',
    end: '2026-12-03T19:00:00+00:00',
    mode: 'online',
    price: '89.00',
    url: '#experience',
  },
];

export const ACHIEVEMENTS = ['night-owl', 'curator', 'dj', 'explorer', 'pen-pal', 'konami'];
