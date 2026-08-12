import React, { useState, useEffect } from "react";
import { ExternalLink, Video, Users as UsersIcon } from "lucide-react";
import { Select } from "@/components/ui/select/Select";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { DateTimePicker } from "@/components/ui/datetime-picker/DateTimePicker";
import { Input, Textarea } from "@/components/ui/form/ResponsiveForm";
import { RadioGroup } from "@/components/ui/radio";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { cn } from "@/components/ui/utils";
import { formatDateUS } from "@/utils/format";
import { TrainingType, TrainingMethod, Recurrence } from "../../types";

// Option lists (shared between edit and readOnly modes)
const TRAINING_TYPE_OPTIONS = [
  { label: "GMP", value: "GMP" },
  { label: "Safety", value: "Safety" },
  { label: "Technical", value: "Technical" },
  { label: "Compliance", value: "Compliance" },
  { label: "SOP", value: "SOP" },
  { label: "Software", value: "Software" },
];

const TRAINING_METHOD_OPTIONS = [
  { label: "Read & Understood", value: "Read & Understood" },
  { label: "Quiz (Paper-based/Manual)", value: "Quiz (Paper-based/Manual)" },
  { label: "Hands-on / OJT", value: "Hands-on/OJT" },
];

const INSTRUCTOR_OPTIONS = [
  { label: "Dr. John Smith - Quality Manager", value: "john_smith" },
  { label: "Ms. Sarah Johnson - QA Lead", value: "sarah_johnson" },
  { label: "Mr. Michael Brown - Production Manager", value: "michael_brown" },
  { label: "Dr. Emily Davis - R&D Director", value: "emily_davis" },
  { label: "Mr. David Wilson - Compliance Officer", value: "david_wilson" },
];

const DEPARTMENT_OPTIONS = [
  { label: "Quality Assurance (QA)", value: "qa" },
  { label: "Quality Control (QC)", value: "qc" },
  { label: "Production", value: "production" },
  { label: "Research & Development (R&D)", value: "rnd" },
  { label: "Regulatory Affairs", value: "regulatory" },
  { label: "Warehouse", value: "warehouse" },
  { label: "Maintenance", value: "maintenance" },
  { label: "Engineering", value: "engineering" },
  { label: "Human Resources (HR)", value: "hr" },
  { label: "Finance & Accounting", value: "finance" },
  { label: "Procurement", value: "procurement" },
  { label: "Logistics", value: "logistics" },
  { label: "IT Department", value: "it" },
  { label: "Safety & Environment", value: "safety" },
  { label: "Management", value: "management" },
];

const USER_OPTIONS = [
  { label: "John Smith - Quality Manager", value: "john_smith" },
  { label: "Sarah Johnson - QA Lead", value: "sarah_johnson" },
  { label: "Michael Brown - Production Manager", value: "michael_brown" },
  { label: "Emily Davis - R&D Director", value: "emily_davis" },
  { label: "David Wilson - Compliance Officer", value: "david_wilson" },
  { label: "Lisa Anderson - QC Analyst", value: "lisa_anderson" },
  { label: "Robert Taylor - Production Supervisor", value: "robert_taylor" },
  { label: "Jennifer Martinez - QA Specialist", value: "jennifer_martinez" },
  { label: "William Garcia - Lab Technician", value: "william_garcia" },
  { label: "Mary Robinson - Regulatory Specialist", value: "mary_robinson" },
  { label: "James Lee - Warehouse Manager", value: "james_lee" },
  { label: "Patricia Clark - HR Manager", value: "patricia_clark" },
  { label: "Thomas White - IT Manager", value: "thomas_white" },
  { label: "Linda Harris - Finance Director", value: "linda_harris" },
  { label: "Charles Lewis - Safety Officer", value: "charles_lewis" },
];

