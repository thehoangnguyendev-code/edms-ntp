import React, { useState } from "react";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import {
  Download,
  FileText,
  Calendar,
  Users,
  Settings,
  ShieldCheck,
  History,
  AlertCircle,
  FileArchive
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { exportRecords } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useNavigateWithLoading } from "@/hooks";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { DateRangePicker } from "@/components/ui/datetime-picker/DateRangePicker";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { formatDateUS } from "@/utils/format";
import { FormSection } from "@/components/ui/form";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { IconClipboardData } from "@tabler/icons-react";
import { navigateBack } from "@/app/navigation/backNavigation";
import { ROUTES } from "@/app/routes.constants";

interface ExportConfig {
  reportType: string;
  dateFrom: string;
  dateTo: string;
  department: string;
  includeScores: boolean;
  includeAttendance: boolean;
  includeCertificates: boolean;
  format: string;
  // EU-GMP Compliance Options
  watermarkType: "" | "None" | "Uncontrolled" | "For Audit Only" | "Confidential";
  includeAuditTrail: boolean;
  includeHistoricalRecords: boolean;
  exceptionsOnly: boolean;
  outputStructure: "" | "single_pdf" | "zip_dossiers";
}

export const ExportTrainingRecordsView: React.FC = () => {
  const { navigateTo, isNavigating } = useNavigateWithLoading();

  const [config, setConfig] = useState<ExportConfig>({
    reportType: "",
    dateFrom: "",
    dateTo: "",
    department: "",
    includeScores: true,
    includeAttendance: true,
    includeCertificates: false,
    format: "",
    watermarkType: "",
    includeAuditTrail: false,
    includeHistoricalRecords: true,
    exceptionsOnly: false,
    outputStructure: "",
  });

  const [isESignOpen, setIsESignOpen] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const reportTypeOptions = [
    { label: "Individual Training Record", value: "individual" },
    { label: "Department Summary", value: "department" },
    { label: "Course Completion Report", value: "course" },
    { label: "Compliance Matrix", value: "matrix" },
    { label: "Audit Trail", value: "audit" },
  ];

  const departmentOptions = [
    { label: "All Departments", value: "All" },
    { label: "Quality Assurance", value: "Quality Assurance" },
    { label: "Quality Control", value: "Quality Control" },
    { label: "Production", value: "Production" },
    { label: "Documentation", value: "Documentation" },
    { label: "Engineering", value: "Engineering" },
  ];

  const formatOptions = [
    { label: "PDF Document (.pdf)", value: "pdf" },
    { label: "Excel Spreadsheet (.xlsx)", value: "excel" },
    { label: "CSV File (.csv)", value: "csv" },
  ];

  const watermarkOptions = [
    { label: "None (Clean)", value: "None" },
    { label: "UNCONTROLLED COPY", value: "Uncontrolled" },
    { label: "FOR AUDIT ONLY", value: "For Audit Only" },
    { label: "STRICTLY CONFIDENTIAL", value: "Confidential" },
  ];

  const outputStructureOptions = [
    { label: "Single Combined File", value: "single_pdf" },
    { label: "Individual Files (ZIP Archive)", value: "zip_dossiers" },
  ];

  const areRequiredSelectsValid =
    config.reportType.trim().length > 0 &&
    config.department.trim().length > 0 &&
    config.format.trim().length > 0 &&
    (config.format !== "pdf" ||
      (config.outputStructure.trim().length > 0 && config.watermarkType.trim().length > 0));

  const handleExport = () => {
    setIsESignOpen(true);
  };

  const onConfirmExport = async (reason: string) => {
    console.log("Confirmed Export with E-Signature:", { ...config, eSignReason: reason });
    setIsESignOpen(false);
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      {/* Header: Title + Breadcrumb */}
      <PageHeader
        title="Export Training Records"
        breadcrumbItems={exportRecords(navigateTo)}
      />

      {/* Export Configuration Form */}
      <FormSection
        title="Export Configuration"
        icon={<IconClipboardData  className="h-4 w-4" />}
      >
        <div className="space-y-6">
          {/* Row 1: Report Type & Department */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Select
                label={<><span>Report Type</span> <span className="text-red-500">*</span></>}
                value={config.reportType}
                onChange={(val) => setConfig((prev) => ({ ...prev, reportType: val }))}
                options={reportTypeOptions}
                placeholder="Select report type"
              />
            </div>

            <div>
              <Select
                label={<><span>Department</span> <span className="text-red-500">*</span></>}
                value={config.department}
                onChange={(val) => setConfig((prev) => ({ ...prev, department: val }))}
                options={departmentOptions}
                placeholder="Select department"
              />
            </div>
          </div>

          {/* Row 2: Date Range + Export Format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <DateRangePicker
                label={<><span>Date Range</span> <span className="text-red-500">*</span></>}
                startDate={config.dateFrom}
                endDate={config.dateTo}
                onStartDateChange={(val) => setConfig((prev) => ({ ...prev, dateFrom: val }))}
                onEndDateChange={(val) => setConfig((prev) => ({ ...prev, dateTo: val }))}
                placeholder="Select date range"
              />
            </div>

            <div>
              <Select
                label={<><span>Export Format</span> <span className="text-red-500">*</span></>}
                value={config.format}
                onChange={(val) => setConfig((prev) => ({
                  ...prev,
                  format: val,
                  outputStructure: val === "pdf" ? prev.outputStructure : "",
                  watermarkType: val === "pdf" ? prev.watermarkType : "",
                }))}
                options={formatOptions}
                placeholder="Select export format"
              />
            </div>
          </div>

          {/* Row 3: Output Structure + Document Watermark */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Select
                label={<><span>Output Structure</span> <span className="text-red-500">*</span></>}
                value={config.outputStructure}
                onChange={(val) => setConfig((prev) => ({ ...prev, outputStructure: val as any }))}
                options={outputStructureOptions}
                disabled={config.format !== "pdf"}
                placeholder="Select output structure"
              />
            </div>
            <div>
              <Select
                label={<><span>Document Watermark</span> <span className="text-red-500">*</span></>}
                value={config.watermarkType}
                onChange={(val) => setConfig((prev) => ({ ...prev, watermarkType: val as any }))}
                options={watermarkOptions}
                disabled={config.format !== "pdf"}
                placeholder="Select watermark"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-6"></div>

          {/* Include Options & Compliance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <FormSection
              title="Content Selection"
              icon={<FileText className="h-4 w-4" />}
              className="h-full"
            >
              <div className="space-y-3">
                <Checkbox
                  id="includeScores"
                  label="Include Test Scores and Assessments"
                  checked={config.includeScores}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeScores: checked }))
                  }
                />
                <Checkbox
                  id="includeAttendance"
                  label="Include Attendance Records"
                  checked={config.includeAttendance}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeAttendance: checked }))
                  }
                />
                <Checkbox
                  id="includeCertificates"
                  label="Include Training Certificates"
                  checked={config.includeCertificates}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeCertificates: checked }))
                  }
                  disabled={config.format !== "pdf"}
                />
              </div>
            </FormSection>

            <FormSection
              title="EU-GMP Compliance Options"
              icon={<ShieldCheck className="h-4 w-4" />}
              className="h-full"
            >
              <div className="space-y-3">
                <Checkbox
                  id="includeAuditTrail"
                  label="Include Data Change History (Audit Trail)"
                  checked={config.includeAuditTrail}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeAuditTrail: checked }))
                  }
                />
                <Checkbox
                  id="includeHistoricalRecords"
                  label="Include Historical Retraining Records"
                  checked={config.includeHistoricalRecords}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, includeHistoricalRecords: checked }))
                  }
                />
                <Checkbox
                  id="exceptionsOnly"
                  label="Compliance Gaps Only (Exception Report)"
                  checked={config.exceptionsOnly}
                  onChange={(checked) =>
                    setConfig((prev) => ({ ...prev, exceptionsOnly: checked }))
                  }
                />
              </div>
            </FormSection>
          </div>

        </div>
      </FormSection>

      {/* Export Preview */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5">
        <h3 className="text-xs md:text-sm font-semibold text-slate-900 mb-3 md:mb-4">Export Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-4">
          <div className="flex items-center gap-1.5 md:gap-2">
            <FileText className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-slate-500" />
            <span className="text-xs md:text-sm text-slate-600">Report Type:</span>
            <span className="text-xs md:text-sm font-medium text-slate-900 truncate">
              {reportTypeOptions.find((opt) => opt.value === config.reportType)?.label || "Not selected"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Users className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-slate-500" />
            <span className="text-xs md:text-sm text-slate-600">Department:</span>
            <span className="text-xs md:text-sm font-medium text-slate-900 truncate">{config.department || "Not selected"}</span>
          </div>
          {config.dateFrom && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-slate-500" />
              <span className="text-xs md:text-sm text-slate-600">From:</span>
              <span className="text-xs md:text-sm font-medium text-slate-900">
                {formatDateUS(config.dateFrom)}
              </span>
            </div>
          )}
          {config.dateTo && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-slate-500" />
              <span className="text-xs md:text-sm text-slate-600">To:</span>
              <span className="text-xs md:text-sm font-medium text-slate-900">
                {formatDateUS(config.dateTo)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 md:gap-2">
            <Download className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-slate-500" />
            <span className="text-xs md:text-sm text-slate-600">Format:</span>
            <span className="text-xs md:text-sm font-medium text-slate-900 uppercase">
              {config.format ? `${config.format} ${config.outputStructure === 'zip_dossiers' ? '(ZIP)' : ''}` : "Not selected"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <ShieldCheck className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-emerald-500" />
            <span className="text-xs md:text-sm text-slate-600">GxP Control:</span>
            <span className="text-xs md:text-sm font-medium text-emerald-600">
              {config.format !== "pdf"
                ? "N/A"
                : config.watermarkType
                  ? config.watermarkType !== "None"
                    ? config.watermarkType
                    : "Standard"
                  : "Not selected"}
            </span>
          </div>
          {config.includeAuditTrail && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <History className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-blue-500" />
              <span className="text-xs md:text-sm text-slate-600">Audit Trail:</span>
              <span className="text-xs md:text-sm font-medium text-slate-900">Included</span>
            </div>
          )}
          {config.exceptionsOnly && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <AlertCircle className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0 text-red-500" />
              <span className="text-xs md:text-sm text-slate-600">Scope:</span>
              <span className="text-xs md:text-sm font-medium text-red-600">Gaps Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="outline-emerald"
          size="sm"
          onClick={() => { navigateBack(navigateTo as any, null, ROUTES.TRAINING.EMPLOYEE_TRAINING_FILES); }}
          className="whitespace-nowrap"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleExport}
          disabled={!areRequiredSelectsValid}
          className="default whitespace-nowrap"
        >
          Sign and Generate Export
        </Button>
      </div>

      <ESignatureModal
        isOpen={isESignOpen}
        onClose={() => setIsESignOpen(false)}
        onConfirm={onConfirmExport}
        actionTitle="Authorize GxP Data Export"
        targetDetails={{
          title: reportTypeOptions.find(o => o.value === config.reportType)?.label || 'Báo cáo đào tạo',
          code: `EXPORT-${config.format.toUpperCase()}`,
          revision: config.department
        }}
      />

      {/* ─── Loading Overlays ─────────────────────────────────── */}
      {(isNavigating || initialLoading) && <FullPageLoading text={initialLoading ? "Preparing Export Module..." : "Loading..."} />}
    </div>
  );
};
