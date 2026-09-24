/* Viewing dialogs: order detail, logistics tracking, trade snapshot, review, follow-up review. */
(function (D) {
  'use strict';
  const { esc, ic, money, toast } = UI;
  const M = MockData;

  const tagHTML = (t) => `<span class="tag">${t}</span>`;
  const timeline = (events) => `<ul class="tl big">${events.slice().reverse().map((ev, i) => `<li class="${i === 0 ? 'now' : ''} ev-${ev.type}"><i></i>
      <div><b>${App.EVENT_LABEL[ev.type]}</b><p>${esc(ev.text)}</p><time>${M.fmt(ev.t)}</time></div></li>`).join('')}</ul>`;

  /* ---------- route map ---------- */
  function routeMap(o) {
    const addr = M.ADDRESSES[o.addr];
    const same = o.shop.city === addr.city;
    const from = o.shop.city.replace('市', '') + (same ? '仓' : '');
    const to = addr.city.replace('市', '');
    const towns = [[150, 52], [210, 132], [300, 92], [372, 146], [430, 40], [488, 118], [600, 36], [40, 60]];
    return `<svg viewBox="0 0 640 170" class="route" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs><pattern id="rgrid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#e1eaf4" stroke-width="1"/></pattern>
        <linearGradient id="rbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f9fe"/><stop offset="1" stop-color="#e8f1fa"/></linearGradient>
        <linearGradient id="rgo" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffab3d"/><stop offset="1" stop-color="#ff5000"/></linearGradient></defs>
      <rect width="640" height="170" fill="url(#rbg)"/><rect width="640" height="170" fill="url(#rgrid)"/>
      <path d="M-10 138 C110 118 190 160 310 140 S520 104 650 126" stroke="#d3e5f6" stroke-width="12" fill="none"/>
      <path d="M-10 26 C90 46 170 8 270 30 S470 58 650 20" stroke="#e8eef5" stroke-width="4" fill="none"/>
      ${towns.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#d2dfec"/>`).join('')}
      <path d="M86 118 Q320 -14 554 72" stroke="#c3d2e2" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" fill="none"/>
      <path class="rp" d="M86 118 Q320 -14 554 72" pathLength="100" stroke="url(#rgo)" stroke-width="4" stroke-linecap="round" fill="none" stroke-dasharray="0 200"/>
      <g transform="translate(86 118)"><circle r="7" fill="#fff" stroke="#3b82f6" stroke-width="3"/>
        <rect x="-34" y="14" width="68" height="22" rx="11" fill="#fff" stroke="#dbe6f2"/><text y="29.5" text-anchor="middle" font-size="12" fill="#3c3c3c">发 · ${esc(from)}</text></g>
      <g transform="translate(554 72)"><path d="M0 0 C-10 -12 -12 -18 -12 -22 A12 12 0 1 1 12 -22 C12 -18 10 -12 0 0Z" fill="#ff5000"/><circle cy="-22" r="4.5" fill="#fff"/>
        <rect x="-34" y="10" width="68" height="22" rx="11" fill="#fff" stroke="#ffd3bf"/><text y="25.5" text-anchor="middle" font-size="12" fill="#ff5000">收 · ${esc(to)}</text></g>
      <g class="truck" transform="translate(86 118)"><circle r="15" fill="#ff5000" opacity=".16"/><circle r="11" fill="#ff5000"/>
        <g transform="translate(-7 -7) scale(.58)" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 16V6h11v10"/><path d="M13.5 9.5h4l3 3.3V16h-1.6"/><path d="M8.3 16h6.9"/><circle cx="6.5" cy="16.8" r="1.8"/><circle cx="17" cy="16.8" r="1.8"/></g></g>
    </svg>`;
  }
  function routeProgress(o) {
    const last = o.events[o.events.length - 1];
    if (last.type === 'sign') return 1;
    const same = o.shop.city === M.ADDRESSES[o.addr].city;
    return Math.min(0.9, Math.max(0.05, (o.events.length - 1) / (same ? 5 : 8)));
  }
  function animateRoute(h, p) {
    const path = h.$('.rp'), truck = h.$('.truck');
    if (!path) return;
    const L = path.getTotalLength();
    const t0 = performance.now(), dur = 1200;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const cur = p * (1 - Math.pow(1 - k, 3));
      path.setAttribute('stroke-dasharray', `${(cur * 100).toFixed(2)} 200`);
      const pt = path.getPointAtLength(L * cur);
      truck.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
      if (k < 1 && !h.closed) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- logistics ---------- */
  D.logistics = function (o) {
    if (!o.events.length) { toast('卖家还未发货，暂无物流信息', 'info'); return; }
    const c = M.CARRIERS[o.carrier], addr = M.ADDRESSES[o.addr];
    const last = o.events[o.events.length - 1];
    const h = UI.modal({
      title: '物流详情', width: 640, cls: 'm-log',
      body: `<div class="lg">
        <div class="lg-map">${routeMap(o)}</div>
        <div class="lg-head"><span class="lg-logo" style="--c:${c.color}">${c.name.slice(0, 2)}</span>
          <div class="lg-meta"><b>${c.name}</b><p>运单号 ${o.trackNo}<a data-copy>${ic('copy')}复制</a><span>客服电话 ${c.tel}</span></p></div>
          <span class="lg-st ${last.type}">${App.EVENT_LABEL[last.type]}</span></div>
        <div class="lg-addr">${ic('location')}<span>送至　${addr.name} ${addr.phone}　${addr.region} ${addr.detail}</span></div>
        <div class="lg-goods">${o.items.map((it) => `<img src="${Art.url(it.art)}" alt="" title="${esc(it.t)}">`).join('')}<span>共 ${App.count(o)} 件商品</span></div>
        ${timeline(o.events)}
      </div>`,
    });
    h.$('[data-copy]').addEventListener('click', () => UI.copy(o.trackNo, '运单号已复制'));
    animateRoute(h, routeProgress(o));
  };

  /* ---------- order detail ---------- */
  const STATUS_TIP = {
    WAIT_PAY: (o) => [`等待买家付款`, `请在 ${M.fmt(o.payDeadline)} 前完成付款，逾期订单将自动关闭。`],
    WAIT_SHIP: (o) => [`买家已付款，等待卖家发货`, o.presale ? o.presale.replace('预售 · ', '预售商品：') : '卖家承诺 48 小时内发货，超时未发货可获得赔付。'],
    WAIT_RECEIVE: (o) => [`卖家已发货，等待买家确认`, `还剩 ${UI.dayHour(o.autoConfirm - Date.now())} 自动确认收货，收到货后请及时确认。`],
    SUCCESS: (o) => [`交易成功`, o.rated ? '感谢你的评价，期待再次光临！' : '快去评价吧，你的分享能帮助其他买家。'],
    CLOSED: (o) => [`交易关闭`, `关闭原因：${o.closedReason}`],
  };
  D.detail = function (o) {
    const addr = M.ADDRESSES[o.addr], c = M.CARRIERS[o.carrier];
    const steps = [['拍下商品', o.created], ['付款到支付宝', o.paid], ['卖家发货', o.shipped], ['确认收货', o.finished], ['评价', o.rated ? o.finished + 3 * M.H : null]];
    const done = { WAIT_PAY: 1, WAIT_SHIP: 2, WAIT_RECEIVE: 3, SUCCESS: o.rated ? 5 : 4, CLOSED: o.paid ? 2 : 1 }[o.status];
    const [st, tip] = STATUS_TIP[o.status](o);
    const last = o.events.length ? o.events[o.events.length - 1] : null;
    const act = { WAIT_PAY: ['pay', '立即付款'], WAIT_SHIP: o.reminded ? null : ['remind', '提醒发货'], WAIT_RECEIVE: ['confirm', '确认收货'], SUCCESS: o.rated ? ['rebuy', '再次购买'] : ['rate', '评价'], CLOSED: ['rebuy', '再次购买'] }[o.status];
    const h = UI.modal({
      title: `订单详情<span class="m-sub">订单号 ${o.id}</span>`, width: 880, cls: 'm-detail',
      body: `<div class="dt">
        <div class="dt-steps${o.status === 'CLOSED' ? ' closed' : ''}">${steps.map((s, i) => `<div class="step ${i < done ? 'done' : i === done ? 'cur' : ''}"><i>${i < done ? ic('check') : i + 1}</i><b>${s[0]}</b><time>${i < done && s[1] ? M.fmt(s[1]) : ''}</time></div>`).join('')}</div>
        <div class="dt-status st-${o.status.toLowerCase()}"><div><p class="dt-st">当前订单状态：<b>${st}</b></p><p class="dt-tip">${esc(tip)}</p></div>
          ${act ? `<button class="btn ${act[0] === 'rebuy' ? 'btn-line' : 'btn-primary'} btn-lg" data-dact="${act[0]}">${act[1]}</button>` : ''}</div>
        <div class="dt-grid">
          <section><h4>${ic('location')}收货信息</h4><p><b>${addr.name}</b>　${addr.phone}</p><p class="gray">${addr.region} ${addr.detail}</p></section>
          <section><h4>${ic('truck')}物流信息</h4>${last ? `<p>${c.name}　${o.trackNo}</p><p class="gray clamp2">${esc(last.text)}</p><a data-dact="logistics">查看物流详情 ›</a>` : '<p class="gray">卖家尚未发货</p>'}</section>
          <section><h4>${ic('invoice')}订单信息</h4><dl class="kv">
            <dt>订单编号</dt><dd>${o.id}<a data-copy>复制</a></dd>
            ${o.paid ? `<dt>支付宝交易号</dt><dd>${o.alipayNo}</dd>` : ''}
            <dt>创建时间</dt><dd>${M.fmt(o.created)}</dd>
            ${o.paid ? `<dt>付款时间</dt><dd>${M.fmt(o.paid)}</dd>` : ''}
            ${o.shipped ? `<dt>发货时间</dt><dd>${M.fmt(o.shipped)}</dd>` : ''}
            ${o.finished ? `<dt>成交时间</dt><dd>${M.fmt(o.finished)}</dd>` : ''}
            ${o.closedAt ? `<dt>关闭时间</dt><dd>${M.fmt(o.closedAt)}</dd>` : ''}</dl></section>
          <section><h4>${ic('shop')}卖家信息</h4><p><b>${esc(o.shop.name)}</b>${o.shop.tmall ? '<i class="shop-badge tm">天猫</i>' : ''}</p>
            <p class="gray">${o.shop.credit ? `卖家信用：${o.shop.credit} · ` : ''}发货地：${o.shop.city}</p><a data-dact="chat">${ic('ww')} 联系卖家</a></section>
        </div>
        <table class="dt-items"><thead><tr><th>宝贝</th><th>单价</th><th>数量</th><th>小计</th><th>售后</th></tr></thead><tbody>
          ${o.items.map((it) => `<tr><td><div class="dt-it"><img src="${Art.url(it.art)}" alt=""><div><p>${esc(it.t)}</p><span>${esc(D.skuText(it))}</span></div></div></td>
            <td>${it.orig ? `<del>￥${money(it.orig)}</del>` : ''}￥${money(it.price)}</td><td>${it.qty}</td><td>￥${money(it.price * it.qty)}</td>
            <td>${it.refund === 'REFUNDED' ? '<span class="o">退款成功</span>' : it.refund === 'REFUNDING' ? '<span class="o">退款中</span>' : '—'}</td></tr>`).join('')}
        </tbody></table>
        <div class="dt-foot">${o.note ? `<p class="dt-note">${ic('msg')}买家留言：${esc(o.note)}</p>` : '<span></span>'}
          <div class="dt-sum"><p><span>商品总价</span><b>￥${money(App.goodsTotal(o))}</b></p><p><span>运费</span><b>￥${money(o.freight)}</b></p>
            ${o.discount ? `<p><span>${o.discountLabel}</span><b class="o">-￥${money(o.discount)}</b></p>` : ''}
            <p class="total"><span>${o.status === 'WAIT_PAY' ? '需付款' : '实付款'}</span><b>￥${money(App.payTotal(o))}</b></p></div></div>
      </div>`,
    });
    h.$('[data-copy]').addEventListener('click', () => UI.copy(o.id, '订单号已复制'));
    h.$$('[data-dact]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.dact;
      if (k === 'rebuy') {
        const img = h.$('.dt-it img');
        UI.flyToCart(img, img.src, () => { App.setCart(App.state.cart + App.count(o)); toast(`已将 ${App.count(o)} 件宝贝加入购物车`); });
        return;
      }
      h.close();
      if (k === 'pay') D.pay([o]);
      else if (k === 'remind') App.remind(o);
      else if (k === 'confirm') D.confirmReceive([o]);
      else if (k === 'rate') D.review(o);
      else if (k === 'logistics') D.logistics(o);
      else if (k === 'chat') Chat.open(o);
    }));
  };

  /* ---------- trade snapshot ---------- */
  D.snapshot = function (o, idx) {
    const it = o.items[idx];
    const h = UI.modal({
      title: '交易快照', width: 760, cls: 'm-snap',
      body: `<div class="snap-note">${ic('info')}<span>你现在查看的是<b>交易快照</b>，它记录了宝贝在下单时（${M.fmt(o.created)}）的描述和价格。</span></div>
        <div class="snap-main">
          <div class="snap-img"><img src="${Art.url(it.art)}" alt="${esc(it.t)}"><span class="snap-stamp">快照</span></div>
          <div class="snap-info">
            <h4>${o.shop.tmall ? '<i class="shop-badge tm">天猫</i>' : ''}${esc(it.t)}</h4>
            <div class="snap-price"><span>成交价</span><p><small>￥</small><b>${money(it.price)}</b></p>${it.orig ? `<del>原价 ￥${money(it.orig)}</del>` : ''}</div>
            <dl class="snap-attr">${it.sku.map(([k, v]) => `<dt>${k}</dt><dd><span class="chipb">${esc(v)}</span></dd>`).join('')}
              <dt>数量</dt><dd>${it.qty} 件</dd>
              <dt>服务</dt><dd>${it.tags.length ? it.tags.map(tagHTML).join('') : '<span class="gray">—</span>'}</dd>
              <dt>店铺</dt><dd>${esc(o.shop.name)}<span class="gray">（${o.shop.city}发货）</span></dd></dl>
            <div class="snap-btns"><button class="btn btn-primary btn-lg" data-rebuy>${ic('cart')}再次购买</button><button class="btn btn-line btn-lg" data-chat>${ic('ww')}联系卖家</button></div>
          </div>
        </div>`,
    });
    h.$('[data-rebuy]').addEventListener('click', () => {
      const img = h.$('.snap-img img');
      UI.flyToCart(img, img.src, () => { App.setCart(App.state.cart + it.qty); toast('已加入购物车'); });
    });
    h.$('[data-chat]').addEventListener('click', () => { h.close(); Chat.open(o); });
  };

  /* ---------- review ---------- */
  const RV_TAGS = ['质量很好', '物流很快', '包装完好', '性价比高', '与描述相符', '客服态度好'];
  D.review = function (o) {
    const h = UI.modal({
      title: `评价宝贝<span class="m-sub">${esc(o.shop.name)}</span>`, width: 700, cls: 'm-review',
      body: `<div class="rv">
        ${o.items.map((it, i) => `<div class="rv-item" data-i="${i}">
          <img class="rv-img" src="${Art.url(it.art)}" alt="">
          <div class="rv-main">
            <p class="rv-title">${esc(it.t)}</p><p class="rv-sku">${esc(D.skuText(it))}</p>
            <div class="rv-row"><span>宝贝评分</span>${UI.stars('item' + i, 5)}</div>
            <div class="rv-tags">${RV_TAGS.map((t) => `<a class="rv-tag">${t}</a>`).join('')}</div>
            <div class="rv-ta"><textarea class="ta" maxlength="500" placeholder="宝贝满足你的期待吗？说说它的优点和美中不足的地方吧"></textarea><span class="rv-cnt">0/500</span></div>
            <div class="rv-up"><label class="up-btn">${ic('camera')}<span>晒图</span><input type="file" accept="image/*" multiple hidden></label><div class="up-list"></div>
              <a class="up-demo">${ic('img')}添加示例图</a><span class="up-tip">最多 5 张，晒图评价更有参考价值</span></div>
          </div></div>`).join('')}
        <div class="rv-shop"><h4>店铺评分</h4>
          <div class="rv-row"><span>描述相符</span>${UI.stars('d1', 5)}</div>
          <div class="rv-row"><span>物流服务</span>${UI.stars('d2', 5)}</div>
          <div class="rv-row"><span>服务态度</span>${UI.stars('d3', 5)}</div></div>
      </div>`,
      foot: '<label class="ck"><input type="checkbox" checked name="anon">匿名评价</label><span class="rv-gift">评价完成可得 <b>10</b> 淘金币</span><button class="btn btn-primary btn-lg" data-ok>发表评价</button>',
    });
    UI.bindStars(h.el);
    h.$$('.rv-tag').forEach((a) => a.addEventListener('click', () => a.classList.toggle('on')));
    h.$$('.rv-ta textarea').forEach((ta) => ta.addEventListener('input', () => { ta.nextElementSibling.textContent = `${ta.value.length}/500`; }));
    h.$$('.rv-item').forEach((row) => {
      const list = row.querySelector('.up-list');
      const add = (src) => {
        if (list.children.length >= 5) { toast('最多上传 5 张图片', 'warn'); return; }
        const d = document.createElement('span');
        d.className = 'up-img';
        d.innerHTML = `<img src="${src}" alt=""><a aria-label="删除">${ic('close')}</a>`;
        d.querySelector('a').addEventListener('click', () => d.remove());
        list.appendChild(d);
      };
      row.querySelector('input[type=file]').addEventListener('change', (e) => {
        [...e.target.files].filter((f) => f.type.startsWith('image/')).forEach((f) => {
          const rd = new FileReader();
          rd.onload = () => add(rd.result);
          rd.readAsDataURL(f);
        });
        e.target.value = '';
      });
      row.querySelector('.up-demo').addEventListener('click', () => {
        const it = o.items[+row.dataset.i];
        const bgs = [['#fff7ec', '#f1e2cc'], ['#eef6ff', '#d7e6f7'], ['#f3fbef', '#dcecd3'], ['#fff0f3', '#f4d8df'], ['#f5f5f5', '#e2e2e2']];
        add(Art.url({ ...it.art, bg: bgs[list.children.length % bgs.length] }));
      });
    });
    h.$('[data-ok]').addEventListener('click', () => {
      const items = h.$$('.rv-item').map((row) => {
        const tags = [...row.querySelectorAll('.rv-tag.on')].map((a) => a.textContent);
        const text = row.querySelector('textarea').value.trim();
        return { stars: +row.querySelector('.stars').dataset.val, tags, text: text || (tags.length ? tags.join('，') + '。' : '此用户没有填写评价。'), photos: row.querySelectorAll('.up-img').length };
      });
      const shop = ['d1', 'd2', 'd3'].map((k) => +h.$(`.stars[data-name="${k}"]`).dataset.val);
      const low = items.some((x) => x.stars <= 2);
      h.close();
      App.rated(o, { items, shop, stars: items[0].stars, text: items[0].text, anon: h.$('input[name=anon]').checked });
      toast(low ? '评价已提交，卖家会尽快联系你处理问题' : '评价成功，获得 10 淘金币！');
    });
  };

  D.append = function (o) {
    const r = o.review || { stars: 5, text: '' };
    const h = UI.modal({
      title: '追加评论', width: 560, cls: 'm-review',
      body: `<div class="ap">
        <div class="mini-item"><img src="${Art.url(o.items[0].art)}" alt=""><div><p>${esc(o.items[0].t)}</p><span>${esc(D.skuText(o.items[0]))}</span></div></div>
        <div class="ap-old"><p><span class="ap-stars">${'★'.repeat(r.stars || 5)}${'☆'.repeat(5 - (r.stars || 5))}</span>我的初次评价</p><p class="gray">${esc(r.text || '好评！宝贝收到了，和描述一致，很满意。')}</p></div>
        <div class="rv-ta"><textarea class="ta" maxlength="500" placeholder="用了一段时间，宝贝怎么样？分享一下使用感受吧（至少 5 个字）"></textarea><span class="rv-cnt">0/500</span></div>
      </div>`,
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok>发表追评</button>',
    });
    const ta = h.$('textarea');
    ta.addEventListener('input', () => { ta.nextElementSibling.textContent = `${ta.value.length}/500`; });
    setTimeout(() => ta.focus(), 250);
    h.$('[data-ok]').addEventListener('click', () => {
      if (ta.value.trim().length < 5) { toast('追评内容至少 5 个字', 'warn'); ta.focus(); return; }
      h.close();
      App.appended(o, ta.value.trim());
      toast('追评已发布，感谢分享！');
    });
  };
})(window.Dialogs);
