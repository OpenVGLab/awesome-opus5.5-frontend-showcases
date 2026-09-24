// File import (CSV / TSV / semicolon / whitespace / JSON) and exports (PNG, CSV).
const d3 = window.d3;

const PATTERNS = {
  x: /^(x|lon|lng|long|longitude|easting|east|x_?coord|px)$/i,
  y: /^(y|lat|latitude|northing|north|y_?coord|py)$/i,
  v: /^(value|val|v|z|w|weight|intensity|count|amount|magnitude|mag|temp|temperature|elevation|height|depth|density|score|signal|price)$/i,
};

class Column {
  constructor() {
    this.a = new Float64Array(1 << 16);
    this.n = 0;
  }
  push(v) {
    if (this.n === this.a.length) {
      const b = new Float64Array(this.a.length * 2);
      b.set(this.a);
      this.a = b;
    }
    this.a[this.n++] = v;
  }
  take() {
    return this.a.slice(0, this.n);
  }
}

const num = (s) => (s == null || (typeof s === 'string' && s.trim() === '') ? NaN : +s);
const clean = (s) => String(s).trim().replace(/^["']|["']$/g, '');

// Choose the x / y / value columns by name, falling back to the numeric columns left to right.
function pickColumns(names, sample) {
  const taken = [];
  const find = (re) => {
    const i = names.findIndex((n, j) => !taken.includes(j) && re.test(clean(n)));
    if (i >= 0) taken.push(i);
    return i;
  };
  const picks = [find(PATTERNS.x), find(PATTERNS.y), find(PATTERNS.v)];
  const numeric = names
    .map((_, i) => i)
    .filter((i) => !taken.includes(i) && (!sample || Number.isFinite(num(sample[i]))));
  const cols = picks.map((c) => (c >= 0 ? c : numeric.shift()));
  if (cols.some((c) => c === undefined)) {
    throw new Error('need three numeric columns (x, y, value)');
  }
  return cols;
}

function labelsFrom(names, cols) {
  const fallback = ['x', 'y', 'value'];
  return cols.map((c, i) => (names && names[c] != null && clean(names[c]) ? clean(names[c]) : fallback[i]));
}

function parseDelimited(text) {
  const firstLine = (text.match(/^[^\r\n]*/) || [''])[0];
  const counts = [',', '\t', ';', '|']
    .map((d) => [d, firstLine.split(d).length - 1])
    .sort((a, b) => b[1] - a[1]);
  const delim = counts[0][1] > 0 ? counts[0][0] : null;
  const X = new Column();
  const Y = new Column();
  const V = new Column();
  let cols = null;
  let header = null;
  let pendingHeader = null;
  let skipped = 0;

  const onRow = (row) => {
    if (!row.length || (row.length === 1 && row[0].trim() === '')) return;
    if (String(row[0]).trim().startsWith('#')) return;
    if (!cols) {
      const isHeader = row.some((s) => s.trim() !== '' && !Number.isFinite(num(s)));
      if (isHeader && !pendingHeader) {
        pendingHeader = row;
        return;
      }
      header = pendingHeader;
      cols = header ? pickColumns(header, row) : pickColumns(row.map((_, i) => `c${i}`), row);
    }
    const x = num(row[cols[0]]);
    const y = num(row[cols[1]]);
    const v = num(row[cols[2]]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(v)) {
      X.push(x);
      Y.push(y);
      V.push(v);
    } else skipped++;
  };

  if (delim) {
    d3.dsvFormat(delim).parseRows(text, (row) => {
      onRow(row);
      return null;
    });
  } else {
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (t) onRow(t.split(/\s+/));
    }
  }
  if (!cols) throw new Error('no numeric rows found');
  return { x: X.take(), y: Y.take(), v: V.take(), n: X.n, skipped, labels: labelsFrom(header, cols) };
}

function parseJSON(obj) {
  if (!Array.isArray(obj)) {
    if (obj && typeof obj === 'object') {
      for (const key of ['data', 'points', 'values', 'rows', 'features']) {
        if (Array.isArray(obj[key])) return parseJSON(obj[key]);
      }
      const keys = Object.keys(obj).filter((k) => Array.isArray(obj[k]));
      if (keys.length >= 3) {
        const cols = pickColumns(keys, keys.map((k) => obj[k][0]));
        const [ax, ay, av] = cols.map((i) => obj[keys[i]]);
        const X = new Column();
        const Y = new Column();
        const V = new Column();
        let skipped = 0;
        const n = Math.min(ax.length, ay.length, av.length);
        for (let i = 0; i < n; i++) {
          const x = num(ax[i]);
          const y = num(ay[i]);
          const v = num(av[i]);
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(v)) {
            X.push(x);
            Y.push(y);
            V.push(v);
          } else skipped++;
        }
        return { x: X.take(), y: Y.take(), v: V.take(), n: X.n, skipped, labels: labelsFrom(keys, cols) };
      }
    }
    throw new Error('expected an array of [x, y, value] rows or {x, y, value} objects');
  }
  const first = obj.find((d) => d != null);
  if (first == null) throw new Error('the array is empty');
  const X = new Column();
  const Y = new Column();
  const V = new Column();
  let skipped = 0;
  let get;
  let labels = ['x', 'y', 'value'];
  if (Array.isArray(first)) {
    get = (d, i) => d[i];
  } else if (typeof first === 'object') {
    // GeoJSON points: coordinates are x / y, the first numeric property is the value.
    if (first.type === 'Feature' && first.geometry && first.properties) {
      const prop = Object.keys(first.properties).find((k) => Number.isFinite(num(first.properties[k])));
      if (!prop) throw new Error('GeoJSON features need a numeric property for the value');
      labels = ['longitude', 'latitude', prop];
      get = (d, i) => (i < 2 ? d.geometry && d.geometry.coordinates && d.geometry.coordinates[i] : d.properties && d.properties[prop]);
    } else {
      const keys = Object.keys(first);
      const cols = pickColumns(keys, keys.map((k) => first[k]));
      const names = cols.map((c) => keys[c]);
      labels = labelsFrom(keys, cols);
      get = (d, i) => d[names[i]];
    }
  } else throw new Error('expected rows as arrays or objects');
  for (const d of obj) {
    if (d == null) {
      skipped++;
      continue;
    }
    const x = num(get(d, 0));
    const y = num(get(d, 1));
    const v = num(get(d, 2));
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(v)) {
      X.push(x);
      Y.push(y);
      V.push(v);
    } else skipped++;
  }
  return { x: X.take(), y: Y.take(), v: V.take(), n: X.n, skipped, labels };
}

