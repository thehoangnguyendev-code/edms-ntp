import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ROUTES } from "@/app/routes.constants";
import {
  MapPin,
  Briefcase,
  Award,
  UserCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ESignatureModal } from "@/components/ui/esign-modal/ESignatureModal";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { FormSection } from "@/components/ui/form";
import { TabNav, TabItem } from "@/components/ui/tabs/TabNav";
import { MOCK_EMPLOYEE_TRAINING_FILES } from "../mockData";
import { employeeDossier } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { DossierOverviewTab } from "../components/dossier-tabs/DossierOverviewTab";
import { DossierSOPsTab } from "../components/dossier-tabs/DossierSOPsTab";
import { DossierOJTTab } from "../components/dossier-tabs/DossierOJTTab";
import type { EmployeeTrainingFile } from "@/features/training/types";
import { navigateBack } from "@/app/navigation/backNavigation";

export const EmployeeDossierView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isNavigating, setIsNavigating] = useState(false);
  const [showESign, setShowESign] = useState(false);
  const [selectedOJT, setSelectedOJT] = useState<any>(null);

  const handleNavigate = (path: string | number) => {
    setIsNavigating(true);
    setTimeout(() => {
      if (typeof path === "number") navigate(path);
      else navigate(path);
    }, 600);
  };

  const handleBack = () => {
    setIsNavigating(true);
    setTimeout(() => navigateBack(navigate, location.state, ROUTES.TRAINING.COURSES_LIST), 600);
  };

  // Find employee data
  const employee = useMemo(() =>
    MOCK_EMPLOYEE_TRAINING_FILES.find(e => e.id === id),
    [id]);

  if (!employee) {
    return (
      <div className="space-y-6 w-full flex-1 flex flex-col">
        <PageHeader title="Not Found" breadcrumbItems={[{ label: 'Record Archive' }, { label: 'Dossier' }]} />
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-lg font-bold text-slate-900">Employee dossier not found</p>
          <p className="text-sm text-slate-500 mt-1">
            The requested employee record does not exist in our archives.
          </p>
          <Button variant="outline" className="mt-6 border-slate-200" onClick={handleBack}>Back to list</Button>
        </div>
      </div>
    );
  }

  const dossierTabs: TabItem[] = [
    { id: "overview", label: "General Overview" },
    { id: "sops", label: "SOP Training", count: 5 },
    { id: "ojt", label: "OJT Verification", count: employee.ojtRecords?.length },
  ];

  const handleVerifyOJT = (ojt: any) => {
    setSelectedOJT(ojt);
    setShowESign(true);
  };

  const onSignConfirm = async (reason: string) => {
    console.log(`Signed OJT: ${selectedOJT?.taskName} with reason: ${reason}`);
    setShowESign(false);
    setSelectedOJT(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return <DossierOverviewTab employee={employee} />;
      case "sops":
        return <DossierSOPsTab employee={employee} />;
      case "ojt":
        return <DossierOJTTab employee={employee} onVerifyOJT={handleVerifyOJT} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col pb-10">
      {/* Header */}
      <PageHeader
        title="Employee Dossier"
        breadcrumbItems={employeeDossier(navigate)}
        actions={
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap"
            >
              Back
            </Button>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={() => window.print()}
              className="whitespace-nowrap gap-2"
            >
              Export Dossier
            </Button>
          </div>
        }
      />

      {/* Personnel Summary Card - FormSection Style */}
      <div className="space-y-6">
        <FormSection
          title="Personnel Summary"
          icon={<UserCircle className="h-4 w-4 text-emerald-600" />}
        >
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-2xs font-semibold text-emerald-600">{employee.employeeId}</span>
            <div className="h-1 w-1 rounded-full bg-slate-300 hidden sm:block" />
            <span className="text-2xs font-semibold text-slate-600 uppercase leading-none">Record Archive</span>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
            <div className="min-w-0">
              <h2 className="text-lg md:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                {employee.employeeName}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-2xs text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded-full border border-slate-200">
                  <Briefcase className="h-3.5 w-3.5 text-emerald-500" /> {employee.jobPosition}
                </div>
                <div className="flex items-center gap-1.5 text-2xs text-slate-600 font-medium bg-slate-50 px-2 py-1 rounded-full border border-slate-200">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" /> {employee.department}
                </div>
                <StatusBadge status="effective" label="GMP COMPLIANT" size="xs" className="h-5" />
              </div>
            </div>
            <div className="flex items-center gap-3 bg-emerald-50/40 p-4 md:p-5 rounded-xl border border-emerald-100 border-dashed">
              <div className="h-9 w-9 sm:h-10 sm:w-10 flex items-center justify-center bg-white rounded-lg border border-emerald-100 shrink-0">
                <Award className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-black text-emerald-700/60 uppercase tracking-widest mb-0.5">Qualification Rank</p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 uppercase leading-tight">Expert Level Personnel</p>
              </div>
            </div>
          </div>
        </FormSection>

        {/* Tab Container using Central TabNav */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <TabNav tabs={dossierTabs} activeTab={activeTab} onChange={setActiveTab} />

          <div className="flex-1 bg-white min-h-[400px]">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* E-Signature Modal */}
      {selectedOJT && (
        <ESignatureModal
          isOpen={showESign}
          onClose={() => setShowESign(false)}
          onConfirm={onSignConfirm}
          actionTitle="Practical Skill Verification"
          targetDetails={{
            code: selectedOJT.id,
            title: selectedOJT.taskName,
            revision: "OJT-RECORD"
          }}
        />
      )}

      {isNavigating && <FullPageLoading text="Updating dossier..." />}
    </div>
  );
};
