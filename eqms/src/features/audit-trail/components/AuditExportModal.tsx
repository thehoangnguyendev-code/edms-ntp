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
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();

  const exportOptions: { format: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { format: "json", label: t("auditExport.json"), desc: t("auditExport.structuredData"), icon: <FileJson className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "json" ? "text-emerald-600" : "text-slate-500")} /> },
    { format: "pdf", label: t("auditExport.pdf"), desc: t("auditExport.printableDocument"), icon: <FileText className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "pdf" ? "text-emerald-600" : "text-slate-500")} /> },
    { format: "txt", label: t("auditExport.txt"), desc: t("auditExport.plainText"), icon: <FileType className={cn("h-4 w-4 flex-shrink-0", selectedFormat === "txt" ? "text-emerald-600" : "text-slate-500")} /> },
  ];

  const doExport = async (format: ExportFormat) => {
    if (format === "pdf") {
      setIsExporting(true);
      try {
        const pdf = new jsPDF();
        const content = [
          t("auditExport.record"),
          "",
          `${t("auditExport.timestamp")}: ${formatDateTime(record.timestamp)}`,
          `${t("auditExport.user")}: ${record.user?.fullName || record.fullName || t("auditExport.notRecorded")}`,
          `${t("auditExport.module")}: ${record.module || t("auditExport.notRecorded")}`,
          `${t("auditExport.action")}: ${formatAuditActionLabel(record.action)}`,
          `${t("auditExport.entity")}: ${record.entityLabel || record.entityName || t("auditExport.notRecorded")}`,
          `${t("auditExport.description")}: ${record.description || t("auditExport.notRecorded")}`,
          `${t("auditExport.severity")}: ${record.severity || t("auditExport.notRecorded")}`,
          `${t("auditExport.ipAddress")}: ${record.ipAddress || t("auditExport.notRecorded")}`,
          ...(record.changes?.length
            ? ["", `${t("auditExport.changes")}:`, ...record.changes.map((change) => `- ${change.field}: ${change.oldValue ?? ""} -> ${change.newValue ?? ""}`)]
            : []),
        ].join("\n");
        pdf.setFontSize(11);
        pdf.text(pdf.splitTextToSize(content, 180), 15, 18);
        pdf.save(`audit-trail-${record.id}.pdf`);
      } catch (error) {
        showToast({
          type: "error",
          title: t("auditExport.failedTitle"),
          message: error instanceof Error ? error.message : t("auditExport.pdfFailed"),
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
        title={t("auditExport.title")}
        description={<>{t("auditExport.selectFormat")} <span className="font-medium text-slate-700">{record.entityLabel || record.entityName || formatAuditActionLabel(record.action)}</span></>}
        size="md"
        showCancel
        cancelText={t("common.close")}
        confirmText={t("auditExport.confirm")}
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
