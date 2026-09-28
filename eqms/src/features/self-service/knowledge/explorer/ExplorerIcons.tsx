import React from "react";
import { typeAbbreviation, typeColor } from "./explorerModel";

interface FileIconProps {
  type?: string | null;
  className?: string;
}

/** A document "sheet" whose colour band and badge come from the document type. */
export const FileIcon: React.FC<FileIconProps> = React.memo(({ type, className }) => {
  const color = typeColor(type);
  return (
    <svg viewBox="0 0 48 56" aria-hidden="true" className={className} focusable="false">
      <path d="M6 4a4 4 0 0 1 4-4h20l12 12v40a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.4" />
      <path d="M30 0v8a4 4 0 0 0 4 4h8z" fill={color} opacity="0.28" />
      <path d="M14 16h14M14 22h20M14 28h12" stroke={color} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 36h36v16a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill={color} />
      <text x="24" y="48" textAnchor="middle" fontSize="10" fontWeight="800" fill="#ffffff" letterSpacing="0.5" fontFamily="var(--font-sans)">
        {typeAbbreviation(type)}
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
