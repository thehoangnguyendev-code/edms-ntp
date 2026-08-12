import React, { useEffect, useRef } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { CodeHighlightNode, CodeNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $insertNodes, $getSelection, $createTextNode, EditorState, createCommand, LexicalCommand } from 'lexical';
import { ToolbarPlugin } from './lexical/ToolbarPlugin';
import './LexicalEditor.css';
import defaultLogo from '@/assets/images/logo_nobg.png';

// Custom command to insert text at cursor
export const INSERT_TEXT_COMMAND: LexicalCommand<string> = createCommand('INSERT_TEXT_COMMAND');

interface LexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  insertText?: string;
  onInsertHandled?: () => void;
  logoUrl?: string;
}

// Plugin: load initial HTML + export on change
function HtmlPlugin({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (value) {
      editor.update(() => {
        const parser = new DOMParser();
        const dom = parser.parseFromString(value, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.select();
        $insertNodes(nodes);
      });
    }
  }, []); // only on mount

  const handleChange = (editorState: EditorState) => {
    editorState.read(() => {
      const htmlString = $generateHtmlFromNodes(editor);
      onChange(htmlString);
    });
  };

  return <OnChangePlugin onChange={handleChange} ignoreSelectionChange />;
}

// Plugin: insert text at cursor when insertText prop changes
function InsertTextPlugin({
  insertText,
  onInsertHandled,
}: {
  insertText?: string;
  onInsertHandled?: () => void;
}) {
  const [editor] = useLexicalComposerContext();
  const prevInsertText = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!insertText || insertText === prevInsertText.current) return;
    prevInsertText.current = insertText;

    editor.update(() => {
      const selection = $getSelection();
      if (selection) {
        const textNode = $createTextNode(insertText);
        selection.insertNodes([textNode]);
      } else {
        // No selection — append to end of root
        const root = $getRoot();
        const lastChild = root.getLastChild();
        if (lastChild) {
          lastChild.selectEnd();
          const textNode = $createTextNode(insertText);
          $getSelection()?.insertNodes([textNode]);
        }
      }
    });

    onInsertHandled?.();
  }, [insertText]);

  return null;
}

const theme = {
  paragraph: 'lexical-paragraph',
  heading: {
    h1: 'lexical-h1',
    h2: 'lexical-h2',
    h3: 'lexical-h3',
  },
  list: {
    nested: { listitem: 'lexical-nested-listitem' },
    ol: 'lexical-list-ol',
    ul: 'lexical-list-ul',
    listitem: 'lexical-listitem',
  },
  link: 'lexical-link',
  text: {
    bold: 'lexical-text-bold',
    italic: 'lexical-text-italic',
    underline: 'lexical-text-underline',
    strikethrough: 'lexical-text-strikethrough',
    code: 'lexical-text-code',
  },
  code: 'lexical-code',
  quote: 'lexical-quote',
};

function onError(error: Error) {
  console.error('Lexical Error:', error);
}

export const LexicalEditor: React.FC<LexicalEditorProps> = ({
  value,
  onChange,
  placeholder = 'Enter content...',
  minHeight = 480,
  insertText,
  onInsertHandled,
  logoUrl,
}) => {
  const effectiveLogo = logoUrl || defaultLogo;

  const initialConfig = {
    namespace: 'EmailTemplateEditor',
    theme,
    onError,
    nodes: [
      HeadingNode, ListNode, ListItemNode, QuoteNode,
      CodeNode, CodeHighlightNode,
      TableNode, TableCellNode, TableRowNode,
      AutoLinkNode, LinkNode,
    ],
  };

  return (
    <div className="lexical-editor-wrapper" style={{ minHeight: `${minHeight}px` }}>
      {/* Logo banner — outside LexicalComposer so it updates when logoUrl changes */}
      <div className="flex justify-center items-center py-4 px-6 border border-slate-200 rounded-t-xl border-b-0 bg-slate-50/50">
        <img
          src={effectiveLogo}
          alt="Email logo"
          className="h-10 w-auto object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
      <LexicalComposer initialConfig={initialConfig}>
        <div className="lexical-editor-container" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <ToolbarPlugin />
          <div className="lexical-editor-inner" style={{ minHeight: `${minHeight}px` }}>
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  className="lexical-content-editable"
                  style={{ minHeight: `${minHeight}px` }}
                />
              }
              placeholder={<div className="lexical-placeholder">{placeholder}</div>}
              ErrorBoundary={() => <div>Error loading editor</div>}
            />
            <HistoryPlugin />
            <LinkPlugin />
            <ListPlugin />
            <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
            <HtmlPlugin value={value} onChange={onChange} />
            <InsertTextPlugin insertText={insertText} onInsertHandled={onInsertHandled} />
          </div>
        </div>
      </LexicalComposer>
    </div>
  );
};
