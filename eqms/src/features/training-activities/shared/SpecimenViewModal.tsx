import { FormModal } from "@/components/ui/modal/FormModal";
import { SpecimenSignaturePanel } from "./SpecimenSignaturePanel";

/** The specimen signature in force of a person (FRM.0007), opened beside the scan that is being checked against the paper. */
export function SpecimenViewModal({ personId, personName, onClose }: { personId: string; personName: string; onClose: () => void }) {
  return (
    <FormModal isOpen onClose={onClose} onConfirm={onClose} title={`Specimen signature: ${personName}`} confirmText="Close" showCancel={false} size="lg">
      <SpecimenSignaturePanel personId={personId} personName={personName} />
    </FormModal>
  );
}