export function parseText(text) {
  const s = text.replace(/^\uFEFF/, '');
  const head = s.trimStart()[0];
  const parsed = head === '[' || head === '{' ? parseJSON(JSON.parse(s)) : parseDelimited(s);
  if (parsed.n < 3) throw new Error('found fewer than 3 valid [x, y, value] rows');
  return parsed;
}

export function toDataset(parsed, fileName) {
  const { x, y, v, n } = parsed;
  let X0 = Infinity;
  let X1 = -Infinity;
  let Y0 = Infinity;
  let Y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    if (x[i] < X0) X0 = x[i];
    if (x[i] > X1) X1 = x[i];
    if (y[i] < Y0) Y0 = y[i];
    if (y[i] > Y1) Y1 = y[i];
  }
  if (!(X1 > X0)) {
    X0 -= 0.5;
    X1 += 0.5;
  }
  if (!(Y1 > Y0)) {
    Y0 -= 0.5;
    Y1 += 0.5;
  }
  const [lx, ly, lv] = parsed.labels;
  return {
    key: 'file',
    name: fileName,
    desc: `Imported from ${fileName}: ${d3.format(',')(n)} rows` + (parsed.skipped ? `, ${d3.format(',')(parsed.skipped)} skipped.` : '.'),
    n,
    x,
    y,
    v,
    X0,
    X1,
    Y0,
    Y1,
    labels: { x: lx, y: ly, v: lv, unit: '' },
    equalAspect: false,
    shuffled: false,
  };
}

// A subsample of the current dataset in the exact format the importer expects.
export function sampleCSV(ds, max) {
  const n = Math.min(ds.n, max);
  const step = ds.n / n;
  const lines = ['x,y,value'];
  for (let i = 0; i < n; i++) {
    const j = ds.shuffled ? i : Math.floor(i * step);
    lines.push(`${+ds.x[j].toFixed(4)},${+ds.y[j].toFixed(4)},${+ds.v[j].toPrecision(6)}`);
  }
  return lines.join('\n') + '\n';
}

export function toCSV(header, rows) {
  const cell = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? String(+v.toPrecision(7)) : '') : `"${String(v).replace(/"/g, '""')}"`);
  return [header.join(','), ...rows.map((r) => r.map(cell).join(','))].join('\n') + '\n';
}

// Canvas layer + serialised SVG layer (axes, legend, profiles) composited into one PNG.
export async function exportPNG(canvas, svgNode, W, H, background) {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0);
  const clone = svgNode.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', W);
  clone.setAttribute('height', H);
  clone.querySelectorAll('[data-export="skip"]').forEach((n) => n.remove());
  const src = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  await img.decode();
  ctx.drawImage(img, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas is empty'))), 'image/png'),
  );
}

export function download(blob, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
