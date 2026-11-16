import React from "react";
import noDocumentImage from "@/assets/images/image-file/no_document.png";
import noAccessImage from "@/assets/images/image-file/no_access.svg";

export type DocumentStateVariant = "no-document" | "no-access";

const IMAGES: Record<DocumentStateVariant, string> = {
  "no-document": noDocumentImage,
  "no-access": noAccessImage,
};

/** The document could not be loaded (no-document) or the viewer may no longer open it (no-access). */
export const documentStateFromError = (error: unknown): DocumentStateVariant => {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 403 || status === 410 ? "no-access" : "no-document";
};

interface DocumentStateMessageProps {
  variant: DocumentStateVariant;
  title: string;
  description?: string;
  /** Extra content under the text (notes, timestamps). */
  children?: React.ReactNode;
  /** Inside a card that already has its own padding. */
  compact?: boolean;
}

export const DocumentStateMessage: React.FC<DocumentStateMessageProps> = ({
  variant,
  title,
  description,
  children,
  compact = false,
}) => (
  <div
    role="alert"
    className={`flex w-full max-w-full flex-col items-center justify-center gap-3 text-center sm:gap-4 ${
      compact ? "" : "px-4 py-6 sm:py-10"
    }`}
  >
    <img
      src={IMAGES[variant]}
      alt=""
      draggable={false}
      className="h-auto w-40 max-w-full select-none mix-blend-multiply sm:w-56 md:w-72 lg:w-80"
    />
    <div className="max-w-md space-y-1.5">
      <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
      {description && <p className="text-xs text-slate-600 sm:text-sm">{description}</p>}
    </div>
    {children}
  </div>
);
