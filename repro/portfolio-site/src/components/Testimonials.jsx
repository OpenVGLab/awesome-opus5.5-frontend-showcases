import { A11y, Autoplay, Keyboard, Navigation, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';
import { PROJECTS, TESTIMONIAL_META } from '../content/shared';
import { useContent } from '../lib/content';
import { usePrefersReducedMotion } from '../lib/hooks';
import { ChevronLeft, ChevronRight, Star } from './Icons';

const AVATAR_COLORS = [
  ['#FF4D2E', '#FF9A6B'],
  ['#2A9D8F', '#8FD9C9'],
  ['#3D5AFE', '#8C9EFF'],
  ['#141414', '#6B6862'],
  ['#E9A23B', '#F6D68B'],
  ['#B5452B', '#F0A18A'],
];

function Avatar({ name, i }) {
  const [a, b] = AVATAR_COLORS[i % AVATAR_COLORS.length];
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);
  return (
    <svg className="avatar" viewBox="0 0 56 56" aria-hidden="true">
      <defs>
        <linearGradient id={`av-${i}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="1" stopColor={b} />
        </linearGradient>
      </defs>
      <circle cx="28" cy="28" r="28" fill={`url(#av-${i})`} />
      <text x="28" y="34" textAnchor="middle" fontSize="18" fontWeight="600" fill="#fff" fontFamily="inherit">
        {initials}
      </text>
    </svg>
  );
}

export default function Testimonials() {
  const { testimonials, work } = useContent();
  const reduce = usePrefersReducedMotion();

  return (
    <section id="testimonials" className="section testimonials" aria-labelledby="testimonials-title">
      <div className="container">
        <div className="testimonials-head">
          <header className="section-head" data-aos="fade-up">
            <p className="kicker">{testimonials.kicker}</p>
            <h2 id="testimonials-title" className="section-title">
              {testimonials.title}
            </h2>
          </header>
          <div className="swiper-controls" data-aos="fade-up">
            <span className="swiper-hint">{testimonials.pauseHint}</span>
            <button type="button" className="icon-btn t-prev link" aria-label={testimonials.prev}>
              <ChevronLeft />
            </button>
            <button type="button" className="icon-btn t-next link" aria-label={testimonials.next}>
              <ChevronRight />
            </button>
          </div>
        </div>

        <div data-aos="fade-up">
          <Swiper
            className="testimonial-swiper"
            modules={[Autoplay, Pagination, Navigation, A11y, Keyboard]}
            spaceBetween={24}
            slidesPerView={1}
            breakpoints={{ 860: { slidesPerView: 2 } }}
            loop
            speed={700}
            autoplay={reduce ? false : { delay: 5200, pauseOnMouseEnter: true, disableOnInteraction: false }}
            pagination={{ clickable: true }}
            navigation={{ prevEl: '.t-prev', nextEl: '.t-next' }}
            keyboard={{ enabled: true, onlyInViewport: true }}
            a11y={{ enabled: true }}
          >
            {TESTIMONIAL_META.map((m, i) => {
              const t = testimonials.items[m.id];
              const project = PROJECTS.find((p) => p.id === m.project);
              return (
                <SwiperSlide key={m.id}>
                  <figure className="testimonial card">
                    <div className="testimonial-top">
                      <span className="stars" role="img" aria-label={testimonials.ratingLabel}>
                        {Array.from({ length: m.rating }, (_, k) => (
                          <Star key={k} />
                        ))}
                      </span>
                      <span className="chip">{work.items[project.id].title.split(' — ')[0]}</span>
                    </div>
                    <blockquote className="testimonial-quote">
                      <p>“{t.quote}”</p>
                    </blockquote>
                    <figcaption className="testimonial-person">
                      <Avatar name={m.name} i={i} />
                      <span>
                        <strong>{m.name}</strong>
                        <span>
                          {t.role}, {m.company}
                        </span>
                      </span>
                    </figcaption>
                  </figure>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </div>
      </div>
    </section>
  );
}
