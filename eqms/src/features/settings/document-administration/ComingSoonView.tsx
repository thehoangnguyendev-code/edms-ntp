import React from "react";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb/Breadcrumb";

interface ComingSoonViewProps {
  title: string;
  breadcrumbItems: BreadcrumbItem[];
  description: string;
}

/** Placeholder shell for Document Administration screens that are scaffolded but not yet built. */
export const ComingSoonView: React.FC<ComingSoonViewProps> = ({ title, breadcrumbItems, description }) => (
  <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
    <PageHeader title={title} breadcrumbItems={breadcrumbItems} />
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
        <Hammer className="h-6 w-6" />
      </span>
      <p className="text-sm font-semibold text-slate-900">{title} — coming soon</p>
      <p className="max-w-md text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  </div>
);
