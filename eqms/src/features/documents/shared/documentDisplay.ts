export const stripDuplicateDocumentCode = (documentCode?: string | null, title?: string | null) => {
  const code = (documentCode || "").trim();
  const value = (title || "").trim();
  if (!code || !value) {
    return value;
  }

  const normalizedCode = code.replace(/[-_.\s]/g, "").toLowerCase();
  const normalizedValue = value.replace(/[-_.\s]/g, "").toLowerCase();
  if (!normalizedValue.startsWith(normalizedCode)) {
    return value;
  }

  return value
    .slice(code.length)
    .replace(/^\s*[-:|]\s*/, "")
    .trim() || value;
};

export const formatDocumentDisplayLabel = (
  documentNumber?: string | null,
  documentTitle?: string | null,
) => {
  const code = (documentNumber || "").trim();
  const title = stripDuplicateDocumentCode(code, documentTitle);

  if (code && title) {
    return `${code} - ${title}`;
  }

  return code || title || "";
};

export const formatRevisionDocumentDisplayLabel = (
  displayLabel?: string | null,
  documentNumber?: string | null,
  documentTitle?: string | null,
) => {
  if (displayLabel && displayLabel.trim()) {
    return displayLabel.trim();
  }
  return formatDocumentDisplayLabel(documentNumber, documentTitle);
};
