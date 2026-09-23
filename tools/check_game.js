// Headless play-test for a single-file SVG game.
// Usage: node tools/check_game.js <game.svg|url> <out_dir> [step ...]
// Needs `npm i puppeteer`. Optional env: CHROME=/path/to/chrome, PROXY=http://host:port, VW/VH viewport.
// Steps (run in order, after the page has loaded):
//   wait:MS            sleep
//   press:KEY          keydown+keyup (puppeteer key names: Enter, Space, ArrowLeft, KeyJ, ...)
//   down:KEY / up:KEY  hold / release a key
//   hold:KEY:MS        hold a key for MS milliseconds
//   click:X,Y          click at viewport coordinates
//   shot:NAME          save NAME.png into out_dir
//   fps:MS             measure requestAnimationFrame rate for MS milliseconds
//   eval:JS            evaluate JS in the page and print the result
// A screenshot "00_load.png" is always taken 900 ms after load.
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const CHROME = process.env.CHROME;

// Generated CJK text occasionally comes out as stray control bytes, which breaks XML parsing.
function lintText(buf) {
  const problems = [];
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    return ['FILE IS NOT VALID UTF-8'];
  }
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const m = line.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/);
    if (m) problems.push(`BAD CHAR U+${m[0].charCodeAt(0).toString(16).padStart(4, '0')} at line ${i + 1} col ${m.index + 1}: ${line.trim().slice(0, 120)}`);
  });
  return problems;
}

async function main() {
  const [svgArg, outDir, ...steps] = process.argv.slice(2);
  if (!svgArg || !outDir) {
    console.error('usage: check.sh <game.svg|url> <out_dir> [step ...]');
    process.exit(2);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const url = /^https?:|^file:/.test(svgArg) ? svgArg : 'file://' + path.resolve(svgArg);
  const report = { url, errors: [], console: [], shots: [], fps: [], evals: [] };
  if (!/^https?:|^file:/.test(svgArg)) report.errors.push(...lintText(fs.readFileSync(svgArg)));
  const width = Number(process.env.VW || 1280);
  const height = Number(process.env.VH || 720);

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required',
      process.env.PROXY ? `--proxy-server=${process.env.PROXY}` : '--no-proxy-server', `--window-size=${width},${height}`],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    page.on('pageerror', (e) => report.errors.push(String(e && e.stack || e)));
    page.on('console', (m) => {
      const line = `[${m.type()}] ${m.text()}`;
      if (m.type() === 'error') report.errors.push(line); else report.console.push(line);
    });
    page.on('requestfailed', (r) => report.errors.push(`requestfailed ${r.url()} ${r.failure() && r.failure().errorText}`));
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    // XML well-formedness errors do not raise pageerror; Chrome injects a <parsererror> node instead.
    const parseError = await page.evaluate(() => {
      const n = document.getElementsByTagNameNS('*', 'parsererror')[0];
      return n ? n.textContent.replace(/\s+/g, ' ').trim() : null;
    });
    if (parseError) report.errors.push('XML PARSE ERROR: ' + parseError);
    await new Promise((r) => setTimeout(r, 900));
    const shot = async (name) => {
      const file = path.join(outDir, name + '.png');
      await page.screenshot({ path: file });
      report.shots.push(file);
    };
    await shot('00_load');

    for (const step of steps) {
      const i = step.indexOf(':');
      const op = i < 0 ? step : step.slice(0, i);
      const arg = i < 0 ? '' : step.slice(i + 1);
      if (op === 'wait') await new Promise((r) => setTimeout(r, Number(arg)));
      else if (op === 'press') await page.keyboard.press(arg);
      else if (op === 'down') await page.keyboard.down(arg);
      else if (op === 'up') await page.keyboard.up(arg);
      else if (op === 'hold') {
        const [key, ms] = arg.split(':');
        await page.keyboard.down(key);
        await new Promise((r) => setTimeout(r, Number(ms)));
        await page.keyboard.up(key);
      } else if (op === 'click') {
        const [x, y] = arg.split(',').map(Number);
        await page.mouse.click(x, y);
      } else if (op === 'shot') await shot(arg);
      else if (op === 'fps') {
        const ms = Number(arg || 2000);
        const fps = await page.evaluate((ms) => new Promise((res) => {
          let n = 0; let worst = 0; let last = performance.now(); const t0 = last;
          const tick = (t) => {
            n++; worst = Math.max(worst, t - last); last = t;
            if (t - t0 < ms) requestAnimationFrame(tick);
            else res({ fps: +(n * 1000 / (t - t0)).toFixed(1), worstFrameMs: +worst.toFixed(1) });
          };
          requestAnimationFrame(tick);
        }), ms);
        report.fps.push(fps);
      } else if (op === 'eval') {
        let value;
        try { value = await page.evaluate(arg); } catch (e) { value = 'EVAL ERROR: ' + e.message; }
        report.evals.push({ js: arg, value });
      } else throw new Error('unknown step ' + step);
    }
    report.domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(3); });
