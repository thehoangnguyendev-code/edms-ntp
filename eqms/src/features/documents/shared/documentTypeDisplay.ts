import { DOCUMENT_TYPE_CODES, type DocumentType } from "@/features/documents/types";

const normalizeText = (value: string) => value.trim().replace(/\s+/g, " ");

const extractDisplayName = (label: string) => {
  const normalized = normalizeText(label);
  const separatorIndex = normalized.indexOf(" - ");
  if (separatorIndex < 0) {
    return normalized;
  }
  return normalized.slice(separatorIndex + 3).trim();
};

export const formatDocumentTypeSelectLabel = (documentType: DocumentType): string => {
  const shortCode = DOCUMENT_TYPE_CODES[documentType];
  return shortCode ? `${shortCode} - ${documentType}` : documentType;
};

export const formatDocumentTypeLookupLabel = (shortCode: string | null | undefined, name: string) => {
  const normalizedShortCode = normalizeText(String(shortCode || "")).toUpperCase();
  const normalizedName = normalizeText(name);
  return normalizedShortCode ? `${normalizedShortCode} - ${normalizedName}` : normalizedName;
};

export const matchesDocumentTypeLabel = (candidate: string, optionLabel: string) => {
  const normalizedCandidate = normalizeText(candidate);
  const normalizedLabel = normalizeText(optionLabel);
  return (
    normalizedCandidate === normalizedLabel ||
    normalizedCandidate === extractDisplayName(normalizedLabel)
  );
};
