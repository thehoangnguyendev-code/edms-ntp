import React from "react";
import { cn } from '@/components/ui/utils';
import { Button } from "@/components/ui/button/Button";
import { PageHeader } from "@/components/ui/page/PageHeader";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { TabNav } from "@/components/ui/tabs/TabNav";
import type { TabItem } from "@/components/ui/tabs/TabNav";
import type { WorkflowProgress } from "@/types/document";
import { WorkflowProgressStepper } from "@/components/ui/workflow-stepper/WorkflowProgressStepper";
import { tr } from "@/i18n";

// --- Types ---
type TabType =
    | "document"
    | "general"
    | "workingNotes"
    | "documentInfo"
    | "infoFromDocument"
    | "training"
    | "reviewers"
    | "approvers"
    | "signatures"
    | "audit";

interface DocumentWorkflowLayoutProps {
    // Header props
    title: string;
    breadcrumbs: BreadcrumbItem[];
    onBack: () => void;

    // Header actions (optional - buttons next to Back)
    headerActions?: React.ReactNode;

    // Status stepper
    /** The lifecycle stepper as the server worked it out; nothing is drawn until it has arrived. */
    workflow?: WorkflowProgress;

    // Tabs
    tabs: TabItem[];
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;

    // Footer actions (buttons below tab card)
    footerActions?: React.ReactNode;

    // Content rendered after the tab card (e.g. sub-tabs, original document panel)
    afterTabContent?: React.ReactNode;

    // Tab content
    children: React.ReactNode;

}

// --- Default Tabs ---
export const DEFAULT_WORKFLOW_TABS: TabItem[] = [
    { id: "general", get label() { return tr("General Information"); } },
    { id: "workingNotes", get label() { return tr("Working Notes"); } },
    { id: "documentInfo", get label() { return tr("Information from Document"); } },
    { id: "training", get label() { return tr("Training Information"); } },
    { id: "reviewers", label: "Reviewers" },
    { id: "approvers", label: "Approvers" },
    { id: "signatures", get label() { return tr("Signatures"); } },
    { id: "document", label: "Document" },
    { id: "audit", get label() { return tr("Audit Trail"); } },
];

// --- Main Component ---
export const DocumentWorkflowLayout: React.FC<DocumentWorkflowLayoutProps> = ({
    title,
    breadcrumbs,
    onBack,
    headerActions,
    workflow,
    tabs,
    activeTab,
    onTabChange,
    footerActions,
    afterTabContent,
    children,
}) => {
    return (
        <div className="space-y-4 md:space-y-6 w-full">
            {/* Header */}
            <PageHeader
                title={title}
                breadcrumbItems={breadcrumbs}
                actions={
                    <>
                        <Button
                            onClick={onBack}
                            size="sm"
                            variant="outline-emerald"
                            className="whitespace-nowrap"
                        >
                            {tr("Back")}
                        </Button>
                        {headerActions}
                    </>
                }
            />

            <div className="min-w-0 space-y-4 md:space-y-6">
                {/* Status Stepper */}
                <WorkflowProgressStepper workflow={workflow} />

                {/* Tab Navigation + Content */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <TabNav tabs={tabs} activeTab={activeTab} onChange={(id) => onTabChange(id as TabType)} variant="underline" />
                    <div className="p-4 md:p-5">
                        {children}
                    </div>
                </div>

                {/* Footer Actions */}
                {footerActions && (
                    <div className="flex items-center gap-2 md:gap-3">
                        {footerActions}
                    </div>
                )}

                {/* After Tab Content (e.g. Document Master panel) */}
                {afterTabContent}
            </div>
        </div>
    );
};
