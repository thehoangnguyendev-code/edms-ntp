/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * A word translated while its file is loaded, or kept by a useMemo that does not depend on the language, stays in the language the page was opened in until
 * the page is reloaded. Both are refused here. Write `get label() { return tr("..."); }` in a constant, and add getCatalogLanguage() to the useMemo.
 */
const SOURCE = resolve(__dirname, '../..');
const TRANSLATORS = new Set(['tr', 'trFormat', 'trPlural']);

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return ['__tests__', 'i18n', 'test'].includes(entry.name) ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|d)\.tsx?$/.test(entry.name) ? [path] : [];
  });

const insideFunction = (node: ts.Node): boolean => {
  for (let parent = node.parent; parent; parent = parent.parent) if (ts.isFunctionLike(parent)) return true;
  return false;
};

describe('The words on screen follow a change of language without a reload', () => {
  const atLoad: string[] = [];
  const kept: string[] = [];
  for (const path of sourceFiles(SOURCE)) {
    const text = readFileSync(path, 'utf8');
    if (!/\btr(Format|Plural)?\(|useMemo/.test(text)) continue;
    const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const where = (node: ts.Node) => `${path.slice(SOURCE.length + 1).replace(/\\/g, '/')}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const name = node.expression.getText();
        if (TRANSLATORS.has(name) && !insideFunction(node)) atLoad.push(where(node));
        if (/^(React\.)?useMemo$/.test(name) && node.arguments.length === 2
          && /\b(tr|trFormat|trPlural)\(|_LABELS?\b|_TABS\b/.test(node.arguments[0].getText())
          && !/getCatalogLanguage|\blanguage\b|\btLabel\b/.test(node.arguments[1].getText())) kept.push(where(node));
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }

  it('translates nothing while a file is loaded', () => {
    expect(atLoad).toEqual([]);
  });

  it('keeps no translated words in a useMemo that ignores the language', () => {
    expect(kept).toEqual([]);
  });
});
