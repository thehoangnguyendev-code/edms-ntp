import { trFormat as __ariaTrFormat } from "@/i18n";
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Palette,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { TokenHighlight, tokenHighlightKey } from './tokenHighlight';
import './RichTextEditor.css';
import { tr } from "@/i18n";

/**
 * The editor of the wording of a notification (TipTap, the same engine as the Text-editor-react project the owner asked for, reduced to what a
 * message needs: text style, lists, links, tables, colour). No pages, comments or sharing: a message is not a document.
 * The value is HTML; a {{placeholder}} stays plain text in it and is only drawn as a chip.
 */
export interface RichTextEditorHandle {
  /** Puts text (a placeholder) where the cursor is. */
  insertText: (text: string) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** The placeholders the event offers; others are drawn as mistakes. Null: any. */
  allowedTokens?: string[] | null;
  placeholder?: string;
  disabled?: boolean;
  onFocus?: () => void;
  ariaLabel?: string;
  className?: string;
}

const TEXT_COLOURS = ['#0f172a', '#475569', '#dc2626', '#d97706', '#059669', '#2563eb', '#7c3aed'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca'];

const EMPTY_DOC = '<p></p>';
const clean = (html: string) => (html === EMPTY_DOC ? '' : html);

const ToolbarButton: React.FC<{
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, active, disabled, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-pressed={active}
    disabled={disabled}
    // keep the selection in the editor when a button is pressed
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      'inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40',
      active && 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
    )}
  >
    {children}
  </button>
);

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />;

