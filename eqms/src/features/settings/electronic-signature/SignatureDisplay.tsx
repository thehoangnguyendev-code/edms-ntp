import React, { useEffect, useState } from "react";
import { FormSection } from "@/components/ui/form/FormSection";
import { Badge } from "@/components/ui/badge/Badge";
import { electronicSignatureSettingsApi, type ElectronicSignatureDisplayStyle } from "@/services/api/electronicSignatureSettings";

/** The first line of a block is the signer's name, as in the document. */
function SignatureSample({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3" data-testid="signature-sample">
      {text.split("\n").map((line, i) => (
        <p key={i} className={i === 0 ? "text-sm font-semibold text-slate-900" : "mt-0.5 text-xs text-slate-700"}>{line}</p>
      ))}
    </div>
  );
}

/** Configuration > Electronic Signature > Signature Display: the one way a signed signature is written in a document, drawn by the server from a sample record. */
export const SignatureDisplay: React.FC = () => {
  const [sample, setSample] = useState<ElectronicSignatureDisplayStyle | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    electronicSignatureSettingsApi.getDisplayStyle().then((s) => { if (live) setSample(s); }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  return (
    <FormSection title="Signature Display">
      <p className="mb-3 text-xs text-slate-500 sm:text-sm">
        A signed electronic signature is written in every document the same way, the Standard frame, drawn from the electronic signature record.
        The placeholders are in <strong>Publishing Templates</strong>, in the group <strong>Signature</strong>.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">The signature display could not be loaded.</p>
      ) : (
        <section className="flex max-w-xl flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-4" aria-label="Standard signature display">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-900">Standard</h4>
            <Badge color="emerald">{sample?.frame ?? "Standard frame"}</Badge>
          </div>
          {sample && <SignatureSample text={sample.text} />}
          <p className="text-xs text-slate-500">Used for every signature of a document: the signature cells at the top of a document, a signature area of its own, and the forms of Training.</p>
        </section>
      )}
      <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
        <p className="font-semibold">What the signature keeps (21 CFR 11.50)</p>
        <p>The printed name of the signer, the date and time of the signing, and the meaning of the signature are written in it. The reason and the signature ID stay on the signature record and in the Audit Trail. A signature that is not signed yet, or lacks any of these, is written in full.</p>
      </div>
    </FormSection>
  );
};
