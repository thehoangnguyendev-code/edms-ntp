import React from "react";
import { EformSessionFrame } from "./EformSessionFrame";

export const DesignEformFieldsFrame: React.FC<{
  formDocumentId: string;
  onClose: (committed: boolean) => void;
}> = ({ formDocumentId, onClose }) => (
  <EformSessionFrame
    formDocumentId={formDocumentId}
    kind="DESIGN"
    title="Design eForm Fields"
    footerActionLabel="Save & Close"
    signatureMeaningCode="FORM_FIELDS_DESIGNED"
    onClose={onClose}
  />
);
