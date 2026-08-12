import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { X, Check, KeyRound, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { ROUTES } from "@/app/routes.constants";
import { settingsApi, type PermissionCatalogGroup, type PermissionSetResponse, type PermissionSetSummary } from "@/services/api/settings";

interface PermissionSetDrawerProps {
  ps: PermissionSetSummary | null;
  onClose: () => void;
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== "undefined") return window.innerWidth < 768;
    return false;
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return isMobile;
};

export const AccessProfilePermissionSetDrawer: React.FC<PermissionSetDrawerProps> = ({ ps, onClose }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<PermissionSetResponse | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalogGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(88);
  const isMobile = useIsMobile();
  const dragStartY = React.useRef(0);
  const dragStartHeight = React.useRef(88);

  const MIN_HEIGHT = 40;
  const MAX_HEIGHT = 100;
  const CLOSE_THRESHOLD = 25;

  const handleClose = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (!ps) return;
    setLoading(true);
    settingsApi.getPermissionSet(ps.id)
      .then(setDetail)
      .catch(() => {})
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

  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = drawerHeight;
  };

  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const viewportHeight = window.innerHeight;
    const deltaY = dragStartY.current - clientY;
    const deltaVh = (deltaY / viewportHeight) * 100;
    let newHeight = dragStartHeight.current + deltaVh;
    newHeight = Math.max(0, Math.min(MAX_HEIGHT, newHeight));
    setDrawerHeight(newHeight);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    if (drawerHeight < CLOSE_THRESHOLD) {
      handleClose();
    } else {
      setDrawerHeight(88);
    }
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleDragMove(e.clientY);
    const onEnd = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDragging, drawerHeight]);

  if (!ps) return null;

  const permissionLookup = new Map(
    catalog.flatMap((group) =>
      group.permissions.map((permission) => [permission.code, { ...permission, groupName: group.name }])
    )
  );

  const groupedPermissions = (detail?.permissionCodes ?? []).reduce<Record<string, {
    title: string;
    description: string | null;
    items: { code: string; name: string; description: string; module: string; action?: string; riskLevel?: string; requiresAudit?: boolean; requiresESign?: boolean }[];
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
    });
    return acc;
  }, {});

  const isFullHeight = drawerHeight >= 98;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center md:justify-end items-end md:items-center">
      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes slideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes slideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        .desktop-drawer-enter { animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .desktop-drawer-exit { animation: slideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .mobile-drawer-enter { animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .mobile-drawer-exit { animation: slideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .backdrop-enter { animation: fadeIn 0.3s ease-out forwards; }
        .backdrop-exit { animation: fadeOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={cn(
          "absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto",
          isClosing ? "backdrop-exit" : "backdrop-enter"
        )}
        onClick={handleClose}
      />

      <div
        className={cn(
          "pointer-events-auto bg-white flex flex-col relative overflow-hidden shadow-2xl",
          isMobile
            ? cn("w-full transition-all flex flex-col", isFullHeight ? "rounded-none" : "rounded-t-2xl")
            : "w-[500px] h-[calc(100vh-32px)] mr-4 rounded-2xl border border-slate-200",
          isClosing
            ? (isMobile ? "mobile-drawer-exit" : "desktop-drawer-exit")
            : (isMobile ? (!isDragging && "mobile-drawer-enter") : "desktop-drawer-enter"),
        )}
        style={isMobile ? {
          height: `${drawerHeight}dvh`,
          transition: isDragging ? "none" : "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 200ms ease",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          paddingTop: isFullHeight ? "env(safe-area-inset-top, 0px)" : "0px",
        } : {}}
      >
        {isMobile && (
          <div
            className="flex flex-col items-center py-3 cursor-grab active:cursor-grabbing select-none touch-none bg-white shrink-0"
            onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
            onMouseDown={(e) => handleDragStart(e.clientY)}
          >
            <div className={cn(
              "rounded-full transition-all duration-200",
              isDragging ? "w-20 h-1.5 bg-slate-400" : "w-12 h-1 bg-slate-200 hover:bg-slate-300"
            )} />
          </div>
        )}

        <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-50">
              <KeyRound className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Access Profile</p>
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate" title={ps.name}>{ps.name}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {ps.description && (
          <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-white">
            <p className="text-xs text-slate-500">{ps.description}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 scroll-smooth custom-scrollbar" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
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
        </div>

        <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3 sm:px-5 shrink-0">
          <Button
            variant="outline-emerald"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => navigate(ROUTES.SECURITY.PERMISSION_SETS)}
          >
            Open Permission Sets
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
