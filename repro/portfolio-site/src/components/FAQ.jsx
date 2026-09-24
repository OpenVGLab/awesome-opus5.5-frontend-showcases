import { motion } from 'framer-motion';
import { useState } from 'react';
import { useContent } from '../lib/content';
import { Plus } from './Icons';
import { SpringButton } from './Spring';

// Answers stay in the DOM while collapsed so the visible content matches the FAQPage schema.
export default function FAQ() {
  const { faq } = useContent();
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="section faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <div className="faq-aside" data-aos="fade-up">
          <p className="kicker">{faq.kicker}</p>
          <h2 id="faq-title" className="section-title">
            {faq.title}
          </h2>
          <p className="faq-prompt">{faq.chatPrompt}</p>
          <SpringButton as="button" type="button" className="btn btn--ghost link" onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}>
            {faq.chatCta}
          </SpringButton>
        </div>
        <div className="faq-list">
          {faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`faq-item${isOpen ? ' is-open' : ''}`} data-aos="fade-up" data-aos-delay={i * 50}>
                <h3 className="faq-q">
                  <button type="button" className="link" aria-expanded={isOpen} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    <span>{item.q}</span>
                    <motion.span className="faq-icon" animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 26 }}>
                      <Plus />
                    </motion.span>
                  </button>
                </h3>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="faq-a" aria-hidden={!isOpen}>
                  <div className="faq-a-inner">
                    <p>{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
