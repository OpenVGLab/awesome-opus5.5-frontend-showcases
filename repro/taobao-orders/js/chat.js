/* Wangwang-style chat window with canned seller / customer-service replies. */
window.Chat = (function () {
  'use strict';
  const { esc, ic } = UI;
  let el = null, cur = null, order = null, isService = false, replyTimer = 0;

  const SHOP_REPLIES = [
    [/发货|什么时候|多久|几天/, (o) => (o && o.status === 'WAIT_SHIP' ? '亲，您的宝贝已经在仓库打包啦，48 小时内一定为您发出，发货后物流信息会实时同步哦~' : '亲，本店下单后 48 小时内发货，节假日也不休息哦~')],
    [/物流|快递|到哪|运单|包裹/, (o) => (o && o.events.length ? `亲，帮您查到包裹最新动态：${o.events[o.events.length - 1].text}` : '亲，订单发货后就能查看物流啦，请耐心等待哦~')],
    [/退|换|售后|质量/, () => '亲，本店支持 7 天无理由退换，在订单页点击“申请售后”提交即可，小店会第一时间为您处理~'],
    [/尺码|大小|码数|多大/, () => '亲，建议参考详情页尺码表：身高 170-175cm、体重 60-70kg 一般选 L 码哦~'],
    [/便宜|优惠|券|降价|价格|活动/, () => '亲，店铺首页可以领取满 199 减 20 的优惠券，关注店铺还有粉丝专享价哦~'],
    [/发票|开票/, () => '亲，本店支持开具电子普通发票，在订单页点击“申请开票”即可~'],
    [/谢|好的|ok|嗯|可以/i, () => '不客气哦亲，祝您购物愉快，有问题随时找我~ (｡･ω･｡)ﾉ♡'],
    [/你好|在吗|hi|hello|哈喽/i, () => '在的亲，请问有什么可以帮您？'],
  ];
  const SVC_REPLIES = [
    [/退款|退货|售后/, () => '在「已买到的宝贝」中找到对应订单，点击商品旁的“申请退款 / 申请售后”，按提示填写原因和金额即可~'],
    [/地址/, () => '卖家发货前，在订单“交易操作”栏点击“修改地址”，就可以更换收货地址啦~'],
    [/回收站|删除|还原/, () => '点击订单列表右上角的“订单回收站”，可以还原或永久删除已删除的订单哦~'],
    [/人工|转接/, () => '正在为您转接人工客服，当前排队 2 人，预计等待 1 分钟，请稍候…'],
    [/付款|支付|合并/, () => '勾选多个“待付款”订单后点击“合并付款”，可以一次付清哦~'],
    [/谢|好的|ok/i, () => '很高兴为您服务，祝您生活愉快！'],
  ];
  const DEFAULT = '亲，您的问题已收到，小二正在火速为您查询，请稍等哦~';
  const clock = () => { const d = new Date(); return `${UI.pad(d.getHours())}:${UI.pad(d.getMinutes())}`; };

  function push(who, html, shop) {
    const box = el.querySelector('.ww-msgs');
    const m = document.createElement('div');
    m.className = `msg ${who}`;
    m.innerHTML = who === 'me'
      ? `<div class="bubble">${html}</div><span class="av me">${Art.avatar()}</span>`
      : `<span class="av" style="--c:${shop.color}">${esc(shop.abbr)}</span><div class="bubble">${html}</div>`;
    box.appendChild(m);
    box.scrollTop = box.scrollHeight;
    return m;
  }

  function botSay(text, shop) {
    const typing = push('bot typing', '<i></i><i></i><i></i>', shop);
    clearTimeout(replyTimer);
    replyTimer = setTimeout(() => {
      if (!el || !typing.isConnected) return;
      typing.classList.remove('typing');
      typing.querySelector('.bubble').innerHTML = esc(text);
      const box = el.querySelector('.ww-msgs');
      box.scrollTop = box.scrollHeight;
    }, 650 + Math.min(900, text.length * 12));
  }

  function close(now) {
    clearTimeout(replyTimer);
    if (!el) return;
    const w = el;
    el = null;
    cur = null;
    if (now) w.remove();
    else { w.classList.remove('show'); setTimeout(() => w.remove(), 250); }
  }

  function open(o) {
    const key = o ? o.id : 'svc';
    if (el && cur === key) { el.classList.remove('min'); el.querySelector('textarea').focus(); return; }
    close(true);
    cur = key;
    order = o;
    isService = !o;
    const shop = o ? o.shop : { name: '淘宝官方客服', abbr: '小蜜', color: '#ff5000', agent: '阿里小蜜' };
    const quick = o ? ['什么时候发货？', '查看物流', '怎么退换货？', '有优惠券吗？'] : ['怎么申请退款？', '如何修改收货地址？', '订单回收站在哪？', '转人工'];
    el = document.createElement('div');
    el.className = 'ww';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `与${shop.name}聊天`);
    el.innerHTML = `<div class="ww-head">
        <span class="ww-av" style="--c:${shop.color}">${esc(shop.abbr)}</span>
        <div class="ww-name"><b>${esc(shop.name)}</b><span><i></i>${esc(shop.agent)} · 在线</span></div>
        <a class="ww-btn" data-min title="最小化" aria-label="最小化">${ic('min')}</a><a class="ww-btn" data-x title="关闭" aria-label="关闭">${ic('close')}</a></div>
      ${o ? `<div class="ww-order"><img src="${Art.url(o.items[0].art)}" alt=""><div><p>${esc(o.items[0].t)}</p><span>订单号 ${o.id} · <em>${App.STATUS[o.status].text}</em></span></div></div>` : ''}
      <div class="ww-msgs"><p class="ww-time">今天 ${clock()}</p></div>
      <div class="ww-quick">${quick.map((q) => `<a>${q}</a>`).join('')}</div>
      <div class="ww-input"><textarea rows="2" maxlength="300" placeholder="请输入消息，按 Enter 发送" aria-label="消息"></textarea><button class="btn btn-primary btn-sm" data-send>${ic('send')}发送</button></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el && el.classList.add('show')));

    const ta = el.querySelector('textarea');
    const send = (text) => {
      text = text.trim();
      if (!text) return;
      push('me', esc(text));
      ta.value = '';
      const r = (isService ? SVC_REPLIES : SHOP_REPLIES).find(([re]) => re.test(text));
      botSay(r ? r[1](order) : DEFAULT, shop);
    };
    el.querySelector('[data-send]').addEventListener('click', () => send(ta.value));
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(ta.value); } });
    el.querySelectorAll('.ww-quick a').forEach((a) => a.addEventListener('click', () => send(a.textContent)));
    el.querySelector('[data-x]').addEventListener('click', () => close());
    el.querySelector('[data-min]').addEventListener('click', () => el.classList.toggle('min'));
    el.querySelector('.ww-head').addEventListener('dblclick', () => el.classList.toggle('min'));
    const greet = o ? `亲，您好，欢迎光临${o.shop.name}~ 我是${o.shop.agent}，有什么可以帮您的吗？` : '您好，我是阿里小蜜，请问遇到了什么问题？可以点下方的常见问题快速咨询~';
    setTimeout(() => { if (el && cur === key) botSay(greet, shop); }, 300);
    setTimeout(() => ta.focus(), 350);
  }

  return { open, close };
})();
