import { esc, icon } from './dom.js';
import { t } from '../core/i18n.js';

// Segmented control. options: [{ v, label: string | () => string }]
export function segmented(el, options, value, onChange) {
  el.classList.add('seg');
  const render = () => {
    el.innerHTML = options.map((o, i) => `<button type="button" data-i="${i}" class="${o.v === value ? 'on' : ''}"${o.title ? ` title="${esc(o.title())}"` : ''}>${typeof o.label === 'function' ? o.label() : o.label}</button>`).join('');
  };
  el.onclick = (ev) => {
    const b = ev.target.closest('button[data-i]');
    if (!b) return;
    const v = options[+b.dataset.i].v;
    if (v === value) return;
    value = v;
    render();
    onChange(v);
  };
  render();
  return { set(v) { value = v; render(); }, get: () => value, render };
}

// Searchable popover list, single or multi select.
// getItems(): [{ id, label, sub?, group?, keys? }]; value: id (single) or Set (multi)
let openPicker = null;
const pop = document.createElement('div');
pop.className = 'picker-pop';
pop.hidden = true;
document.body.appendChild(pop);
document.addEventListener('mousedown', (ev) => {
  if (openPicker && !pop.contains(ev.target) && !openPicker.anchor.contains(ev.target)) openPicker.close();
});
window.addEventListener('resize', () => openPicker && openPicker.close());

export class Picker {
  constructor(opts) {
    this.o = opts;
    this.anchor = opts.anchor;
    this.anchor.addEventListener('click', () => (openPicker === this ? this.close() : this.open()));
    this.query = '';
    this.active = 0;
  }

  open() {
    if (openPicker) openPicker.close();
    openPicker = this;
    this.query = '';
    this.active = 0;
    pop.hidden = false;
    pop.innerHTML = `
      <div class="picker-search">${icon('search')}<input type="text" spellcheck="false" autocomplete="off" placeholder="${esc(this.o.placeholder || t('search'))}"></div>
      ${this.o.multi ? `<div class="picker-tools"><button type="button" data-act="all">${t('all')}</button><button type="button" data-act="clear">${t('clear')}</button><span class="picker-count"></span></div>` : ''}
      <div class="picker-list" role="listbox"></div>`;
    this.input = pop.querySelector('input');
    this.list = pop.querySelector('.picker-list');
    this.input.oninput = () => { this.query = this.input.value.trim().toLowerCase(); this.active = 0; this.renderList(); };
    this.input.onkeydown = (ev) => this.key(ev);
    pop.onclick = (ev) => this.click(ev);
    this.renderList();
    this.position();
    this.anchor.classList.add('open');
    setTimeout(() => this.input.focus(), 0);
  }

  close() {
    pop.hidden = true;
    pop.innerHTML = '';
    this.anchor.classList.remove('open');
    if (openPicker === this) openPicker = null;
  }

  position() {
    const r = this.anchor.getBoundingClientRect();
    const w = Math.max(r.width, this.o.width || 300);
    const h = Math.min(420, window.innerHeight - 24);
    let left = Math.min(r.left, window.innerWidth - w - 8);
    left = Math.max(8, left);
    const below = window.innerHeight - r.bottom - 12;
    pop.style.width = w + 'px';
    pop.style.left = left + 'px';
    if (below >= Math.min(h, 300) || below > r.top) {
      pop.style.top = r.bottom + 6 + 'px';
      pop.style.maxHeight = Math.min(h, below) + 'px';
    } else {
      const avail = Math.min(h, r.top - 12);
      pop.style.top = r.top - 6 - avail + 'px';
      pop.style.maxHeight = avail + 'px';
    }
  }

  filtered() {
    const items = this.o.getItems();
    if (!this.query) return items;
    const q = this.query;
    return items.filter((it) => (it.keys || (it.label + ' ' + (it.sub || ''))).toLowerCase().includes(q));
  }

  renderList() {
    const items = (this.items = this.filtered());
    const val = this.o.getValue();
    const multi = this.o.multi;
    let html = '';
    let group = null;
    items.forEach((it, i) => {
      if (it.group != null && it.group !== group) {
        group = it.group;
        html += `<div class="picker-group"${multi ? ` data-group="${esc(group)}"` : ''}>${esc(group)}</div>`;
      }
      const sel = multi ? val.has(it.id) : val === it.id;
      html += `<div class="picker-item${sel ? ' sel' : ''}${i === this.active ? ' active' : ''}" data-idx="${i}" role="option">
        ${multi ? `<span class="cb">${sel ? icon('check') : ''}</span>` : ''}
        <span class="pi-label">${esc(it.label)}</span>${it.sub ? `<span class="pi-sub">${esc(it.sub)}</span>` : ''}</div>`;
    });
    this.list.innerHTML = html || `<div class="picker-empty">${t('noData')}</div>`;
    if (multi) pop.querySelector('.picker-count').textContent = t('selected', { n: val.size });
  }

  choose(it) {
    if (this.o.multi) {
      const v = new Set(this.o.getValue());
      if (v.has(it.id)) v.delete(it.id); else v.add(it.id);
      this.o.onChange(v);
      this.renderList();
    } else {
      this.o.onChange(it.id);
      this.close();
    }
  }

  click(ev) {
    const item = ev.target.closest('.picker-item');
    if (item) { this.choose(this.items[+item.dataset.idx]); return; }
    const act = ev.target.closest('[data-act]');
    if (act && this.o.multi) {
      const v = new Set(this.o.getValue());
      if (act.dataset.act === 'all') this.items.forEach((it) => v.add(it.id));
      else if (this.query) this.items.forEach((it) => v.delete(it.id));
      else v.clear();
      this.o.onChange(v);
      this.renderList();
      return;
    }
    const g = ev.target.closest('.picker-group[data-group]');
    if (g && this.o.multi) {
      const ids = this.items.filter((it) => it.group === g.dataset.group).map((it) => it.id);
      const v = new Set(this.o.getValue());
      const allOn = ids.every((id) => v.has(id));
      ids.forEach((id) => (allOn ? v.delete(id) : v.add(id)));
      this.o.onChange(v);
      this.renderList();
    }
  }

  key(ev) {
    const n = this.items.length;
    if (ev.key === 'ArrowDown') { this.active = Math.min(n - 1, this.active + 1); this.renderList(); this.scrollActive(); ev.preventDefault(); }
    else if (ev.key === 'ArrowUp') { this.active = Math.max(0, this.active - 1); this.renderList(); this.scrollActive(); ev.preventDefault(); }
    else if (ev.key === 'Enter') { if (this.items[this.active]) this.choose(this.items[this.active]); ev.preventDefault(); }
    else if (ev.key === 'Escape') { this.close(); this.anchor.focus(); }
  }

  scrollActive() {
    const el = this.list.querySelector('.picker-item.active');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
}
