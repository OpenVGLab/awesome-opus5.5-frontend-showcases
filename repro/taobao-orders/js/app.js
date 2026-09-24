/* Order list: state, filtering, rendering and action dispatch. */
(function () {
  'use strict';
  const { esc, ic, money, toast, notify } = UI;
  const M = MockData;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const state = { orders: M.makeOrders(), tab: 'all', q: '', filters: {}, page: 1, selected: new Set(), cart: 12, recOffset: 0 };
  const mq = matchMedia('(max-width: 860px)');
  const wide = matchMedia('(min-width: 1600px)');
  const pageSize = () => (mq.matches ? 6 : 10);

  const STATUS = {
    WAIT_PAY: { text: '等待买家付款', cls: 'hot' },
    WAIT_SHIP: { text: '买家已付款', cls: '' },
    WAIT_RECEIVE: { text: '卖家已发货', cls: '' },
    SUCCESS: { text: '交易成功', cls: '' },
    CLOSED: { text: '交易关闭', cls: 'gray' },
  };
  const EVENT_LABEL = { ship: '已发货', pick: '已揽件', transit: '运输中', deliver: '派送中', sign: '已签收' };
  const TAG_CLS = { '极速退款': 'blue', '次日达': 'blue', '晚发必赔': 'blue', '以旧换新': 'blue', '运费险': 'green', '坏果包赔': 'green', '坏单包赔': 'green', '产地直发': 'green' };
  const TABS = [['all', '所有订单', '全部'], ['pay', '待付款', '待付款'], ['ship', '待发货', '待发货'], ['receive', '待收货', '待收货'], ['rate', '待评价', '待评价']];
  const TAB_TEST = {
    all: () => true,
    pay: (o) => o.status === 'WAIT_PAY',
    ship: (o) => o.status === 'WAIT_SHIP',
    receive: (o) => o.status === 'WAIT_RECEIVE',
    rate: (o) => o.status === 'SUCCESS' && !o.rated,
  };

  const goodsTotal = (o) => o.items.reduce((s, it) => s + it.price * it.qty, 0);
  const payTotal = (o) => goodsTotal(o) - o.discount + o.freight;
  const count = (o) => o.items.reduce((s, it) => s + it.qty, 0);
  const find = (id) => state.orders.find((o) => o.id === id);
  const live = () => state.orders.filter((o) => !o.deleted);
  const deletable = (o) => o.status === 'SUCCESS' || o.status === 'CLOSED';
  const lastEvent = (o) => o.events[o.events.length - 1];
  const short = (s, n = 16) => (s.length > n ? s.slice(0, n) + '…' : s);
  const hasFilter = () => !!state.q.trim() || Object.values(state.filters).some(Boolean);

  function hl(s) {
    const q = state.q.trim();
    const e = esc(s);
    if (!q) return e;
    const re = new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return e.replace(re, (m) => `<mark>${m}</mark>`);
  }

  function visible() {
    let list = state.tab === 'recycle' ? state.orders.filter((o) => o.deleted) : live().filter(TAB_TEST[state.tab]);
    const q = state.q.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => o.id.includes(q) || o.shop.name.toLowerCase().includes(q) ||
        o.items.some((it) => it.t.toLowerCase().includes(q) || it.sku.some((s) => s[1].toLowerCase().includes(q))));
    }
    const f = state.filters;
    if (f.from) { const t = new Date(f.from + 'T00:00:00').getTime(); list = list.filter((o) => o.created >= t); }
    if (f.to) { const t = new Date(f.to + 'T23:59:59').getTime(); list = list.filter((o) => o.created <= t); }
    if (f.status) list = list.filter((o) => o.status === f.status);
    if (f.rate === 'need') list = list.filter((o) => o.status === 'SUCCESS' && !o.rated);
    if (f.rate === 'done') list = list.filter((o) => o.rated);
    if (f.after) list = list.filter((o) => o.items.some((it) => it.refund === f.after));
    if (f.type === 'tmall') list = list.filter((o) => o.shop.tmall);
    if (f.type === 'taobao') list = list.filter((o) => !o.shop.tmall);
    if (f.type === 'mobile') list = list.filter((o) => o.mobile);
    if (f.seller && f.seller.trim()) list = list.filter((o) => o.shop.name.toLowerCase().includes(f.seller.trim().toLowerCase()));
    return list.sort((a, b) => b.created - a.created);
  }
  function pageInfo() {
    const all = visible();
    const pages = Math.max(1, Math.ceil(all.length / pageSize()));
    state.page = Math.max(1, Math.min(state.page, pages));
    return { all, pages, list: all.slice((state.page - 1) * pageSize(), state.page * pageSize()) };
  }

  /* ---------- tabs ---------- */
  let prevCounts = null;
  function renderTabs() {
    const lv = live();
    const counts = {};
    ['pay', 'ship', 'receive', 'rate'].forEach((k) => { counts[k] = lv.filter(TAB_TEST[k]).length; });
    const nDel = state.orders.length - lv.length;
    $('#tabs').innerHTML = TABS.map(([k, d, m]) => `<a class="tab ${state.tab === k ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${state.tab === k}">
        <span class="d-lab">${d}</span><span class="m-lab">${m}</span>${counts[k] ? `<em data-count="${k}">${counts[k]}</em>` : ''}</a>`).join('') +
      `<div class="tabs-r"><a data-tab="recycle" class="${state.tab === 'recycle' ? 'on' : ''}">${ic('trash')}<span>订单回收站</span>${nDel ? `<span class="num">(${nDel})</span>` : ''}</a></div>`;
    if (prevCounts) {
      Object.keys(counts).forEach((k) => {
        if (prevCounts[k] !== counts[k]) { const em = $(`#tabs [data-count="${k}"]`); if (em) em.classList.add('bump'); }
      });
    }
    prevCounts = counts;
  }

  /* ---------- order markup ---------- */
  const tagHTML = (t) => `<span class="tag ${TAG_CLS[t] || ''}">${t}</span>`;

  function mStatus(o) {
    if (o.deleted) return '已删除';
    if (o.status === 'WAIT_PAY') return '等待付款';
    if (o.status === 'WAIT_SHIP') return o.presale ? '预售 · 待发货' : '待发货';
    if (o.status === 'WAIT_RECEIVE') return EVENT_LABEL[lastEvent(o).type] || '卖家已发货';
    if (o.status === 'SUCCESS') return o.rated ? '交易成功' : '待评价';
    return '交易关闭';
  }

  function itemOps(o, it, idx) {
    if (it.refund === 'REFUNDING') return `<a class="rf" data-act="refundView" data-idx="${idx}">退款中</a><a data-act="refundCancel" data-idx="${idx}">撤销申请</a>`;
    if (it.refund === 'REFUNDED') return `<a class="rf done" data-act="refundView" data-idx="${idx}">退款成功</a>`;
    if (o.deleted) return '';
    if (o.status === 'WAIT_SHIP') return `<a data-act="aftersale" data-idx="${idx}">申请退款</a>`;
    if (o.status === 'WAIT_RECEIVE') return `<a data-act="aftersale" data-idx="${idx}">退款/退货</a>`;
    if (o.status === 'SUCCESS') return `<a data-act="aftersale" data-idx="${idx}">申请售后</a><a data-act="complain">投诉卖家</a>`;
    return '';
  }

  function itemHTML(o, it, idx) {
    return `<div class="o-item${it.refund ? ' has-rf' : ''}">
      <div class="c-item">
        <a class="thumb" data-act="snapshot" data-idx="${idx}"><img src="${Art.url(it.art)}" alt="${esc(it.t)}" width="80" height="80"></a>
        <div class="info">
          <p class="t-line"><a class="title" data-act="snapshot" data-idx="${idx}">${hl(it.t)}</a><a class="snap" data-act="snapshot" data-idx="${idx}">[交易快照]</a></p>
          <p class="sku">${it.sku.map(([k, v]) => `<span>${k}：${hl(v)}</span>`).join('')}</p>
          ${it.tags.length ? `<p class="tags">${it.tags.map(tagHTML).join('')}</p>` : ''}
          ${it.refund ? `<p class="m-rf">${it.refund === 'REFUNDED' ? '退款成功' : '退款中'}</p>` : ''}
        </div>
        <div class="o-mprice"><b>￥${money(it.price)}</b>${it.orig ? `<del>￥${money(it.orig)}</del>` : ''}<span>×${it.qty}</span></div>
      </div>
      <div class="c-price">${it.orig ? `<del>￥${money(it.orig)}</del>` : ''}<span>￥${money(it.price)}</span></div>
      <div class="c-qty">${it.qty}</div>
      <div class="c-ops">${itemOps(o, it, idx)}</div>
    </div>`;
  }

  function statusHTML(o) {
    const st = STATUS[o.status];
    let h = `<p class="st ${st.cls}">${st.text}</p>`;
    if (o.status === 'WAIT_SHIP' && o.reminded) h += '<p class="sub">已提醒卖家发货</p>';
    if (o.status === 'WAIT_RECEIVE' && lastEvent(o).type === 'sign') h += '<p class="sub">包裹已签收</p>';
    if (o.status === 'CLOSED') h += `<p class="sub">${esc(o.closedReason.replace(/（.*）/, ''))}</p>`;
    h += '<a data-act="detail">订单详情</a>';
    if (o.status === 'WAIT_RECEIVE' || o.status === 'SUCCESS') h += '<a data-act="logistics" class="lg-link">查看物流</a>';
    return h;
  }

  function actsHTML(o) {
    if (o.deleted) return '<button class="btn btn-line hl" data-act="restore">还原订单</button><a class="lk" data-act="purge">永久删除</a>';
    const now = Date.now();
    switch (o.status) {
      case 'WAIT_PAY':
        return `<p class="cd" data-cd="pay" data-t="${o.payDeadline}">${ic('clock')}<span>剩 ${UI.countdown(o.payDeadline - now)}</span></p>
          <button class="btn btn-primary" data-act="pay">立即付款</button>
          <a class="lk" data-act="cancel">取消订单</a><a class="lk" data-act="proxy">找人代付</a>`;
      case 'WAIT_SHIP':
        return `${o.reminded ? '<button class="btn btn-line" disabled>已提醒发货</button>' : '<button class="btn btn-line hl" data-act="remind">提醒发货</button>'}
          <a class="lk" data-act="address">修改地址</a>`;
      case 'WAIT_RECEIVE':
        return `<p class="cd soft" data-cd="auto" data-t="${o.autoConfirm}">还剩<span>${UI.dayHour(o.autoConfirm - now)}</span>自动确认</p>
          <button class="btn btn-primary" data-act="confirm">确认收货</button>
          ${o.extended ? '<span class="lk muted">已延长收货</span>' : '<a class="lk" data-act="extend">延长收货</a>'}`;
      case 'SUCCESS':
        return `${o.rated ? (o.appended ? '<span class="lk muted">已追评</span>' : '<a class="lk" data-act="append">追加评论</a>') : '<button class="btn btn-line hl" data-act="rate">评价</button>'}
          <button class="btn btn-line" data-act="rebuy">再次购买</button>
          <a class="lk" data-act="invoice">${o.invoiced ? '发票已申请' : '申请开票'}</a><a class="lk m-del" data-act="delete">删除订单</a>`;
      default:
        return '<button class="btn btn-line" data-act="rebuy">再次购买</button><a class="lk m-del" data-act="delete">删除订单</a>';
    }
  }

  function orderHTML(o, i) {
    const st = STATUS[o.status];
    const refunding = o.items.some((it) => it.refund === 'REFUNDING');
    const last = o.events.length ? lastEvent(o) : null;
    return `<div class="order st-${o.status.toLowerCase()}${o.deleted ? ' is-del' : ''}${state.selected.has(o.id) ? ' sel' : ''}" data-id="${o.id}" style="animation-delay:${Math.min(i, 8) * 35}ms">
      <div class="o-head">
        <label class="ck"><input type="checkbox" data-sel="${o.id}" ${state.selected.has(o.id) ? 'checked' : ''} aria-label="选择订单"></label>
        <span class="o-date" title="下单时间 ${M.fmt(o.created)}">${M.fmt(o.created, false)}</span>
        <span class="o-no">订单号: <em>${hl(o.id)}</em></span>
        <a class="o-shop" data-act="shop">${o.shop.tmall ? '<i class="shop-badge tm">天猫</i>' : '<i class="shop-badge">淘</i>'}<span>${hl(o.shop.name)}</span>${ic('right')}</a>
        <a class="o-ww" data-act="chat" title="和卖家聊聊">${ic('ww')}<span>和我联系</span></a>
        <span class="o-head-r">
          ${o.flag && o.status === 'WAIT_PAY' ? `<span class="o-flag refund">${o.flag}</span>` : ''}
          ${o.presale && o.status === 'WAIT_SHIP' ? `<span class="o-flag presale">${o.presale}</span>` : ''}
          ${refunding ? '<span class="o-flag refund">退款处理中</span>' : ''}
          ${!o.deleted && deletable(o) ? `<a class="o-del" data-act="delete" title="删除订单" aria-label="删除订单">${ic('trash')}</a>` : ''}
        </span>
        <span class="o-mstatus ${st.cls}">${mStatus(o)}</span>
      </div>
      <div class="o-body">
        <div class="o-items">${o.items.map((it, idx) => itemHTML(o, it, idx)).join('')}</div>
        <div class="c-pay"><strong>￥${money(payTotal(o))}</strong><p class="freight">(含运费：￥${money(o.freight)})</p>
          ${o.discount ? `<p class="disc">${o.discountLabel} -￥${money(o.discount)}</p>` : ''}
          ${o.mobile ? `<p class="m-order" title="手机订单">${ic('phone')}手机订单</p>` : ''}</div>
        <div class="c-status">${statusHTML(o)}</div>
        <div class="c-acts">${actsHTML(o)}</div>
        ${last && o.status === 'WAIT_RECEIVE' ? `<a class="o-mlog" data-act="logistics">${ic('truck')}<span><b>${EVENT_LABEL[last.type]}</b>${esc(last.text)}</span>${ic('right')}</a>` : ''}
        <div class="o-msum">${o.discount ? `<span class="ms-disc">已优惠￥${money(o.discount)}</span>` : ''}<span>共${count(o)}件</span>
          <span>${o.status === 'WAIT_PAY' ? '需付款' : '实付款'} <b>￥${money(payTotal(o))}</b></span></div>
      </div>
    </div>`;
  }

  const EMPTY_ART = `<svg viewBox="0 0 150 112" fill="none" aria-hidden="true"><ellipse cx="75" cy="101" rx="52" ry="7" fill="#f3f3f3"/>
    <path d="M35 48 L75 36 L115 48 L75 60 Z" fill="#ffe7d8"/><path d="M35 48 V86 L75 98 V60 Z" fill="#ffd5bd"/><path d="M115 48 V86 L75 98 V60 Z" fill="#ffc6a4"/>
    <path d="M35 48 L22 36 L62 24 L75 36 Z" fill="#fff2ea"/><path d="M115 48 L128 36 L88 24 L75 36 Z" fill="#fff2ea"/>
    <circle cx="104" cy="30" r="11" stroke="#ff9a62" stroke-width="3.5" fill="#fff"/><path d="M112 38 L121 47" stroke="#ff9a62" stroke-width="4" stroke-linecap="round"/>
    <path d="M40 18 l3 3 M48 12 v4 M30 27 h4" stroke="#ffc29e" stroke-width="2" stroke-linecap="round"/></svg>`;
  function emptyHTML() {
    if (state.tab === 'recycle') return `<div class="empty">${EMPTY_ART}<p>回收站空空如也，删除的订单会出现在这里</p><button class="btn btn-line hl" data-tab="all">返回我的订单</button></div>`;
    if (hasFilter()) return `<div class="empty">${EMPTY_ART}<p>没有找到符合条件的订单，换个关键词试试吧</p><button class="btn btn-line hl" data-clear>清空筛选条件</button></div>`;
    return `<div class="empty">${EMPTY_ART}<p>这里空空的，暂时没有相关订单</p><button class="btn btn-primary" data-tab="all">查看全部订单</button></div>`;
  }
  const recycleBar = () => `<div class="recycle-bar">${ic('trash')}<span>订单回收站：删除的订单可以在这里<b>还原</b>，永久删除后将无法恢复。</span><a href="#" data-tab="all">${ic('left')}返回我的订单</a></div>`;

  /* ---------- toolbars / pager / result bar ---------- */
  function renderToolbars(info) {
    const { list, pages } = info || pageInfo();
    const nSel = list.filter((o) => state.selected.has(o.id)).length;
    const allSel = list.length > 0 && nSel === list.length;
    const btns = state.tab === 'recycle'
      ? '<button class="btn btn-line btn-sm" data-batch="restore">批量还原</button>'
      : '<button class="btn btn-line btn-sm" data-batch="confirm">批量确认收货</button><button class="btn btn-line btn-sm" data-batch="pay">合并付款</button><button class="btn btn-line btn-sm" data-batch="delete">批量删除</button>';
    const base = `<label class="ck"><input type="checkbox" data-selall ${allSel ? 'checked' : ''}>全选</label>${btns}${nSel ? `<span class="sel-info">已选 <b>${nSel}</b> 笔订单</span>` : ''}`;
    $('#toolbarTop').innerHTML = list.length ? base + `<div class="mini-pager"><span class="num">${state.page}/${pages}</span>
      <button class="btn btn-line btn-sm" data-page="${state.page - 1}" ${state.page <= 1 ? 'disabled' : ''}>上一页</button>
      <button class="btn btn-line btn-sm" data-page="${state.page + 1}" ${state.page >= pages ? 'disabled' : ''}>下一页</button></div>` : '';
    $('#toolbarBottom').innerHTML = list.length ? base : '';
    $$('[data-selall]').forEach((cb) => { cb.indeterminate = nSel > 0 && !allSel; });
  }

  function renderPager(total, pages) {
    const p = state.page;
    if (!total) { $('#pager').innerHTML = ''; return; }
    const nums = [];
    for (let i = 1; i <= pages; i++) {
      if (i === 1 || i === pages || Math.abs(i - p) <= 1) nums.push(i);
      else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    $('#pager').innerHTML = `<a class="pg-prev ${p <= 1 ? 'dis' : ''}" data-page="${p - 1}">${ic('left')}上一页</a>` +
      nums.map((n) => (n === '…' ? '<span class="pg ell">…</span>' : `<a class="pg-n ${n === p ? 'cur' : ''}" data-page="${n}">${n}</a>`)).join('') +
      `<a class="pg-next ${p >= pages ? 'dis' : ''}" data-page="${p + 1}">下一页${ic('right')}</a>` +
      `<span class="pg-info">共 ${pages} 页 · ${total} 笔订单，到第</span><input type="number" min="1" max="${pages}" value="${p}" id="pgInput" aria-label="页码"><span class="pg-unit">页</span><a class="pg-go" data-go>确定</a>`;
  }

  function renderResultBar(n) {
    const bar = $('#resultBar');
    if (!hasFilter()) { bar.classList.remove('show'); bar.innerHTML = ''; return; }
    const f = state.filters, chips = [];
    if (state.q.trim()) chips.push(`关键词：${esc(state.q.trim())}`);
    if (f.from || f.to) chips.push(`成交时间：${f.from || '不限'} 至 ${f.to || '不限'}`);
    if (f.status) chips.push(`状态：${STATUS[f.status].text}`);
    if (f.rate) chips.push(f.rate === 'need' ? '需我评价' : '我已评价');
    if (f.after) chips.push(f.after === 'REFUNDING' ? '退款中' : '退款成功');
    if (f.type) chips.push({ tmall: '天猫订单', taobao: '淘宝订单', mobile: '手机订单' }[f.type]);
    if (f.seller && f.seller.trim()) chips.push(`卖家：${esc(f.seller.trim())}`);
    bar.innerHTML = `${ic('filter')}<span>筛选结果：共 <b>${n}</b> 笔订单</span>${chips.map((c) => `<span class="chip">${c}</span>`).join('')}<a href="#" class="clear" data-clear>清空条件</a>`;
    bar.classList.add('show');
  }

  /* ---------- main render ---------- */
  function render() {
    renderTabs();
    const info = pageInfo();
    const ids = new Set(info.list.map((o) => o.id));
    [...state.selected].forEach((id) => { if (!ids.has(id)) state.selected.delete(id); });
    $('#viewBar').innerHTML = state.tab === 'recycle' ? recycleBar() : '';
    $('#orderList').innerHTML = info.list.length ? info.list.map(orderHTML).join('') : emptyHTML();
    renderToolbars(info);
    renderPager(info.all.length, info.pages);
    renderResultBar(info.all.length);
    const th = $('#thStatus');
    th.value = state.filters.status || '';
    th.classList.toggle('on', !!state.filters.status);
  }

  function flash(id) {
    const el = $(`.order[data-id="${id}"]`);
    if (!el) return;
    el.classList.remove('flash');
    void el.offsetWidth;
    el.classList.add('flash');
    setTimeout(() => el.classList.remove('flash'), 1900);
  }

  function scrollToList() {
    const top = $('#tabs').getBoundingClientRect().top + scrollY - (mq.matches ? 56 : 8);
    if (scrollY > top + 4) scrollTo({ top, behavior: 'smooth' });
  }
  function setTab(k) {
    UI.hidePop(true);
    const changed = state.tab !== k;
    state.tab = k;
    state.page = 1;
    state.selected.clear();
    render();
    if (changed) scrollToList();
  }
  function goPage(n) {
    const { pages } = pageInfo();
    n = Math.max(1, Math.min(pages, n || 1));
    if (n === state.page) return;
    state.page = n;
    state.selected.clear();
    render();
    scrollToList();
  }
  function clearFilters() {
    state.q = '';
    state.filters = {};
    state.page = 1;
    $('#q').value = '';
    $('#filterPanel').reset();
    render();
  }

  /* ---------- recommendations ---------- */
  function renderRec() {
    const grid = $('#recGrid');
    const cols = parseInt(getComputedStyle(grid).getPropertyValue('--rec-cols'), 10) || 5;
    const n = mq.matches ? 6 : cols * 2;
    let html = '';
    for (let i = 0; i < n; i++) {
      const idx = (state.recOffset + i) % M.REC.length;
      const r = M.REC[idx];
      html += `<div class="rec" style="animation-delay:${i * 30}ms">
        <a href="#" class="rec-img" data-demo-rec><img src="${Art.url(r.art)}" alt="${esc(r.t)}"><span class="rec-sim">找相似</span></a>
        <div class="rec-body"><p class="rec-t">${r.tm ? '<i class="shop-badge tm">天猫</i>' : ''}${esc(r.t)}</p>
        <p class="rec-p"><b><small>￥</small>${r.p % 1 ? r.p.toFixed(1) : r.p}</b><span>${r.sold}</span></p></div>
        <button class="rec-add" data-recadd="${idx}" aria-label="加入购物车">${ic('cart')}</button></div>`;
    }
    grid.innerHTML = html;
  }

  /* ---------- cart ---------- */
  function setCart(n) {
    state.cart = n;
    $$('[data-cart-num]').forEach((el) => { el.textContent = n > 99 ? '99+' : n; });
  }
  function rebuy(o, el) {
    const img = el.closest('.order').querySelector('.thumb img');
    const n = count(o);
    UI.flyToCart(img, img.src, () => {
      setCart(state.cart + n);
      toast(`已将 ${n} 件宝贝加入购物车`);
    });
  }

  /* ---------- order state transitions (also used by dialogs) ---------- */
  const App = {
    state, find, payTotal, goodsTotal, count, STATUS, EVENT_LABEL, render, flash, short, mq,
    markPaid(orders) {
      const now = Date.now();
      orders.forEach((o) => { o.status = 'WAIT_SHIP'; o.paid = now; });
      state.selected.clear();
      render();
      orders.forEach((o) => flash(o.id));
    },
    markReceived(orders) {
      const now = Date.now();
      orders.forEach((o) => {
        o.status = 'SUCCESS';
        o.finished = now;
        if (lastEvent(o).type !== 'sign') o.events.push({ t: now, type: 'sign', text: `【${M.ADDRESSES[o.addr].city}】您的快件已签收，签收人：本人签收。感谢使用${M.CARRIERS[o.carrier].name}！` });
      });
      state.selected.clear();
      render();
      orders.forEach((o) => flash(o.id));
    },
    cancel(o, reason) {
      o.status = 'CLOSED';
      o.closedReason = `买家取消订单（${reason}）`;
      o.closedAt = Date.now();
      render();
      flash(o.id);
      toast('订单已取消，交易关闭');
    },
    rated(o, review) {
      o.rated = true;
      o.review = review;
      render();
      flash(o.id);
    },
    appended(o, text) {
      o.appended = true;
      o.review = { ...(o.review || {}), append: text };
      render();
      flash(o.id);
    },
    invoiced(o) { o.invoiced = true; render(); flash(o.id); },
    setAddress(o, i) { o.addr = i; render(); flash(o.id); },
    remind(o) {
      o.reminded = true;
      render();
      flash(o.id);
      toast(o.presale ? '已提醒卖家，预售商品将尽快为您发出' : '已提醒卖家尽快发货');
      setTimeout(() => { if (o.status === 'WAIT_SHIP' && !o.deleted) App.ship(o); }, 4500);
    },
    ship(o) {
      o.status = 'WAIT_RECEIVE';
      o.shipped = Date.now();
      o.autoConfirm = o.shipped + 10 * M.D;
      o.events = M.buildTrack(o, Date.now() + 90e3);
      render();
      flash(o.id);
      notify({
        title: '卖家已发货', icon: 'truck', img: Art.url(o.items[0].art),
        text: `「${short(o.items[0].t, 14)}」已交由${M.CARRIERS[o.carrier].name}配送，点击查看物流`,
        onClick: () => Dialogs.logistics(o),
      });
    },
    extend(o) {
      o.extended = true;
      o.autoConfirm += 3 * M.D;
      render();
      flash(o.id);
      toast('已延长收货时间 3 天');
    },
    refundApply(o, idx, info) {
      const it = o.items[idx];
      it.refund = 'REFUNDING';
      it.refundInfo = { ...info, at: Date.now() };
      render();
      flash(o.id);
      toast('退款申请已提交，等待卖家处理');
      clearTimeout(it.refundTimer);
      it.refundTimer = setTimeout(() => {
        if (it.refund !== 'REFUNDING') return;
        it.refund = 'REFUNDED';
        it.refundInfo.doneAt = Date.now();
        if (o.items.every((x) => x.refund === 'REFUNDED')) {
          o.status = 'CLOSED';
          o.closedReason = '退款成功，交易关闭';
          o.closedAt = Date.now();
        }
        render();
        flash(o.id);
        notify({ title: '退款成功', tone: 'green', icon: 'refund', img: Art.url(it.art), text: `卖家已同意退款，￥${money(info.amount)} 将在 1-3 个工作日内原路退回` });
      }, 5200);
    },
    refundCancel(o, idx) {
      const it = o.items[idx];
      clearTimeout(it.refundTimer);
      it.refund = null;
      it.refundInfo = null;
      render();
      flash(o.id);
      toast('已撤销退款申请');
    },
    remove(o) {
      const el = $(`.order[data-id="${o.id}"]`);
      const done = () => {
        o.deleted = true;
        state.selected.delete(o.id);
        render();
        toast('订单已移入回收站，可在“订单回收站”中还原');
      };
      if (el) { el.classList.add('leaving'); setTimeout(done, 300); } else done();
    },
    setCart, rebuy,
  };
  window.App = App;

  /* ---------- action dispatch ---------- */
  const ACT = {
    shop: (o) => toast(`演示页面：「${esc(o.shop.name)}」店铺首页暂未开放`, 'info'),
    chat: (o) => Chat.open(o),
    snapshot: (o, el) => Dialogs.snapshot(o, +el.dataset.idx || 0),
    detail: (o) => Dialogs.detail(o),
    logistics: (o) => { clearTimeout(hoverTimer); UI.hidePop(true); Dialogs.logistics(o); },
    pay: (o) => Dialogs.pay([o]),
    cancel: (o) => Dialogs.cancel(o),
    proxy: (o) => UI.copy(`https://m.tb.cn/pay/${o.id.slice(-10)}`, '代付链接已复制，发给好友即可帮你付款'),
    remind: (o) => App.remind(o),
    address: (o) => Dialogs.address(o),
    confirm: (o) => Dialogs.confirmReceive([o]),
    extend: (o, el) => UI.confirmPop(el, '确定延长收货时间吗？', () => App.extend(o), { sub: '每笔订单只能延长一次，将顺延 3 天', place: 'bottom' }),
    rate: (o) => Dialogs.review(o),
    append: (o) => Dialogs.append(o),
    rebuy: (o, el) => rebuy(o, el),
    invoice: (o) => (o.invoiced ? toast('发票已申请，开具后将发送至你的邮箱', 'info') : Dialogs.invoice(o)),
    delete: (o, el) => UI.confirmPop(el, '确定要删除该订单吗？', () => App.remove(o), { sub: '删除后可在“订单回收站”中还原', place: 'bottom' }),
    restore: (o) => { o.deleted = false; render(); toast('订单已还原到订单列表'); },
    purge: (o, el) => UI.confirmPop(el, '永久删除后将无法恢复，确定吗？', () => {
      state.orders.splice(state.orders.indexOf(o), 1);
      render();
      toast('订单已永久删除');
    }, { okText: '永久删除', place: 'bottom' }),
    aftersale: (o, el) => Dialogs.refund(o, +el.dataset.idx || 0),
    complain: (o) => Dialogs.complain(o),
    refundView: (o, el) => Dialogs.refundView(o, +el.dataset.idx || 0),
    refundCancel: (o, el) => UI.confirmPop(el, '确定撤销退款申请吗？', () => App.refundCancel(o, +el.dataset.idx || 0), { place: 'bottom' }),
  };

  function doBatch(kind, btn) {
    const { list } = pageInfo();
    const sel = list.filter((o) => state.selected.has(o.id));
    if (!sel.length) { toast('请先勾选订单', 'warn'); return; }
    if (kind === 'confirm') {
      const ok = sel.filter((o) => o.status === 'WAIT_RECEIVE');
      if (!ok.length) toast('所选订单中没有待收货的订单', 'warn');
      else Dialogs.confirmReceive(ok);
    } else if (kind === 'pay') {
      const ok = sel.filter((o) => o.status === 'WAIT_PAY');
      if (!ok.length) toast('所选订单中没有待付款的订单', 'warn');
      else Dialogs.pay(ok);
    } else if (kind === 'delete') {
      const ok = sel.filter(deletable);
      if (!ok.length) { toast('只有交易成功或已关闭的订单可以删除', 'warn'); return; }
      UI.confirmPop(btn, `确定删除选中的 ${ok.length} 笔订单吗？`, () => {
        ok.forEach((o) => { o.deleted = true; state.selected.delete(o.id); });
        render();
        toast(`已删除 ${ok.length} 笔订单，可在回收站中还原`);
      }, { sub: sel.length > ok.length ? `其余 ${sel.length - ok.length} 笔进行中的订单不可删除` : '删除后可在“订单回收站”中还原', place: 'bottom' });
    } else if (kind === 'restore') {
      sel.forEach((o) => { o.deleted = false; });
      state.selected.clear();
      render();
      toast(`已还原 ${sel.length} 笔订单`);
    }
  }

  function sideTool(k) {
    if (k === 'top') scrollTo({ top: 0, behavior: 'smooth' });
    else if (k === 'service') Chat.open(null);
    else if (k === 'feedback') Dialogs.feedback();
    else if (k === 'cart') toast(`购物车里有 ${state.cart} 件宝贝（演示页面）`, 'info');
    else toast('演示页面：该功能暂未开放', 'info');
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target;
    let el;
    if ((el = t.closest('[data-tab]'))) { e.preventDefault(); setTab(el.dataset.tab); return; }
    if ((el = t.closest('[data-tab-link]'))) { e.preventDefault(); state.q = ''; state.filters = {}; $('#q').value = ''; setTab(el.dataset.tabLink); return; }
    if ((el = t.closest('[data-page]'))) { e.preventDefault(); if (!el.classList.contains('dis') && !el.disabled) goPage(+el.dataset.page); return; }
    if (t.closest('[data-go]')) { e.preventDefault(); goPage(+$('#pgInput').value); return; }
    if (t.closest('[data-clear]')) { e.preventDefault(); clearFilters(); return; }
    if ((el = t.closest('[data-batch]'))) { e.preventDefault(); doBatch(el.dataset.batch, el); return; }
    if ((el = t.closest('[data-act]'))) {
      e.preventDefault();
      const host = el.closest('[data-id]');
      const o = host && find(host.dataset.id);
      if (o && ACT[el.dataset.act]) ACT[el.dataset.act](o, el);
      return;
    }
    if ((el = t.closest('[data-recadd]'))) {
      const img = el.closest('.rec').querySelector('img');
      UI.flyToCart(img, img.src, () => { setCart(state.cart + 1); toast('已加入购物车'); });
      return;
    }
    if ((el = t.closest('[data-demo-rec]'))) {
      e.preventDefault();
      toast(t.closest('.rec-sim') ? '已为你找到 36 件相似宝贝（演示页面）' : '演示页面：商品详情页暂未开放', 'info');
      return;
    }
    if ((el = t.closest('[data-tool]'))) { e.preventDefault(); sideTool(el.dataset.tool); return; }
    if ((el = t.closest('a[href="#"]'))) {
      e.preventDefault();
      if (el.hasAttribute('data-demo')) toast('演示页面：只有“已买到的宝贝”可以操作哦', 'info');
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-sel]')) {
      if (t.checked) state.selected.add(t.dataset.sel); else state.selected.delete(t.dataset.sel);
      t.closest('.order').classList.toggle('sel', t.checked);
      renderToolbars();
    } else if (t.matches('[data-selall]')) {
      const { list } = pageInfo();
      list.forEach((o) => { if (t.checked) state.selected.add(o.id); else state.selected.delete(o.id); });
      $$('[data-sel]').forEach((cb) => { cb.checked = t.checked; cb.closest('.order').classList.toggle('sel', t.checked); });
      renderToolbars();
    } else if (t.id === 'thStatus') {
      state.filters.status = t.value;
      $('#filterPanel').elements.status.value = t.value;
      state.page = 1;
      render();
    }
  });

  let hoverTimer = 0;
  function showLogPop(a, o) {
    if (!o.events.length || !document.body.contains(a)) return;
    const c = M.CARRIERS[o.carrier];
    const evs = o.events.slice(-3).reverse();
    const p = UI.showPop(a, `<div class="lpop">
        <div class="lpop-h">${ic('truck')}<b>${c.name}</b><span>运单号：${o.trackNo}</span><a data-copy>${ic('copy')}复制</a></div>
        <ul class="tl">${evs.map((ev, i) => `<li class="${i === 0 ? 'now' : ''}"><i></i><p>${esc(ev.text)}</p><time>${M.fmt(ev.t)}</time></li>`).join('')}</ul>
        <a class="lpop-more" data-more>查看全部物流信息${ic('right')}</a></div>`, { place: 'bottom', cls: 'pop-log', hover: true });
    p.querySelector('[data-copy]').addEventListener('click', () => UI.copy(o.trackNo, '运单号已复制'));
    p.querySelector('[data-more]').addEventListener('click', () => { UI.hidePop(true); Dialogs.logistics(o); });
  }
  document.addEventListener('mouseover', (e) => {
    const a = e.target.closest && e.target.closest('.lg-link');
    if (!a || mq.matches) return;
    if (UI.popFor(a)) { UI.keepPop(); return; }
    const host = a.closest('[data-id]');
    const o = host && find(host.dataset.id);
    if (!o) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => showLogPop(a, o), 160);
  });
  document.addEventListener('mouseout', (e) => {
    const a = e.target.closest && e.target.closest('.lg-link');
    if (!a || a.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    if (UI.popFor(a)) UI.schedHidePop();
  });

  $('#orderSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    state.q = $('#q').value;
    state.page = 1;
    render();
    if (state.q.trim()) scrollToList();
  });
  $('#q').addEventListener('input', () => {
    if (!$('#q').value && state.q) { state.q = ''; state.page = 1; render(); }
  });
  $('#moreFilter').addEventListener('click', (e) => {
    e.preventDefault();
    const open = !$('#filterPanel').classList.contains('open');
    $('#filterPanel').classList.toggle('open', open);
    $('#moreFilter').classList.toggle('open', open);
  });
  $('#filterPanel').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const f = Object.fromEntries(fd.entries());
    if (f.from && f.to && f.from > f.to) { toast('开始日期不能晚于结束日期', 'warn'); return; }
    state.filters = f;
    state.q = $('#q').value;
    state.page = 1;
    render();
  });
  $('#filterReset').addEventListener('click', () => {
    $('#filterPanel').reset();
    state.filters = {};
    state.page = 1;
    render();
  });
  $('#topSearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const v = input.value.trim() || input.placeholder;
    toast(`即将为你搜索“${esc(v)}”（演示页面不跳转）`, 'info');
  });
  $('#noticeX').addEventListener('click', (e) => { e.preventDefault(); $('#notice').classList.add('hide'); });
  $('#mSearchBtn').addEventListener('click', (e) => { e.preventDefault(); $('#q').focus(); });
  $('#recRefresh').addEventListener('click', (e) => {
    e.preventDefault();
    const a = e.currentTarget;
    a.classList.remove('spin'); void a.offsetWidth; a.classList.add('spin');
    state.recOffset = (state.recOffset + 5) % M.REC.length;
    renderRec();
  });
  const toTop = $('#toTop');
  addEventListener('scroll', () => toTop.classList.toggle('show', scrollY > 500), { passive: true });
  mq.addEventListener('change', () => { state.page = 1; UI.hidePop(true); render(); renderRec(); });
  wide.addEventListener('change', renderRec);

  /* live countdowns + auto-close of unpaid orders */
  setInterval(() => {
    const now = Date.now();
    $$('[data-cd]').forEach((el) => {
      const t = +el.dataset.t, span = el.querySelector('span');
      span.textContent = el.dataset.cd === 'pay' ? '剩 ' + UI.countdown(t - now) : UI.dayHour(t - now);
    });
    let changed = false;
    state.orders.forEach((o) => {
      if (o.status === 'WAIT_PAY' && o.payDeadline <= now) {
        o.status = 'CLOSED';
        o.closedReason = '超时未付款，交易自动关闭';
        o.closedAt = now;
        changed = true;
        notify({ title: '订单已关闭', tone: 'gray', icon: 'clock', img: Art.url(o.items[0].art), text: `「${short(o.items[0].t, 14)}」超时未付款，交易已自动关闭` });
      }
    });
    if (changed) render();
  }, 1000);

  $$('[data-avatar]').forEach((el) => { el.innerHTML = Art.avatar(); });
  setCart(state.cart);
  render();
  renderRec();
})();
