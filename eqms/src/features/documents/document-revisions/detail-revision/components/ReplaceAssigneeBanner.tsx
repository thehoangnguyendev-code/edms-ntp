import React, { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button/Button";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { documentApi } from "@/services/api/documents";
import { securityApi } from "@/services/api/security";
import type { RevisionPerson } from "../types";

type ParticipantType = "REVIEWER" | "APPROVER";

interface Props {
  revisionId: string;
  status?: string | null;
  documentNumber?: string;
  documentName?: string;
  revisionNumber?: string;
  reviewers?: RevisionPerson[];
  approvers?: RevisionPerson[];
  onReplaced: () => void | Promise<void>;
}

interface Unavailable {
  type: ParticipantType;
  person: RevisionPerson;
}

const errorMessage = (error: unknown) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ??
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
  "Unable to replace the assignee.";

/**
 * Shown to Document Control when a Reviewer/Approver whose action is pending has been suspended,
 * terminated or deactivated: the revision cannot progress until the assignment is handed over.
 */
export const ReplaceAssigneeBanner: React.FC<Props> = ({
  revisionId, status, documentNumber, documentName, revisionNumber, reviewers, approvers, onReplaced,
}) => {
  const { hasPermissionAlias } = usePermissions();
  const { showToast } = useToast();
  const [target, setTarget] = useState<Unavailable | null>(null);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");
  const [showSign, setShowSign] = useState(false);
  const [saving, setSaving] = useState(false);

  const normalizedStatus = String(status ?? "").toUpperCase();
  const unavailable = useMemo<Unavailable[]>(() => {
    const isPending = (p: RevisionPerson) =>
      String(p.actionStatus ?? "PENDING").toUpperCase() === "PENDING" &&
      Boolean(p.userStatus) && String(p.userStatus).toUpperCase() !== "ACTIVE";
    const list: Unavailable[] = [];
    if (normalizedStatus === "PENDING_REVIEW") {
      (reviewers ?? []).filter(isPending).forEach((person) => list.push({ type: "REVIEWER", person }));
    }
    if (normalizedStatus === "PENDING_APPROVAL") {
      (approvers ?? []).filter(isPending).forEach((person) => list.push({ type: "APPROVER", person }));
    }
    return list;
  }, [approvers, normalizedStatus, reviewers]);

  if (!hasPermissionAlias("documents.workspace.manage") || unavailable.length === 0) {
    return null;
  }

  const searchUsers = async (query: string): Promise<SelectOption[]> => {
    if (!target) return [];
    const response = await securityApi.getEligibleParticipants(
      "DOCUMENT_REVISION", revisionId, target.type, query || undefined, 1, 20,
    );
    return response.data.map((user) => ({
      value: user.userId,
      label: [user.fullName, user.department].filter(Boolean).join(" — "),
    }));
  };

  const close = () => {
    setTarget(null);
    setToUserId("");
    setReason("");
    setShowSign(false);
  };

  const confirm = async (signature: { signatureToken?: string }) => {
    if (!target) return;
    setShowSign(false);
    setSaving(true);
    try {
      await documentApi.replaceWorkflowParticipant(revisionId, {
        participantType: target.type,
        fromUserId: target.person.id,
        toUserId,
        reason: reason.trim(),
        signatureToken: signature.signatureToken as string,
      });
      showToast({ type: "success", title: "Assignee replaced", message: "The new assignee has been notified.", duration: 3000 });
      close();
      await onReplaced();
    } catch (error) {
      showToast({ type: "error", title: "Replacement failed", message: errorMessage(error) });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <>
      <div className="space-y-2">
        {unavailable.map((item) => (
          <div
            key={`${item.type}-${item.person.id}`}
            className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {item.type === "REVIEWER" ? "Reviewer" : "Approver"}{" "}
                <b>{item.person.fullName || item.person.username}</b> is {String(item.person.userStatus).toLowerCase()} and
                cannot act. This revision cannot progress until the assignment is replaced.
              </span>
            </div>
            <Button size="sm" variant="outline-emerald" className="whitespace-nowrap" onClick={() => setTarget(item)}>
              Replace assignee
            </Button>
          </div>
        ))}
      </div>

      <FormModal
        isOpen={Boolean(target) && !showSign}
        onClose={close}
        onConfirm={() => setShowSign(true)}
        title={`Replace ${target?.type === "APPROVER" ? "Approver" : "Reviewer"}`}
        description={target ? `Hand over ${target.person.fullName || target.person.username}'s pending action to another user.` : undefined}
        confirmText="Continue"
        confirmDisabled={!toUserId || !reason.trim()}
        isLoading={saving}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="New assignee"
            value={toUserId}
            onChange={(value) => setToUserId(String(value))}
            options={[]}
            onSearch={searchUsers}
            minSearchLength={0}
            enableSearch
            placeholder="Search an eligible user..."
          />
          <div>
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">Reason</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Why is the assignee being replaced?"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none"
            />
          </div>
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={showSign}
        onClose={() => setShowSign(false)}
        onConfirm={confirm}
        actionTitle="Replace Workflow Assignee"
        meaningDisplayName="Workflow Authorization Change"
        meaningCode="WORKFLOW_AUTHORIZATION_CHANGE"
        changes={[
          {
            action: target?.type === "APPROVER" ? "Approver" : "Reviewer",
            oldValue: target?.person.fullName || target?.person.username || "",
            newValue: "New assignee",
            category: target?.type === "APPROVER" ? "approver" : "reviewer",
          },
        ]}
        targetDetails={{ code: documentNumber || "Document", title: documentName || "", revision: revisionNumber || "" }}
      />
    </>
  );
};
