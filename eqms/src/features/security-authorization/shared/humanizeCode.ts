/** Words that stay in capitals inside a sentence. */
const ACRONYMS = new Set(["QA", "GMP", "SOP", "DCO", "SOD", "MFA", "KPI"]);

/** A label inside a sentence: "Approve GMP Template" reads "approve GMP template", "Person the item is about" reads "person the item is about". */
export const inSentence = (label: string): string =>
  label
    .split(" ")
    .map((word) => (ACRONYMS.has(word.replace(/[^A-Za-z]/g, "")) ? word : word.toLowerCase()))
    .join(" ");

/** A status or code shown to a person when the server gave no label: "PENDING_QA_CONFIRMATION" reads "Pending QA confirmation". Display only, never sent back. */
export const readableCode = (code: string): string => {
  const words = code.toLowerCase().split(/[_\s]+/).filter(Boolean).map((word) => (ACRONYMS.has(word.toUpperCase()) ? word.toUpperCase() : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/** The label of a status; the code made readable when the label is only the code. */
export const statusText = (label: string | null | undefined, code: string): string => (label && label !== code ? label : readableCode(code));
