import React, { useState } from "react";
import { PortalDropdownMenu } from "@/components/ui/dropdown";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { Briefcase, Plus, Eye, MoreVertical, Trash2 } from "lucide-react";
import { EditableField } from "../components/ProfileSectionCard";
import { CertAddModal } from "../components/CertAddModal";
import { EducationAddModal } from "../components/EducationAddModal";
import { CertPreviewModal } from "../components/CertPreviewModal";
import { Button } from "@/components/ui/button/Button";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { formatDate } from "@/utils/format";
import { cn } from "@/components/ui/utils";
import type { User, Certification, EducationItem } from "../../types";
import { IconCertificate, IconSchool, IconEdit } from "@tabler/icons-react";
import { usePortalDropdown } from "@/hooks";
import { FormSection } from "@/components/ui/form/FormSection";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface QualificationsTabProps {
  user: User;
  draft: User;
  /** One switch covers every field in Professional Expertise -- edit mode is unified per tab now.
   *  Education/Certifications keep their own always-available Add/Edit/Delete modal flow,
   *  independent of this flag. See useUserProfile#isEditingProfile. */
  isEditing: boolean;
  fieldErrors: Partial<Record<keyof User, string>>;
  certifications: Certification[];
  educationList?: EducationItem[];
  canEdit?: boolean;
  onDraftChange: (key: keyof User, value: string) => void;
  onCertSave: (data: Omit<Certification, "id">, editing: Certification | null, file: File | null) => void;
  onCertDelete: (id: string) => void;
  onEduSave: (data: Omit<EducationItem, "id">, editing: EducationItem | null) => void;
  onEduDelete: (id: string) => void;
}

