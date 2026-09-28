import React from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Boxes,
  Coffee,
  Cpu,
  Database,
  GitBranch,
  HardDrive,
  Layers,
  RefreshCw,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { FormSection } from "@/components/ui/form/FormSection";
import { systemInformation } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import { systemInfoApi, type SystemInfoResponse } from "@/services/api/systemInfo";
import metadata from "../../../../metadata.json";
import packageJson from "../../../../package.json";

/* ------------------------------------------------------------------ */
/*  Brand logo marks (inline SVG — crisp, offline, CSP-safe)          */
/* ------------------------------------------------------------------ */

type MarkProps = { className?: string };

const ReactMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="-11.5 -10.23174 23 20.46348" className={className} aria-hidden="true">
    <circle r="2.05" fill="#61DAFB" />
    <g stroke="#61DAFB" strokeWidth="1" fill="none">
      <ellipse rx="11" ry="4.2" />
      <ellipse rx="11" ry="4.2" transform="rotate(60)" />
      <ellipse rx="11" ry="4.2" transform="rotate(120)" />
    </g>
  </svg>
);

const ReactRouterMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#F44250" />
    <path d="M6.8 18.2c0-3.2 3.1-3.2 3.1-6.2s-3.1-3-3.1-6.2" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" fill="none" />
    <path d="M17.2 5.8c0 3.2-3.1 3.2-3.1 6.2s3.1 3 3.1 6.2" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" fill="none" />
    <circle cx="6.8" cy="5.8" r="1.7" fill="#fff" />
    <circle cx="17.2" cy="18.2" r="1.7" fill="#fff" />
  </svg>
);

const ViteMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="0 0 410 404" className={className} aria-hidden="true">
    <path
      d="M399.641 59.5246L215.643 388.545C211.844 395.338 202.084 395.378 198.228 388.618L10.5817 59.5563C6.38087 52.1896 12.6802 43.2665 21.0281 44.7586L205.223 77.6824C206.398 77.8924 207.601 77.8904 208.776 77.6763L389.119 44.8058C397.439 43.2894 403.768 52.1587 399.641 59.5246Z"
      fill="url(#vite-mesh)"
    />
    <path
      d="M292.965 1.5744L156.801 28.2552C154.563 28.6937 152.906 30.5903 152.771 32.8664L144.395 174.33C144.198 177.662 147.258 180.248 150.51 179.498L188.42 170.749C191.967 169.931 195.172 173.055 194.443 176.622L183.18 231.775C182.422 235.487 185.907 238.661 189.532 237.56L212.947 230.446C216.577 229.344 220.065 232.527 219.297 236.242L201.398 322.875C200.278 328.294 207.486 331.249 210.492 326.603L212.5 323.5L323.454 102.072C325.312 98.3645 322.108 94.137 318.036 94.9228L279.014 102.454C275.347 103.161 272.227 99.746 273.262 96.1583L298.731 7.86689C299.767 4.27314 296.636 0.855181 292.965 1.5744Z"
      fill="url(#vite-flame)"
    />
    <defs>
      <linearGradient id="vite-mesh" x1="6" y1="33" x2="235" y2="344" gradientUnits="userSpaceOnUse">
        <stop stopColor="#41D1FF" />
        <stop offset="1" stopColor="#BD34FE" />
      </linearGradient>
      <linearGradient id="vite-flame" x1="194.651" y1="8.818" x2="236.076" y2="292.989" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFEA83" />
        <stop offset="0.083" stopColor="#FFDD35" />
        <stop offset="1" stopColor="#FFA800" />
      </linearGradient>
    </defs>
  </svg>
);

const TypeScriptMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      fill="#3178C6"
      d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.302.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"
    />
  </svg>
);

const SpringMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="12" fill="#6DB33F" />
    <path
      d="M17.6 5.2c-.3 1-.9 1.7-1.6 2.4a7.7 7.7 0 0 0-5.6-2.4 7.8 7.8 0 0 0 0 15.6 7.8 7.8 0 0 0 7.7-6.7c.5-2.4-.2-5.6-.5-8.9ZM7.2 17.9a1 1 0 1 1 .1-2 1 1 0 0 1-.1 2Zm9-2c-1.6 2.2-5.1 1.4-7.3 1.5 0 0 .4 0 .5-.1 0 0 3.4-.1 5-1.5a3.4 3.4 0 0 0 1-2.4c0-.6-.3-1.2-.7-1.9-.7-1.1-1-2-.2-3.5C9.9 8.6 12 12.4 12 12.4c1 1.6.7 3-.3 3.5.9-.1 1.9-.4 2.7-1a3 3 0 0 0 .9-2.9c.7 2.1 1.2 4.3-.1 5.9Z"
      fill="#fff"
    />
  </svg>
);

