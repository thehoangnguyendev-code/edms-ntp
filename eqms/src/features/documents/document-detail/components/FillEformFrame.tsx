import React from "react";
import { EformSessionFrame } from "./EformSessionFrame";

export const FillEformFrame: React.FC<{
  controlledCopyId: string;
  /** Which OnlyOffice Form Role this session fills -- undefined for the initial data-entry phase
   *  or a Controlled Copy with no signer roles configured. */
  roleName?: string;
  onClose: (submitted: boolean) => void;
}> = ({ controlledCopyId, roleName, onClose }) => (
  <EformSessionFrame
    controlledCopyId={controlledCopyId}
    kind="FILL"
    title={roleName ? `Sign eForm -- ${roleName}` : "Fill eForm"}
    footerActionLabel="Submit"
    signatureMeaningCode="EFORM_SUBMITTED"
    roleName={roleName}
    onClose={onClose}
  />
);
