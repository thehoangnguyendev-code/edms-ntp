import React, { useEffect, useRef, useState } from "react";
import { Info, Trash2, Upload } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { FormField } from "@/components/ui/form";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Button } from "@/components/ui/button/Button";
import { Select, type SelectOption } from "@/components/ui/select";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { metadataApi } from "@/services/api/metadata";
import { documentApi } from "@/services/api/documents";
import { executedRecordApi, type ExecutedRecord, type CaptureMethod } from "@/services/api/executedRecords";

const searchSystemUsers = async (query: string, keep: SelectOption | null): Promise<SelectOption[]> => {
  const users = await metadataApi.getUsersLookup({ search: query.trim() || undefined });
  const options: SelectOption[] = users.map((u) => ({
    value: u.id,
    label: [u.fullName || u.username || u.id, u.email || u.department].filter(Boolean).join(" · "),
  }));
  return keep && !options.some((o) => o.value === keep.value) ? [keep, ...options] : options;
};

const SystemUserPicker: React.FC<{
  label: string;
  value: SelectOption | null;
  onChange: (option: SelectOption | null) => void;
  placeholder: string;
}> = ({ label, value, onChange, placeholder }) => {
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
 * Handles both capture methods for an Executed Record: a scanned-back paper Controlled Copy
 * (captureMethod="PAPER_SCAN") and an already-filled eForm file upload (captureMethod="EFORM").
 * Live OnlyOffice Form Creator/fill-session embedding is a follow-up increment (see the approved
 * plan) -- this direct upload is the fully working interim path for both methods.
 */
export const SubmitExecutedRecordModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (record: ExecutedRecord) => void;
  captureMethod: CaptureMethod;
  formDocumentId: string;
  formDocumentNumber?: string;
  formDocumentTitle?: string;
}> = ({ isOpen, onClose, onCreated, captureMethod, formDocumentId, formDocumentNumber, formDocumentTitle }) => {
  const { showToast } = useToast();
  const isPaper = captureMethod === "PAPER_SCAN";

  const [controlledCopyOptions, setControlledCopyOptions] = useState<SelectOption[]>([]);
  const [loadingControlledCopies, setLoadingControlledCopies] = useState(false);
  const [controlledCopyId, setControlledCopyId] = useState("");
  const [filledBy, setFilledBy] = useState<SelectOption | null>(null);
  const [filledAt, setFilledAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [file, setFile] = useState<File | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setControlledCopyId("");
    setFilledBy(null);
    setFilledAt(new Date().toISOString().slice(0, 10));
    setFile(null);
    if (isPaper) {
      setLoadingControlledCopies(true);
      documentApi
        .getControlledCopies({ documentId: formDocumentId, limit: 100 })
        .then((page) => {
          const eligible = (page.data ?? []).filter((c: any) =>
            ["READY_FOR_DISTRIBUTION", "DISTRIBUTED"].includes(c.statusCode),
          );
          setControlledCopyOptions(
            eligible.map((c: any) => ({
              value: c.id,
              label: `${c.controlledCopyNumber} — ${c.recipientName || c.recipientEmail || "—"}`,
            })),
          );
        })
        .catch(() => setControlledCopyOptions([]))
        .finally(() => setLoadingControlledCopies(false));
    }
  }, [isOpen, isPaper, formDocumentId]);

  const canSubmit = Boolean(file) && (isPaper ? Boolean(controlledCopyId) && Boolean(filledBy) : true);

  const handleSigned = async (data: { reason: string; signatureToken: string }) => {
    if (!file) return;
    const input = {
      sourceControlledCopyId: isPaper ? controlledCopyId : undefined,
      filledByUserId: isPaper ? filledBy?.value ? String(filledBy.value) : undefined : undefined,
      filledAt: isPaper ? filledAt : undefined,
      reason: data.reason,
      signatureToken: data.signatureToken,
      file,
    };
    const created = isPaper
      ? await executedRecordApi.recordPhysicalCopy(formDocumentId, input)
      : await executedRecordApi.submitEform(formDocumentId, input);
    setIsSigning(false);
    showToast({ type: "success", title: "Recorded", message: `${created.recordNumber} has been logged.` });
    onCreated?.(created);
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen && !isSigning}
        onClose={onClose}
        onConfirm={() => setIsSigning(true)}
        title={isPaper ? "Record Physical Copy" : "Submit Filled eForm"}
        description={
          isPaper
            ? "Log a hand-filled, scanned Controlled Copy against this Form -- no new Document Number is created."
            : "Upload the filled eForm file. Live in-browser field filling is coming in a follow-up release; this direct upload works today."
        }
        confirmText="Sign & Submit"
        confirmDisabled={!canSubmit}
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">{formDocumentNumber} - {formDocumentTitle}</p>
          </div>

          {isPaper && (
            <>
              <Select
                label="Controlled Copy"
                value={controlledCopyId}
                onChange={(v) => setControlledCopyId(String(v))}
                options={controlledCopyOptions}
                placeholder={loadingControlledCopies ? "Loading..." : "Select the Controlled Copy that was filled"}
                enableSearch
              />
              <SystemUserPicker
                label="Filled by"
                value={filledBy}
                onChange={setFilledBy}
                placeholder="Select the person who filled this form"
              />
              <DateTimePicker
                label="Date filled"
                value={filledAt}
                showTime={false}
                onChange={(value) => setFilledAt(value ? value.split("/").reverse().join("-") : "")}
              />
            </>
          )}

          <FormField label={isPaper ? "Scanned file" : "Filled eForm file"} required>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              id="executed-record-file"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                e.currentTarget.value = "";
              }}
            />
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div>
                <p className="text-xs text-slate-500">File</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-xs sm:text-sm font-medium text-slate-700">
                    {file?.name || "No file uploaded"}
                  </p>
                  {file && (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                      title="Remove selected file"
                      aria-label="Remove selected file"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline-emerald" className="gap-2"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </div>
              <p className="text-xs text-slate-500">PDF, JPG, PNG. The file is submitted after signing.</p>
            </div>
          </FormField>

          {!isPaper && (
            <p className="flex items-start gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-2xs sm:text-xs text-sky-800">
              Fill the eForm outside the system today (print, save-as, or hand-annotate), then upload the result
              here. In-browser filling on the Form's own fillable fields is planned next.
            </p>
          )}
        </div>
      </FormModal>

      {isSigning && (
        <ESignatureModal
          isOpen
          onClose={() => setIsSigning(false)}
          onConfirm={handleSigned}
          actionTitle={isPaper ? "Record Physical Copy" : "Submit Filled eForm"}
          meaningCode={isPaper ? "RECORD_LOGGED" : "EFORM_SUBMITTED"}
          targetDetails={{ code: formDocumentNumber || "N/A", title: formDocumentTitle || "N/A" }}
        />
      )}
    </>
  );
};