const Swatches: React.FC<{ label: string; colours: string[]; onPick: (colour: string | null) => void; children: React.ReactNode }> = ({ label, colours, onPick, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={open}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        {children}
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-9 z-20 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          {colours.map((colour) => (
            <button
              key={colour}
              type="button"
              role="menuitem"
              aria-label={`${label} ${colour}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onPick(colour);
                setOpen(false);
              }}
              className="h-5 w-5 rounded-full border border-slate-200"
              style={{ background: colour }}
            />
          ))}
          <button
            type="button"
            role="menuitem"
            aria-label={__ariaTrFormat("Remove {v1}", { v1: label.toLowerCase() })}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="ml-1 rounded px-1.5 text-xs text-slate-500 hover:bg-slate-100"
          >
            {tr("None")}
          </button>
        </div>
      )}
    </div>
  );
};

const LinkControl: React.FC<{ editor: Editor; active: boolean }> = ({ editor, active }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const apply = () => {
    const address = url.trim();
    if (!address) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else if (/^https?:\/\//i.test(address) || address.startsWith('{{')) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: address }).run();
    } else {
      return; // only web addresses (or a placeholder that becomes one)
    }
    setOpen(false);
  };
  return (
    <div className="relative">
      <ToolbarButton
        label={tr("Link")}
        active={active}
        onClick={() => {
          setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
          setOpen((v) => !v);
        }}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      {open && (
        <div className="absolute left-0 top-9 z-20 flex w-72 items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <input
            autoFocus
            aria-label={tr("Link address")}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="https://… or {{actionUrl}}"
            className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 px-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button type="button" onClick={apply} className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
            {tr("Apply")}
          </button>
        </div>
      )}
    </div>
  );
};

const Toolbar: React.FC<{ editor: Editor; disabled?: boolean }> = ({ editor, disabled }) => {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      inTable: e.isActive('table'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      heading: e.isActive('heading', { level: 1 }) ? '1' : e.isActive('heading', { level: 2 }) ? '2' : e.isActive('heading', { level: 3 }) ? '3' : '0',
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (fn: () => void) => () => {
    if (!disabled) fn();
  };
  return (
    <div role="toolbar" aria-label={tr("Text formatting")} className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5">
      <ToolbarButton label={tr("Undo")} disabled={disabled || !s.canUndo} onClick={run(() => editor.chain().focus().undo().run())}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Redo")} disabled={disabled || !s.canRedo} onClick={run(() => editor.chain().focus().redo().run())}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <select
        aria-label={tr("Text style")}
        disabled={disabled}
        value={s.heading}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run();
        }}
        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-emerald-500 focus:outline-none"
      >
        <option value="0">{tr("Paragraph")}</option>
        <option value="1">{tr("Heading 1")}</option>
        <option value="2">{tr("Heading 2")}</option>
        <option value="3">{tr("Heading 3")}</option>
      </select>
      <Divider />
      <ToolbarButton label={tr("Bold")} active={s.bold} disabled={disabled} onClick={run(() => editor.chain().focus().toggleBold().run())}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Italic")} active={s.italic} disabled={disabled} onClick={run(() => editor.chain().focus().toggleItalic().run())}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Underline")} active={s.underline} disabled={disabled} onClick={run(() => editor.chain().focus().toggleUnderline().run())}>
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Strikethrough")} active={s.strike} disabled={disabled} onClick={run(() => editor.chain().focus().toggleStrike().run())}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <Swatches label={tr("Text colour")} colours={TEXT_COLOURS} onPick={(c) => (c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run())}>
        <Palette className="h-4 w-4" />
      </Swatches>
      <Swatches label={tr("Highlight")} colours={HIGHLIGHTS} onPick={(c) => (c ? editor.chain().focus().setHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run())}>
        <Highlighter className="h-4 w-4" />
      </Swatches>
      <Divider />
      <ToolbarButton label={tr("Bulleted list")} active={s.bullet} disabled={disabled} onClick={run(() => editor.chain().focus().toggleBulletList().run())}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Numbered list")} active={s.ordered} disabled={disabled} onClick={run(() => editor.chain().focus().toggleOrderedList().run())}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Quote")} active={s.quote} disabled={disabled} onClick={run(() => editor.chain().focus().toggleBlockquote().run())}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <ToolbarButton label={tr("Align left")} active={s.left} disabled={disabled} onClick={run(() => editor.chain().focus().setTextAlign('left').run())}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Align centre")} active={s.center} disabled={disabled} onClick={run(() => editor.chain().focus().setTextAlign('center').run())}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Align right")} active={s.right} disabled={disabled} onClick={run(() => editor.chain().focus().setTextAlign('right').run())}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <Divider />
      <LinkControl editor={editor} active={s.link} />
      <ToolbarButton label={tr("Remove link")} disabled={disabled || !s.link} onClick={run(() => editor.chain().focus().extendMarkRange('link').unsetLink().run())}>
        <Link2Off className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Insert table")} disabled={disabled || s.inTable} onClick={run(() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run())}>
        <Table2 className="h-4 w-4" />
      </ToolbarButton>
      {s.inTable && (
        <>
          <ToolbarButton label={tr("Add row")} disabled={disabled} onClick={run(() => editor.chain().focus().addRowAfter().run())}>
            <span className="text-[11px] font-semibold">{tr("+Row")}</span>
          </ToolbarButton>
          <ToolbarButton label={tr("Add column")} disabled={disabled} onClick={run(() => editor.chain().focus().addColumnAfter().run())}>
            <span className="text-[11px] font-semibold">{tr("+Col")}</span>
          </ToolbarButton>
          <ToolbarButton label={tr("Delete table")} disabled={disabled} onClick={run(() => editor.chain().focus().deleteTable().run())}>
            <Trash2 className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}
      <ToolbarButton label={tr("Divider line")} disabled={disabled} onClick={run(() => editor.chain().focus().setHorizontalRule().run())}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label={tr("Clear formatting")} disabled={disabled} onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())}>
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
};

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { value, onChange, allowedTokens = null, placeholder, disabled, onFocus, ariaLabel, className },
  ref,
) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      TokenHighlight.configure({ allowed: allowedTokens }),
    ],
    // the allowed names are applied through a transaction below, so the editor is not rebuilt when they arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: value || '',
    editable: !disabled,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? 'Message',
        'aria-multiline': 'true',
        role: 'textbox',
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange(clean(e.getHTML())),
    onFocus: () => onFocus?.(),
  });

  // the value can change from outside (a restored version): take it in without sending it back
  useEffect(() => {
    if (!editor) return;
    if (clean(editor.getHTML()) !== (value || '')) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // the offered names arrive after the editor exists: tell the highlighter and redraw
  useEffect(() => {
    if (!editor) return;
    const highlighter = editor.extensionManager.extensions.find((x) => x.name === 'tokenHighlight');
    if (highlighter) highlighter.options.allowed = allowedTokens;
    editor.view.dispatch(editor.state.tr.setMeta(tokenHighlightKey, true));
  }, [editor, allowedTokens]);

  useImperativeHandle(
    ref,
    () => ({
      insertText: (text: string) => {
        editor?.chain().focus().insertContent(text).run();
      },
      focus: () => {
        editor?.commands.focus();
      },
    }),
    [editor],
  );

  if (!editor) return null;
  return (
    <div className={cn('overflow-hidden rounded-lg border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500', className)}>
      <Toolbar editor={editor} disabled={disabled} />
      <EditorContent editor={editor} className="rt-surface" />
    </div>
  );
});
