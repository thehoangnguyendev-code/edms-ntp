import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Workflow, X } from "lucide-react";
import { Badge } from "@/components/ui/badge/Badge";
import { Button } from "@/components/ui/button/Button";
import { cn } from "@/components/ui/utils";

export const labelCls =
  "mb-1.5 block text-xs font-medium text-slate-700 sm:text-sm";
export const inputCls =
  "h-9 w-full rounded-lg border border-slate-200 px-3 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
export const textareaCls =
  "w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

export const parseScopeCount = (scope?: string | null) => {
  if (!scope || scope.trim().toLowerCase() === "all") return 0;
  return scope
    .split(/[,\n;|]/)
    .map((value) => value.trim())
    .filter(Boolean).length;
};

export const scopeStringToList = (scope?: string | null): string[] => {
  if (!scope || scope.trim().toLowerCase() === "all") return [];
  return scope
    .split(/[,\n;|]/)
    .map((value) => value.trim())
    .filter(Boolean);
};

export const scopeListToString = (values: string[]): string | null =>
  values.length ? values.join(", ") : null;

export interface WorkflowRolePreview {
  code: string;
  label: string;
  description?: string | null;
  policies: Array<{
    actionCode: string;
    actionLabel: string;
    fromStatus: string;
    active: boolean;
  }>;
}

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
};

