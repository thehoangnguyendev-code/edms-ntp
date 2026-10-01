import { Drawer, type DrawerHandle } from "@/components/ui/drawer";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi, type PermissionCatalogGroup, type PermissionLifecycleUsage, type PermissionSetResponse, type PermissionSetSummary } from "@/services/api/settings";

const formatLifecycleState = (u: PermissionLifecycleUsage) =>
  `${u.objectTypeLabel} · ${u.fromStatusLabel ?? u.fromStatus ?? "Any state"}`;
// Includes the action -- two entries can share the same object type + status (e.g. distributing a
// single Controlled Copy vs. a Controlled Copy Batch both apply "Ready for Distribution"), so the
// action is what tells them apart and must be visible wherever more than one entry is listed together.
const formatLifecycleUsage = (u: PermissionLifecycleUsage) =>
  `${formatLifecycleState(u)} (${u.actionLabel})`;

interface PermissionSetDrawerProps {
  ps: PermissionSetSummary | null;
  onClose: () => void;
}

export const AccessProfilePermissionSetDrawer: React.FC<PermissionSetDrawerProps> = ({ ps, onClose }) => {
  const drawer = React.useRef<DrawerHandle>(null);

  const navigate = useNavigate();
  const [expandedLifecycle, setExpandedLifecycle] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<PermissionSetResponse | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ps) return;
    setLoading(true);
    settingsApi.getPermissionSet(ps.id)
      .then(setDetail)
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [ps?.id]);

  useEffect(() => {
    let cancelled = false;
    settingsApi.getPermissionCatalog()
      .then((groups) => {
        if (!cancelled) setCatalog(groups);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      });
    return () => { cancelled = true; };
  }, []);

  if (!ps) return null;

  const permissionLookup = new Map(
    catalog.flatMap((group) =>
      group.permissions.map((permission) => [permission.code, { ...permission, groupName: group.name }])
    )
  );

  const groupedPermissions = (detail?.permissionCodes ?? []).reduce<Record<string, {
    title: string;
    description: string | null;
    items: { code: string; name: string; description: string; module: string; action?: string; riskLevel?: string; requiresAudit?: boolean; requiresESign?: boolean; lifecycleUsages?: PermissionLifecycleUsage[] }[];
  }>>((acc, code) => {
    const item = permissionLookup.get(code);
    const key = item?.module || "General";
    if (!acc[key]) {
      acc[key] = {
        title: key,
        description: item?.groupName ?? null,
        items: [],
      };
    }
    acc[key].items.push({
      code,
      name: item?.name ?? code,
      description: item?.description ?? "No description available.",
      module: item?.module ?? "General",
      action: item?.action,
      riskLevel: item?.riskLevel,
      requiresAudit: item?.requiresAudit,
      requiresESign: item?.requiresESign,
      lifecycleUsages: item?.lifecycleUsages,
    });
    return acc;
  }, {});


  return <Drawer
    ref={drawer}
    onClose={onClose}
    title={ps.name}
    subtitle="Permission Set"
    icon={<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50"><KeyRound className="h-4 w-4 text-emerald-600" /></span>}
    description={ps.description}
    bodyClassName="space-y-4"
    footer={<>
      <Button
        variant="outline-emerald"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => navigate(ROUTES.SECURITY.PERMISSION_SETS)}
      >
        Open Permission Sets
      </Button>
    </>}
  >

    {loading ? (
      <SectionLoading />
    ) : detail?.permissionCodes && detail.permissionCodes.length > 0 ? (
      <div className="space-y-4">
        {Object.entries(groupedPermissions).map(([module, section]) => (
          <div key={module} className="rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-white">
              <p className="text-sm font-semibold text-slate-900">{module}</p>
              {section.description ? <p className="text-xs text-slate-500 mt-0.5">{section.description}</p> : null}
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item) => (
                <div key={item.code} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                    <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge size="xs" color="slate">{item.code}</Badge>
                    {item.action ? <Badge size="xs" color="blue">{item.action}</Badge> : null}
                    {item.riskLevel ? <Badge size="xs" color={item.riskLevel === "CRITICAL" ? "red" : item.riskLevel === "HIGH" ? "orange" : "slate"}>{item.riskLevel}</Badge> : null}
                    {item.requiresAudit ? <Badge size="xs" color="indigo">Audit</Badge> : null}
                    {item.requiresESign ? <Badge size="xs" color="emerald">E-sign</Badge> : null}
                    {item.lifecycleUsages && item.lifecycleUsages.length > 0 && (
                      expandedLifecycle.has(item.code) ? (
                        <>
                          {item.lifecycleUsages.map((u, i) => (
                            <Badge key={i} size="xs" color="purple">{formatLifecycleUsage(u)}</Badge>
                          ))}
                          <button
                            type="button"
                            onClick={() => setExpandedLifecycle((prev) => { const next = new Set(prev); next.delete(item.code); return next; })}
                            className="text-2xs text-slate-400 hover:text-emerald-600 hover:underline"
                          >
                            Show less
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Badge size="xs" color="purple" title={formatLifecycleUsage(item.lifecycleUsages[0])}>
                            {formatLifecycleState(item.lifecycleUsages[0])}
                          </Badge>
                          {item.lifecycleUsages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setExpandedLifecycle((prev) => new Set(prev).add(item.code))}
                              className="text-2xs text-slate-400 hover:text-emerald-600 hover:underline"
                            >
                              +{item.lifecycleUsages.length - 1} more
                            </button>
                          )}
                        </span>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <div className="flex items-center justify-center h-32 text-xs text-slate-400 italic">No permissions assigned</div>
    )}

  </Drawer>;
};
