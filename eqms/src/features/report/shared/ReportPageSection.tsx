import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { report } from "@/components/ui/breadcrumb/breadcrumbs.config";

interface ReportPageSectionProps {
  title: string;
  sectionTitle: string;
  description: string;
  icon: LucideIcon;
  notice?: string | null;
  children: ReactNode;
}

/** Shared presentation shell; each report area owns its own state and API calls. */
export function ReportPageSection({
  title,
  sectionTitle,
  description,
  icon: Icon,
  notice,
  children,
}: ReportPageSectionProps) {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <PageHeader title={title} breadcrumbItems={report(navigate, title)} />
      {notice && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}
      <FormSection title={sectionTitle} description={description} icon={<Icon className="h-4 w-4" />}>
        {children}
      </FormSection>
    </div>
  );
}
