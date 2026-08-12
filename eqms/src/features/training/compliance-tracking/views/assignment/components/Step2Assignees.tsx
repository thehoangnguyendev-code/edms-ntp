import React, { useMemo, useState } from "react";
import { Search, X, Building2 } from "lucide-react";
import { IconUsers, IconCheck, IconBuilding } from "@tabler/icons-react";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { FormSection } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge/Badge";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { cn } from "@/components/ui/utils";
import type { AssignmentScope } from "../../../../types/assignment.types";
import type { EmployeeRow } from "../../../types";
import { DEPARTMENTS, BUSINESS_UNITS, SCOPE_TABS, getInitials } from "../AssignTrainingView";

export interface Step2Props {
  scopeTab: AssignmentScope;
  onScopeChange: (id: string) => void;
  employees: EmployeeRow[];
  selectedEmployeeIds: string[];
  onEmployeeToggle: (id: string) => void;
  selectedDepartments: string[];
  onDeptToggle: (dept: string) => void;
  selectedBusinessUnits: string[];
  onBusinessUnitToggle: (bu: string) => void;
  resolvedAssignees: EmployeeRow[];
  employeeSearch: string;
  onEmployeeSearchChange: (v: string) => void;
}

export const Step2Assignees: React.FC<Step2Props> = ({
  scopeTab,
  onScopeChange,
  employees,
  selectedEmployeeIds,
  onEmployeeToggle,
  selectedDepartments,
  onDeptToggle,
  selectedBusinessUnits,
  onBusinessUnitToggle,
  resolvedAssignees,
  employeeSearch,
  onEmployeeSearchChange,
}) => {
  const deptEmployeeCount = useMemo(
    () =>
      DEPARTMENTS.reduce<Record<string, number>>((acc, dept) => {
        acc[dept] = employees.filter((e) => e.department === dept).length;
        return acc;
      }, {}),
    [employees],
  );

  const buEmployeeCount = useMemo(
    () =>
      BUSINESS_UNITS.reduce<Record<string, number>>((acc, bu) => {
        acc[bu] = employees.filter(
          (e) =>
            e.businessUnit === bu ||
            (bu === "Operation Unit" && !e.businessUnit),
        ).length;
        return acc;
      }, {}),
    [employees],
  );

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const totalPages = Math.ceil(resolvedAssignees.length / itemsPerPage);
  const currentAssignees = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return resolvedAssignees.slice(startIndex, startIndex + itemsPerPage);
  }, [resolvedAssignees, currentPage, itemsPerPage]);

  return (
    <FormSection
      title="Select Target Assignees"
      icon={<IconUsers className="h-4 w-4" />}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4">
          {/* Top: Scope selector + content */}
          <div className="space-y-4">
            <TabNav
              tabs={SCOPE_TABS}
              activeTab={scopeTab}
              onChange={onScopeChange}
              variant="pill"
              layoutId="assignmentScopeTabs"
              className="flex-nowrap [&_[role=tab]]:min-w-0 [&_[role=tab]]:px-1 [&_[role=tab]>span]:min-w-0 [&_[role=tab]>span>svg]:hidden [&_[role=tab]>span>svg]:sm:block [&_[role=tab]>span>span]:truncate"
            />

            {/* Individual */}
            {scopeTab === "individual" && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    value={employeeSearch}
                    onChange={(e) => onEmployeeSearchChange(e.target.value)}
                    placeholder="Search…"
                    className="w-full h-9 pl-9 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder:text-slate-400"
                  />
                  {employeeSearch && (
                    <button
                      type="button"
                      onClick={() => onEmployeeSearchChange("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label="Clear employee search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="border border-slate-200 rounded-xl bg-white">
                  <div className="px-3 pt-3 pb-2">
                    <p className="text-xs sm:text-sm font-semibold text-slate-700">
                      Employee List
                    </p>
                  </div>
                  <div className="space-y-1 max-h-[360px] overflow-y-auto px-2 pb-2">
                    {employees.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-emerald-50/50 cursor-pointer border border-transparent hover:border-emerald-200 transition-all"
                      >
                        <Checkbox
                          id={`emp-${emp.id}`}
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onChange={() => onEmployeeToggle(emp.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center flex-wrap gap-1.5">
                            <p className="text-xs sm:text-sm font-medium text-slate-900 truncate leading-tight">
                              {emp.fullName}
                            </p>
                            <Badge color="emerald" size="sm" pill>
                              {emp.employeeCode}
                            </Badge>
                          </div>
                          <p className="text-2xs sm:text-xs text-slate-500 truncate mt-0.5 leading-tight">
                            {emp.position} - {emp.department} - {emp.businessUnit} | {emp.email}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Business Unit */}
            {scopeTab === "business_unit" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                {BUSINESS_UNITS.map((bu) => (
                  <button
                    key={bu}
                    onClick={() => onBusinessUnitToggle(bu)}
                    className={cn(
                      "relative min-w-0 text-left p-2.5 rounded-lg border transition-all",
                      selectedBusinessUnits.includes(bu)
                        ? "border-emerald-500 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          selectedBusinessUnits.includes(bu)
                            ? "border-emerald-200 bg-white text-emerald-600"
                            : "border-slate-200 bg-slate-50 text-slate-400",
                        )}
                      >
                        <IconBuilding
                          className="h-4 w-4"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="min-w-0 truncate text-xs sm:text-sm font-semibold text-slate-900">
                            {bu}
                          </span>
                          {selectedBusinessUnits.includes(bu) && (
                            <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-2xs font-medium",
                            selectedBusinessUnits.includes(bu)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {buEmployeeCount[bu] ?? 0} employees
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Department */}
            {scopeTab === "department" && (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => onDeptToggle(dept)}
                    className={cn(
                      "relative min-w-0 text-left p-2.5 rounded-lg border transition-all",
                      selectedDepartments.includes(dept)
                        ? "border-emerald-500 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                          selectedDepartments.includes(dept)
                            ? "border-emerald-200 bg-white text-emerald-600"
                            : "border-slate-200 bg-slate-50 text-slate-400",
                        )}
                      >
                        <Building2
                          className="h-4 w-4"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="min-w-0 truncate text-xs sm:text-sm font-semibold text-slate-900">
                            {dept}
                          </span>
                          {selectedDepartments.includes(dept) && (
                            <IconCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded-full px-1.5 py-0.5 text-2xs font-medium",
                            selectedDepartments.includes(dept)
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {deptEmployeeCount[dept] ?? 0} employees
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>          
          {/* Bottom: Selected summary in a table format */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-semibold text-slate-700">Selected Assignees</p>
              {resolvedAssignees.length > 0 && (
                <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full">
                  {resolvedAssignees.length} employee{resolvedAssignees.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col bg-white shadow-sm transition-all duration-300">
              {/* ==================== DESKTOP TABLE VIEW (>= 1024px) ==================== */}
              <div className="hidden lg:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-50 hover:scrollbar-thumb-slate-400 pb-1.5 transition-colors">
                <table className="w-full min-w-max border-spacing-0 text-left">
                  <thead>
                    <tr>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-16">
                        No.
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-36">
                        Employee ID
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors">
                        Full Name
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-64">
                        Email
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-44">
                        Position
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-44">
                        Department
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap transition-colors w-44">
                        Business Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {resolvedAssignees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="flex flex-col items-center justify-center p-6 text-center">
                            <IconUsers className="h-8 w-8 text-slate-300" />
                            <h4 className="text-sm font-semibold text-slate-900 mt-2">No assignees selected</h4>
                            <p className="text-xs text-slate-500 max-w-xs mt-1">
                              Select assignees from the scope selector on the left.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentAssignees.map((emp, idx) => {
                        const tdClass = "py-3 px-4 text-xs md:text-sm text-slate-700 border-b border-slate-200 whitespace-nowrap";
                        return (
                          <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className={cn(tdClass, "text-center font-medium text-slate-500 w-16")}>
                              {(currentPage - 1) * itemsPerPage + idx + 1}
                            </td>
                            <td className={tdClass}>
                              <span className="font-semibold text-emerald-600">
                                {emp.employeeCode}
                              </span>
                            </td>
                            <td className={tdClass}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">
                                  {emp.fullName}
                                </span>
                              </div>
                            </td>
                            <td className={tdClass}>
                              <span className="flex items-center gap-2 text-slate-700">
                                {emp.email}
                              </span>
                            </td>
                            <td className={tdClass}>
                              {emp.position}
                            </td>
                            <td className={tdClass}>
                              {emp.department}
                            </td>
                            <td className={tdClass}>
                              {emp.businessUnit || "Operation Unit"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ==================== PREMIUM MOBILE CARD VIEW (< 1024px) ==================== */}
              <div className="block lg:hidden p-4 space-y-3 bg-slate-50/50 max-h-[500px] overflow-y-auto scrollbar-thin">
                {resolvedAssignees.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center bg-white border border-slate-200 rounded-xl">
                    <IconUsers className="h-8 w-8 text-slate-300" />
                    <h4 className="text-sm font-semibold text-slate-900 mt-2">No assignees selected</h4>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Select assignees from the scope selector on the left.
                    </p>
                  </div>
                ) : (
                  currentAssignees.map((emp, idx) => (
                    <div
                      key={emp.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 transition-all duration-200 hover:shadow-md hover:border-slate-300 relative"
                    >
                      {/* Top Bar: Index + Employee ID Badge */}
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-bold text-slate-500">
                          #{(currentPage - 1) * itemsPerPage + idx + 1}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {emp.employeeCode}
                        </span>
                      </div>

                      {/* Middle Area: Employee Full Name & Email */}
                      <div className="space-y-1 mb-3">
                        <h4 className="font-semibold text-slate-900 text-sm leading-snug">
                          {emp.fullName}
                        </h4>
                        <p className="text-xs text-slate-500 truncate leading-relaxed">
                          {emp.email}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-slate-100 my-2.5" />

                      {/* Bottom Info Grid (2-column layout) */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs text-slate-600">
                        <div className="flex flex-col">
                          <span className="text-2xs text-slate-400 uppercase tracking-wider font-medium">Position</span>
                          <span className="font-semibold text-slate-700 truncate">{emp.position}</span>
                        </div>

                        <div className="flex flex-col">
                          <span className="text-2xs text-slate-400 uppercase tracking-wider font-medium">Department</span>
                          <span className="font-semibold text-slate-700 truncate">{emp.department}</span>
                        </div>

                        <div className="flex flex-col col-span-2">
                          <span className="text-2xs text-slate-400 uppercase tracking-wider font-medium">Business Unit</span>
                          <span className="font-semibold text-slate-700 truncate">{emp.businessUnit || "Operation Unit"}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {resolvedAssignees.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={resolvedAssignees.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </FormSection>
  );
};
