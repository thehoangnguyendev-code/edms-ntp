import React from "react";
import { useLanguage } from "@/i18n";

export { TABLE_STYLES } from "./tableStyles";

/**
 * Shared DOM table primitives for data lists, editable grids, matrices and expanded rows.
 * Each primitive forwards every native prop (including ref) without adding wrappers or styles.
 * DataTable supplies the default register layout; specialized screens compose these primitives.
 */
function Root(props: React.ComponentPropsWithRef<"table">) {
  return <table {...props} />;
}
function Head(props: React.ComponentPropsWithRef<"thead">) {
  return <thead {...props} />;
}
function Body(props: React.ComponentPropsWithRef<"tbody">) {
  return <tbody {...props} />;
}
function Foot(props: React.ComponentPropsWithRef<"tfoot">) {
  return <tfoot {...props} />;
}
function Row(props: React.ComponentPropsWithRef<"tr">) {
  return <tr {...props} />;
}
function HeaderCell({ children, ...props }: React.ComponentPropsWithRef<"th">) {
  const { tLabel } = useLanguage();
  // A header is a label, never a record value: translate its text, keep any icon or control untouched.
  const translateNode = (node: React.ReactNode): React.ReactNode =>
    typeof node === "string" ? tLabel(node) : Array.isArray(node) ? node.map(translateNode) : node;
  return <th {...props}>{translateNode(children)}</th>;
}
function Cell(props: React.ComponentPropsWithRef<"td">) {
  return <td {...props} />;
}
function Caption(props: React.ComponentPropsWithRef<"caption">) {
  return <caption {...props} />;
}
function ColumnGroup(props: React.ComponentPropsWithRef<"colgroup">) {
  return <colgroup {...props} />;
}
function Column(props: React.ComponentPropsWithRef<"col">) {
  return <col {...props} />;
}

export const TableMarkup = { Root, Head, Body, Foot, Row, HeaderCell, Cell, Caption, ColumnGroup, Column };
