/* Mock data: shops, orders, logistics and recommendations. All dates are relative to page load. */
window.MockData = (function () {
  'use strict';
  const NOW = Date.now();
  const MIN = 60e3, H = 60 * MIN, D = 24 * H;
  let seed = 20260924;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const digits = (n) => { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(rnd() * 10); return s; };
  const pad = (n) => String(n).padStart(2, '0');
  function fmt(t, withTime = true) {
    const d = new Date(t);
    const s = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return withTime ? `${s} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` : s;
  }
  const ago = (d = 0, h = 0, m = 0) => NOW - (d * D + h * H + m * MIN) - Math.floor(rnd() * 50e3);

  const SHOPS = {
    xiaomi: { name: '小米官方旗舰店', tmall: true, city: '北京市', abbr: 'MI', color: '#ff6900', agent: '小米客服·米兔' },
    squirrel: { name: '三只松鼠旗舰店', tmall: true, city: '芜湖市', abbr: '松鼠', color: '#d4581a', agent: '鼠小弟' },
    lining: { name: '李宁官方网店', tmall: true, city: '泉州市', abbr: 'LN', color: '#c8102e', agent: '李宁客服·小宁' },
    proya: { name: '珀莱雅官方旗舰店', tmall: true, city: '湖州市', abbr: 'PR', color: '#c0392b', agent: '珀莱雅美妆顾问' },
    senyu: { name: '森屿复古女装', tmall: false, city: '广州市', abbr: '森屿', color: '#3d6db5', agent: '店主阿屿', credit: '2冠' },
    dareu: { name: '达尔优外设旗舰店', tmall: true, city: '深圳市', abbr: 'DU', color: '#2f7fe0', agent: '达尔优·小达' },
    tmsuper: { name: '天猫超市', tmall: true, city: '杭州市', abbr: '超市', color: '#ff0036', agent: '天猫超市客服', local: true },
    huawei: { name: '华为官方旗舰店', tmall: true, city: '东莞市', abbr: 'HW', color: '#cf0a2c', agent: '华为客服·小华' },
    qinghe: { name: '青禾园艺小铺', tmall: false, city: '漳州市', abbr: '青禾', color: '#3a9d4f', agent: '园艺师老周', credit: '3钻' },
    uniqlo: { name: '优衣库官方旗舰店', tmall: true, city: '上海市', abbr: 'UQ', color: '#e60012', agent: '优衣库客服' },
    midea: { name: '美的生活电器旗舰店', tmall: true, city: '佛山市', abbr: 'M', color: '#0a5eb0', agent: '美的服务管家' },
    gannan: { name: '赣南果园鲜果坊', tmall: false, city: '赣州市', abbr: '果园', color: '#ff8c1a', agent: '果农小李', credit: '4钻' },
    perfect: { name: '完美日记官方旗舰店', tmall: true, city: '广州市', abbr: 'PD', color: '#b5121b', agent: '完子心选顾问' },
    xinhua: { name: '新华书店官方旗舰店', tmall: true, city: '南京市', abbr: '新华', color: '#b71c1c', agent: '新华书店客服' },
    thermos: { name: '膳魔师官方旗舰店', tmall: true, city: '上海市', abbr: 'TH', color: '#2f5d8a', agent: '膳魔师客服' },
    royal: { name: '皇家宠物食品旗舰店', tmall: true, city: '上海市', abbr: 'RC', color: '#c8102e', agent: '宠物营养师' },
    philips: { name: '飞利浦个护旗舰店', tmall: true, city: '苏州市', abbr: 'PH', color: '#0b5ed7', agent: '飞利浦客服' },
    paradise: { name: '天堂伞旗舰店', tmall: true, city: '杭州市', abbr: '天堂', color: '#1f3b63', agent: '天堂伞客服' },
    lego: { name: 'LEGO乐高官方旗舰店', tmall: true, city: '嘉兴市', abbr: 'LEGO', color: '#e3000b', agent: '乐高客服' },
    shifeng: { name: '狮峰茶农直营店', tmall: false, city: '杭州市', abbr: '狮峰', color: '#2d7a4f', agent: '茶农阿明', credit: '1冠' },
    latex: { name: '泰乳胶枕源头工厂店', tmall: false, city: '东莞市', abbr: '乳胶', color: '#caa46a', agent: '小泰', credit: '2钻' },
    chaoke: { name: '潮壳数码配件', tmall: false, city: '深圳市', abbr: '潮壳', color: '#6b8fb8', agent: '潮壳客服', credit: '5心' },
    rayban: { name: 'Ray-Ban雷朋官方旗舰店', tmall: true, city: '上海市', abbr: 'RB', color: '#1a1a1a', agent: '雷朋客服' },
    mijia: { name: '米家官方旗舰店', tmall: true, city: '北京市', abbr: '米家', color: '#ff6900', agent: '米家客服' },
    tnf: { name: 'THE NORTH FACE旗舰店', tmall: true, city: '上海市', abbr: 'TNF', color: '#34424a', agent: 'TNF客服' },
    anta: { name: '安踏官方旗舰店', tmall: true, city: '泉州市', abbr: 'ANTA', color: '#d0021b', agent: '安踏客服' },
  };

  const CARRIERS = {
    sf: { name: '顺丰速运', prefix: 'SF', len: 13, tel: '95338', color: '#1a1a1a' },
    zto: { name: '中通快递', prefix: '78', len: 14, tel: '95311', color: '#1f4fa3' },
    yto: { name: '圆通速递', prefix: 'YT', len: 13, tel: '95554', color: '#5a2d82' },
    yd: { name: '韵达快递', prefix: '43', len: 13, tel: '95546', color: '#f6b600' },
    jt: { name: '极兔速递', prefix: 'JT', len: 13, tel: '956025', color: '#e60012' },
    cn: { name: '菜鸟速递', prefix: 'CN', len: 13, tel: '95000', color: '#1e90ff' },
    ems: { name: '中国邮政EMS', prefix: '98', len: 11, tel: '11183', color: '#0a7b3e' },
  };

  const ADDRESSES = [
    { name: '张小橘', phone: '138****6688', region: '浙江省 杭州市 余杭区 五常街道', detail: '文一西路 1001 号 橘子公寓 3 幢 1202 室', tag: '家', city: '杭州市', station: '余杭五常营业部' },
    { name: '张小橘', phone: '138****6688', region: '浙江省 杭州市 西湖区 西溪街道', detail: '文三路 90 号 东部软件园 5 号楼 6 层', tag: '公司', city: '杭州市', station: '西湖文三营业部' },
    { name: '张妈妈', phone: '139****2046', region: '江苏省 苏州市 姑苏区 平江街道', detail: '平江路 88 号 3 单元 501 室', tag: '父母', city: '苏州市', station: '姑苏平江营业部' },
  ];

  const trackNo = (key) => { const c = CARRIERS[key]; return c.prefix + digits(c.len - c.prefix.length); };

  /* Chronological tracking events, trimmed to what "has happened" by `until`. */
  function buildTrack(o, until) {
    const c = CARRIERS[o.carrier];
    const addr = ADDRESSES[o.addr || 0];
    const dest = addr.city, dc = dest.replace('市', ''), oc = o.shop.city.replace('市', '');
    const sameCity = o.shop.city === dest;
    const steps = sameCity ? [
      [0, 'ship', '卖家已发货，包裹已出库'],
      [0.6, 'pick', `【${dest}】${c.name} 已揽收，揽收员：陈师傅`],
      [2, 'transit', `【${dest}】包裹已到达【${dc}分拣中心】`],
      [3.2, 'transit', `【${dest}】包裹已从【${dc}分拣中心】发出，下一站【${addr.station}】`],
      [5, 'deliver', `【${dest}】快递员 王师傅（电话 137****5210）正在为您派送，请保持电话畅通`],
      [8.5, 'sign', `【${dest}】您的快件已签收，签收人：本人签收。感谢使用${c.name}，期待再次为您服务！`],
    ] : [
      [0, 'ship', '卖家已发货，包裹等待揽收'],
      [1.2, 'pick', `【${o.shop.city}】${c.name} 已揽收，揽收员：李师傅`],
      [4, 'transit', `【${o.shop.city}】快件已到达【${oc}转运中心】`],
      [6, 'transit', `【${o.shop.city}】快件已从【${oc}转运中心】发出，下一站【${dc}转运中心】`],
      [19, 'transit', `【${dest}】快件已到达【${dc}转运中心】`],
      [22, 'transit', `【${dest}】快件已从【${dc}转运中心】发出，下一站【${addr.station}】`],
      [27, 'transit', `【${dest}】快件已到达【${addr.station}】`],
      [28, 'deliver', `【${dest}】快递员 王师傅（电话 137****5210）正在为您派送，请保持电话畅通`],
      [31, 'sign', `【${dest}】您的快件已签收，签收人：菜鸟驿站（${addr.station.slice(2, 4)}店），取件码 6-2-3018。如有疑问请联系派件员`],
    ];
    const sp = o.speed || 1;
    return steps
      .map(([h, type, text], i) => ({ t: o.shipped + h * sp * H + (i ? Math.floor(rnd() * 40) * MIN : 0), type, text }))
      .filter((e, i) => i === 0 || e.t <= until);
  }

  const RAW = [
    { shop: 'xiaomi', status: 'WAIT_PAY', created: [0, 0, 12], payWin: 30 * MIN, discount: 20, discountLabel: '店铺满减', flag: '限时秒杀',
      items: [
        { t: 'Redmi Buds 6 Pro 真无线降噪蓝牙耳机 55dB深度主动降噪 小米官方正品', sku: [['颜色分类', '晴雪白']], price: 349, orig: 399, qty: 1, art: { k: 'earbuds' }, tags: ['7天无理由', '极速退款'] },
        { t: '小米 67W 氮化镓充电器套装 USB-C 快充头 适用小米/苹果', sku: [['规格', '67W 套装（含线）']], price: 99, orig: 129, qty: 1, art: { k: 'charger' }, tags: ['7天无理由'] },
      ] },
    { shop: 'squirrel', status: 'WAIT_PAY', created: [0, 2, 6], payWin: 24 * H, discount: 20, discountLabel: '跨店满减',
      items: [
        { t: '三只松鼠 每日坚果750g/30袋 混合果仁孕妇儿童零食大礼包 年货送礼', sku: [['规格', '750g(30袋)'], ['口味', '经典原味']], price: 89.9, orig: 129, qty: 2, art: { k: 'snack' }, tags: ['正品保障'] },
        { t: '三只松鼠 夏威夷果 奶油味 160g×2袋 坚果炒货办公室休闲零食', sku: [['规格', '160g×2袋']], price: 29.9, orig: 39.9, qty: 1, art: { k: 'snack', c: '#8a5a2b', label: '夏威夷果', sub: 'MACADAMIA · 160g' }, tags: [] },
      ] },
    { shop: 'lining', status: 'WAIT_SHIP', created: [0, 5, 3],
      items: [{ t: '李宁超轻21 跑步鞋男鞋2026新款轻量减震回弹竞速训练运动鞋', sku: [['颜色分类', '标准白/荧光橙'], ['鞋码', '42']], price: 399, orig: 569, qty: 1, art: { k: 'sneaker' }, tags: ['7天无理由', '运费险'] }] },
    { shop: 'proya', status: 'WAIT_SHIP', created: [1, 3, 20], note: '麻烦帮忙检查下生产日期，谢谢~',
      items: [{ t: '珀莱雅双抗精华液3.0 抗氧化抗糖化 提亮肤色 精华液女 30ml', sku: [['规格', '30ml 正装']], price: 299, orig: 369, qty: 1, art: { k: 'serum' }, tags: ['正品保障', '假一赔四'] }] },
    { shop: 'senyu', status: 'WAIT_SHIP', created: [2, 5, 41], presale: '预售 · 付款后7天内发货', freight: 0,
      items: [{ t: '法式复古碎花连衣裙女夏2026新款收腰显瘦气质长裙温柔风', sku: [['颜色分类', '雾霾蓝碎花'], ['尺码', 'M']], price: 159, orig: 239, qty: 1, art: { k: 'dress' }, tags: ['7天无理由'] }] },
    { shop: 'dareu', status: 'WAIT_RECEIVE', created: [1, 4, 10], shipAfter: 8 * H, carrier: 'sf',
      items: [{ t: '达尔优A87Pro 三模机械键盘 天空轴V3 热插拔Gasket结构 客制化办公游戏', sku: [['颜色分类', '海盐白-天空轴V3'], ['套餐', '官方标配']], price: 329, orig: 399, qty: 1, art: { k: 'keyboard' }, tags: ['7天无理由', '极速退款'] }] },
    { shop: 'tmsuper', status: 'WAIT_RECEIVE', created: [1, 2, 33], shipAfter: 19 * H, carrier: 'cn', discount: 10, discountLabel: '超市满减',
      items: [
        { t: '维达抽纸 超韧3层120抽×24包 整箱家用卫生纸面巾纸餐巾纸', sku: [['规格', '120抽×24包']], price: 52.9, orig: 69.9, qty: 1, art: { k: 'tissue' }, tags: ['天猫超市', '次日达'] },
        { t: '农夫山泉 饮用天然水 550ml×24瓶 整箱装', sku: [['规格', '550ml×24瓶']], price: 29.9, qty: 2, art: { k: 'water' }, tags: ['天猫超市'] },
      ] },
    { shop: 'huawei', status: 'WAIT_RECEIVE', created: [4, 1, 5], shipAfter: 5 * H, carrier: 'sf',
      items: [{ t: '华为WATCH GT 5 智能手表 运动健康 心率血氧监测 长续航 蓝牙通话', sku: [['颜色分类', '46mm 曜石黑'], ['版本', '氟橡胶表带']], price: 1488, orig: 1588, qty: 1, art: { k: 'watch' }, tags: ['正品保障', '晚发必赔'] }] },
    { shop: 'qinghe', status: 'WAIT_RECEIVE', created: [3, 6, 48], shipAfter: 20 * H, carrier: 'zto', speed: 2.2, freight: 5,
      items: [{ t: '绿萝盆栽 大叶绿萝 室内客厅吸甲醛净化空气 好养易活绿植 带盆', sku: [['规格', '中号 · 含白色陶瓷盆']], price: 29.8, orig: 39.8, qty: 2, art: { k: 'plant' }, tags: ['坏单包赔'] }] },
    { shop: 'uniqlo', status: 'SUCCESS', created: [8, 2, 0], carrier: 'yd', rated: false,
      items: [
        { t: '优衣库 男装 AIRism棉 圆领宽松T恤(五分袖) 460185', sku: [['颜色分类', '09 黑色'], ['尺码', '175/100A(L)']], price: 79, orig: 99, qty: 1, art: { k: 'tshirt', c: '#222222', print: 'badge' }, tags: ['7天无理由'] },
        { t: '优衣库 男装 AIRism棉 圆领宽松T恤(五分袖) 460185', sku: [['颜色分类', '00 白色'], ['尺码', '175/100A(L)']], price: 79, orig: 99, qty: 1, art: { k: 'tshirt', c: '#ffffff', print: 'badge' }, tags: ['7天无理由'] },
      ] },
    { shop: 'midea', status: 'SUCCESS', created: [11, 5, 0], carrier: 'jt', rated: false,
      items: [{ t: '美的空气炸锅 家用5.5L大容量 可视化窗口 智能触控 多功能炸锅', sku: [['颜色分类', '曜石黑 可视款']], price: 259, orig: 399, qty: 1, art: { k: 'airfryer' }, tags: ['正品保障', '以旧换新'] }] },
    { shop: 'gannan', status: 'SUCCESS', created: [13, 8, 0], carrier: 'zto', rated: false,
      items: [{ t: '赣南脐橙 10斤装 当季现摘新鲜水果 甜橙子 精选大果 产地直发', sku: [['规格', '10斤 · 大果(75-80mm)']], price: 39.9, orig: 59.9, qty: 1, art: { k: 'oranges' }, tags: ['坏果包赔', '产地直发'] }] },
    { shop: 'perfect', status: 'SUCCESS', created: [16, 3, 0], carrier: 'yto', rated: false,
      items: [{ t: '完美日记 小细跟口红 丝绒哑光 显白不易掉色 唇膏女', sku: [['颜色分类', 'L03 复古红棕']], price: 69.9, orig: 99, qty: 1, art: { k: 'lipstick' }, tags: ['正品保障'] }] },
    { shop: 'xinhua', status: 'SUCCESS', created: [20, 6, 0], carrier: 'ems', rated: false,
      items: [{ t: '三体全集 刘慈欣 典藏版 全3册 雨果奖获奖作品 科幻小说 正版书籍', sku: [['版本', '典藏版 全3册']], price: 68.5, orig: 93, qty: 1, art: { k: 'books' }, tags: ['正版保障'] }] },
    { shop: 'thermos', status: 'SUCCESS', created: [24, 4, 0], carrier: 'sf', rated: true,
      items: [{ t: '膳魔师保温杯 男女士316不锈钢大容量车载水杯 JNL-502', sku: [['颜色分类', '星空蓝'], ['容量', '500ml']], price: 169, orig: 229, qty: 1, art: { k: 'thermos' }, tags: ['7天无理由'] }] },
    { shop: 'royal', status: 'SUCCESS', created: [29, 2, 0], carrier: 'yd', rated: true, discount: 30, discountLabel: '店铺优惠券',
      items: [{ t: '皇家猫粮 室内成猫粮 I27 2kg 营养均衡 减少毛球', sku: [['规格', '2kg']], price: 189, orig: 219, qty: 2, art: { k: 'petfood' }, tags: ['正品保障'] }] },
    { shop: 'philips', status: 'SUCCESS', created: [35, 7, 0], carrier: 'sf', rated: true,
      items: [
        { t: '飞利浦电动牙刷 HX2431 声波震动 成人软毛 智能计时 情侣款', sku: [['颜色分类', '冰川蓝']], price: 199, orig: 299, qty: 1, art: { k: 'toothbrush' }, tags: ['7天无理由'] },
        { t: '飞利浦 原装替换刷头 HX6063 3支装 适用HX系列', sku: [['规格', '3支装']], price: 129, qty: 1, art: { k: 'brushheads' }, tags: [], refund: 'REFUNDED' },
      ] },
    { shop: 'paradise', status: 'SUCCESS', created: [42, 1, 0], carrier: 'zto', rated: true,
      items: [{ t: '天堂伞 晴雨两用 防晒防紫外线 三折叠 黑胶遮阳伞', sku: [['颜色分类', '藏青']], price: 59, qty: 1, art: { k: 'umbrella' }, tags: ['7天无理由'] }] },
    { shop: 'lego', status: 'SUCCESS', created: [50, 9, 0], carrier: 'sf', rated: true,
      items: [{ t: 'LEGO乐高 经典创意系列 11717 积木盒 拼插积木玩具 儿童礼物', sku: [['规格', '11717 创意积木盒']], price: 299, orig: 369, qty: 1, art: { k: 'bricks' }, tags: ['正品保障'] }] },
    { shop: 'shifeng', status: 'SUCCESS', created: [58, 3, 0], carrier: 'sf', rated: true, appended: true,
      items: [{ t: '2026新茶 西湖龙井 明前特级 绿茶 250g 罐装 杭州茶农直供', sku: [['规格', '250g 罐装']], price: 268, orig: 328, qty: 1, art: { k: 'teatin' }, tags: ['产地直发'] }] },
    { shop: 'latex', status: 'CLOSED', created: [63, 5, 0], closedReason: '买家取消订单（我不想买了）',
      items: [{ t: '泰国天然乳胶枕 护颈椎 助睡眠 成人枕头 单人', sku: [['规格', '波浪按摩款 60×40cm']], price: 89, qty: 2, art: { k: 'pillow' }, tags: [] }] },
    { shop: 'chaoke', status: 'CLOSED', created: [70, 2, 0], closedReason: '超时未付款，交易自动关闭',
      items: [{ t: 'iPhone 17 Pro 手机壳 磁吸MagSafe 液态硅胶 全包防摔', sku: [['颜色分类', '雾霾蓝'], ['适用型号', 'iPhone 17 Pro']], price: 39, qty: 1, art: { k: 'phonecase' }, tags: [] }] },
    { shop: 'rayban', status: 'CLOSED', created: [78, 6, 0], paidClosed: true, closedReason: '退款成功，交易关闭',
      items: [{ t: 'Ray-Ban雷朋太阳镜 飞行员系列 偏光墨镜 RB3025', sku: [['颜色分类', '黑框墨绿偏光'], ['尺寸', '58mm']], price: 1090, orig: 1390, qty: 1, art: { k: 'sunglasses' }, tags: ['正品保障'], refund: 'REFUNDED' }] },
    { shop: 'mijia', status: 'SUCCESS', created: [88, 4, 0], carrier: 'jt', rated: true,
      items: [{ t: '米家LED智能台灯1S增强版 国AA级护眼 学生学习 宿舍卧室', sku: [['颜色分类', '白色']], price: 169, qty: 1, art: { k: 'lamp' }, tags: ['7天无理由'] }] },
    { shop: 'tnf', status: 'SUCCESS', created: [96, 8, 0], carrier: 'sf', rated: true,
      items: [{ t: 'THE NORTH FACE北面双肩包 通勤电脑包 大容量户外旅行背包 26L', sku: [['颜色分类', '沥青灰'], ['容量', '26L']], price: 599, orig: 799, qty: 1, art: { k: 'backpack' }, tags: ['正品保障'] }] },
    { shop: 'anta', status: 'SUCCESS', created: [105, 2, 0], carrier: 'yto', rated: true,
      items: [{ t: '安踏运动卫衣男2026秋季新款 圆领套头 宽松休闲长袖上衣', sku: [['颜色分类', '藏青蓝'], ['尺码', 'XL']], price: 199, orig: 299, qty: 1, art: { k: 'tshirt', c: '#3a4a6b', long: true, print: 'run' }, tags: ['7天无理由'] }] },
  ];

  function makeOrders() {
    return RAW.map((r) => {
      const created = ago(...r.created);
      const o = {
        id: String(2 + Math.floor(rnd() * 3)) + digits(18),
        shopKey: r.shop, shop: SHOPS[r.shop], status: r.status, created,
        items: r.items.map((it) => ({ tags: [], ...it, refund: it.refund || null })),
        freight: r.freight || 0, discount: r.discount || 0, discountLabel: r.discountLabel || '',
        mobile: rnd() > 0.25, presale: r.presale || '', flag: r.flag || '', note: r.note || '',
        carrier: r.carrier || ['sf', 'zto', 'yto', 'yd', 'jt'][Math.floor(rnd() * 5)], speed: r.speed || 1,
        rated: !!r.rated, appended: !!r.appended, reminded: false, extended: false, deleted: false,
        closedReason: r.closedReason || '', addr: 0, events: [],
      };
      o.trackNo = trackNo(o.carrier);
      if (o.status === 'WAIT_PAY') o.payDeadline = created + r.payWin;
      if (o.status !== 'WAIT_PAY' && !(o.status === 'CLOSED' && !r.paidClosed)) o.paid = created + (1 + Math.floor(rnd() * 3)) * MIN;
      if (o.status === 'WAIT_RECEIVE') {
        o.shipped = o.paid + r.shipAfter;
        o.autoConfirm = o.shipped + 10 * D;
        o.events = buildTrack(o, NOW);
      }
      if (o.status === 'SUCCESS') {
        o.shipped = o.paid + (6 + Math.floor(rnd() * 20)) * H;
        o.events = buildTrack(o, Infinity);
        o.finished = o.events[o.events.length - 1].t + (4 + Math.floor(rnd() * 30)) * H;
        if (o.rated) o.review = { stars: 5, text: '' };
      }
      if (o.status === 'CLOSED') o.closedAt = (o.paid || created) + (2 + Math.floor(rnd() * 20)) * H;
      o.alipayNo = fmt(created, false).replace(/-/g, '') + '2200' + digits(20);
      return o;
    });
  }

  const REC = [
    { t: 'Redmi Buds 6 活力版 真无线蓝牙耳机 超长续航 通话降噪', p: 99, sold: '10万+人付款', tm: true, art: { k: 'earbuds', c: '#2a2a2a' } },
    { t: '李宁飞电4 竞速跑鞋 全掌碳板 马拉松训练鞋', p: 999, sold: '5000+人付款', tm: true, art: { k: 'sneaker', c: '#2b2b2b', a: '#ff3b30', s: '#f2f2f2' } },
    { t: '头戴式无线降噪耳机 超长续航 游戏低延迟 可折叠', p: 259, sold: '2万+人付款', art: { k: 'headphones' } },
    { t: '达尔优 A98 三模机械键盘 暗夜黑 客制化 Gasket', p: 399, sold: '8000+人付款', tm: true, art: { k: 'keyboard', c: '#3a3a3a', kc: '#4a4a4a', a: '#ff7a45' } },
    { t: '膳魔师 儿童保温杯 吸管杯 316不锈钢 樱花粉', p: 139, sold: '3万+人付款', tm: true, art: { k: 'thermos', c: '#e98aa6' } },
    { t: '完美日记 镜面唇釉 水光玻璃唇 持久不沾杯', p: 59.9, sold: '6万+人付款', tm: true, art: { k: 'lipstick', c: '#e2556b' } },
    { t: '原创设计 复古格纹连衣裙女 秋冬新款 收腰长裙', p: 199, sold: '1万+人付款', art: { k: 'dress', c: '#a8323e' } },
    { t: '通勤双肩包男女 大容量防泼水 15.6寸电脑包', p: 139, sold: '4万+人付款', art: { k: 'backpack', c: '#b69c7a' } },
    { t: '智能运动手表 NFC 血氧心率 50米防水 长续航', p: 249, sold: '9万+人付款', tm: true, art: { k: 'watch', c: '#111111', s: '#e98aa6' } },
    { t: '秭归脐橙 5斤 新鲜水果 当季现摘 甜过初恋', p: 25.9, sold: '20万+人付款', art: { k: 'oranges' } },
    { t: '乐高 城市系列 积木 创意拼搭 男孩女孩礼物', p: 499, sold: '7000+人付款', tm: true, art: { k: 'bricks' } },
    { t: '全自动晴雨伞 折叠加大加固 男女防晒遮阳伞', p: 49, sold: '15万+人付款', art: { k: 'umbrella', c: '#7a2335' } },
    { t: '福鼎白茶 白牡丹 2020年老白茶 茶叶礼盒装', p: 158, sold: '2000+人付款', art: { k: 'teatin', c: '#8a5a2b' } },
    { t: '重磅纯棉圆领短袖T恤男 260g 宽松百搭 夏季', p: 49, sold: '30万+人付款', art: { k: 'tshirt', c: '#7d8c5a' } },
    { t: '北欧风陶瓷花盆 绿植盆栽 客厅大型 龟背竹', p: 89, sold: '1万+人付款', art: { k: 'plant' } },
    { t: '豆腐猫砂 除臭低尘 可冲厕所 10kg 整箱', p: 49.9, sold: '50万+人付款', tm: true, art: { k: 'petfood', c: '#2f8a45' } },
    { t: '氮化镓 100W 多口快充充电器 笔记本手机通用', p: 169, sold: '3万+人付款', tm: true, art: { k: 'charger' } },
    { t: '偏光太阳镜男 开车专用 防紫外线 飞行员墨镜', p: 128, sold: '6000+人付款', art: { k: 'sunglasses' } },
  ];

  return { NOW, MIN, H, D, SHOPS, CARRIERS, ADDRESSES, REC, fmt, pad, makeOrders, buildTrack, trackNo, rnd };
})();
