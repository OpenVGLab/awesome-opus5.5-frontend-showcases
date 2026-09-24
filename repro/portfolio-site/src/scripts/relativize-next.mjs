// Rewrites the Next.js static export so it works from any sub-folder (no absolute /_next/ URLs).
// All Next pages are emitted at the export root (index.html, zh.html, 404.html), so "./_next/" is
// correct for every one of them; CSS files live in _next/static/css/, two levels below static/.
import fs from 'node:fs';
import path from 'node:path';

export function relativizeNextExport(dir) {
  const htmlFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
  for (const file of htmlFiles) {
    const p = path.join(dir, file);
    let html = fs.readFileSync(p, 'utf8');
    html = html.replace(/(["'(])\/_next\//g, '$1./_next/');
    // The pages-router client sets webpack's public path from __NEXT_DATA__.assetPrefix at runtime.
    html = html.replace(
      /(<script id="__NEXT_DATA__" type="application\/json">)(\{.*?\})(<\/script>)/s,
      (_, open, json, close) => {
        const data = JSON.parse(json);
        data.assetPrefix = '.';
        return open + JSON.stringify(data).replace(/</g, '\\u003c') + close;
      },
    );
    fs.writeFileSync(p, html);
  }

  const cssDir = path.join(dir, '_next/static/css');
  if (fs.existsSync(cssDir)) {
    for (const file of fs.readdirSync(cssDir)) {
      if (!file.endsWith('.css')) continue;
      const p = path.join(cssDir, file);
      const css = fs.readFileSync(p, 'utf8').replace(/url\((["']?)\/_next\/static\//g, 'url($1../');
      fs.writeFileSync(p, css);
    }
  }

  const chunkDir = path.join(dir, '_next/static/chunks');
  for (const file of fs.readdirSync(chunkDir)) {
    if (!/^webpack-.*\.js$/.test(file)) continue;
    const p = path.join(chunkDir, file);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/\.p="\/_next\/"/g, '.p="./_next/"'));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  relativizeNextExport(path.resolve(process.argv[2] || 'out'));
  console.log('relativized', process.argv[2] || 'out');
}
