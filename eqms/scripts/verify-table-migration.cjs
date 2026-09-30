/** Structural evidence: migration must preserve all code except table tag names/style references/imports. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const tags = {Root:'table', Head:'thead', Body:'tbody', Foot:'tfoot', Row:'tr', HeaderCell:'th', Cell:'td', Caption:'caption', ColumnGroup:'colgroup', Column:'col'};
const styleFile = path.join(root, 'src/components/ui/table/tableStyles.ts');
const styles = {};
if (fs.existsSync(styleFile)) {
  const source = ts.createSourceFile(styleFile, fs.readFileSync(styleFile, 'utf8'), ts.ScriptTarget.Latest, true);
  function find(node) {
    if (ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)) styles[node.name.getText(source)] = node.initializer.text;
    ts.forEachChild(node, find);
  }
  find(source);
}
function walk(dir) {return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir,entry.name)) : entry.name.endsWith('.tsx') ? [path.join(dir,entry.name)] : []);}
const result = {};
for (const file of walk(path.join(root, 'src')).filter(file => !file.endsWith('TablePrimitives.tsx') && !file.includes(`${path.sep}__tests__${path.sep}`))) {
  const text = fs.readFileSync(file,'utf8');
  const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function canonical(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith('/table/TablePrimitives')) return null;
    if (ts.isIdentifier(node) && Object.values(tags).includes(node.text)) return {kind:ts.SyntaxKind.Identifier,text:node.text};
    if (ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'TableMarkup') {
      const jsxTag = (ts.isJsxOpeningElement(node.parent) || ts.isJsxClosingElement(node.parent) || ts.isJsxSelfClosingElement(node.parent)) && node.parent.tagName === node;
      return {kind:jsxTag ? ts.SyntaxKind.Identifier : ts.SyntaxKind.StringLiteral,text:tags[node.name.text]};
    }
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'className' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isPropertyAccessExpression(node.initializer.expression) && node.initializer.expression.expression.getText(source) === 'TABLE_STYLES') {
      const value = styles[node.initializer.expression.name.text];
      if (value === undefined) throw new Error(`Unresolved style in ${file}`);
      return {kind:node.kind, children:[canonical(node.name),{kind:ts.SyntaxKind.StringLiteral,text:value}]};
    }
    const children = [];
    ts.forEachChild(node,child => {const value = canonical(child); if (value !== null) children.push(value);});
    if (children.length) return {kind:node.kind,children};
    return {kind:node.kind,text:ts.isStringLiteral(node) ? node.text : node.getText(source).replace(/\r\n?/g,'\n')};
  }
  result[path.relative(root,file).replaceAll('\\','/')] = crypto.createHash('sha256').update(JSON.stringify(canonical(source))).digest('hex');
}
if (process.argv[2]) {
  const baseline = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8'));
  const differences = Object.keys(baseline).filter(file => result[file] !== baseline[file]);
  process.stdout.write(JSON.stringify({checkedFiles:Object.keys(baseline).length,differences},null,2));
  if (differences.length) process.exitCode = 1;
} else process.stdout.write(JSON.stringify(result));
