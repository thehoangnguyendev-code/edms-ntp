import React, { useState } from "react";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import { tr } from "@/i18n";

interface ResetMfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

/**
 * Reset the multi-factor authentication of a person who lost the device of their authenticator (21 CFR 11.300(c): loss management with rigorous controls before a
 * replacement). The administrator reads what will happen, then signs: the electronic signature window collects the reason, the user name and the password, so the reason
 * is asked once and belongs to the signature. The person is signed out everywhere, told by e-mail, and sets MFA up again at the next sign-in. If the server refuses,
 * the signature window shows why and stays open.
 */
export const ResetMfaModal: React.FC<ResetMfaModalProps> = ({ isOpen, onClose, userId, userName, onSuccess }) => {
  const { showToast } = useToast();
  const [eSignOpen, setESignOpen] = useState(false);

  const close = () => {
    setESignOpen(false);
    onClose();
  };

  const sign = async (data: { signatureToken: string; reason: string }) => {
    // a refusal is thrown on purpose: the signature window shows it and keeps the reason the administrator typed
    await settingsApi.resetUserMfa(userId, { reason: data.reason.trim(), signatureToken: data.signatureToken });
    showToast({ type: "success", title: "MFA reset", message: `${userName} was signed out everywhere and is told by e-mail. They set up multi-factor authentication again at the next sign-in.` });
    onSuccess?.();
    setESignOpen(false);
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={close}
        onConfirm={() => setESignOpen(true)}
        title={tr("Reset MFA")}
        description={<>{tr("Remove the multi-factor authentication of")} <span className="font-semibold text-slate-700">{userName}</span> {tr("because they lost their authenticator device.")}</>}
        confirmText="Continue"
        size="md"
      >
        <div className="space-y-4">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>{tr("Their authenticator and trusted devices are switched off.")}</li>
            <li>{tr("They are signed out on every device.")}</li>
            <li>{tr("They are told by e-mail and set up multi-factor authentication again at the next sign-in.")}</li>
          </ul>
          <WarningBanner variant="warning">
            {tr("Check who is asking before you continue. You give the reason and sign on the next step; the reset is recorded in the Audit Trail with your signature.")}
          </WarningBanner>
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={eSignOpen && isOpen}
        onClose={() => setESignOpen(false)}
        onConfirm={(data) => sign(data)}
        actionTitle={`Reset MFA: ${userName}`}
        meaningDisplayName="User MFA Reset"
        meaningCode="USER_MFA_RESET"
      />
    </>
  );
};
