import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X as XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import type { EducationItem } from "../types";

interface EducationAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<EducationItem, "id">) => void;
  editing?: EducationItem | null;
}

export const EducationAddModal: React.FC<EducationAddModalProps> = ({ isOpen, onClose, onSave, editing }) => {
  const [degree, setDegree] = useState(editing?.degree ?? "");
  const [fieldOfStudy, setFieldOfStudy] = useState(editing?.fieldOfStudy ?? "");
  const [institution, setInstitution] = useState(editing?.institution ?? "");
  const [graduationYear, setGraduationYear] = useState(editing?.graduationYear ?? "");
  const [gpa, setGpa] = useState(editing?.gpa ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isOpen) {
      setDegree(editing?.degree ?? "");
      setFieldOfStudy(editing?.fieldOfStudy ?? "");
      setInstitution(editing?.institution ?? "");
      setGraduationYear(editing?.graduationYear ?? "");
      const initialGpa = editing?.gpa ?? "";
      setGpa(initialGpa.replace(/\s*\/\s*4\.0$/, ""));
      setErrors({});
    }
  }, [isOpen, editing]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!degree.trim()) errs.degree = "Degree is required";
    if (!fieldOfStudy.trim()) errs.fieldOfStudy = "Field of Study is required";
    if (!institution.trim()) errs.institution = "Institution is required";
    return errs;
  };

  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      degree: degree.trim(),
      fieldOfStudy: fieldOfStudy.trim(),
      institution: institution.trim(),
      graduationYear: graduationYear.trim(),
      gpa: gpa.trim() ? `${gpa.trim()} / 4.0` : "",
    });
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleSave}
      title={editing ? "Edit Education" : "Add Education"}
      confirmText={editing ? "Save Changes" : "Add Education"}
      size="lg"
    >
      <div className="space-y-4">
        {/* Degree */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Degree <span className="text-red-500">*</span>
          </label>
          <input
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="e.g. Bachelor of Science"
            className={cn(
              "w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-slate-400",
              errors.degree
                ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
            )}
          />
          {errors.degree && <p className="text-xs text-red-600 font-medium mt-1.5">{errors.degree}</p>}
        </div>

        {/* Field of Study */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Field of Study / Major <span className="text-red-500">*</span>
          </label>
          <input
            value={fieldOfStudy}
            onChange={(e) => setFieldOfStudy(e.target.value)}
            placeholder="e.g. Computer Science"
            className={cn(
              "w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-slate-400",
              errors.fieldOfStudy
                ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
            )}
          />
          {errors.fieldOfStudy && <p className="text-xs text-red-600 font-medium mt-1.5">{errors.fieldOfStudy}</p>}
        </div>

        {/* Institution */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Institution / University / College <span className="text-red-500">*</span>
          </label>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. Stanford University"
            className={cn(
              "w-full h-9 px-3 text-sm border rounded-lg focus:outline-none focus:ring-1 transition-colors placeholder:text-slate-400",
              errors.institution
                ? "border-red-400 focus:ring-red-400 focus:border-red-400"
                : "border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
            )}
          />
          {errors.institution && <p className="text-xs text-red-600 font-medium mt-1.5">{errors.institution}</p>}
        </div>

        {/* Year & GPA */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Select
              label="Graduation Year"
              value={graduationYear}
              onChange={setGraduationYear}
              placeholder="Select year"
              enableSearch={true}
              options={Array.from({ length: new Date().getFullYear() - 1970 + 11 }, (_, i) => {
                const year = (new Date().getFullYear() + 10 - i).toString();
                return { label: year, value: year };
              })}
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
              GPA / Grade
            </label>
            <div className="relative">
              <input
                value={gpa}
                onChange={(e) => setGpa(e.target.value)}
                placeholder="e.g. 3.8"
                className="w-full h-9 pl-3 pr-12 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium pointer-events-none">
                / 4.0
              </div>
            </div>
          </div>
        </div>
      </div>
    </FormModal>
  );
};