export const QualificationsTab: React.FC<QualificationsTabProps> = ({
  user,
  draft,
  isEditing,
  fieldErrors,
  certifications,
  educationList = [],
  canEdit = true,
  onDraftChange,
  onCertSave,
  onCertDelete,
  onEduSave,
  onEduDelete,
}) => {
  const [certAddOpen, setCertAddOpen] = useState(false);
  const [certEditing, setCertEditing] = useState<Certification | null>(null);
  const [certPreview, setCertPreview] = useState<Certification | null>(null);
  const [certDeleteId, setCertDeleteId] = useState<string | null>(null);

  const [eduAddOpen, setEduAddOpen] = useState(false);
  const [eduEditing, setEduEditing] = useState<EducationItem | null>(null);
  const [eduDeleteId, setEduDeleteId] = useState<string | null>(null);
  const { openId, position, getRef, toggle, close } = usePortalDropdown();
  const {
    openId: eduOpenId,
    position: eduMenuPosition,
    getRef: getEduMenuRef,
    toggle: toggleEduMenu,
    close: closeEduMenu,
  } = usePortalDropdown();




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
      {/* Education Details — same table style as External Certifications below, for one
          consistent list UI across the tab instead of two different visual languages. */}
      <FormSection
        title="Education Details"
        icon={<IconSchool className="h-4 w-4" />}
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && isEditing && (
              <Button variant="default" size="sm" onClick={handleEduOpenAdd} className="flex-shrink-0 gap-2 sm:h-9 sm:px-4 sm:text-sm">
                <Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                Add Education
              </Button>
            )}
          </div>
        }
      >
        <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white">
          <div className="overflow-x-auto">
            <TableMarkup.Root className="w-full">
              <TableMarkup.Head className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <TableMarkup.Row>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell8}>No.</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Degree</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Field of Study</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Institution</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Graduation Year</TableMarkup.HeaderCell>
                  <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>GPA</TableMarkup.HeaderCell>
                  {canEdit && (
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell22}>
                      Action
                    </TableMarkup.HeaderCell>
                  )}
                </TableMarkup.Row>
              </TableMarkup.Head>
              <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                {educationList.length === 0 ? (
                  <TableMarkup.Row>
                    <TableMarkup.Cell colSpan={7} className="p-0">
                      <TableEmptyState title="No education items recorded" description="Add your degrees and academic qualifications." />
                    </TableMarkup.Cell>
                  </TableMarkup.Row>
                ) : (
                  [...(educationList ?? [])]
                    .sort((a, b) => parseInt(b.graduationYear || "0") - parseInt(a.graduationYear || "0"))
                    .map((edu, index) => (
                      <TableMarkup.Row key={edu.id} className="hover:bg-slate-50/80 transition-colors group">
                        <TableMarkup.Cell className={TABLE_STYLES.cell1}>
                          {String(index + 1)}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                              <IconSchool className="h-3.5 w-3.5 text-emerald-600" />
                            </div>
                            <p className="font-medium text-slate-900">{edu.degree}</p>
                          </div>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.cell2}>
                          {edu.fieldOfStudy || "-"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.cell2}>
                          {edu.institution || "-"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.cell3}>
                          {edu.graduationYear || "-"}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className={TABLE_STYLES.cell2}>
                          {edu.gpa || <span className="text-slate-400 italic">-</span>}
                        </TableMarkup.Cell>
                        {canEdit && (
                          <TableMarkup.Cell
                            onClick={(e) => e.stopPropagation()}
                            className={TABLE_STYLES.cell32}
                          >
                            <button
                              ref={getEduMenuRef(edu.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEduMenu(edu.id, e);
                              }}
                              className="inline-flex items-center justify-center h-7 w-7 md:h-8 md:w-8 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors"
                            >
                              <MoreVertical className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            </button>
                          </TableMarkup.Cell>
                        )}
                      </TableMarkup.Row>
                    ))
                )}
              </TableMarkup.Body>
            </TableMarkup.Root>
          </div>
          {educationList.length > 0 && (
            <div className="px-4 md:px-5 py-3 border-t border-slate-200 bg-slate-50/50">
              <p className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{educationList.length}</span> education item{educationList.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      </FormSection>

      {/* Professional Expertise */}
      <FormSection
        title="Professional Expertise"
        icon={<Briefcase className="h-4 w-4" />}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-5">
          <EditableField
            label="Professional Level" value={user.professionalLevel} draftValue={draft.professionalLevel}
            isEditing={isEditing}
            field={{ type: "text", fieldKey: "professionalLevel" }}
            onChange={onDraftChange}
            placeholder="e.g. Senior, Specialist, Manager"
            className="col-span-2"
            error={fieldErrors.professionalLevel}
            />
          <EditableField
            label="Area of Expertise" value={user.areaOfExpertise} draftValue={draft.areaOfExpertise}
            isEditing={isEditing}
            field={{ type: "text", fieldKey: "areaOfExpertise" }}
            onChange={onDraftChange}
            placeholder="e.g. Quality Assurance, Document Control"
            className="col-span-2"
            error={fieldErrors.areaOfExpertise}
            />
          <EditableField
            label="Years of Experience" value={user.yearsOfExperience} draftValue={draft.yearsOfExperience}
            isEditing={isEditing}
            field={{ type: "text", fieldKey: "yearsOfExperience" }}
            onChange={onDraftChange}
            placeholder="e.g. 5"
            error={fieldErrors.yearsOfExperience}
            />
          <EditableField
            label="Previous Employer" value={user.previousEmployer} draftValue={draft.previousEmployer}
            isEditing={isEditing}
            field={{ type: "text", fieldKey: "previousEmployer" }}
            onChange={onDraftChange}
            placeholder="e.g. Acme Corp"
            error={fieldErrors.previousEmployer}
            />
        </div>
      </FormSection>

      {/* External Certifications */}
      <FormSection
        title="External Certifications"
        icon={<IconCertificate className="h-4 w-4" />}
        className="xl:col-span-2"
        headerRight={
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && isEditing && (
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
              <TableMarkup.Root className="w-full ">
                <TableMarkup.Head className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <TableMarkup.Row>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell8}>No.</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Certificate Name</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Issuing Organization</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Issue Date</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Expiry Date</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell9}>Attachment</TableMarkup.HeaderCell>
                    {canEdit && (
                      <TableMarkup.HeaderCell className={TABLE_STYLES.headerCell22}>
                        Action
                      </TableMarkup.HeaderCell>
                    )}
                  </TableMarkup.Row>
                </TableMarkup.Head>
                <TableMarkup.Body className="divide-y divide-slate-200 bg-white">
                  {certifications.length === 0 ? (
                    <TableMarkup.Row>
                      <TableMarkup.Cell colSpan={7} className="p-0">
                        <TableEmptyState title="No certifications recorded" description="Add external certifications and licenses." />
                      </TableMarkup.Cell>
                    </TableMarkup.Row>
                  ) : (
                    certifications.map((cert, index) => {
                      const isExpired = cert.expiryDate ? new Date(cert.expiryDate) < new Date() : false;
                      return (
                        <TableMarkup.Row key={cert.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* No. */}
                          <TableMarkup.Cell className={TABLE_STYLES.cell1}>
                            {String(index + 1)}
                          </TableMarkup.Cell>
                          {/* Name */}
                          <TableMarkup.Cell className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0 font-medium">
                                <IconCertificate className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              <p className="font-medium text-slate-900">{cert.name}</p>
                            </div>
                          </TableMarkup.Cell>
                          {/* Org */}
                          <TableMarkup.Cell className={TABLE_STYLES.cell2}>
                            {cert.issuingOrg}
                          </TableMarkup.Cell>
                          {/* Issue Date */}
                          <TableMarkup.Cell className={TABLE_STYLES.cell3}>
                            {cert.issueDate ? formatDate(cert.issueDate) : "-"}
                          </TableMarkup.Cell>
                          {/* Expiry Date */}
                          <TableMarkup.Cell className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-xs sm:text-sm whitespace-nowrap">
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
                          </TableMarkup.Cell>
                          {/* Attachment */}
                          <TableMarkup.Cell className="py-1.5 px-2 sm:py-2.5 sm:px-4 text-left">
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
                          </TableMarkup.Cell>
                          {/* Action Sticky */}
                          {canEdit && (
                            <TableMarkup.Cell
                              onClick={(e) => e.stopPropagation()}
                              className={TABLE_STYLES.cell32}
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
                            </TableMarkup.Cell>
                          )}
                        </TableMarkup.Row>
                      );
                    })
                  )}
                </TableMarkup.Body>
              </TableMarkup.Root>
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

      {/* Education Action Menu Portal */}
      <PortalDropdownMenu isOpen={eduOpenId !== null} onClose={closeEduMenu} position={eduMenuPosition} minWidth={160}>
        {(() => {
          const edu = educationList.find((e) => e.id === eduOpenId);
          if (!edu) return null;
          return (
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); handleEduOpenEdit(edu); closeEduMenu(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                <IconEdit className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                Edit Education
              </button>
              <div className="my-1 h-px bg-slate-100" />
              <button
                onClick={(e) => { e.stopPropagation(); setEduDeleteId(edu.id); closeEduMenu(); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5 flex-shrink-0" />
                Delete
              </button>
            </div>
          );
        })()}
      </PortalDropdownMenu>

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
