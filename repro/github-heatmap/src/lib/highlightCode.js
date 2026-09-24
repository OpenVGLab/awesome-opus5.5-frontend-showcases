// Tiny syntax highlighter for the source viewer: Vue SFCs (template / script /
// style blocks), plain JavaScript and CSS. Returns one HTML string per line.

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const JS_RULES = [
  ['com', /\/\/[^\n]*|\/\*[\s\S]*?\*\//y],
  ['str', /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/y],
  [
    'key',
    /\b(?:import|from|export|default|const|let|var|function|return|if|else|for|of|in|while|do|switch|case|break|continue|new|typeof|instanceof|async|await|try|catch|finally|throw|class|extends|query)\b/y,
  ],
  ['lit', /\b(?:true|false|null|undefined|this|Infinity|NaN)\b/y],
  ['num', /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/y],
  ['fn', /[A-Za-z_$][\w$]*(?=\s*\()/y],
  [null, /[A-Za-z_$][\w$]*|\s+|[\s\S]/y],
];

function tokenizeJS(src, out) {
  let i = 0;
  while (i < src.length) {
    for (const [cls, re] of JS_RULES) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (m) {
        out.push([cls, m[0]]);
        i += m[0].length;
        break;
      }
    }
  }
}

function tokenizeCSS(src, out) {
  const re = /\/\*[\s\S]*?\*\/|'[^'\n]*'|"[^"\n]*"|@[\w-]+|#[\da-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|s|ms|vh|vw|fr|deg)?\b|-{0,2}[A-Za-z][\w-]*|[{}]|\s+|[\s\S]/y;
  let depth = 0;
  re.lastIndex = 0;
  let m;
  while (re.lastIndex < src.length && (m = re.exec(src))) {
    const t = m[0];
    let cls = null;
    if (t.startsWith('/*')) cls = 'com';
    else if (t[0] === '"' || t[0] === "'") cls = 'str';
    else if (t[0] === '@') cls = 'key';
    else if (t === '{') depth++;
    else if (t === '}') depth = Math.max(0, depth - 1);
    else if (/^#[\da-fA-F]/.test(t) && depth > 0) cls = 'num';
    else if (/^-?\d|^-?\.\d/.test(t)) cls = 'num';
    else if (/^-{0,2}[A-Za-z]/.test(t)) {
      if (depth === 0) cls = 'tag';
      else if (/^\s*:/.test(src.slice(re.lastIndex, re.lastIndex + 8))) cls = 'attr';
    }
    out.push([cls, t]);
  }
}

function tokenizeHTML(src, out) {
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i);
      const j = end < 0 ? src.length : end + 3;
      out.push(['com', src.slice(i, j)]);
      i = j;
    } else if (src[i] === '<' && /[\w/]/.test(src[i + 1] ?? '')) {
      const tag = /^<\/?[\w-]+/.exec(src.slice(i, i + 64));
      out.push(['tag', tag[0]]);
      i += tag[0].length;
      while (i < src.length && src[i] !== '>') {
        const rest = src.slice(i, i + 400);
        const m =
          /^\s+/.exec(rest) ??
          /^"[^"]*"|^'[^']*'/.exec(rest) ??
          /^\/(?=>)/.exec(rest) ??
          /^=/.exec(rest) ??
          /^[^\s=>"'/]+/.exec(rest) ??
          [rest[0]];
        const t = m[0];
        const cls = /^["']/.test(t) ? 'str' : t === '/' ? 'tag' : /^[^\s=]/.test(t) && t !== '=' ? 'attr' : null;
        out.push([cls, t]);
        i += t.length;
      }
      if (src[i] === '>') {
        out.push(['tag', '>']);
        i++;
      }
    } else if (src.startsWith('{{', i)) {
      const end = src.indexOf('}}', i);
      const j = end < 0 ? src.length : end + 2;
      out.push(['exp', src.slice(i, j)]);
      i = j;
    } else {
      let j = i + 1;
      while (j < src.length && src[j] !== '<' && !src.startsWith('{{', j)) j++;
      out.push([null, src.slice(i, j)]);
      i = j;
    }
  }
}

// Top-level SFC blocks are the unindented <template>, <script> and <style> tags.
function tokenizeVue(src, out) {
  const lines = src.split('\n');
  let block = null;
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    const text = `${buffer.join('\n')}\n`;
    if (block === 'script') tokenizeJS(text, out);
    else if (block === 'style') tokenizeCSS(text, out);
    else tokenizeHTML(text, out);
    buffer = [];
  };
  lines.forEach((line, n) => {
    const nl = n < lines.length - 1 ? '\n' : '';
    const open = !block && /^<(template|script|style)\b[^>]*>\s*$/.exec(line);
    if (open) {
      tokenizeHTML(line + nl, out);
      block = open[1];
    } else if (block && line.trim() === `</${block}>` && !/^\s/.test(line)) {
      flush();
      tokenizeHTML(line + nl, out);
      block = null;
    } else if (block) {
      buffer.push(line);
    } else {
      out.push([null, line + nl]);
    }
  });
  flush();
}

export function highlightLines(code, lang) {
  const tokens = [];
  if (lang === 'vue') tokenizeVue(code, tokens);
  else if (lang === 'css') tokenizeCSS(code, tokens);
  else tokenizeJS(code, tokens);

  const lines = [''];
  for (const [cls, text] of tokens) {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push('');
      if (part) lines[lines.length - 1] += cls ? `<span class="tk-${cls}">${escapeHtml(part)}</span>` : escapeHtml(part);
    });
  }
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
