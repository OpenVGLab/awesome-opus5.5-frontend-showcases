// 角色卡: a single 1080×1920 cast card drawn with the same character code (renderCast()).
(function () {
  'use strict';
  const TH = window.TH;
  const { fo, OUT, font, rrect } = TH;
  const W = TH.W;

  const CARDS = [
    { who: 'change', name: '嫦娥（娥姐）', say: '口头禅：注意形象！', lines: ['月宫形象管理大师', '优雅、要面子，一急就破功'] },
    { who: 'rabbit', name: '玉兔 · 团团', say: '口头禅：就一口！', lines: ['麻薯团子兔，右耳总耷拉', '吃货、嘴硬，关键时刻讲义气'] },
    { who: 'kid', name: '人间 · 豆豆', say: '口头禅：妈妈快看！', lines: ['提着兔子灯的好奇宝宝', '眼睛最尖，第一个发现异常'] },
    { who: 'dog', name: '天狗（客串）', say: '口头禅：这锅我不背！', lines: ['背着大铁锅的藏青小狗', '下集主角，专程来澄清'] },
  ];

  function at(ctx, x, y, s, fn) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); fn(); ctx.restore(); }

  function renderCast(ctx) {
    ctx = ctx || TH.ctx;
    const t = 2.0;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    TH.palaceSky(ctx, t, null);
    // header seal
    rrect(ctx, W / 2 - 250, 70, 500, 110, 22); fo(ctx, '#e2433a', OUT, 7);
    rrect(ctx, W / 2 - 237, 83, 474, 84, 16); ctx.strokeStyle = '#ffd98a'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#fff6df'; ctx.font = font(62); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('月宫小剧场 · 角色卡', W / 2, 128);
    const top = 220, h = 410, gap = 14;
    CARDS.forEach((c, i) => {
      const y = top + i * (h + gap);
      const col = TH.WHO[c.who].color;
      rrect(ctx, 48, y + 10, W - 84, h, 36); ctx.fillStyle = 'rgba(10,6,30,0.35)'; ctx.fill();
      rrect(ctx, 40, y, W - 80, h, 36); fo(ctx, '#fffaf2', OUT, 6);
      rrect(ctx, 40, y, 22, h, 11); ctx.fillStyle = col; ctx.fill();
      // text block
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2e2236'; ctx.font = font(58); ctx.fillText(c.name, 330, y + 78);
      ctx.font = font(40);
      const sw = ctx.measureText(c.say).width + 44;
      rrect(ctx, 326, y + 128, sw, 64, 32); fo(ctx, col, OUT, 5);
      ctx.fillStyle = '#fff'; ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 7;
      ctx.strokeText(c.say, 348, y + 162); ctx.fillText(c.say, 348, y + 162);
      ctx.fillStyle = '#5b4a6a'; ctx.font = font(36);
      c.lines.forEach((l, k) => ctx.fillText(l, 332, y + 240 + k * 52));
      // figures
      ctx.save();
      rrect(ctx, 40, y, W - 80, h, 36); ctx.clip();
      if (c.who === 'change') {
        at(ctx, 175, y + 400, 0.56, () => TH.drawChangE(ctx, { time: t, eyes: 'closed', mouth: 'smile', armL: 'mirror', mirror: true, makeup: 1 }));
        at(ctx, 868, y + 396, 0.3, () => TH.drawChangE(ctx, { time: t, eyes: 'shock', mouth: 'scream', armL: 'cover', armR: 'cover', hairUp: 1, pop: 1 }));
        at(ctx, 978, y + 396, 0.3, () => TH.drawChangE(ctx, { time: t, eyes: 'squint', mouth: 'flat', armL: 'hip', armR: 'hip' }));
      } else if (c.who === 'rabbit') {
        at(ctx, 180, y + 385, 0.78, () => TH.drawRabbit(ctx, { eyes: 'sparkle', look: [3, -6], drool: 0.8, arms: 'tiptoe', blush: 1 }));
        at(ctx, 878, y + 392, 0.4, () => TH.drawRabbit(ctx, { eyes: 'happy', cheeks: 1, mouth: 'munch', arms: 'hold', blush: 1 }));
        at(ctx, 982, y + 392, 0.4, () => TH.drawRabbit(ctx, { eyes: 'side', look: [9, 0], cheeks: 0.8, mouth: 'munch', arms: 'behind', sweat: 1 }));
      } else if (c.who === 'kid') {
        at(ctx, 185, y + 400, 0.8, () => TH.drawKid(ctx, { eyes: 'sparkle', mouth: 'o', arm: 'point', time: t }));
        at(ctx, 948, y + 396, 0.5, () => TH.drawKid(ctx, { eyes: 'happy', mouth: 'grin', arm: 'cheer', time: t }));
      } else {
        at(ctx, 185, y + 392, 0.95, () => TH.drawDog(ctx, { talk: 0.7, time: 0.3 }));
      }
      ctx.restore();
    });
    ctx.restore();
  }

  TH.renderCast = renderCast;
})();
