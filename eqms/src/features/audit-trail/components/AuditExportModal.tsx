import React, { useState } from "react";
import { jsPDF } from "jspdf";
import { FileJson, FileType, FileText } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { useToast } from "@/components/ui/toast/Toast";
import { formatDateTime } from "@/utils/format";
import { cn } from "@/components/ui/utils";
import type { AuditTrailRecord } from "../types";
import { formatAuditActionLabel } from "../utils/actionBadge";

interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AuditTrailRecord;
}

type ExportFormat = "json" | "pdf" | "txt";

export const AuditExportModal: React.FC<AuditExportModalProps> = ({ isOpen, onClose, record }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
  const [showESign, setShowESign] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const exportOptions: { format: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { format: "json", label: "Export as JSON", desc: "Structured data format", icon: <FileJson className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "json" ? "text-emerald-600" : "text-slate-500")} /> },
    { format: "pdf", label: "Export as PDF", desc: "Printable document format", icon: <FileText className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "pdf" ? "text-emerald-600" : "text-slate-500")} /> },
    { format: "txt", label: "Export as TXT", desc: "Plain text format", icon: <FileType className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "txt" ? "text-emerald-600" : "text-slate-500")} /> },
  ];

  const doExport = async (format: ExportFormat) => {
    if (format === "pdf") {
      setIsExporting(true);
      try {
        const pdf = new jsPDF();
        const content = [
          "Audit Trail Record",
          "",
          `Timestamp: ${formatDateTime(record.timestamp)}`,
          `User: ${record.user?.fullName || record.fullName || "Not recorded"}`,
          `Module: ${record.module || "Not recorded"}`,
          `Action: ${formatAuditActionLabel(record.action)}`,
          `Entity: ${record.entityLabel || record.entityName || "Not recorded"}`,
          `Description: ${record.description || "Not recorded"}`,
          `Severity: ${record.severity || "Not recorded"}`,
          `IP Address: ${record.ipAddress || "Not recorded"}`,
          ...(record.changes?.length
            ? ["", "Changes:", ...record.changes.map((change) => `- ${change.field}: ${change.oldValue ?? ""} -> ${change.newValue ?? ""}`)]
            : []),
        ].join("\n");
        pdf.setFontSize(11);
        pdf.text(pdf.splitTextToSize(content, 180), 15, 18);
        pdf.save(`audit-trail-${record.id}.pdf`);
      } catch (error) {
        showToast({
          type: "error",
          title: "Export failed",
          message: error instanceof Error ? error.message : "Could not export audit record as PDF.",
          duration: 3500,
        });
      } finally {
        setIsExporting(false);
      }
      return;
    }
    if (format === "json") {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-trail-${record.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (format === "txt") {
      const text = `
Audit Trail Record
==================
Timestamp: ${formatDateTime(record.timestamp)}
User: ${record.user?.fullName || record.fullName}${record.user?.employeeCode ? ` (${record.user.employeeCode})` : ""}
IP Address: ${record.ipAddress}
Device: ${record.device || "Not recorded"}
Module: ${record.module}
Action: ${formatAuditActionLabel(record.action)}
Entity: ${record.entityLabel || record.entityName || record.module}
Description: ${record.description}
Severity: ${record.severity}
${record.changes?.length ? `\nChanges:\n${record.changes.map(c => `- ${c.field}: "${c.oldValue}" → "${c.newValue}"`).join("\n")}` : ""}
${record.metadata && Object.keys(record.metadata).length ? `\nMetadata:\n${Object.entries(record.metadata).map(([k, v]) => `- ${k}: ${v}`).join("\n")}` : ""}
      `.trim();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `audit-trail-${record.id}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleConfirm = () => {
    if (!selectedFormat) return;
    setShowESign(true);
  };

  const handleESignConfirm = async (_reason: string) => {
    if (selectedFormat) await doExport(selectedFormat);
    setSelectedFormat(null);
    onClose();
  };

  const handleClose = () => {
    setSelectedFormat(null);
    onClose();
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title="Export Audit Record"
        description={<>Select export format for audit record <span className="font-medium text-slate-700">{record.entityLabel || record.entityName || formatAuditActionLabel(record.action)}</span></>}
        size="md"
        showCancel
        cancelText="Close"
        confirmText="Confirm"
        confirmDisabled={!selectedFormat || isExporting}
        onConfirm={handleConfirm}
      >
        <div className="space-y-2">
          {exportOptions.map(item => (
            <button
              key={item.format}
              onClick={() => setSelectedFormat(item.format)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-sm text-slate-700 border rounded-lg transition-colors",
                selectedFormat === item.format
                  ? "bg-emerald-50 border-emerald-400 ring-1 ring-emerald-400"
                  : "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300"
              )}
            >
              {item.icon}
              <div className="flex-1 text-left">
                <div className={cn("font-medium", selectedFormat === item.format && "text-emerald-700")}>{item.label}</div>
                <div className="text-xs text-slate-500">{item.desc}</div>
              </div>
              {selectedFormat === item.format && (
                <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </FormModal>

      <ESignatureModal
        isOpen={showESign}
        onClose={() => setShowESign(false)}
        onConfirm={handleESignConfirm}
        actionTitle={`Export Audit Record as ${selectedFormat?.toUpperCase()}`}
      />
    </>
  );
};
