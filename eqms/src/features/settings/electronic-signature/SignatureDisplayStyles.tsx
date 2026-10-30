import React, { useEffect, useState } from "react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { electronicSignatureSettingsApi, type ElectronicSignatureDisplayStyle } from "@/services/api/electronicSignatureSettings";

const TITLE: Record<string, string> = { COMPACT: "Style 1 – Compact", STANDARD: "Style 2 – Standard", DETAILED: "Style 3 – Detailed" };
const USE: Record<string, string> = {
  COMPACT: "For the signature cells of the Prepared / Reviewed / Approved table at the top of an SOP.",
  STANDARD: "For a signature area of its own, or a frame of the document that is tall enough.",
  DETAILED: "For a separate signature confirmation page, an important record, or when the signature ID must be shown.",
};

/** The first line of a block is the signer's name; a line that is the signature ID is small and grey, as in the document. */
function SignatureSample({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3" data-testid="signature-sample">
      {text.split("\n").map((line, i) => (
        <p key={i} className={i === 0 ? "text-sm font-semibold text-slate-900" : /^SIG-/.test(line) ? "mt-0.5 text-2xs text-slate-500" : "mt-0.5 text-xs text-slate-700"}>{line}</p>
      ))}
    </div>
  );
}

/** Configuration > Electronic Signature > Signature Styles: the three ways a signed signature is written in a document, drawn by the server from one sample record. */
export const SignatureDisplayStyles: React.FC = () => {
  const [styles, setStyles] = useState<ElectronicSignatureDisplayStyle[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    electronicSignatureSettingsApi.getDisplayStyles().then((s) => { if (live) setStyles(s); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  return (
    <FormSection title="Signature Styles">
      <p className="mb-3 text-xs text-slate-500 sm:text-sm">
        A signed electronic signature can be written in a document in one of three styles. They differ only in how much of the signature is written: all three are drawn from the same electronic signature record.
        The placeholder that chooses each style is in <strong>Publishing Templates</strong>, in the group <strong>Signature Display Styles</strong>.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">The signature styles could not be loaded.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {styles.map((s) => (
            <section key={s.style} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4" aria-label={`${s.label} style`}>
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">{TITLE[s.style] ?? s.label}</h4>
                <Badge color="emerald">{s.frame}</Badge>
              </div>
              <SignatureSample text={s.text} />
              <p className="text-xs text-slate-500">{USE[s.style]}</p>
            </section>
          ))}
        </div>
      )}
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
        <p className="font-semibold">What every style keeps (21 CFR 11.50)</p>
        <p>The printed name of the signer, the date and time of the signing, and the meaning of the signature are written in all three. The reason and the signature ID stay on the signature record and in the Audit Trail whichever style is used. A signature that is not signed yet, or lacks any of these, is written in full.</p>
      </div>
    </FormSection>
  );
};
