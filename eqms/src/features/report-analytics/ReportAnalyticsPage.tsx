import React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { reportBreadcrumbs } from "@/features/report/shared/reportBreadcrumbs";

export const PreviewBanner: React.FC = () => (
  <WarningBanner
    variant="info"
    title="Design preview"
    description="The figures on this page are sample data and the buttons do not reach a server. Nothing here is a record of your system."
  />
);

/** Frame of the Reports & Analytics screens that are still design previews. */
export const ReportAnalyticsPage: React.FC<{
  title: string;
  actions?: React.ReactNode;
  breadcrumbItems?: (navigate: (path: string) => void) => BreadcrumbItem[];
  children: React.ReactNode;
}> = ({ title, actions, breadcrumbItems, children }) => {
  const navigate = useNavigate();
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-4 md:gap-6">
      <PageHeader title={title} breadcrumbItems={breadcrumbItems ? breadcrumbItems(navigate) : reportBreadcrumbs(navigate, title)} actions={actions} />
      <PreviewBanner />
      {children}
    </div>
  );
};
