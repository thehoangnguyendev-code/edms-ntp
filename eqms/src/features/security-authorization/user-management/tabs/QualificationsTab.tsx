import React, { useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { Briefcase, Plus, Eye, MoreVertical, Trash2 } from "lucide-react";
import { EditableField } from "../components/ProfileSectionCard";
import type { SectionKey } from "../components/ProfileSectionCard";
import { CertAddModal } from "../components/CertAddModal";
import { EducationAddModal } from "../components/EducationAddModal";
import { CertPreviewModal } from "../components/CertPreviewModal";
import { Button } from "@/components/ui/button/Button";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { formatDate } from "@/utils/format";
import { cn } from "@/components/ui/utils";
import type { User, Certification, EducationItem } from "../types";
import { IconCertificate, IconSchool, IconPencilMinus, IconEdit } from "@tabler/icons-react";
import { usePortalDropdown } from "@/hooks";
import { StatusBadge } from "@/components/ui/badge";
import { FormSection } from "@/components/ui/form/FormSection";

interface QualificationsTabProps {
  user: User;
  draft: User;
  editingSection: SectionKey | null;
  isDraftDirty: boolean;
  fieldErrors: Partial<Record<keyof User, string>>;
  certifications: Certification[];
  educationList?: EducationItem[];
  canEdit?: boolean;
  onSectionEdit: (section: SectionKey) => void;
  onSectionSave: (section: SectionKey) => void;
  onSectionCancel: () => void;
  onSectionReset: () => void;
  onDraftChange: (key: keyof User, value: string) => void;
  onCertSave: (data: Omit<Certification, "id">, editing: Certification | null, file: File | null) => void;
  onCertDelete: (id: string) => void;
  onEduSave: (data: Omit<EducationItem, "id">, editing: EducationItem | null) => void;
  onEduDelete: (id: string) => void;
}

export const QualificationsTab: React.FC<QualificationsTabProps> = ({
  user,
  draft,
  editingSection,
  isDraftDirty,
  fieldErrors,
  certifications,
  educationList = [],
  canEdit = true,
  onSectionEdit,
  onSectionSave,
  onSectionCancel,
  onSectionReset,
  onDraftChange,
  onCertSave,
  onCertDelete,
  onEduSave,
  onEduDelete,
}) => {
  const isEducationEditing = editingSection === "education";
  const isExpertiseEditing = editingSection === "expertise";

  const [certAddOpen, setCertAddOpen] = useState(false);
  const [certEditing, setCertEditing] = useState<Certification | null>(null);
  const [certPreview, setCertPreview] = useState<Certification | null>(null);
  const [certDeleteId, setCertDeleteId] = useState<string | null>(null);

  const [eduAddOpen, setEduAddOpen] = useState(false);
  const [eduEditing, setEduEditing] = useState<EducationItem | null>(null);
  const [eduDeleteId, setEduDeleteId] = useState<string | null>(null);
  const { openId, position, getRef, toggle, close } = usePortalDropdown();




  const handleOpenAdd = () => {
    setCertEditing(null);
    setCertAddOpen(true);
  };

  const handleOpenEdit = (cert: Certification) => {
    setCertEditing(cert);
    setCertAddOpen(true);
  };

  const handleCertSave = (data: Omit<Certification, "id">, file: File | null) => {
    onCertSave(data, certEditing, file);
    setCertAddOpen(false);
    setCertEditing(null);
  };

  const handleEduOpenAdd = () => {
    setEduEditing(null);
    setEduAddOpen(true);
  };

  const handleEduOpenEdit = (edu: EducationItem) => {
    setEduEditing(edu);
    setEduAddOpen(true);
  };

  const handleEduSave = (data: Omit<EducationItem, "id">) => {
    onEduSave(data, eduEditing);
    setEduAddOpen(false);
    setEduEditing(null);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 auto-rows-min">
      {/* Education List */}
      {/* Education List */}
      <FormSection
        title="Education Details"
        icon={<IconSchool className="h-4 w-4" />}
        className="flex flex-col min-h-[400px]"
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button variant="default" size="sm" onClick={handleEduOpenAdd} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Add Education
              </Button>
            )}
          </div>
        }
      >
        <div className="flex-1 overflow-y-auto">
          {educationList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-slate-400">
              <IconSchool className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No education items recorded</p>
              <p className="text-xs mt-1">Add your degrees and academic qualifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...(educationList ?? [])]
                .sort((a, b) => parseInt(b.graduationYear || "0") - parseInt(a.graduationYear || "0"))
                .map((edu, idx) => (
                  <div key={edu.id} className="p-4 hover:bg-slate-50 transition-colors group relative flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center gap-1.5 shrink-0 mt-0.5">
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight mb-1">{edu.degree}</p>
                        <p className="text-xs font-medium text-emerald-600 mb-1">{edu.fieldOfStudy} - <span className="text-slate-500 font-medium">{edu.institution}</span></p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5">
                          <StatusBadge
                            status="draft"
                            size="sm"
                            label={`${edu.graduationYear}`}
                          />
                          {edu.gpa && (
                            <StatusBadge
                              status="approved"
                              size="sm"
                              label={`GPA ${edu.gpa}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleEduOpenEdit(edu)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title="Edit"
                        >
                          <IconPencilMinus className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEduDeleteId(edu.id)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </FormSection>

      {/* Professional Expertise */}
      <FormSection
        title="Professional Expertise"
        icon={<Briefcase className="h-4 w-4" />}
        className={cn(isExpertiseEditing && "border-emerald-300 ring-1 ring-emerald-200")}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {isExpertiseEditing ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline-emerald" size="sm" onClick={onSectionReset} disabled={!isDraftDirty} className="sm:h-9 sm:px-4 sm:text-sm">
                  Reset
                </Button>
                <Button variant="outline-emerald" size="sm" onClick={onSectionCancel} className="sm:h-9 sm:px-4 sm:text-sm">
                  Cancel
                </Button>
                <Button variant="outline-emerald" size="sm" onClick={() => onSectionSave("expertise")} className="sm:h-9 sm:px-4 sm:text-sm">
                  Save
                </Button>
              </div>
            ) : canEdit ? (
              <Button variant="default" size="sm" onClick={() => onSectionEdit("expertise")} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                <IconPencilMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <EditableField
            label="Professional Level" value={user.professionalLevel} draftValue={draft.professionalLevel}
            isEditing={isExpertiseEditing}
            field={{ type: "text", fieldKey: "professionalLevel" }}
            onChange={onDraftChange}
            placeholder="e.g. Senior, Specialist, Manager"
            className="col-span-2"
            error={fieldErrors.professionalLevel}
            />
          <EditableField
            label="Area of Expertise" value={user.areaOfExpertise} draftValue={draft.areaOfExpertise}
            isEditing={isExpertiseEditing}
            field={{ type: "text", fieldKey: "areaOfExpertise" }}
            onChange={onDraftChange}
            placeholder="e.g. Quality Assurance, Document Control"
            className="col-span-2"
            error={fieldErrors.areaOfExpertise}
            />
          <EditableField
            label="Years of Experience" value={user.yearsOfExperience} draftValue={draft.yearsOfExperience}
            isEditing={isExpertiseEditing}
            field={{ type: "text", fieldKey: "yearsOfExperience" }}
            onChange={onDraftChange}
            placeholder="e.g. 5"
            error={fieldErrors.yearsOfExperience}
            />
          <EditableField
            label="Previous Employer" value={user.previousEmployer} draftValue={draft.previousEmployer}
            isEditing={isExpertiseEditing}
            field={{ type: "text", fieldKey: "previousEmployer" }}
            onChange={onDraftChange}
            placeholder="e.g. Acme Corp"
            error={fieldErrors.previousEmployer}
            />
        </div>
      </FormSection>

      {/* External Certifications — full width */}
      <FormSection
        title="External Certifications"
        icon={<IconCertificate className="h-4 w-4" />}
        className="xl:col-span-2"
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && (
              <Button variant="default" size="sm" onClick={handleOpenAdd} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Add Certificate
              </Button>
            )}
          </div>
        }
      >
        {/* Card Body */}
        <div className="flex-1 flex flex-col relative text-slate-900">
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white">
            <div className="overflow-x-auto">
              <table className="w-full ">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-center text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap w-10 sm:w-12">No.</th>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Certificate Name</th>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Issuing Organization</th>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Issue Date</th>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Expiry Date</th>
                    <th className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left text-2xs md:text-xs font-bold uppercase tracking-wider whitespace-nowrap">Attachment</th>
                    {canEdit && (
                      <th className="sticky top-0 right-0 z-30 bg-slate-50 py-1.5 px-2 md:py-2.5 md:px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap border-b-2 border-slate-200 before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {certifications.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm font-medium text-slate-900">No certifications recorded</p>
                          <p className="text-xs text-slate-500">Add external certifications and licenses.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    certifications.map((cert, index) => {
                      const isExpired = cert.expiryDate ? new Date(cert.expiryDate) < new Date() : false;
                      return (
                        <tr key={cert.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* No. */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm text-center text-slate-500 font-medium">
                            {String(index + 1)}
                          </td>
                          {/* Name */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 font-medium">
                                <IconCertificate className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              <p className="font-medium text-slate-900">{cert.name}</p>
                            </div>
                          </td>
                          {/* Org */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap">
                            {cert.issuingOrg}
                          </td>
                          {/* Issue Date */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm text-slate-700 whitespace-nowrap font-medium">
                            {cert.issueDate ? formatDate(cert.issueDate) : "-"}
                          </td>
                          {/* Expiry Date */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            {cert.expiryDate ? (
                              <div className="flex flex-col">
                                <span className={cn("font-medium", isExpired ? "text-rose-600" : "text-slate-700")}>
                                  {formatDate(cert.expiryDate)}
                                </span>
                                {isExpired && <span className="text-[12px] font-semibold text-rose-500 tracking-tight">Expired</span>}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </td>
                          {/* Attachment */}
                          <td className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left">
                            {cert.fileName ? (
                              <button
                                onClick={() => setCertPreview(cert)}
                                className="inline-flex items-left gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                              >
                                <IconCertificate className="h-3.5 w-3.5" />
                                <span className="truncate max-w-[150px]">{cert.fileName}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No file</span>
                            )}
                          </td>
                          {/* Action Sticky */}
                          {canEdit && (
                            <td
                              onClick={(e) => e.stopPropagation()}
                              className="sticky right-0 z-10 bg-white border-b border-slate-200 py-1.5 px-2 md:py-2 md:px-4 text-center whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10_rgba(0,0,0,0.05)] group-hover:bg-slate-50 transition-colors"
                            >
                              <button
                                ref={getRef(cert.id)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(cert.id, e);
                                }}
                                className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                              >
                                <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Summary */}
            {certifications.length > 0 && (
              <div className="px-4 md:px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-700">{certifications.length}</span> certification{certifications.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-3 text-xs font-semibold text-slate-700">
                  <span>Last Updated: {formatDate(new Date().toISOString())}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <AlertModal
          isOpen={certDeleteId !== null}
          onClose={() => setCertDeleteId(null)}
          onConfirm={() => { onCertDelete(certDeleteId!); setCertDeleteId(null); }}
          type="confirm"
          title="Delete Certificate"
          description="Are you sure you want to delete this certificate? This action cannot be undone."
        />
      </FormSection>

      {/* Cert modals managed locally */}
      <CertAddModal
        isOpen={certAddOpen}
        onClose={() => { setCertAddOpen(false); setCertEditing(null); }}
        onSave={handleCertSave}
        editing={certEditing}
      />
      <CertPreviewModal
        isOpen={!!certPreview}
        cert={certPreview}
        userId={user.id}
        onClose={() => setCertPreview(null)}
      />

      {/* Education modals */}
      <EducationAddModal
        isOpen={eduAddOpen}
        onClose={() => { setEduAddOpen(false); setEduEditing(null); }}
        onSave={handleEduSave}
        editing={eduEditing}
      />

      <AlertModal
        isOpen={eduDeleteId !== null}
        onClose={() => setEduDeleteId(null)}
        onConfirm={() => { onEduDelete(eduDeleteId!); setEduDeleteId(null); }}
        type="confirm"
        title="Delete Education Entry"
        description="Are you sure you want to delete this education entry? This action cannot be undone."
      />

      <AlertModal
        isOpen={certDeleteId !== null}
        onClose={() => setCertDeleteId(null)}
        onConfirm={() => { onCertDelete(certDeleteId!); setCertDeleteId(null); }}
        type="confirm"
        title="Delete Certificate"
        description="Are you sure you want to delete this certificate? This action cannot be undone."
      />

      {/* Action Menu Portal */}
      <PortalDropdownMenu isOpen={openId !== null} onClose={close} position={position} minWidth={180}>
        {(() => {
          const cert = certifications.find(c => c.id === openId);
          if (!cert) return null;
          return (
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); setCertPreview(cert); close(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <Eye className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                Preview
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleOpenEdit(cert); close(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <IconEdit className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                Edit Certificate
              </button>
              <div className="my-1 h-px bg-slate-100" />
              <button
                onClick={(e) => { e.stopPropagation(); setCertDeleteId(cert.id); close(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                Delete
              </button>
            </div>
          );
        })()}
      </PortalDropdownMenu>
    </div>
  );
};
