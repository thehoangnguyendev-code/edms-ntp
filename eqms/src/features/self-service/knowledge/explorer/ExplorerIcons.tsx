import React, { createContext, useContext } from "react";
import { folderColor, typeAbbreviation, typeColor } from "./explorerModel";

/** What a Document Type was given for its icon; an empty field means the automatic one. */
export interface TypeIcon {
  label?: string | null;
  color?: string | null;
  shortCode?: string | null;
}

const TypeIconsContext = createContext<ReadonlyMap<string, TypeIcon>>(new Map());
/** Gives every icon below it the icons the Document Types were designed with (read once by the explorer). */
export const TypeIconsProvider = TypeIconsContext.Provider;
export const typeIconKey = (type?: string | null): string => (type ?? "").trim().toLowerCase();

/** How a Business Unit, Department or Document Type is drawn as a folder: the colour it was given and its abbreviation; empty means automatic colour / no abbreviation. */
export interface FolderStyleOf {
  color?: string | null;
  abbreviation?: string | null;
}

interface FolderStyles {
  /** By id (`id:`) and by name (`name:`): a folder is found by its key, else by its name. */
  styles: ReadonlyMap<string, FolderStyleOf>;
  /** True when the administrator chose to name the folders of the layout (tiles, list, details, path) by their abbreviation (Configuration > General). */
  abbreviate: boolean;
  /** The same choice for the sidebar, made on its own. */
  abbreviateSidebar: boolean;
}

const FolderStylesContext = createContext<FolderStyles>({ styles: new Map(), abbreviate: false, abbreviateSidebar: false });
export const FolderStylesProvider = FolderStylesContext.Provider;
export const folderStyleKeys = (id: string, name: string): [string, string] => [`id:${id.trim().toLowerCase()}`, `name:${name.trim().toLowerCase()}`];

const styleOf = (styles: ReadonlyMap<string, FolderStyleOf>, key: string, label: string): FolderStyleOf | undefined => {
  const [byId, byName] = folderStyleKeys(key, label);
  return styles.get(byId) ?? styles.get(byName);
};

/** The colour of a folder: what its Business Unit or Department was given, else an automatic one. */
export const useFolderColor = (): ((key: string, label: string) => string) => {
  const { styles } = useContext(FolderStylesContext);
  return (key, label) => styleOf(styles, key, label)?.color || folderColor(label);
};

/** The name a folder shows in the layout or in the sidebar: its abbreviation when the administrator chose that for that place (and the folder has one), else its name. */
export const useFolderLabel = (where: "layout" | "sidebar" = "layout"): ((key: string, label: string) => string) => {
  const { styles, abbreviate, abbreviateSidebar } = useContext(FolderStylesContext);
  const short = where === "sidebar" ? abbreviateSidebar : abbreviate;
  return (key, label) => (short ? styleOf(styles, key, label)?.abbreviation || label : label);
};

/** The text and colour of the icon of a type: what its Document Type was given, else its Short Code and an automatic colour. */
export const useTypeIcon = (type?: string | null): { label: string; color: string } => {
  const given = useContext(TypeIconsContext).get(typeIconKey(type));
  return { label: given?.label || given?.shortCode || typeAbbreviation(type), color: given?.color || typeColor(type) };
};

interface FileIconProps {
  type?: string | null;
  className?: string;
  /** Text and colour to draw instead of the type's own (the designer in Document Types previews what is being typed). */
  label?: string;
  color?: string;
}

/** A document "sheet" whose colour band and text come from the document type. */
export const FileIcon: React.FC<FileIconProps> = React.memo(({ type, className, label, color: colorOverride }) => {
  const own = useTypeIcon(type);
  const color = colorOverride || own.color;
  const text = label || own.label;
  return (
    <svg viewBox="0 0 48 44" aria-hidden="true" className={className} focusable="false">
      <path d="M6 4a4 4 0 0 1 4-4h20l12 12v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.4" />
      <path d="M30 0v8a4 4 0 0 0 4 4h8z" fill={color} opacity="0.28" />
      <path d="M14 16h14M14 21h20" stroke={color} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 27h36v13a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill={color} />
      <text x="24" y="39" textAnchor="middle" fontSize={text.length > 4 ? 8 : 10} fontWeight="800" fill="#ffffff" letterSpacing="0.5" fontFamily="var(--font-sans)">
        {text}
      </text>
    </svg>
  );
});
FileIcon.displayName = "FileIcon";

export const FolderIcon: React.FC<{ color: string; className?: string }> = React.memo(({ color, className }) => (
  <svg viewBox="0 0 64 52" aria-hidden="true" className={className} focusable="false">
    <path d="M4 8a4 4 0 0 1 4-4h16l6 7h26a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill={color} opacity="0.55" />
    <rect x="4" y="16" width="56" height="32" rx="4" fill={color} />
    <path d="M4 20a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v2H4z" fill="#ffffff" opacity="0.22" />
  </svg>
));
FolderIcon.displayName = "FolderIcon";