const PostgresMark: React.FC<MarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#336791" />
    <path
      d="M17.4 6.5c-1.2-1.1-3.3-1.4-5.4-1.3-2 0-3.8.5-4.8 1.6-1.1 1.3-1.1 3.4-.9 5.4.2 1.9.7 3.9 1.6 5.2.4.6 1 1.1 1.7 1 .5 0 .9-.4 1.2-.9.2-.4.4-1 .5-1.5.2.5.6.9 1.2.9.8 0 1.3-.7 1.6-1.4.6.4 1.4.4 1.9-.2.7-.8.9-2.3 1-3.7.1-1.8.2-3.7-.4-4.9Z"
      fill="#fff"
      opacity="0.12"
    />
    <path
      d="M8.5 9c.2 2 .6 4 1.3 5.4M12 8.8c0 1.9-.1 4.2.6 5.6M15.4 8.9c-.1 1.4-.3 2.9-.9 3.7"
      stroke="#fff"
      strokeWidth="1.3"
      strokeLinecap="round"
      fill="none"
    />
    <circle cx="9.4" cy="7.7" r="0.9" fill="#fff" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Static frontend data (read from package.json / metadata.json)     */
/* ------------------------------------------------------------------ */

const stripRange = (v: string) => v.replace(/^[\^~]/, "");

const FRONTEND_STACK = [
  { id: "react", name: "React", category: "UI Runtime", version: packageJson.dependencies.react, Mark: ReactMark },
  { id: "react-router", name: "React Router", category: "Client Routing", version: packageJson.dependencies["react-router-dom"], Mark: ReactRouterMark },
  { id: "vite", name: "Vite", category: "Build Tooling", version: packageJson.devDependencies.vite, Mark: ViteMark },
  { id: "typescript", name: "TypeScript", category: "Type System", version: packageJson.devDependencies.typescript, Mark: TypeScriptMark },
] as const;

const BACKEND_MARKS: Record<string, React.FC<MarkProps>> = {
  "spring-boot": SpringMark,
  "spring-framework": SpringMark,
  "spring-security": SpringMark,
  postgresql: PostgresMark,
  "postgresql-jdbc": PostgresMark,
};

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "Language / Runtime": Coffee,
  Security: ShieldCheck,
  Persistence: Database,
  Database: Database,
  "Database Driver": Database,
  "Schema Migration": GitBranch,
  "Embedded Web Server": Server,
  "Cache / Rate Limiting": Zap,
  "Object Storage": HardDrive,
};

/* ------------------------------------------------------------------ */
/*  Building blocks                                                   */
/* ------------------------------------------------------------------ */

const Field: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 border-b border-slate-100 last:border-0">
    <span className="text-xs font-medium text-slate-500 shrink-0 pt-0.5">{label}</span>
    <span className={cn("text-sm font-semibold text-slate-900 text-right break-all", mono && "font-mono text-xs text-slate-700")}>
      {value}
    </span>
  </div>
);

