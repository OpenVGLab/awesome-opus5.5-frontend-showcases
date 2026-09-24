import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { PERSON, SOCIALS } from '../content/shared';
import { useAchievements } from '../lib/achievements';
import { track } from '../lib/analytics';
import { useContent } from '../lib/content';
import { Check, Clock, Close, FileIcon, Mail, MapPin, Phone, Upload } from './Icons';
import { SpringButton } from './Spring';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ACCEPT = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
};
const EMPTY = { name: '', email: '', company: '', type: '', budget: '', message: '', consent: false, website: '' };

function validate(v, captcha, msg) {
  const e = {};
  if (v.name.trim().length < 2) e.name = msg.name;
  if (!EMAIL_RE.test(v.email.trim())) e.email = msg.email;
  if (!v.type) e.type = msg.type;
  if (v.message.trim().length < 30) e.message = msg.message;
  if (!v.consent) e.consent = msg.consent;
  if (captcha !== 'done') e.captcha = msg.captcha;
  return e;
}

const formatBytes = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

// Offline stand-in for the reCAPTCHA v2 checkbox (Google's script cannot load in this static demo).
function RecaptchaDemo({ state, onVerify, f, invalid, describedBy }) {
  return (
    <div className={`recaptcha is-${state}${invalid ? ' is-invalid' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={state === 'done'}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className="recaptcha-box link"
        onClick={() => state === 'idle' && onVerify()}
      >
        {state === 'checking' && <span className="recaptcha-spinner" aria-hidden="true" />}
        {state === 'done' && <Check />}
        <span className="sr-only">{f.captcha}</span>
      </button>
      <span className="recaptcha-label" aria-hidden="true">
        {state === 'checking' ? f.captchaChecking : state === 'done' ? f.captchaDone : f.captcha}
      </span>
      <span className="recaptcha-brand" aria-hidden="true">
        <svg viewBox="0 0 32 32">
          <path d="M16 3a13 13 0 0 1 11.3 6.5l-3.6 2.1A8.8 8.8 0 0 0 16 7.2V3Z" fill="#4A90E2" />
          <path d="M29 16a13 13 0 0 1-6.5 11.3l-2.1-3.6A8.8 8.8 0 0 0 24.8 16H29Z" fill="#1C3AA9" />
          <path d="M16 29a13 13 0 0 1-11.3-6.5l3.6-2.1A8.8 8.8 0 0 0 16 24.8V29Z" fill="#ABABAB" />
          <circle cx="16" cy="16" r="4.2" fill="#4A90E2" />
        </svg>
        <span>reCAPTCHA</span>
        <small>{f.captchaNote}</small>
      </span>
    </div>
  );
}

function Field({ id, label, error, children, hint }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint}
      <AnimatePresence>
        {error && (
          <motion.p id={`${id}-error`} className="field-error" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Contact() {
  const { contact } = useContent();
  const f = contact.form;
  const uid = useId().replace(/:/g, '');
  const { unlock, celebrate } = useAchievements();
  const [values, setValues] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [captcha, setCaptcha] = useState('idle');
  const [token, setToken] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [status, setStatus] = useState('idle');
  const formRef = useRef(null);
  const filesRef = useRef(files);
  filesRef.current = files;

  const errors = useMemo(() => validate(values, captcha, f.errors), [values, captcha, f.errors]);
  const show = (k) => (touched[k] || submitted) && errors[k];
  const id = (k) => `${uid}-${k}`;
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const aria = (k) => ({ 'aria-invalid': show(k) ? true : undefined, 'aria-describedby': show(k) ? `${id(k)}-error` : undefined });

  const onDrop = useCallback(
    (accepted, rejected) => {
      setFiles((prev) =>
        [...prev, ...accepted.map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`, preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null }))].slice(0, 5),
      );
      setFileError(rejected.length ? f.errors.file : '');
    },
    [f.errors.file],
  );
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: ACCEPT, maxSize: 10 * 1024 * 1024, maxFiles: 5 });

  useEffect(() => () => filesRef.current.forEach((x) => x.preview && URL.revokeObjectURL(x.preview)), []);

  const removeFile = (key) =>
    setFiles((prev) => {
      const hit = prev.find((x) => x.key === key);
      if (hit?.preview) URL.revokeObjectURL(hit.preview);
      return prev.filter((x) => x.key !== key);
    });

  const addSamples = async () => {
    const [pdf, img] = await Promise.all([
      fetch('media/sample-project-brief.pdf').then((r) => r.blob()),
      fetch('images/projects/nordlys-3d-outdoor-gear-configurator-480.webp').then((r) => r.blob()),
    ]);
    onDrop([new File([pdf], 'sample-project-brief.pdf', { type: 'application/pdf' }), new File([img], 'moodboard-nordlys.webp', { type: 'image/webp' })], []);
  };

  const verify = () => {
    setCaptcha('checking');
    window.setTimeout(() => {
      setCaptcha('done');
      setToken(`demo.${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}`);
    }, 1100);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (values.website) return;
    const keys = Object.keys(errors);
    if (keys.length) {
      const first = formRef.current?.querySelector('[aria-invalid="true"], .recaptcha.is-invalid button');
      window.setTimeout(() => (formRef.current?.querySelector('[aria-invalid="true"]') || first)?.focus(), 0);
      track('form_error', { fields: keys.join(',') });
      return;
    }
    setStatus('sending');
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const outbox = JSON.parse(window.localStorage.getItem('me-outbox') || '[]');
      outbox.push({ ...values, website: undefined, files: files.map((x) => ({ name: x.file.name, size: x.file.size })), recaptchaToken: token, sentAt: new Date().toISOString() });
      window.localStorage.setItem('me-outbox', JSON.stringify(outbox.slice(-10)));
    } catch {
      /* storage unavailable: the demo still shows success */
    }
    setStatus('sent');
    window.setTimeout(() => document.querySelector('.contact-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    track('generate_lead', { type: values.type, budget: values.budget, files: files.length });
    celebrate(420);
    unlock('pen-pal');
  };

  const reset = () => {
    files.forEach((x) => x.preview && URL.revokeObjectURL(x.preview));
    setValues(EMPTY);
    setTouched({});
    setSubmitted(false);
    setCaptcha('idle');
    setToken('');
    setFiles([]);
    setStatus('idle');
  };

  const errorCount = submitted ? Object.keys(errors).length : 0;

  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <div className="container contact-grid">
        <div className="contact-aside" data-aos="fade-up">
          <p className="kicker">{contact.kicker}</p>
          <h2 id="contact-title" className="section-title">
            {contact.title}
          </h2>
          <p className="section-intro">{contact.intro}</p>
          <div className="contact-availability">
            <span className="pulse-dot" aria-hidden="true" />
            {contact.availability}
          </div>
          <ul className="contact-details">
            <li>
              <Mail />
              <a href={`mailto:${PERSON.email}`}>{PERSON.email}</a>
            </li>
            <li>
              <Phone />
              <a href={PERSON.phoneHref}>{PERSON.phone}</a>
            </li>
            <li>
              <MapPin />
              <address>
                {contact.detailsTitle}: {PERSON.address.street}, {PERSON.address.postalCode} {PERSON.address.city}, Portugal
              </address>
            </li>
            <li>
              <Clock />
              <span>{contact.hours}</span>
            </li>
          </ul>
          <ul className="contact-socials">
            {SOCIALS.filter((s) => s.id !== 'email').map((s) => (
              <li key={s.id}>
                <a className="chip" href={s.url} target="_blank" rel="noopener noreferrer me">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="card contact-card" data-aos="fade-up" data-aos-delay="100">
          <AnimatePresence mode="wait" initial={false}>
            {status === 'sent' ? (
              <motion.div key="done" className="contact-success" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} role="status">
                <span className="success-icon" aria-hidden="true">
                  <Check />
                </span>
                <h3>{f.successTitle}</h3>
                <p>{f.successText}</p>
                <button type="button" className="btn btn--ghost btn--sm link" onClick={reset}>
                  {f.another}
                </button>
              </motion.div>
            ) : (
              <motion.form key="form" ref={formRef} className="contact-form" noValidate onSubmit={onSubmit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-describedby={errorCount ? `${uid}-summary` : undefined}>
                <div className="form-row">
                  <Field id={id('name')} label={`${f.name} *`} error={show('name')}>
                    <input id={id('name')} name="name" autoComplete="name" required value={values.name} onChange={set('name')} onBlur={blur('name')} {...aria('name')} />
                  </Field>
                  <Field id={id('email')} label={`${f.email} *`} error={show('email')}>
                    <input id={id('email')} name="email" type="email" autoComplete="email" required value={values.email} onChange={set('email')} onBlur={blur('email')} {...aria('email')} />
                  </Field>
                </div>
                <div className="form-row">
                  <Field id={id('company')} label={f.company}>
                    <input id={id('company')} name="company" autoComplete="organization" value={values.company} onChange={set('company')} />
                  </Field>
                  <Field id={id('type')} label={`${f.type} *`} error={show('type')}>
                    <select id={id('type')} name="type" required value={values.type} onChange={set('type')} onBlur={blur('type')} {...aria('type')}>
                      <option value="">{f.typePlaceholder}</option>
                      {f.types.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <fieldset className="field budget">
                  <legend>{f.budget}</legend>
                  <div className="budget-options">
                    {f.budgets.map((b) => (
                      <label key={b} className={`budget-option${values.budget === b ? ' is-checked' : ''}`}>
                        <input type="radio" name="budget" value={b} checked={values.budget === b} onChange={set('budget')} />
                        {b}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id={id('message')} label={`${f.message} *`} error={show('message')} hint={<span className="field-count">{values.message.trim().length} {f.charCount}</span>}>
                  <textarea id={id('message')} name="message" rows={5} required placeholder={f.messagePlaceholder} value={values.message} onChange={set('message')} onBlur={blur('message')} {...aria('message')} />
                </Field>

                <div className="field">
                  <span className="field-label" id={id('files')}>
                    {f.files}
                  </span>
                  <div {...getRootProps({ className: `dropzone link${isDragActive ? ' is-active' : ''}`, 'aria-labelledby': id('files') })}>
                    <input {...getInputProps({ name: 'attachments' })} />
                    <Upload />
                    <p>{isDragActive ? f.dropActive : f.dropIdle}</p>
                    <small>{f.dropHint}</small>
                  </div>
                  <div className="dropzone-actions">
                    <button type="button" className="text-btn link" onClick={addSamples}>
                      + {f.sample}
                    </button>
                    {fileError && <span className="field-error">{fileError}</span>}
                  </div>
                  {files.length > 0 && (
                    <ul className="file-list">
                      {files.map((x) => (
                        <li key={x.key} className="file-item">
                          {x.preview ? <img src={x.preview} alt="" /> : <span className="file-icon"><FileIcon /></span>}
                          <span className="file-name">{x.file.name}</span>
                          <span className="file-size">{formatBytes(x.file.size)}</span>
                          <button type="button" className="icon-btn file-remove link" onClick={() => removeFile(x.key)} aria-label={`${f.remove} ${x.file.name}`}>
                            <Close />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <label className={`consent${show('consent') ? ' has-error' : ''}`}>
                  <input type="checkbox" name="consent" checked={values.consent} onChange={set('consent')} onBlur={blur('consent')} {...aria('consent')} />
                  <span>{f.consent}</span>
                </label>
                {show('consent') && (
                  <p id={`${id('consent')}-error`} className="field-error">
                    {errors.consent}
                  </p>
                )}

                <div className="hp-field" aria-hidden="true">
                  <label htmlFor={id('website')}>Website</label>
                  <input id={id('website')} name="website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
                </div>
                <input type="hidden" name="g-recaptcha-response" value={token} />

                <div className="form-foot">
                  <div>
                    <RecaptchaDemo state={captcha} onVerify={verify} f={f} invalid={Boolean(show('captcha'))} describedBy={show('captcha') ? `${id('captcha')}-error` : undefined} />
                    {show('captcha') && (
                      <p id={`${id('captcha')}-error`} className="field-error">
                        {errors.captcha}
                      </p>
                    )}
                  </div>
                  <SpringButton as="button" type="submit" className="btn btn--accent link" disabled={status === 'sending'}>
                    {status === 'sending' ? f.sending : f.submit}
                  </SpringButton>
                </div>
                {errorCount > 0 && (
                  <p id={`${uid}-summary`} className="form-summary" role="alert">
                    {f.errors.summary} ({errorCount})
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
