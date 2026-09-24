/* Transaction dialogs: cashier, confirm receipt, cancel, refund, complaint, address, invoice, feedback. */
window.Dialogs = window.Dialogs || {};
(function (D) {
  'use strict';
  const { esc, ic, money, toast } = UI;
  const M = MockData;

  const skuText = (it) => it.sku.map(([k, v]) => `${k}：${v}`).join('　');
  const miniItem = (o, it) => `<div class="mini-item"><img src="${Art.url(it.art)}" alt=""><div><p>${esc(it.t)}</p><span>${esc(skuText(it))}</span></div><b>￥${money(it.price)}<small>×${it.qty}</small></b></div>`;
  const okMark = '<span class="okc"><svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27 l7.5 7.5 L37.5 19"/></svg></span>';

  /* ---------- Alipay cashier ---------- */
  D.pay = function (orders) {
    const total = orders.reduce((s, o) => s + App.payTotal(o), 0);
    const multi = orders.length > 1;
    const methods = [
      { k: 'yeb', name: '余额宝', sub: '可用 ￥12,386.52 · 付款后收益照拿', icon: '宝', c: '#ff8a00' },
      { k: 'hb', name: '花呗', sub: '可用额度 ￥6,800.00', icon: '花', c: '#1677ff', tag: '可分期' },
      { k: 'card', name: '招商银行储蓄卡', sub: '尾号 6688 · 快捷支付', icon: '招', c: '#d6212c' },
      { k: 'bal', name: '账户余额', sub: '￥86.20', icon: '余', c: '#1677ff', off: total > 86.2 },
    ];
    const body = `<div class="cashier">
      <div class="cs-amount"><p>${multi ? `合并付款 · ${orders.length} 笔订单` : esc(App.short(orders[0].items[0].t, 22))}</p>
        <b><small>￥</small>${money(total)}</b><span>收款方：${multi ? '多个卖家（资金由支付宝担保）' : esc(orders[0].shop.name)}</span></div>
      ${multi ? `<ul class="cs-orders">${orders.map((o) => `<li><img src="${Art.url(o.items[0].art)}" alt=""><span>${esc(o.shop.name)}</span><b>￥${money(App.payTotal(o))}</b></li>`).join('')}</ul>` : ''}
      <div class="cs-methods" role="radiogroup" aria-label="付款方式">${methods.map((m, i) => `<label class="pm${m.off ? ' dis' : ''}">
          <input type="radio" name="pm" value="${m.k}" ${i === 0 ? 'checked' : ''} ${m.off ? 'disabled' : ''}>
          <i class="pm-ic" style="--c:${m.c}">${m.icon}</i><span class="pm-t"><b>${m.name}${m.tag ? `<em>${m.tag}</em>` : ''}</b><small>${m.off ? '余额不足' : m.sub}</small></span><span class="pm-r"></span></label>`).join('')}
      </div>
      <div class="cs-pwd"><p>请输入 6 位支付密码<span class="hint">演示：任意 6 位数字</span></p>${UI.pwdField()}</div>
    </div>`;
    const h = UI.modal({
      title: `<span class="alipay-logo"><i>支</i>支付宝</span><span class="cs-sub">收银台</span>`,
      body, width: 470, cls: 'm-pay',
      foot: `<span class="cs-safe">${ic('shield')}支付宝全程担保交易</span><button class="btn btn-alipay btn-lg" data-pay disabled>确认付款</button>`,
    });
    const btn = h.$('[data-pay]');
    let busy = false;
    const pwd = UI.bindPwd(h.el, (v) => {
      btn.disabled = v.length < 6;
      if (v.length === 6) setTimeout(() => { if (pwd.value.length === 6) submit(); }, 280);
    });
    btn.addEventListener('click', submit);
    h.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pwd.value.length === 6) submit(); });
    function submit() {
      if (busy || h.closed) return;
      busy = true;
      const method = methods.find((m) => m.k === h.$('input[name=pm]:checked').value);
      h.setClosable(false);
      h.$('.m-body').innerHTML = '<div class="pay-state"><span class="spinner"></span><p>正在付款，请稍候…</p></div>';
      h.$('.m-foot').innerHTML = '';
      setTimeout(() => {
        App.markPaid(orders);
        h.$('.m-body').innerHTML = `<div class="pay-state ok">${okMark}<p class="big">付款成功</p><p class="amt">￥${money(total)}</p>
          <p class="sub">已使用${method.name}付款 · 卖家将尽快为你发货</p></div>`;
        h.$('.m-foot').innerHTML = '<button class="btn btn-primary btn-lg" data-done>完成</button>';
        h.$('.m-foot').classList.add('center');
        h.$('[data-done]').addEventListener('click', h.close);
        h.setClosable(true);
        setTimeout(() => { if (!h.closed) { h.close(); toast(multi ? `${orders.length} 笔订单付款成功` : '付款成功，可在“待发货”中查看'); } }, 2600);
      }, 1100);
    }
  };

  /* ---------- confirm receipt ---------- */
  D.confirmReceive = function (orders) {
    const total = orders.reduce((s, o) => s + App.payTotal(o), 0);
    const body = `<div class="cr">
      <div class="cr-warn">${ic('warn')}<div><b>请收到货后，再确认收货！否则您可能钱货两空！</b><p>确认收货后，${money(total)} 元货款将直接打给卖家。如有问题可先联系卖家或申请售后。</p></div></div>
      <div class="cr-list">${orders.map((o) => o.items.map((it) => miniItem(o, it)).join('')).join('')}</div>
      <div class="cs-pwd"><p>请输入支付宝支付密码<span class="hint">演示：任意 6 位数字</span></p>${UI.pwdField()}</div>
    </div>`;
    const h = UI.modal({
      title: orders.length > 1 ? `批量确认收货（${orders.length} 笔）` : '确认收货', body, width: 520, cls: 'm-cr',
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok disabled>确定收货</button>',
    });
    const btn = h.$('[data-ok]');
    const pwd = UI.bindPwd(h.el, (v) => { btn.disabled = v.length < 6; });
    h.el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && pwd.value.length === 6) btn.click(); });
    btn.addEventListener('click', () => {
      App.markReceived(orders);
      const single = orders.length === 1 ? orders[0] : null;
      h.$('.m-body').innerHTML = `<div class="pay-state ok">${okMark}<p class="big">交易成功</p><p class="sub">货款 ￥${money(total)} 已打给卖家${single ? '，快去评价赢 10 淘金币吧' : ''}</p></div>`;
      h.$('.m-foot').innerHTML = single ? '<button class="btn btn-line btn-lg" data-done>稍后再说</button><button class="btn btn-primary btn-lg" data-rate>立即评价</button>' : '<button class="btn btn-primary btn-lg" data-done>完成</button>';
      h.$('[data-done]').addEventListener('click', h.close);
      const r = h.$('[data-rate]');
      if (r) r.addEventListener('click', () => { h.close(); D.review(single); });
    });
  };

  /* ---------- generic reason picker ---------- */
  function reasonDialog({ title, tip, reasons, okText = '确定', cancelText = '取消', extra = '', onOk }) {
    const h = UI.modal({
      title, width: 480, cls: 'm-reason',
      body: `<p class="rs-tip">${tip}</p><div class="rs-list">${reasons.map((r, i) => `<label class="rs"><input type="radio" name="rs" value="${esc(r)}" ${i === 0 ? '' : ''}><span>${esc(r)}</span></label>`).join('')}</div>${extra}`,
      foot: `<button class="btn btn-line btn-lg" data-close>${cancelText}</button><button class="btn btn-primary btn-lg" data-ok>${okText}</button>`,
    });
    h.$('[data-ok]').addEventListener('click', () => {
      const r = h.$('input[name=rs]:checked');
      if (!r) { toast('请选择一个原因', 'warn'); h.$('.rs-list').classList.remove('shake'); void h.el.offsetWidth; h.$('.rs-list').classList.add('shake'); return; }
      const ta = h.$('textarea');
      h.close();
      onOk(r.value, ta ? ta.value.trim() : '');
    });
    return h;
  }

  D.cancel = function (o) {
    reasonDialog({
      title: '取消订单', okText: '确定取消', cancelText: '暂不取消',
      tip: '请选择取消订单的原因（必选），订单取消后使用的优惠券将退回你的账户：',
      reasons: ['我不想买了', '信息填写错误，重新拍', '卖家缺货', '同城见面交易', '其他原因'],
      onOk: (r) => App.cancel(o, r),
    });
  };

  D.complain = function (o) {
    reasonDialog({
      title: `投诉卖家 · ${esc(o.shop.name)}`, okText: '提交投诉',
      tip: '请选择投诉原因，淘宝小二会在 3 个工作日内介入处理：',
      reasons: ['商品质量问题', '卖家未按约定时间发货', '卖家服务态度差', '商品与描述不符', '其他问题'],
      extra: '<textarea class="ta" maxlength="200" placeholder="请描述具体问题（选填）"></textarea>',
      onOk: () => toast('投诉已提交，小二将在 3 个工作日内处理'),
    });
  };

  /* ---------- refund / after-sale ---------- */
  const REASONS = {
    '仅退款': ['不想要了', '拍错/多拍', '地址/电话填错了', '协商一致退款', '卖家缺货', '其他'],
    '退货退款': ['七天无理由退换货', '质量问题', '大小/尺寸与描述不符', '颜色/款式与描述不符', '少件/漏发', '其他'],
  };
  D.refund = function (o, idx) {
    const it = o.items[idx];
    const types = o.status === 'WAIT_SHIP' ? ['仅退款'] : o.status === 'WAIT_RECEIVE' ? ['仅退款', '退货退款'] : ['退货退款', '仅退款'];
    const max = it.price * it.qty;
    const opts = (t) => `<option value="">请选择原因</option>${REASONS[t].map((r) => `<option>${r}</option>`).join('')}`;
    const h = UI.modal({
      title: o.status === 'SUCCESS' ? '申请售后' : '申请退款', width: 540, cls: 'm-refund',
      body: `<div class="rf-form">
        ${miniItem(o, it)}
        <div class="rf-row"><label>服务类型</label><div class="seg">${types.map((t, i) => `<a class="${i ? '' : 'on'}" data-type="${t}">${t}</a>`).join('')}</div></div>
        <div class="rf-row"><label>${o.status === 'SUCCESS' ? '申请原因' : '退款原因'}</label><select name="reason">${opts(types[0])}</select></div>
        <div class="rf-row"><label>退款金额</label><div class="rf-amt"><span>￥</span><input type="number" name="amount" step="0.01" min="0.01" max="${max.toFixed(2)}" value="${max.toFixed(2)}"><em>最多 ￥${money(max)}，含运费 ￥0.00</em></div></div>
        <div class="rf-row"><label>补充描述</label><textarea class="ta" maxlength="200" placeholder="补充描述，有助于商家更好地处理售后问题"></textarea></div>
        <p class="rf-tip">${ic('shield')}极速退款：信誉良好的买家提交后，卖家同意即可快速到账（演示中约 5 秒后自动同意）</p>
      </div>`,
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok>提交申请</button>',
    });
    let type = types[0];
    h.$$('.seg a').forEach((a) => a.addEventListener('click', () => {
      h.$$('.seg a').forEach((x) => x.classList.toggle('on', x === a));
      type = a.dataset.type;
      h.$('select').innerHTML = opts(type);
    }));
    h.$('[data-ok]').addEventListener('click', () => {
      const reason = h.$('select').value;
      const amount = Math.round(parseFloat(h.$('input[name=amount]').value) * 100) / 100;
      if (!reason) { toast('请选择退款原因', 'warn'); h.$('select').focus(); return; }
      if (!(amount > 0) || amount > max + 1e-9) { toast(`退款金额需在 0.01 ~ ${money(max)} 之间`, 'warn'); return; }
      h.close();
      App.refundApply(o, idx, { type, reason, amount, desc: h.$('textarea').value.trim() });
    });
  };

  D.refundView = function (o, idx) {
    const it = o.items[idx];
    const base = o.finished || o.paid || o.created;
    const info = it.refundInfo || { type: o.status === 'CLOSED' ? '仅退款' : '退货退款', reason: o.status === 'CLOSED' ? '不想要了' : '七天无理由退换货', amount: it.price * it.qty, at: base + 20 * M.H, doneAt: base + 30 * M.H };
    const done = it.refund === 'REFUNDED';
    const steps = [['买家申请退款', info.at], ['卖家处理申请', done ? info.doneAt - 10 * M.MIN : null], ['退款完成', done ? info.doneAt : null]];
    const cur = done ? 3 : 1;
    const h = UI.modal({
      title: '退款详情', width: 520, cls: 'm-refund',
      body: `<div class="rf-view">
        <div class="rv-banner ${done ? 'ok' : ''}">${ic(done ? 'check' : 'clock')}<div><b>${done ? '退款成功' : '等待卖家处理'}</b><p>${done ? `￥${money(info.amount)} 已原路退回你的支付宝账户` : '卖家同意后款项将原路退回，请耐心等待'}</p></div></div>
        <div class="dt-steps sm">${steps.map((s, i) => `<div class="step ${i < cur ? 'done' : i === cur ? 'cur' : ''}"><i>${i < cur ? ic('check') : i + 1}</i><b>${s[0]}</b><time>${s[1] ? M.fmt(s[1]) : ''}</time></div>`).join('')}</div>
        ${miniItem(o, it)}
        <dl class="kv"><dt>服务类型</dt><dd>${info.type}</dd><dt>退款原因</dt><dd>${esc(info.reason)}</dd><dt>退款金额</dt><dd class="o">￥${money(info.amount)}</dd><dt>申请时间</dt><dd>${M.fmt(info.at)}</dd><dt>退款编号</dt><dd>${o.id.slice(0, 12)}${String(idx + 1).padStart(4, '0')}</dd></dl>
      </div>`,
      foot: '<button class="btn btn-primary btn-lg" data-close>知道了</button>',
    });
    return h;
  };

  /* ---------- change address ---------- */
  D.address = function (o) {
    const h = UI.modal({
      title: '修改收货地址', width: 540, cls: 'm-addr',
      body: `<p class="rs-tip">卖家发货前可修改收货地址，修改后运费不变：</p><div class="addr-list">${M.ADDRESSES.map((a, i) => `<label class="addr${i === o.addr ? ' cur' : ''}">
          <input type="radio" name="addr" value="${i}" ${i === o.addr ? 'checked' : ''}>
          <div><p><b>${a.name}</b><span>${a.phone}</span><em>${a.tag}</em>${i === 0 ? '<em class="def">默认</em>' : ''}</p><p class="gray">${a.region} ${a.detail}</p></div></label>`).join('')}</div>`,
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok>确认修改</button>',
    });
    h.$$('input[name=addr]').forEach((r) => r.addEventListener('change', () => h.$$('.addr').forEach((l) => l.classList.toggle('cur', l.contains(r) && r.checked))));
    h.$('[data-ok]').addEventListener('click', () => {
      const i = +h.$('input[name=addr]:checked').value;
      h.close();
      if (i === o.addr) { toast('收货地址未变化', 'info'); return; }
      App.setAddress(o, i);
      toast('收货地址已修改，卖家将按新地址发货');
    });
  };

  /* ---------- invoice ---------- */
  D.invoice = function (o) {
    const h = UI.modal({
      title: '申请开票', width: 500, cls: 'm-inv',
      body: `<div class="inv">
        <div class="rf-row"><label>发票类型</label><div class="seg"><a class="on">电子普通发票</a><a class="dis" title="该店铺暂不支持">增值税专用发票</a></div></div>
        <div class="rf-row"><label>抬头类型</label><div class="seg" data-kind><a class="on" data-k="p">个人</a><a data-k="c">企业</a></div></div>
        <div class="rf-row"><label>发票抬头</label><input class="ipt" name="title" value="张小橘" maxlength="40"></div>
        <div class="rf-row inv-c" hidden><label>税号</label><input class="ipt" name="tax" placeholder="请输入纳税人识别号" maxlength="20"></div>
        <div class="rf-row"><label>收票邮箱</label><input class="ipt" name="mail" value="xiaoju2026@example.com"></div>
        <div class="rf-row"><label>开票金额</label><b class="o">￥${money(App.payTotal(o))}</b><span class="gray">（商品明细）</span></div>
      </div>`,
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok>提交申请</button>',
    });
    h.$$('[data-kind] a').forEach((a) => a.addEventListener('click', () => {
      h.$$('[data-kind] a').forEach((x) => x.classList.toggle('on', x === a));
      const c = a.dataset.k === 'c';
      h.$('.inv-c').hidden = !c;
      h.$('input[name=title]').value = c ? '' : '张小橘';
      h.$('input[name=title]').placeholder = c ? '请输入企业名称' : '';
    }));
    h.$('.seg .dis').addEventListener('click', () => toast('该店铺暂不支持增值税专用发票', 'info'));
    h.$('[data-ok]').addEventListener('click', () => {
      const title = h.$('input[name=title]').value.trim();
      const mail = h.$('input[name=mail]').value.trim();
      if (!title) { toast('请填写发票抬头', 'warn'); return; }
      if (!h.$('.inv-c').hidden && !/^[0-9A-Z]{15,20}$/i.test(h.$('input[name=tax]').value.trim())) { toast('请填写正确的税号（15-20 位）', 'warn'); return; }
      if (!/^\S+@\S+\.\S+$/.test(mail)) { toast('请填写正确的邮箱', 'warn'); return; }
      h.close();
      App.invoiced(o);
      toast('开票申请已提交，开具后将发送至邮箱');
    });
  };

  /* ---------- feedback ---------- */
  D.feedback = function () {
    const cats = ['页面体验', '订单问题', '物流问题', '功能建议', '其他'];
    const h = UI.modal({
      title: '意见反馈', width: 480, cls: 'm-fb',
      body: `<p class="rs-tip">你的每一条建议，我们都会认真阅读：</p><div class="fb-cats">${cats.map((c, i) => `<a class="rv-tag${i ? '' : ' on'}">${c}</a>`).join('')}</div>
        <textarea class="ta" maxlength="300" placeholder="请描述你遇到的问题或建议（至少 5 个字）"></textarea>`,
      foot: '<button class="btn btn-line btn-lg" data-close>取消</button><button class="btn btn-primary btn-lg" data-ok>提交</button>',
    });
    h.$$('.fb-cats a').forEach((a) => a.addEventListener('click', () => h.$$('.fb-cats a').forEach((x) => x.classList.toggle('on', x === a))));
    h.$('[data-ok]').addEventListener('click', () => {
      if (h.$('textarea').value.trim().length < 5) { toast('请至少输入 5 个字', 'warn'); return; }
      h.close();
      toast('感谢你的反馈，我们会尽快处理！');
    });
  };

  D.miniItem = miniItem;
  D.skuText = skuText;
  D.okMark = okMark;
})(window.Dialogs);