const TechTile: React.FC<{
  name: string;
  category: string;
  version: string;
  Mark?: React.FC<MarkProps>;
  FallbackIcon?: React.ComponentType<{ className?: string }>;
}> = ({ name, category, version, Mark, FallbackIcon = Layers }) => (
  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition-shadow hover:shadow-md">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
      {Mark ? <Mark className="h-7 w-7" /> : <FallbackIcon className="h-5 w-5 text-slate-500" />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
      <p className="truncate text-2xs font-medium uppercase tracking-wide text-slate-400">{category}</p>
    </div>
    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-2xs text-slate-600">{version}</span>
  </div>
);

const formatBytes = (n: number) => {
  if (!n || n < 0) return "—";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${Math.round(mb)} MB`;
};

const formatUptime = (ms: number) => {
  if (!ms || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
};

/* ------------------------------------------------------------------ */
/*  View                                                              */
/* ------------------------------------------------------------------ */

export const SystemInformationView: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = React.useState<SystemInfoResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    setError(false);
    systemInfoApi
      .get()
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const server = data?.server;
  const db = data?.database;

  return (
    <div className="space-y-4 md:space-y-6 w-full flex-1 flex flex-col">
      <PageHeader title="System Information" breadcrumbItems={systemInformation(navigate)} />

      {/* Application (frontend) */}
      <FormSection title="Application" icon={<Boxes className="h-4 w-4" />}>
        <Field label="Application name" value={metadata.name} />
        <Field label="Package name" value={packageJson.name} mono />
        <Field label="Frontend version" value={packageJson.version} mono />
        <Field label="Module type" value={packageJson.type} />
        <Field label="Runtime mode" value={import.meta.env.MODE} />
        <Field label="Private package" value={String(packageJson.private)} />
        <div className="py-2.5">
          <p className="text-xs font-medium text-slate-500 mb-1">Description</p>
          <p className="text-sm leading-relaxed text-slate-700">{metadata.description}</p>
        </div>
      </FormSection>

      {loading && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <SectionLoading text="Reading server information..." />
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <p className="text-sm font-medium text-amber-800">Unable to load server &amp; database information.</p>
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && server && db && (
        <>
          <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
            {/* Server */}
            <FormSection title="Server Runtime" icon={<Server className="h-4 w-4" />}>
              <Field label="Service name" value={server.applicationName} mono />
              <Field label="Backend version" value={server.version} mono />
              <Field
                label="Active profiles"
                value={server.activeProfiles.length ? server.activeProfiles.join(", ") : "default"}
                mono
              />
              <Field label="Java" value={`${server.javaVersion} · ${server.javaVendor}`} />
              <Field label="JVM" value={server.jvmName} />
              <Field label="Operating system" value={`${server.osName} (${server.osArch})`} />
              <Field
                label="CPU / Heap"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-slate-400" />
                    {server.availableProcessors} vCPU · {formatBytes(server.heapUsedBytes)} / {formatBytes(server.heapMaxBytes)}
                  </span>
                }
              />
              <Field label="Time zone" value={server.timeZone} />
              <Field label="Started at" value={server.startedAt} />
              <Field label="Uptime" value={formatUptime(server.uptimeMillis)} />
            </FormSection>

            {/* Database */}
            <FormSection title="Database" icon={<Database className="h-4 w-4" />}>
              <Field label="Engine" value={`${db.product} ${stripRange(db.productVersion).split(" ")[0]}`} />
              <Field label="Full version" value={db.productVersion} mono />
              <Field label="JDBC driver" value={`${db.driverName} ${db.driverVersion}`} />
              <Field label="Schema migration" value={`v${db.schemaMigrationVersion}`} mono />
              <Field label="Applied migrations" value={String(db.appliedMigrations)} />
              <Field
                label="Connection pool"
                value={
                  db.poolMax == null
                    ? "—"
                    : `${db.poolActive ?? "?"} active · ${db.poolIdle ?? "?"} idle · ${db.poolMax} max`
                }
              />
            </FormSection>
          </div>

          {/* Technology stack */}
          <FormSection title="Technology Stack" icon={<Layers className="h-4 w-4" />}>
            <div className="py-2 space-y-4">
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Frontend</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {FRONTEND_STACK.map(({ id, name, category, version, Mark }) => (
                    <TechTile key={id} name={name} category={category} version={stripRange(version)} Mark={Mark} />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Backend</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.techStack.map((t) => (
                    <TechTile
                      key={t.id}
                      name={t.name}
                      category={t.category}
                      version={t.version}
                      Mark={BACKEND_MARKS[t.id]}
                      FallbackIcon={CATEGORY_ICON[t.category] ?? Layers}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FormSection>
        </>
      )}

      {/* Routing reference */}
      <FormSection title="Routing" icon={<Terminal className="h-4 w-4" />}>
        <Field label="System information route" value={ROUTES.SETTINGS.SYSTEM_INFO} mono />
        <Field label="Settings route keys" value={String(Object.keys(ROUTES.SETTINGS).length)} />
        <Field label="Top-level route groups" value={String(Object.keys(ROUTES).length)} />
      </FormSection>
    </div>
  );
};
