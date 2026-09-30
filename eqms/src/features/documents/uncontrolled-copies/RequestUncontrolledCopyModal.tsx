import React, { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Info, Search } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select";
import { metadataApi } from "@/services/api/metadata";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import {
  uncontrolledCopyApi,
  type UncontrolledCopy,
  type UncontrolledCopyRequestContext,
} from "@/services/api/uncontrolledCopy";
import { UncontrolledCopyMarkingPreview } from "./UncontrolledCopyMarkingPreview";

const FIELD_INPUT =
  "w-full h-9 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500";

/**
 * SELF: the requester holds the copy. USER: another system user holds it. EXTERNAL: an outside party is the
 * intended reader, but a system user (the requester by default) holds it, downloads it and hands it over -- the
 * external name is only a display/audit label and never receives a self-service link.
 */
type RecipientMode = "SELF" | "USER" | "EXTERNAL";

/** Server-side user search -- the same ungated metadata lookup the Controlled Copy recipient picker uses. */
const searchSystemUsers = async (query: string, keep: SelectOption | null): Promise<SelectOption[]> => {
  const users = await metadataApi.getUsersLookup({ search: query.trim() || undefined });
  const options: SelectOption[] = users.map((u) => ({
    value: u.id,
    label: [u.fullName || u.username || u.id, u.email || u.department].filter(Boolean).join(" · "),
  }));
  // Keep the current choice resolvable so its label still shows after a different search.
  return keep && !options.some((o) => o.value === keep.value) ? [keep, ...options] : options;
};

const SystemUserPicker: React.FC<{
  label: string;
  value: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  placeholder: string;
}> = ({ label, value, onChange, placeholder }) => {
  // The Select hands back only the value; remember labels from search results to keep the chosen option.
  const labels = useRef(new Map<string, string>());
  return (
    <Select
      label={label}
      value={value ? String(value.value) : ""}
      options={value ? [value] : []}
      placeholder={placeholder}
      searchPlaceholder="Search by name, e-mail or code..."
      onSearch={async (query) => {
        const options = await searchSystemUsers(query, value);
        options.forEach((o) => labels.current.set(String(o.value), o.label));
        return options;
      }}
      debounceMs={300}
      minSearchLength={0}
      onChange={(next) => {
        const id = next == null ? "" : String(next);
        onChange(id ? { value: id, label: labels.current.get(id) ?? id } : null);
      }}
    />
  );
};

/**
 * Request an Uncontrolled Copy of a document's current Effective revision. Eligibility (document type flag,
 * Effective revision, permission) is evaluated by the server's request-context; the preview shows the mandatory
 * watermark the generated copy will carry before the request is signed.
 */
export const RequestUncontrolledCopyModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (copy: UncontrolledCopy) => void;
  /** Pre-selects a document (id or document number); otherwise the user enters a document number. */
  documentId?: string;
  revisionId?: string;
}> = ({ isOpen, onClose, onCreated, documentId, revisionId }) => {
  const { showToast } = useToast();
  const [documentRef, setDocumentRef] = useState(documentId ?? "");
  const [context, setContext] = useState<UncontrolledCopyRequestContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [contextError, setContextError] = useState("");
  const [reason, setReason] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("SELF");
  const [recipientUser, setRecipientUser] = useState<SelectOption | null>(null);
  const [externalLabel, setExternalLabel] = useState("");
  const [isSigning, setIsSigning] = useState(false);

  const loadContext = useCallback(
    async (ref: string) => {
      if (!ref.trim()) return;
      setLoadingContext(true);
      setContextError("");
      try {
        const data = await uncontrolledCopyApi.getUncontrolledCopyRequestContext({ documentId: ref.trim(), revisionId });
        setContext(data);
      } catch (error) {
        setContext(null);
        setContextError(extractApiMessage(error, "Unable to load the document."));
      } finally {
        setLoadingContext(false);
      }
    },
    [revisionId],
  );

  useEffect(() => {
    if (!isOpen) return;
    setDocumentRef(documentId ?? "");
    setContext(null);
    setContextError("");
    setReason("");
    setRecipientMode("SELF");
    setRecipientUser(null);
    setExternalLabel("");
    if (documentId) void loadContext(documentId);
  }, [isOpen, documentId, loadContext]);

  const recipientValid =
    recipientMode === "SELF" ||
    (recipientMode === "USER" && recipientUser !== null) ||
    (recipientMode === "EXTERNAL" && externalLabel.trim().length > 0);
  const canSubmit = Boolean(context?.canRequest && context.documentId) && reason.trim().length > 0 && recipientValid;

  // Who the watermark names -- mirrors the server's recipientLabel().
  const holderLabel = recipientMode !== "SELF" && recipientUser ? recipientUser.label.split(" · ")[0] : "You";
  const previewRecipientLabel =
    recipientMode === "EXTERNAL" && externalLabel.trim()
      ? `${externalLabel.trim()} (external; handed over by ${holderLabel})`
      : holderLabel;

  const handleSigned = async (data: { signatureToken: string }) => {
    if (!context?.documentId) return;
    // Errors are rethrown so the signature modal shows them and stays open.
    const created = await uncontrolledCopyApi.requestUncontrolledCopy({
      documentId: context.documentId,
      revisionId: context.revisionId || undefined,
      reason: reason.trim(),
      recipientUserId: recipientMode !== "SELF" && recipientUser ? String(recipientUser.value) : undefined,
      externalRecipientLabel: recipientMode === "EXTERNAL" ? externalLabel.trim() : undefined,
      signatureToken: data.signatureToken,
    });
    setIsSigning(false);
    showToast({
      type: "success",
      title: "Requested",
      message: context.approvalRequired
        ? `${created.uncontrolledCopyNumber} was submitted for approval.`
        : `${created.uncontrolledCopyNumber} was created and is ready to generate.`,
    });
    onCreated?.(created);
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen && !isSigning}
        onClose={onClose}
        onConfirm={() => setIsSigning(true)}
        title="Request Uncontrolled Copy"
        description="A reference copy of the current Effective revision. It is watermarked, not tracked and never recalled after issue."
        confirmText="Sign & Request"
        confirmDisabled={!canSubmit}
        size="2xl"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-4 min-w-0">
            {!documentId && (
              <div>
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">Document number</label>
                <div className="flex items-center gap-2">
                  <input
                    className={FIELD_INPUT}
                    value={documentRef}
                    placeholder="e.g. SOP.QA.0001"
                    onChange={(e) => setDocumentRef(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void loadContext(documentRef);
                      }
                    }}
                  />
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void loadContext(documentRef)} disabled={!documentRef.trim()}>
                    <Search className="h-4 w-4" />
                    Find
                  </Button>
                </div>
              </div>
            )}

            {loadingContext && <SectionLoading minHeight="120px" text="Checking eligibility..." />}
            {contextError && (
              <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-700">{contextError}</p>
            )}

            {context && !loadingContext && (
              <>
                <div className="rounded-xl border border-slate-200 p-4 space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {context.documentNumber} - {context.documentTitle}
                  </p>
                  <p className="text-xs text-slate-500">
                    {context.documentTypeName || "No document type"} · Revision {context.revisionNumber || "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {context.approvalRequired ? "Approval is required before generation." : "No approval step (policy)."} Valid for{" "}
                    <span className="font-bold text-emerald-600">{context.validityHours}</span> hours after distribution.
                  </p>
                </div>

                {!context.canRequest && (
                  <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {context.message || "An uncontrolled copy cannot be requested for this document."}
                  </p>
                )}

                {context.canRequest && (
                  <>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">
                        Reason / Purpose <span className="text-rose-500">*</span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                        rows={3}
                        value={reason}
                        maxLength={1000}
                        placeholder="e.g. Customer audit reference submission"
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </div>
                    {context.canRequestForOthers && (
                      <Select
                        label="Recipient"
                        value={recipientMode}
                        onChange={(v) => {
                          setRecipientMode(v as RecipientMode);
                          setRecipientUser(null);
                        }}
                        enableSearch={false}
                        options={[
                          { label: "Myself", value: "SELF" },
                          { label: "Another system user", value: "USER" },
                          { label: "External party (handed over by an internal user)", value: "EXTERNAL" },
                        ]}
                      />
                    )}
                    {recipientMode === "USER" && (
                      <SystemUserPicker
                        label="Recipient"
                        value={recipientUser}
                        onChange={setRecipientUser}
                        placeholder="Select a system user"
                      />
                    )}
                    {recipientMode === "EXTERNAL" && (
                      <>
                        <div>
                          <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5">External recipient</label>
                          <input
                            className={FIELD_INPUT}
                            value={externalLabel}
                            maxLength={255}
                            onChange={(e) => setExternalLabel(e.target.value)}
                            placeholder="e.g. J. Smith, ACME Corp (customer auditor)"
                          />
                        </div>
                        <SystemUserPicker
                          label="Handed over by"
                          value={recipientUser}
                          onChange={setRecipientUser}
                          placeholder="Myself (or select another system user)"
                        />
                        <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-2xs sm:text-xs text-sky-800">
                          The external party does not get a download link. The internal user above downloads the watermarked
                          copy after sign-in and hands it over outside the system. The external name is only printed on the
                          copy and recorded in the audit trail.
                        </p>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          <div className="min-w-0">
            {context ? (
              <UncontrolledCopyMarkingPreview
                marking={context.marking}
                mandatoryText={context.mandatoryWatermarkText}
                recipientLabel={previewRecipientLabel}
                copyNumberLabel={`UC-${context.documentNumber ?? "DOC"}-###`}
              />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                Find a document to preview the watermark.
              </div>
            )}
          </div>
        </div>
      </FormModal>

      {isSigning && context && (
        <ESignatureModal
          isOpen
          onClose={() => setIsSigning(false)}
          onConfirm={handleSigned}
          actionTitle="Request Uncontrolled Copy"
          meaningDisplayName="Uncontrolled Copy Requested"
          meaningCode="UNCONTROLLED_COPY_REQUESTED"
          targetDetails={{
            code: context.documentNumber || "N/A",
            title: context.documentTitle || "N/A",
            revision: context.revisionNumber || "—",
          }}
        />
      )}
    </>
  );
};
