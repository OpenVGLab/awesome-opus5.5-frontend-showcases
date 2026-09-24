import { EVENTS, PERSON, PROJECTS, SITE_URL, SOCIALS, TESTIMONIAL_META } from '../content/shared';
import build from '../data/build.json';

const BUILD_DATE = build.date;
export const abs = (p = '') => `${SITE_URL}/${p.replace(/^\.?\//, '')}`;
export const pageUrl = (lang) => (lang === 'zh' ? abs('zh') : abs(''));

// One @graph per page with stable @ids (Person, WebSite, WebPage, ProfessionalService, FAQPage,
// Product + reviews, Events).
export function homeJsonLd(c) {
  const url = pageUrl(c.lang);
  const person = `${SITE_URL}/#person`;
  const business = `${SITE_URL}/#studio`;
  const website = `${SITE_URL}/#website`;
  const lumen = PROJECTS.find((p) => p.id === 'lumen');
  const reviews = TESTIMONIAL_META.map((m) => ({
    '@type': 'Review',
    author: { '@type': 'Person', name: m.name },
    reviewRating: { '@type': 'Rating', ratingValue: m.rating, bestRating: 5, worstRating: 1 },
    reviewBody: c.testimonials.items[m.id].quote,
    datePublished: m.date,
    publisher: { '@type': 'Organization', name: m.company },
  }));
  const address = {
    '@type': 'PostalAddress',
    streetAddress: PERSON.address.street,
    postalCode: PERSON.address.postalCode,
    addressLocality: PERSON.address.city,
    addressRegion: PERSON.address.region,
    addressCountry: PERSON.address.country,
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': website,
        url: abs(''),
        name: 'Mara Ellison',
        description: c.meta.description,
        inLanguage: ['en', 'zh-Hans'],
        publisher: { '@id': person },
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: c.meta.title,
        description: c.meta.description,
        inLanguage: c.htmlLang,
        isPartOf: { '@id': website },
        about: { '@id': person },
        primaryImageOfPage: { '@type': 'ImageObject', url: abs(PERSON.ogImage), width: 1200, height: 630 },
        dateModified: BUILD_DATE,
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.hero-intro', '.faq-a p'] },
      },
      {
        '@type': 'Person',
        '@id': person,
        name: PERSON.name,
        jobTitle: 'Creative Frontend Developer',
        description: c.hero.intro,
        url: abs(''),
        image: abs(PERSON.headshot.src.replace('.webp', '-800.webp')),
        email: `mailto:${PERSON.email}`,
        telephone: PERSON.phone,
        address,
        sameAs: SOCIALS.filter((s) => s.id !== 'email').map((s) => s.url),
        knowsAbout: ['React', 'Next.js', 'Astro', 'Three.js', 'WebGL', 'TypeScript', 'Web accessibility', 'Web performance', 'Design systems', 'Motion design'],
        alumniOf: { '@type': 'CollegeOrUniversity', name: 'University of Porto — Faculty of Fine Arts' },
        worksFor: { '@id': business },
        knowsLanguage: ['en', 'pt', 'de'],
      },
      {
        '@type': 'ProfessionalService',
        '@id': business,
        name: 'Mara Ellison Studio',
        description: c.meta.description,
        url: abs(''),
        image: abs(PERSON.ogImage),
        logo: abs('icons/icon-512.png'),
        email: PERSON.email,
        telephone: PERSON.phone,
        priceRange: '€€€',
        address,
        geo: { '@type': 'GeoCoordinates', latitude: PERSON.geo.lat, longitude: PERSON.geo.lng },
        openingHoursSpecification: [
          { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
        ],
        areaServed: [{ '@type': 'City', name: 'Lisbon' }, { '@type': 'Place', name: 'Worldwide (remote)' }],
        founder: { '@id': person },
        aggregateRating: { '@type': 'AggregateRating', ratingValue: '5', bestRating: '5', reviewCount: String(reviews.length) },
        review: reviews,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        inLanguage: c.htmlLang,
        mainEntity: c.faq.items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      },
      {
        '@type': 'Product',
        '@id': `${SITE_URL}/#lumen-ui`,
        name: c.work.items.lumen.title,
        description: c.work.items.lumen.description,
        image: abs(lumen.image.src.replace('.webp', '-1200.webp')),
        sku: lumen.product.sku,
        category: 'Software > Design system',
        brand: { '@type': 'Brand', name: 'Mara Ellison Studio' },
        offers: {
          '@type': 'Offer',
          price: lumen.product.price,
          priceCurrency: lumen.product.currency,
          availability: 'https://schema.org/InStock',
          priceValidUntil: '2027-12-31',
          url: `${url}#work`,
          seller: { '@id': business },
        },
        aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.9', bestRating: '5', reviewCount: '320' },
        review: reviews.filter((_, i) => TESTIMONIAL_META[i].project === 'lumen'),
      },
      ...EVENTS.map((ev) => {
        const t = c.experience.events[ev.id];
        const online = ev.mode === 'online';
        return {
          '@type': 'Event',
          '@id': `${SITE_URL}/#event-${ev.id}`,
          name: t.name,
          description: t.description,
          startDate: ev.start,
          endDate: ev.end,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: online ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode',
          location: online
            ? { '@type': 'VirtualLocation', url: `${url}#experience` }
            : {
                '@type': 'Place',
                name: 'LX Factory',
                address: { '@type': 'PostalAddress', streetAddress: ev.venue, addressLocality: ev.city, postalCode: ev.postalCode, addressCountry: ev.country },
              },
          image: abs(PERSON.ogImage),
          performer: { '@id': person },
          organizer: { '@type': 'Organization', name: online ? 'Mara Ellison Studio' : 'Web Motion Summit', url: abs('') },
          offers: { '@type': 'Offer', price: ev.price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock', url: `${url}#experience`, validFrom: '2026-09-01T00:00:00+00:00' },
        };
      }),
    ],
  };
}
