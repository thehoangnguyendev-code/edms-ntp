import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X as XIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button/Button";
import { Select } from "@/components/ui/select/Select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { cn } from "@/components/ui/utils";
import { educationApi } from "@/services/api";
import type { EducationItem } from "../../types";

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
  const [degreeOptions, setDegreeOptions] = useState<{ label: string; value: string }[]>([]);
  const [schoolOptions, setSchoolOptions] = useState<{ label: string; value: string }[]>([]);
  const [isLoadingLookups, setIsLoadingLookups] = useState(false);

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

  React.useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setIsLoadingLookups(true);

    void Promise.allSettled([
      educationApi.degreeLevels.lookup(),
      educationApi.schools.lookup(),
    ]).then(([degreeLevelsResult, schoolsResult]) => {
      if (!active) return;

      if (degreeLevelsResult.status === "fulfilled") {
        setDegreeOptions(degreeLevelsResult.value.map((item) => ({
          label: item.name,
          value: item.name,
        })));
      }
      if (schoolsResult.status === "fulfilled") {
        setSchoolOptions(schoolsResult.value.map((item) => ({
          label: item.name,
          value: item.name,
        })));
      }
    }).finally(() => {
      if (active) setIsLoadingLookups(false);
    });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const optionIncludingCurrentValue = (
    options: { label: string; value: string }[],
    currentValue: string,
  ) => {
    if (!currentValue || options.some((option) => option.value === currentValue)) return options;
    // An older education record may point to an option that was subsequently deactivated.
    // Keep it selectable while editing, rather than silently discarding the persisted value.
    return [{ label: currentValue, value: currentValue }, ...options];
  };

  const clearError = (field: string) => {
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

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
        {/* Degree — active degree levels from Education Settings; no education-admin permission required. */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Degree <span className="text-red-500">*</span>
          </label>
          <Select
            label=""
            value={degree}
            onChange={(value) => {
              setDegree(String(value));
              clearError("degree");
            }}
            options={optionIncludingCurrentValue(degreeOptions, degree)}
            placeholder="Select degree"
            enableSearch
            isLoading={isLoadingLookups}
            loadingText="Loading degree levels..."
            triggerClassName={cn(errors.degree && "border-red-400 focus:ring-red-400 focus:border-red-400")}
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

        {/* Institution — active schools from Education Settings; no education-admin permission required. */}
        <div>
          <label className="text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block">
            Institution / University / College <span className="text-red-500">*</span>
          </label>
          <Select
            label=""
            value={institution}
            onChange={(value) => {
              setInstitution(String(value));
              clearError("institution");
            }}
            options={optionIncludingCurrentValue(schoolOptions, institution)}
            placeholder="Select institution"
            enableSearch
            isLoading={isLoadingLookups}
            loadingText="Loading institutions..."
            triggerClassName={cn(errors.institution && "border-red-400 focus:ring-red-400 focus:border-red-400")}
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
