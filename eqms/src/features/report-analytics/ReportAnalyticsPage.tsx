import React from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";
import { reportBreadcrumbs } from "@/features/report/shared/reportBreadcrumbs";

/** Frame of the report administration screens: the header, then the sections. */
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
      {children}
    </div>
  );
};
