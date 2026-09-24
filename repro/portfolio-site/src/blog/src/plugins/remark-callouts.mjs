import { visit } from 'unist-util-visit';

const TITLES = { note: 'Note', tip: 'Tip', warning: 'Warning' };

// Turns GitHub-style `> [!NOTE]`, `> [!TIP]`, `> [!WARNING]` and `> [!QUOTE] Author, Source`
// blockquotes into the same markup as the <Blockquote> component, so plain Markdown posts get the
// custom blockquote styles and variants.
export function remarkCallouts() {
  return (tree) => {
    visit(tree, 'blockquote', (node) => {
      const first = node.children[0];
      const lead = first?.type === 'paragraph' ? first.children[0] : null;
      if (!lead || lead.type !== 'text') return;
      const match = lead.value.match(/^\[!(NOTE|TIP|WARNING|QUOTE)\]([^\n]*)\n?/);
      if (!match) return;

      const variant = match[1].toLowerCase();
      const extra = match[2].trim();
      lead.value = lead.value.slice(match[0].length);
      if (!lead.value) first.children.shift();
      if (!first.children.length) node.children.shift();

      if (variant === 'quote') {
        const quote = { type: 'blockquote', children: node.children, data: { hName: 'blockquote', hProperties: { className: ['bq-body'] } } };
        const cite = extra
          ? [{ type: 'paragraph', children: [{ type: 'text', value: `— ${extra}` }], data: { hName: 'figcaption', hProperties: { className: ['bq-cite'] } } }]
          : [];
        node.children = [quote, ...cite];
        node.data = { hName: 'figure', hProperties: { className: ['bq', 'bq--quote'], dataVariant: 'quote' } };
        return 'skip';
      }

      node.children = [
        { type: 'paragraph', children: [{ type: 'text', value: extra || TITLES[variant] }], data: { hName: 'p', hProperties: { className: ['bq-title'] } } },
        { type: 'blockquote', children: node.children, data: { hName: 'div', hProperties: { className: ['bq-body'] } } },
      ];
      node.data = { hName: 'aside', hProperties: { className: ['bq', `bq--${variant}`], dataVariant: variant, role: 'note' } };
      return 'skip';
    });
  };
}
