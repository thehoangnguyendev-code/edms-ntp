import React from "react";
import { useNavigate } from "react-router-dom";
import { Server, Tag, Code2, Route, Wrench } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { systemInformation } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { ROUTES } from "@/app/routes.constants";
import metadata from "../../../../metadata.json";
import packageJson from "../../../../package.json";

const OVERVIEW_ITEMS = [
  {
    id: "application-name",
    label: "Application Name",
    value: metadata.name,
    icon: Server,
  },
  {
    id: "package-name",
    label: "Package Name",
    value: packageJson.name,
    icon: Tag,
  },
  {
    id: "app-version",
    label: "Application Version",
    value: packageJson.version,
    icon: Tag,
  },
  {
    id: "module-type",
    label: "Module Type",
    value: packageJson.type,
    icon: Code2,
  },
  {
    id: "private-package",
    label: "Private Package",
    value: String(packageJson.private),
    icon: Server,
  },
  {
    id: "frame-permission-count",
    label: "Frame Permission Entries",
    value: String(metadata.requestFramePermissions.length),
    icon: Tag,
  },
] as const;

const TECH_STACK_ITEMS = [
  {
    id: "react",
    label: "React",
    value: packageJson.dependencies.react,
    icon: Code2,
  },
  {
    id: "react-router",
    label: "React Router",
    value: packageJson.dependencies["react-router-dom"],
    icon: Route,
  },
  {
    id: "vite",
    label: "Vite",
    value: packageJson.devDependencies.vite,
    icon: Wrench,
  },
  {
    id: "typescript",
    label: "TypeScript",
    value: packageJson.devDependencies.typescript,
    icon: Code2,
  },
] as const;

const ROUTE_INFO_ITEMS = [
  {
    id: "system-info-route",
    label: "System Information Route",
    value: ROUTES.SETTINGS.SYSTEM_INFO,
    icon: Route,
  },
  {
    id: "settings-route-count",
    label: "Settings Route Keys",
    value: String(Object.keys(ROUTES.SETTINGS).length),
    icon: Route,
  },
  {
    id: "total-top-level-route-groups",
    label: "Top-Level Route Groups",
    value: String(Object.keys(ROUTES).length),
    icon: Route,
  },
] as const;

const SCRIPT_ITEMS = [
  {
    id: "dev-script",
    label: "Dev Command",
    value: packageJson.scripts.dev,
    icon: Wrench,
  },
  {
    id: "build-script",
    label: "Build Command",
    value: packageJson.scripts.build,
    icon: Wrench,
  },
  {
    id: "preview-script",
    label: "Preview Command",
    value: packageJson.scripts.preview,
    icon: Wrench,
  },
] as const;

export const SystemInformationView: React.FC = () => {
  const navigate = useNavigate();

  const renderInfoGrid = (
    items: ReadonlyArray<{ id: string; label: string; value: string; icon: React.ComponentType<{ className?: string }> }>
  ) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50/40 p-4"
          >
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <Icon className="h-4 w-4" />
              <p className="text-xs font-medium">{item.label}</p>
            </div>
            <p className="text-sm font-semibold text-slate-900 break-all">{item.value}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 w-full flex-1 flex flex-col">
      <PageHeader
        title="System Information"
        breadcrumbItems={systemInformation(navigate)}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-6 space-y-6">
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Overview</h3>
          {renderInfoGrid(OVERVIEW_ITEMS)}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Technology Stack</h3>
          {renderInfoGrid(TECH_STACK_ITEMS)}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Routing</h3>
          {renderInfoGrid(ROUTE_INFO_ITEMS)}
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Scripts</h3>
          {renderInfoGrid(SCRIPT_ITEMS)}
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50/30 p-4">
          <p className="text-xs font-medium text-slate-600 mb-1">Project Description</p>
          <p className="text-sm text-slate-900 leading-relaxed">{metadata.description}</p>
        </section>
      </div>
    </div>
  );
};
