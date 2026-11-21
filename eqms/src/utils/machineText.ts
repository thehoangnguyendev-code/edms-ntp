import type { ReactNode } from 'react';

/** Words that stay in capitals when a code is made readable. */
const ACRONYMS = new Set(['QA', 'GMP', 'SOP', 'DCO', 'SOD', 'MFA', 'KPI', 'PDF', 'DOCX', 'XLSX', 'SMTP', 'API', 'CAPA', 'ID', 'ALCOA', 'JSON', 'HTTP', 'HTTPS', 'HTML', 'LDAP', 'SAML', 'UUID', 'WORM', 'SFTP', 'TLS']);

/**
 * One-word statuses and severities as the server keeps them. Only these are recognised without an underscore: a word in capitals may be written that way on purpose
 * (TEST, PROD, an abbreviation), so the rest of the one-word values get their label from the server.
 */
const STATUS_WORDS = new Set([
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO', 'WARN', 'WARNING', 'BLOCK', 'PENDING', 'PLANNED', 'NOTIFIED', 'OPEN', 'CLOSED', 'COMPLETED', 'CANCELLED', 'FAILED', 'PASSED',
  'ACTIVE', 'INACTIVE', 'DRAFT', 'EFFECTIVE', 'OBSOLETED', 'DISTRIBUTED', 'APPROVED', 'REJECTED', 'REVIEWED', 'SIGNED', 'SUCCESS', 'RESOLVED', 'SENT', 'SKIPPED', 'NEVER',
  'READY', 'QUEUED', 'RUNNING', 'DONE', 'SUSPENDED', 'DISABLED', 'EXPIRED', 'REVOKED', 'LOCKED', 'ACKNOWLEDGED', 'REQUIRED', 'OPTIONAL', 'SYSTEM', 'CUSTOM',
]);

/** The wording of the few codes that are not just the word in Title Case. */
const WORDING: Record<string, string> = { WARN: 'Warning', BLOCK: 'Blocking', OBSOLETED: 'Obsoleted', CANCELLED: 'Closed - Cancelled', CLOSED_CANCELLED: 'Closed - Cancelled', RESERVED: 'Pending Document Approval' };

/**
 * A machine value as the server keeps it: capitals and digits with underscores (IN_PROGRESS, PENDING_QA_CONFIRMATION, NOT_VERIFIED). A person is never meant to
 * read one. A word that is only capitals (TEST, PROD, DONE) is not matched here: it may be written that way on purpose (the name of the environment, an
 * abbreviation), and the server now sends the label of every status beside its code, so a one-word status reaches the screen as words.
 */
export const isMachineCode = (text: unknown): text is string =>
  typeof text === 'string' && (/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(text) || STATUS_WORDS.has(text));

/** A status or code shown to a person when the server gave no label: "PENDING_QA_CONFIRMATION" reads "Pending QA confirmation". Display only, never sent back. */
export const readableCode = (code: string): string => {
  if (WORDING[code]) return WORDING[code];
  const words = code.toLowerCase().split(/[_\s]+/).filter(Boolean).map((word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The text a person reads for a label: a machine value is made readable, any other text is left as it is. */
export const displayText = <T,>(text: T): T | string => (isMachineCode(text) ? readableCode(text) : text);

/** The same for something drawn on screen: only a plain string is touched, never an element. */
export const displayNode = (node: ReactNode): ReactNode => (typeof node === 'string' ? displayText(node) : node);
