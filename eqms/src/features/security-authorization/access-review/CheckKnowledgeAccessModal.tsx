import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge/Badge";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { knowledgeSharesApi, type KnowledgeAccessExplanation } from "@/services/api/knowledgeShares";

const errorMessage = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data?.error?.message ?? fallback;

const LAYER_TITLES: Record<string, string> = {
  USER_ACTIVE: "User account",
  DOCUMENT_IN_KNOWLEDGE_BASE: "Listed in the Knowledge Base",
  VIEW_ALL: "View-all permission",
  KNOWLEDGE_VISIBILITY_MODE: "Knowledge Base visibility setting",
  OWN_DEPARTMENT: "Own Department",
  OWN_BUSINESS_UNIT: "Own Business Unit",
  KNOWLEDGE_PERMISSION: "Knowledge permission",
  DEPARTMENT_HEAD: "Department Head",
  SHARE: "Share of the Department Head",
};

interface CheckKnowledgeAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Effective Access of the Knowledge Base: why one user can or cannot see one document, layer by layer. Opened from the "Check access"
 * button in the title of Access Review > Knowledge Shares.
 */
export const CheckKnowledgeAccessModal: React.FC<CheckKnowledgeAccessModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useToast();
  const [userId, setUserId] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [userOptions, setUserOptions] = useState<SelectOption[]>([]);
  const [documentOptions, setDocumentOptions] = useState<SelectOption[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<KnowledgeAccessExplanation | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setUserId("");
      setDocumentId("");
      setResult(null);
    }
  }, [isOpen]);

  const run = async () => {
    if (!userId || !documentId) return;
    setRunning(true);
    try {
      setResult(await knowledgeSharesApi.explain(userId, documentId));
    } catch (error) {
      showToast({ type: "error", message: errorMessage(error, "Unable to check the access.") });
    } finally {
      setRunning(false);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={() => !running && onClose()}
      onConfirm={run}
      title="Check access to the Knowledge Base"
      description="Why can or can't this user see this document?"
      confirmText="Check"
      cancelText="Close"
      isLoading={running}
      confirmDisabled={!userId || !documentId}
      size="2xl"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="User"
            value={userId}
            onChange={(v) => { setUserId(String(v)); setResult(null); }}
            options={userOptions}
            onSearch={async (query) => {
              const found = await knowledgeSharesApi.searchUsers(query);
              const options = found.map((u) => ({ value: u.id, label: u.employeeCode ? `${u.fullName} (${u.employeeCode})` : u.fullName }));
              setUserOptions((prev) => [...prev, ...options]);
              return options;
            }}
            placeholder="Search a person by name or employee ID"
            truncateOptions
          />
          <Select
            label="Document"
            value={documentId}
            onChange={(v) => { setDocumentId(String(v)); setResult(null); }}
            options={documentOptions}
            onSearch={async (query) => {
              const found = await knowledgeSharesApi.searchDocuments(query);
              const options = found.map((d) => ({ value: d.id, label: [d.documentNumber, d.documentName].filter(Boolean).join(" - ") }));
              setDocumentOptions((prev) => [...prev, ...options]);
              return options;
            }}
            placeholder="Search a document by number or name"
            truncateOptions
          />
        </div>

        {result && (
          <div className="space-y-3">
            <div className={`rounded-lg border px-3.5 py-3 text-sm ${result.canSee ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              <p className="font-semibold">{result.canSee ? "Can see it" : "Cannot see it"}</p>
              <p className="mt-0.5 text-xs">{result.summary}</p>
            </div>
            <ul className="space-y-1.5">
              {result.layers.map((layer) => (
                <li key={layer.layerCode} className="flex items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2">
                  <Badge color={layer.passed ? "emerald" : "slate"} size="xs" className="mt-0.5 shrink-0">{layer.passed ? "Yes" : "No"}</Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800">{LAYER_TITLES[layer.layerCode] ?? layer.layerCode}</p>
                    <p className="text-xs text-slate-500">{layer.message}</p>
                  </div>
                </li>
              ))}
            </ul>
            {result.decidingShare && (
              <p className="text-xs text-slate-500">
                Deciding share: {result.decidingShare.scopeLabel} in {result.decidingShare.departmentName}
                {result.decidingShare.createdBy ? `, made by ${result.decidingShare.createdBy}` : ""}.
              </p>
            )}
          </div>
        )}
      </div>
    </FormModal>
  );
};