/** Uses the same portal, responsive drawer shell and animation contract as Shared Permission Sets. */
export const WorkflowRoleDrawer: React.FC<{
  role: WorkflowRolePreview | null;
  onClose: () => void;
}> = ({ role, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(88);
  const isMobile = useIsMobile();
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(88);
  const closeTimer = useRef<number | null>(null);
  const isFullHeight = drawerHeight >= 98;

  const closeWithAnimation = () => {
    if (isClosing) return;
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (!role) return;
    setIsClosing(false);
    setDrawerHeight(88);
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) =>
      event.key === "Escape" && closeWithAnimation();
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKeyDown);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, [role]);

  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartY.current = clientY;
    dragStartHeight.current = drawerHeight;
  };
  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    const deltaVh = ((dragStartY.current - clientY) / window.innerHeight) * 100;
    setDrawerHeight(
      Math.max(0, Math.min(100, dragStartHeight.current + deltaVh)),
    );
  };
  const handleDragEnd = () => {
    setIsDragging(false);
    if (drawerHeight < 25) closeWithAnimation();
    else setDrawerHeight(88);
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (event: MouseEvent) => handleDragMove(event.clientY);
    const onEnd = () => handleDragEnd();
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
    };
  }, [isDragging, drawerHeight]);

  if (!role) return null;
  const policies = role.policies.filter((policy) => policy.active);
  const stages = [
    ...new Set(policies.map((policy) => policy.fromStatus.replace(/_/g, " "))),
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end">
      <style>{`
        @keyframes workflowDrawerSlideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes workflowDrawerSlideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes workflowDrawerSlideInBottom { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes workflowDrawerSlideOutBottom { from { transform: translateY(0); opacity: 1; } to { transform: translateY(100%); opacity: 0; } }
        @keyframes workflowDrawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes workflowDrawerFadeOut { from { opacity: 1; } to { opacity: 0; } }
        .workflow-drawer-desktop-enter { animation: workflowDrawerSlideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .workflow-drawer-desktop-exit { animation: workflowDrawerSlideOutRight 0.25s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .workflow-drawer-mobile-enter { animation: workflowDrawerSlideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .workflow-drawer-mobile-exit { animation: workflowDrawerSlideOutBottom 0.3s cubic-bezier(0.4, 0, 1, 1) forwards; }
        .workflow-drawer-backdrop-enter { animation: workflowDrawerFadeIn 0.3s ease-out forwards; }
        .workflow-drawer-backdrop-exit { animation: workflowDrawerFadeOut 0.25s ease-in forwards; }
      `}</style>

      <div
        className={cn(
          "pointer-events-auto absolute inset-0 bg-slate-900/60 backdrop-blur-sm",
          isClosing
            ? "workflow-drawer-backdrop-exit"
            : "workflow-drawer-backdrop-enter",
        )}
        onClick={closeWithAnimation}
      />
      <section
        className={cn(
          "pointer-events-auto relative flex flex-col overflow-hidden bg-white shadow-2xl",
          isMobile
            ? cn(
                "w-full transition-all",
                isFullHeight ? "rounded-none" : "rounded-t-2xl",
              )
            : "mr-4 h-[calc(100vh-32px)] w-[500px] rounded-2xl border border-slate-200",
          isClosing
            ? isMobile
              ? "workflow-drawer-mobile-exit"
              : "workflow-drawer-desktop-exit"
            : isMobile
              ? !isDragging && "workflow-drawer-mobile-enter"
              : "workflow-drawer-desktop-enter",
        )}
        style={
          isMobile
            ? {
                height: `${drawerHeight}dvh`,
                transition: isDragging
                  ? "none"
                  : "transform 400ms cubic-bezier(0.16, 1, 0.3, 1), height 400ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 200ms ease",
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
                paddingTop: isFullHeight
                  ? "env(safe-area-inset-top, 0px)"
                  : "0px",
              }
            : undefined
        }
        aria-label="Workflow role details"
      >
        {isMobile && (
          <div
            className="flex shrink-0 cursor-grab select-none touch-none flex-col items-center bg-white py-3 active:cursor-grabbing"
            onTouchStart={(event) => handleDragStart(event.touches[0].clientY)}
            onTouchMove={(event) => handleDragMove(event.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
            onMouseDown={(event) => handleDragStart(event.clientY)}
          >
            <div
              className={cn(
                "rounded-full transition-all duration-200",
                isDragging
                  ? "h-1.5 w-20 bg-slate-400"
                  : "h-1 w-12 bg-slate-200 hover:bg-slate-300",
              )}
            />
          </div>
        )}

        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
              <Workflow className="h-4 w-4 text-emerald-600" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-slate-400 sm:text-[11px]">
                Workflow Role
              </p>
              <p
                className="truncate text-xs font-bold text-slate-900 sm:text-sm"
                title={role.label}
              >
                {role.label}
              </p>
              <p className="truncate font-mono text-[11px] text-slate-400">
                {role.code}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeWithAnimation}
            className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </header>
        <div className="border-b border-slate-100 bg-white px-4 py-3 text-xs text-slate-500">
          {role.description ||
            "No description has been configured for this workflow role."}
        </div>
        <div
          className="flex-1 space-y-4 overflow-y-auto bg-slate-50/30 p-4"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          <RoleDetailSection title="Workflow Stages">
            {stages.length ? (
              <div className="flex flex-wrap gap-1.5">
                {stages.map((stage) => (
                  <Badge key={stage} size="xs" color="emerald">
                    {stage}
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyRoleDetail text="No active workflow policy references this workflow capacity." />
            )}
          </RoleDetailSection>
          <RoleDetailSection title="Available Actions">
            {policies.length ? (
              <div className="space-y-2">
                {policies.map((policy) => (
                  <div
                    key={`${policy.actionCode}-${policy.fromStatus}`}
                    className="flex items-center gap-2"
                  >
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                    <span className="text-sm text-slate-700">
                      {policy.actionLabel ||
                        policy.actionCode.replace(/_/g, " ")}
                    </span>
                    <Badge size="xs" color="slate">
                      {policy.fromStatus.replace(/_/g, " ")}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyRoleDetail text="No active workflow policy references this workflow capacity." />
            )}
          </RoleDetailSection>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50 px-4 py-3">
          <Button
            variant="outline-emerald"
            size="sm"
            className="w-fit"
            onClick={closeWithAnimation}
          >
            Close
          </Button>
        </footer>
      </section>
    </div>,
    document.body,
  );
};

const RoleDetailSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900">
      {title}
    </div>
    <div className="p-4">{children}</div>
  </div>
);
const EmptyRoleDetail: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-sm italic text-slate-400">{text}</p>
);
