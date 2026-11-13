/**
 * The editor of an email message writes its HTML its own way (no line breaks or indentation between the tags), so the text that was saved and the text the editor gives back
 * differ without anyone having typed. Two texts are the same wording when they are the same once the white space between tags and runs of white space are removed.
 */
const normalise = (html: string | null | undefined) => (html ?? '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

export const sameHtml = (a: string | null | undefined, b: string | null | undefined) => normalise(a) === normalise(b);