const MOCK_DOCUMENT_OPTIONS = [
  {
    label: "SOP.0045.02 - Corrective and Preventive Action (CAPA)",
    value: "SOP.0045.02",
  },
  { label: "WI.0123.01 - Labeling Instructions", value: "WI.0123.01" },
  { label: "POL.0001.05 - Quality Policy", value: "POL.0001.05" },
  { label: "SOP.0089.04 - Document Control", value: "SOP.0089.04" },
  { label: "FRM.0056.03 - Training Record Form", value: "FRM.0056.03" },
  { label: "SOP.QA.001 - Good Manufacturing Practices", value: "SOP-QA-001" },
  { label: "DOC-001 - Safety Guidelines", value: "DOC-001" },
];

/** Read-only display field */
const ReadOnlyField: React.FC<{
  value: string | number | undefined | null;
  placeholder?: string;
}> = ({ value, placeholder }) => (
  <p className="text-sm text-slate-900 h-9 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-lg">
    {value || <span className="text-slate-400">{placeholder || "—"}</span>}
  </p>
);

/** Auto-generate a course ID (prefix + timestamp-based suffix) */
const generateCourseId = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `TRN-${year}-${seq}`;
};

interface BasicInfoTabProps {
  readOnly?: boolean;
  // Data props
  courseId: string;
  createdAt?: string;
  courseName: string;
  description: string;
  trainingType: TrainingType;
  trainingMethod: TrainingMethod;
  instructorType: "internal" | "external";
  instructor: string;
  scheduledDate: string;
  duration: number;
  location: string;
  capacity: number;
  recurrence: Recurrence;
  linkedDocumentIds?: (string | number)[];
  linkedDocumentId?: string; // Kept for legacy compatibility
  linkedDocumentTitle?: string; // Kept for legacy compatibility
  evidenceFiles: File[];
  // Lifecycle & Review props
  periodicReviewCycle?: number;
  periodicReviewNotification?: number;
  effectiveDate?: string;
  validUntil?: string;
  reviewDate?: string;
  // Setter props (optional — only needed when not readOnly)
  setCourseId?: (v: string) => void;
  setCourseName?: (v: string) => void;
  setDescription?: (v: string) => void;
  setTrainingType?: (v: TrainingType) => void;
  setTrainingMethod?: (v: TrainingMethod) => void;
  setInstructorType?: (v: "internal" | "external") => void;
  setInstructor?: (v: string) => void;
  setScheduledDate?: (v: string) => void;
  setDuration?: (v: number) => void;
  setLocation?: (v: string) => void;
  setCapacity?: (v: number) => void;
  setRecurrence?: (v: Recurrence) => void;
  setLinkedDocumentIds?: (v: (string | number)[]) => void;
  setLinkedDocumentId?: (v: string) => void;
  setLinkedDocumentTitle?: (v: string) => void;
  setEvidenceFiles?: (v: File[]) => void;
  setPeriodicReviewCycle?: (v: number) => void;
  setPeriodicReviewNotification?: (v: number) => void;
  setEffectiveDate?: (v: string) => void;
  setValidUntil?: (v: string) => void;
  setReviewDate?: (v: string) => void;
}

const PLATFORM_OPTIONS = [
  { label: "Zoom", value: "Zoom" },
  { label: "Google Meet", value: "Google Meet" },
  { label: "Microsoft Teams", value: "Microsoft Teams" },
  { label: "Other", value: "Other" },
];

