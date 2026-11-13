import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/** A placeholder as the system writes it: {{name}}. */
export const TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const tokenHighlightKey = new PluginKey('notificationTokenHighlight');

export interface TokenHighlightOptions {
  /** The names the event offers. A token with another name is drawn as a mistake, because the server refuses it. */
  allowed: string[] | null;
}

const decorate = (doc: ProseMirrorNode, allowed: string[] | null) => {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    TOKEN_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TOKEN_PATTERN.exec(node.text)) !== null) {
      const known = allowed === null || allowed.includes(match[1]);
      decorations.push(
        Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: known ? 'rt-token' : 'rt-token rt-token-unknown',
          title: known ? undefined : `{{${match[1]}}} is not offered by this notification`,
        }),
      );
    }
  });
  return DecorationSet.create(doc, decorations);
};

/**
 * Draws every {{placeholder}} of the text as a chip (blue when the event offers it, red when it does not) without changing the text:
 * what is stored stays plain {{name}}, so it works the same for the server, the preview and the mail.
 */
export const TokenHighlight = Extension.create<TokenHighlightOptions>({
  name: 'tokenHighlight',

  addOptions() {
    return { allowed: null };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: tokenHighlightKey,
        state: {
          init: (_, { doc }) => decorate(doc, options.allowed),
          apply: (tr, old) => (tr.docChanged || tr.getMeta(tokenHighlightKey) ? decorate(tr.doc, options.allowed) : old),
        },
        props: {
          decorations(state) {
            return tokenHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

/** The names used in a text, in order of first use. */
export const tokensIn = (text: string | null | undefined): string[] => {
  const found: string[] = [];
  if (!text) return found;
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(text)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
};
