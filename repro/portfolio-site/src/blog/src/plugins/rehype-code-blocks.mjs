import { visit } from 'unist-util-visit';

const el = (tagName, properties = {}, children = []) => ({ type: 'element', tagName, properties, children });
const copyIcon = el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', strokeLinecap: 'round', strokeLinejoin: 'round', ariaHidden: 'true' }, [
  el('rect', { x: '8', y: '8', width: '12', height: '12', rx: '2.5' }),
  el('path', { d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }),
]);

// Wraps Shiki's <pre class="astro-code"> in a header with the language and a "copy code" button,
// at build time so enhancing the button later causes no layout shift.
export function rehypeCodeBlocks() {
  return (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || node.tagName !== 'pre') return undefined;
      // Shiki's hast uses a plain `class` string; hast from other plugins uses a `className` array.
      const props = node.properties || {};
      const cls = props.className ?? props.class ?? [];
      if (!(Array.isArray(cls) ? cls : String(cls).split(/\s+/)).includes('astro-code')) return undefined;
      const lang = String(props.dataLanguage ?? props['data-language'] ?? 'text');
      parent.children[index] = el('div', { className: ['code-block'], dataLang: lang }, [
        el('div', { className: ['code-bar'] }, [
          el('span', { className: ['code-lang'] }, [{ type: 'text', value: lang }]),
          el('button', { type: 'button', className: ['code-copy'], dataCopy: '', ariaLabel: `Copy ${lang} code to clipboard` }, [copyIcon, el('span', { className: ['code-copy-label'] }, [{ type: 'text', value: 'Copy' }])]),
        ]),
        node,
      ]);
      return ['skip', index + 1];
    });
  };
}