export const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
  readOnly = false,
  courseId,
  setCourseId,
  createdAt,
  courseName,
  setCourseName,
  description,
  setDescription,
  trainingType,
  setTrainingType,
  trainingMethod,
  setTrainingMethod,
  instructorType,
  setInstructorType,
  instructor,
  setInstructor,
  scheduledDate,
  setScheduledDate,
  duration,
  setDuration,
  location,
  setLocation,
  capacity,
  setCapacity,
  recurrence,
  setRecurrence,
  linkedDocumentIds = [],
  setLinkedDocumentIds,
  linkedDocumentId,
  setLinkedDocumentId,
  linkedDocumentTitle,
  setLinkedDocumentTitle,
  evidenceFiles,
  setEvidenceFiles,
  periodicReviewCycle,
  setPeriodicReviewCycle,
  periodicReviewNotification,
  setPeriodicReviewNotification,
  effectiveDate,
  setEffectiveDate,
  validUntil,
  setValidUntil,
  reviewDate,
  setReviewDate,
}) => {
  // Defensive check for recurrence data
  const safeRecurrence = recurrence || {
    enabled: false,
    intervalMonths: 0,
    warningPeriodDays: 30,
  };

  // Parsing location for internal state
  const parseLocation = (loc: string) => {
    const match = loc.match(
      /^\[(Zoom|Google Meet|Microsoft Teams|Other)\]\s*(.*)$/,
    );
    if (match) {
      return { type: "online" as const, platform: match[1], link: match[2] };
    }
    return { type: "onsite" as const, platform: "Zoom", link: loc };
  };

  const initialLocation = parseLocation(location || "");
  const [locationType, setLocationType] = useState<"onsite" | "online">(
    initialLocation.type,
  );
  const [platform, setPlatform] = useState(initialLocation.platform);
  const [meetingLink, setMeetingLink] = useState(initialLocation.link);

  // Sync internal state to parent when not in readOnly
  useEffect(() => {
    if (readOnly) return;
    if (locationType === "online") {
      setLocation?.(`[${platform}] ${meetingLink}`);
    } else {
      setLocation?.(meetingLink); // For onsite, meetingLink stores the physical location
    }
  }, [locationType, platform, meetingLink, setLocation, readOnly]);

  // Resolve label from value for readOnly display
  const findLabel = (
    options: { label: string; value: string }[],
    value: string,
  ) => options.find((o) => o.value === value)?.label || value;

  return (
    <div className="p-4 md:p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-1">
          {/* Course ID */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Course ID
            </label>
            <ReadOnlyField value={courseId} placeholder="Auto-generated" />
          </div>

          {/* Created Time */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Created Time
            </label>
            <ReadOnlyField value={createdAt || undefined} placeholder="—" />
          </div>
        </div>

        {/* Course Name */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Course Name {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField value={courseName} />
            ) : (
              <Input
                type="text"
                value={courseName}
                onChange={(e) => setCourseName?.(e.target.value)}
                placeholder="e.g., GMP Basic Training"
                className="text-sm"
              />
            )}
          </div>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Course description{" "}
              {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <p className="text-sm text-slate-900 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg leading-relaxed whitespace-pre-wrap min-h-[4rem]">
                {description || <span className="text-slate-400">—</span>}
              </p>
            ) : (
              <Textarea
                value={description}
                onChange={(e) => setDescription?.(e.target.value)}
                rows={3}
                placeholder="Describe the training objectives and content..."
              />
            )}
          </div>
        </div>

        {/* Training Type */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Training Type{" "}
              {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField
                value={findLabel(TRAINING_TYPE_OPTIONS, trainingType)}
              />
            ) : (
              <Select
                value={trainingType}
                onChange={setTrainingType!}
                options={TRAINING_TYPE_OPTIONS}
              />
            )}
          </div>
        </div>

        {/* Training Method */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Training Method{" "}
              {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField
                value={findLabel(TRAINING_METHOD_OPTIONS, trainingMethod)}
              />
            ) : (
              <Select
                value={trainingMethod}
                onChange={(v) => setTrainingMethod?.(v as TrainingMethod)}
                options={TRAINING_METHOD_OPTIONS}
              />
            )}
            <p className="text-xs text-slate-500">
              {trainingMethod === "Read & Understood" &&
                "Employee reads document then confirms with e-signature."}
              {trainingMethod === "Quiz (Paper-based/Manual)" &&
                "Employee completes a paper-based exam graded manually by trainer/admin."}
              {trainingMethod === "Hands-on/OJT" &&
                "Trainer must sign off to confirm practical competency."}
            </p>
          </div>
        </div>

        {/* Instructor */}
        <div className="md:col-span-2">
          <div className="flex flex-col gap-3">
            <RadioGroup
              label="Instructor"
              name="instructorType"
              value={instructorType}
              onChange={(value) => {
                if (!readOnly) {
                  setInstructorType?.(value as "internal" | "external");
                  setInstructor?.("");
                }
              }}
              options={[
                { label: "Internal expert", value: "internal" },
                { label: "External expert/consultant", value: "external" },
              ]}
              layout="horizontal"
              required={!readOnly}
            />

            {instructorType === "internal" ? (
              <div className={cn(readOnly && "pointer-events-none")}>
                <Select
                  value={instructor}
                  onChange={setInstructor!}
                  options={INSTRUCTOR_OPTIONS}
                  placeholder="Select internal instructor..."
                />
              </div>
            ) : (
              <Input
                type="text"
                value={instructor}
                onChange={(e) => !readOnly && setInstructor?.(e.target.value)}
                placeholder="Enter external instructor name..."
                readOnly={readOnly}
                className="text-sm"
              />
            )}
          </div>
        </div>

        {/* Scheduled Date */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Scheduled Date{" "}
              {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField
                value={scheduledDate ? formatDateUS(scheduledDate) : undefined}
              />
            ) : (
              <DateTimePicker
                value={scheduledDate}
                onChange={setScheduledDate!}
                placeholder="Select date and time"
              />
            )}
          </div>
        </div>

        {/* Duration */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Duration (hours){" "}
              {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField
                value={duration ? `${duration} hours` : undefined}
              />
            ) : (
              <Input
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration?.(parseInt(e.target.value) || 1)}
                className="text-sm"
              />
            )}
          </div>
        </div>

        {/* Location */}
        <div className="md:col-span-2">
          <div className="flex flex-col gap-3">
            <RadioGroup
              label="Location Type"
              name="locationType"
              value={locationType}
              onChange={(v) => {
                if (!readOnly) {
                  const type = v as "onsite" | "online";
                  setLocationType(type);
                  setMeetingLink(""); // Clear when switching
                }
              }}
              options={[
                { label: "On-site (Physical)", value: "onsite" },
                { label: "Online (Virtual)", value: "online" },
              ]}
              layout="horizontal"
              required={!readOnly}
            />

            {locationType === "onsite" ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs sm:text-sm font-medium text-slate-700">
                  Physical Location{" "}
                  {!readOnly && <span className="text-red-500">*</span>}
                </label>
                {readOnly ? (
                  <ReadOnlyField value={meetingLink} />
                ) : (
                  <Input
                    type="text"
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="e.g., Training Room A"
                    className="text-sm"
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">
                    Platform{" "}
                    {!readOnly && <span className="text-red-500">*</span>}
                  </label>
                  {readOnly ? (
                    <ReadOnlyField value={platform} />
                  ) : (
                    <Select
                      value={platform}
                      onChange={(v) => setPlatform(v)}
                      options={PLATFORM_OPTIONS}
                    />
                  )}
                </div>
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs sm:text-sm font-medium text-slate-700">
                    Meeting Link{" "}
                    {!readOnly && <span className="text-red-500">*</span>}
                  </label>
                  {readOnly ? (
                    meetingLink ? (
                      <a
                        href={
                          meetingLink.startsWith("http")
                            ? meetingLink
                            : `https://${meetingLink}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium h-9 flex items-center px-3 bg-emerald-50 border border-emerald-200 rounded-lg transition-colors gap-2 group w-full overflow-hidden"
                      >
                        <Video className="h-4 w-4 shrink-0" />
                        <span className="truncate flex-1">{meetingLink}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    ) : (
                      <ReadOnlyField
                        value={null}
                        placeholder="No link provided"
                      />
                    )
                  ) : (
                    <Input
                      type="text"
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder={
                        platform === "Zoom"
                          ? "https://zoom.us/j/..."
                          : platform === "Google Meet"
                            ? "https://meet.google.com/..."
                            : platform === "Microsoft Teams"
                              ? "https://teams.microsoft.com/..."
                              : "Enter meeting link..."
                      }
                      className="text-sm"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Capacity */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Capacity {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField
                value={capacity ? `${capacity} participants` : undefined}
              />
            ) : (
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity?.(parseInt(e.target.value) || 1)}
                className="text-sm"
              />
            )}
          </div>
        </div>

        {/* Periodic Review Cycle & Notification */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Periodic Review Cycle (Months) {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField value={periodicReviewCycle} placeholder="e.g. 24" />
            ) : (
              <input
                type="number"
                value={periodicReviewCycle || ""}
                onChange={(e) => setPeriodicReviewCycle?.(parseInt(e.target.value) || 0)}
                placeholder="e.g. 24"
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
              />
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Periodic Review Notification (Days) {!readOnly && <span className="text-red-500">*</span>}
            </label>
            {readOnly ? (
              <ReadOnlyField value={periodicReviewNotification} placeholder="e.g. 30" />
            ) : (
              <input
                type="number"
                value={periodicReviewNotification || ""}
                onChange={(e) => setPeriodicReviewNotification?.(parseInt(e.target.value) || 0)}
                placeholder="e.g. 30"
                className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400 transition-colors"
              />
            )}
          </div>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Effective Date</label>
            <ReadOnlyField value={effectiveDate} placeholder="Set when approved" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Valid Until</label>
            <ReadOnlyField value={validUntil} placeholder="Set when approved" />
          </div>
        </div>

        {/* Review Date row */}
        <div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">Review Date</label>
            <ReadOnlyField value={reviewDate} placeholder="YYYY-MM-DD" />
          </div>
        </div>

        {/* Linked Document */}
        <div className="md:col-span-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs sm:text-sm font-medium text-slate-700">
              Linked Document{" "}
              {!readOnly && (
                <span className="text-xs font-normal text-slate-400">
                  (optional)
                </span>
              )}
            </label>
            {readOnly ? (
              <div className="flex flex-wrap gap-2 min-h-9 p-2 bg-slate-50 border border-slate-200 rounded-lg">
                {linkedDocumentIds && linkedDocumentIds.length > 0 ? (
                  linkedDocumentIds.map((id) => {
                    const doc = MOCK_DOCUMENT_OPTIONS.find(
                      (d) => d.value === id,
                    );
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200"
                      >
                        {doc ? doc.label : id}
                      </span>
                    );
                  })
                ) : linkedDocumentId ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200">
                    {linkedDocumentTitle
                      ? `${linkedDocumentId} - ${linkedDocumentTitle}`
                      : linkedDocumentId}
                  </span>
                ) : (
                  <span className="text-sm text-slate-400 px-1">—</span>
                )}
              </div>
            ) : (
              <MultiSelect
                value={linkedDocumentIds}
                onChange={setLinkedDocumentIds!}
                options={MOCK_DOCUMENT_OPTIONS}
                placeholder="Select documents to link..."
                enableSearch={true}
              />
            )}
            {!readOnly && (
              <p className="text-xs text-slate-500">
                Search and select controlled documents this training is based
                on.
              </p>
            )}
          </div>
        </div>

        {/* Recurrence */}
        <div className="md:col-span-2">
          <div className="flex flex-col gap-3">
            <Checkbox
              id="recurrence-enabled"
              label="Enable Periodic Retraining"
              checked={safeRecurrence.enabled}
              onChange={(v) =>
                !readOnly && setRecurrence?.({ ...safeRecurrence, enabled: v })
              }
            />
            {safeRecurrence.enabled && (
              <div className="flex flex-col gap-3 ml-6">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-700 whitespace-nowrap w-32">
                    Retrain every
                  </label>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      value={safeRecurrence.intervalMonths}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        !readOnly &&
                        setRecurrence?.({
                          ...safeRecurrence,
                          intervalMonths: parseInt(e.target.value) || 12,
                        })
                      }
                      readOnly={readOnly}
                      className="text-sm text-center"
                    />
                  </div>
                  <label className="text-sm text-slate-700">months</label>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-700 whitespace-nowrap w-32">
                    Warning Period
                  </label>
                  <div className="w-24">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={safeRecurrence.warningPeriodDays || 30}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        !readOnly &&
                        setRecurrence?.({
                          ...safeRecurrence,
                          warningPeriodDays: parseInt(e.target.value) || 30,
                        })
                      }
                      readOnly={readOnly}
                      className="text-sm text-center"
                    />
                  </div>
                  <label className="text-sm text-slate-700">days</label>
                </div>

                <p className="text-xs text-slate-500">
                  When due, employee status will automatically change from{" "}
                  <strong>Completed</strong> to <strong>Required</strong> and a
                  notification will be sent.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
