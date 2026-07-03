import { defineCollections, defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { visit } from 'unist-util-visit';

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    schema: pageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  files: ['**/*.{md,mdx}'],
  schema: pageSchema,
  postprocess: {
    includeProcessedMarkdown: true,
  },
});

/**
 * Rehype plugin: turn ```mermaid code fences into <Mermaid chart="..." />.
 * This lets authors write diagrams in plain Markdown while we render them
 * client-side with the Mermaid component.
 */
function rehypeMermaid() {
  return (tree: any) => {
    visit(tree, 'element', (node: any, index, parent) => {
      if (node.tagName !== 'pre') return;
      const code = node.children?.[0];
      if (!code || code.tagName !== 'code') return;

      const className: string[] = code.properties?.className ?? [];
      if (!className.includes('language-mermaid')) return;

      const text = code.children?.[0]?.value ?? '';
      if (!parent || typeof index !== 'number') return;

      parent.children[index] = {
        type: 'mdxJsxFlowElement',
        name: 'Mermaid',
        attributes: [
          { type: 'mdxJsxAttribute', name: 'chart', value: text },
        ],
        children: [],
      };
    });
  };
}

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (v) => [rehypeMermaid, ...v],
  },
});
