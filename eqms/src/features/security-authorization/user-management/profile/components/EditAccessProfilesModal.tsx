import React, { useEffect, useMemo, useState } from "react";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Badge } from "@/components/ui/badge/Badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { cn } from "@/components/ui/utils";
import { IconUserKey } from "@tabler/icons-react";
import { useToast } from "@/components/ui/toast";
import { settingsApi, type AccessProfileResponse } from "@/services/api/settings";
import { useSecurityESign } from "../../../shared/useSecurityESign";
import { useSodAccessProfileCheck } from "../../../shared/useSodAccessProfileCheck";
import { SodViolationPanel } from "../../../shared/SodViolationPanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  currentProfileIds: string[];
  /** Existing-user mode: fetches the catalog itself, diffs the selection against
   *  currentProfileIds, and persists via assign/remove API calls (each requiring an electronic
   *  signature) -- see handleSave. */
  userId?: string;
  onSaved?: () => void;
  /** Create-mode: the user doesn't exist yet, so there is nothing to persist here -- report the
   *  full next selection back to the caller (AddUserView) instead. No signature required, since
   *  nothing has actually changed on a live account. */
  onSaveLocal?: (ids: string[]) => void;
  /** Create-mode supplies the already-loaded catalog directly (it's loaded page-level in
   *  AddUserView); existing mode fetches its own via settingsApi. */
  allProfiles?: AccessProfileResponse[];
}

/** Dual-list Available/Selected picker, matching the interaction pattern of
 *  DocumentRelationships.tsx (search each side, drag-and-drop, arrow buttons) so Access Profile
 *  assignment feels the same as the rest of the app instead of a one-off checklist. Used for both
 *  the Detail/Edit screen's "Edit Access Profile" flow (userId set) and the Add New User screen's
 *  "New/Edit Access Profile" flow (onSaveLocal set). */
export const EditAccessProfilesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  userName,
  currentProfileIds,
  userId,
  onSaved,
  onSaveLocal,
  allProfiles: allProfilesProp,
}) => {
  const isLocalMode = Boolean(onSaveLocal);
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const [loading, setLoading] = useState(!isLocalMode);
  const [saving, setSaving] = useState(false);
  const [fetchedProfiles, setFetchedProfiles] = useState<AccessProfileResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [availableSearch, setAvailableSearch] = useState("");
  const [selectedSearch, setSelectedSearch] = useState("");
  const [pickedAvailableIds, setPickedAvailableIds] = useState<string[]>([]);
  const [pickedSelectedIds, setPickedSelectedIds] = useState<string[]>([]);

  const allProfiles = isLocalMode ? (allProfilesProp ?? []) : fetchedProfiles;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedIds(currentProfileIds);
    setAvailableSearch("");
    setSelectedSearch("");
    setPickedAvailableIds([]);
    setPickedSelectedIds([]);
    if (isLocalMode) return;
    // Ignore the response if the modal was closed (or reopened) before it arrived.
    let alive = true;
    setLoading(true);
    settingsApi
      .listAllAccessProfiles()
      .then((profiles) => { if (alive) setFetchedProfiles(profiles); })
      .catch(() => { if (alive) showToast({ type: "error", message: "Failed to load access profiles" }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { violations, hasBlockingViolation, checking: checkingViolations } = useSodAccessProfileCheck(selectedIds, isOpen);

  const profileById = useMemo(() => new Map(allProfiles.map((p) => [p.id, p])), [allProfiles]);

  const isLocked = (p: AccessProfileResponse) => p.system || !p.active;

  const availableProfiles = useMemo(() => {
    const q = availableSearch.trim().toLowerCase();
    return allProfiles.filter((p) => {
      if (selectedIds.includes(p.id)) return false;
      if (isLocked(p)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    });
  }, [allProfiles, selectedIds, availableSearch]);

  const selectedProfiles = useMemo(() => {
    const q = selectedSearch.trim().toLowerCase();
    return selectedIds
      .map((id) => profileById.get(id))
      .filter((p): p is AccessProfileResponse => Boolean(p))
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [selectedIds, profileById, selectedSearch]);

  const moveToSelected = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedIds((prev) => [...prev, ...ids.filter((id) => !prev.includes(id))]);
    setPickedAvailableIds([]);
  };

  const moveToAvailable = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedIds((prev) => prev.filter((id) => {
      if (!ids.includes(id)) return true;
      const p = profileById.get(id);
      return p ? isLocked(p) : false; // locked entries can't be removed via this UI
    }));
    setPickedSelectedIds([]);
  };

  const toggleAvailablePick = (id: string) =>
    setPickedAvailableIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleSelectedPick = (id: string, locked: boolean) => {
    if (locked) return;
    setPickedSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleDragStart = (e: React.DragEvent, id: string, source: "available" | "selected") => {
    e.dataTransfer.setData("id", id);
    e.dataTransfer.setData("source", source);
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
  };
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDropToSelected = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const source = e.dataTransfer.getData("source");
    if (source === "available" && id) moveToSelected([id]);
  };
  const handleDropToAvailable = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("id");
    const source = e.dataTransfer.getData("source");
    if (source === "selected" && id) moveToAvailable([id]);
  };

  const isDirty = useMemo(() => {
    if (currentProfileIds.length !== selectedIds.length) return true;
    const current = new Set(currentProfileIds);
    return selectedIds.some((id) => !current.has(id));
  }, [currentProfileIds, selectedIds]);

  const handleSave = async () => {
    if (hasBlockingViolation) return;
    if (isLocalMode) {
      onSaveLocal!(selectedIds);
      onClose();
      return;
    }
    if (!userId) { onClose(); return; }
    if (!isDirty) { onClose(); return; }
    const sig = await requestSignature("Update Access Profiles", "Access Profile Change");
    if (!sig) return;

    setSaving(true);
    const added = selectedIds.filter((id) => !currentProfileIds.includes(id));
    const removed = currentProfileIds.filter((id) => !selectedIds.includes(id));
    let failed = 0;
    try {
      for (const id of added) {
        try {
          await settingsApi.assignUserToAccessProfile(id, userId, sig);
        } catch {
          failed += 1;
        }
      }
      for (const id of removed) {
        try {
          await settingsApi.removeUserFromAccessProfile(id, userId, sig);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) {
        showToast({
          type: "error",
          title: "Some changes failed to apply",
          message: `${added.length + removed.length - failed} change(s) applied, ${failed} failed. The list below now reflects the actual server state.`,
        });
      } else {
        showToast({ type: "success", message: "Access profiles updated" });
      }
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={() => void handleSave()}
        title={isLocalMode ? "Assign Access Profiles" : "Edit Access Profiles"}
        description={
          isLocalMode
            ? `Choose which Access Profiles will be assigned to ${userName} once the account is created.`
            : `Choose which Access Profiles are assigned to ${userName}. Changes apply immediately after you save and require an electronic signature.`
        }
        confirmText="Save"
        isLoading={saving}
        confirmDisabled={loading || hasBlockingViolation || checkingViolations || (!isLocalMode && !isDirty)}
        size="2xl"
        className="max-w-[95%] sm:max-w-3xl"
      >
        {loading ? (
          <SectionLoading minHeight="200px" />
        ) : (
          <div className="flex flex-col h-full">
            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-700">
              {isLocalMode
                ? "Access is cumulative across all selected profiles -- there is no primary/secondary distinction."
                : "Unassigning a profile immediately removes every permission it grants once saved."} System profiles and inactive profiles cannot be changed here.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-2 lg:gap-6">
              {/* Available Profiles */}
              <div className="flex flex-col min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">Available Profiles</h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={availableSearch}
                    onChange={(e) => setAvailableSearch(e.target.value)}
                    placeholder="Search by name or code..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropToAvailable}
                  className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[220px] sm:max-h-[320px] overflow-y-auto custom-scrollbar"
                >
                  {availableProfiles.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {availableProfiles.map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, p.id, "available")}
                          onDragEnd={handleDragEnd}
                          onClick={() => toggleAvailablePick(p.id)}
                          onDoubleClick={() => moveToSelected([p.id])}
                          className={cn(
                            "px-3 py-2.5 cursor-pointer transition-all text-[11px] hover:bg-emerald-50/50 flex items-center gap-2.5",
                            pickedAvailableIds.includes(p.id) && "bg-emerald-50/80 font-medium",
                          )}
                        >
                          <div className="h-6 w-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                            <IconUserKey className="h-3 w-3 text-emerald-600" />
                          </div>
                          <span className="font-medium text-slate-900 truncate min-w-0 flex-1">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-sm text-slate-400 py-10">
                      {availableSearch ? "No matching profiles" : "No profiles available"}
                    </div>
                  )}
                </div>
              </div>

              {/* Arrow Buttons */}
              <div className="flex lg:flex-col items-center justify-center gap-3 py-2 lg:pt-12">
                <button
                  onClick={() => moveToSelected(pickedAvailableIds)}
                  disabled={pickedAvailableIds.length === 0}
                  className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Move to selected"
                >
                  <ChevronRight className="h-5 w-5 rotate-90 lg:rotate-0" />
                </button>
                <button
                  onClick={() => moveToAvailable(pickedSelectedIds)}
                  disabled={pickedSelectedIds.length === 0}
                  className="p-2 sm:p-2.5 border border-slate-200 rounded-xl bg-white shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  title="Move to available"
                >
                  <ChevronLeft className="h-5 w-5 rotate-90 lg:rotate-0" />
                </button>
              </div>

              {/* Selected Profiles */}
              <div className="flex flex-col min-w-0">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-2 sm:mb-3">Selected Profiles</h3>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={selectedSearch}
                    onChange={(e) => setSelectedSearch(e.target.value)}
                    placeholder="Search in selected..."
                    className="w-full h-9 pl-9 pr-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-sm"
                  />
                </div>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDropToSelected}
                  className="border border-slate-200 rounded-lg bg-slate-50/50 flex-1 min-h-[100px] sm:min-h-[180px] max-h-[220px] sm:max-h-[320px] overflow-y-auto custom-scrollbar"
                >
                  {selectedProfiles.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {selectedProfiles.map((p) => {
                        const locked = isLocked(p);
                        return (
                          <div
                            key={p.id}
                            draggable={!locked}
                            onDragStart={(e) => !locked && handleDragStart(e, p.id, "selected")}
                            onDragEnd={handleDragEnd}
                            onClick={() => toggleSelectedPick(p.id, locked)}
                            onDoubleClick={() => !locked && moveToAvailable([p.id])}
                            title={locked ? (p.system ? "System profiles cannot be modified." : "Inactive profiles cannot be changed here.") : undefined}
                            className={cn(
                              "px-3 py-2.5 transition-all text-[11px] flex items-center gap-2.5",
                              locked ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-white/80",
                              pickedSelectedIds.includes(p.id) && "bg-blue-50/80 font-medium",
                            )}
                          >
                            <div className="h-6 w-6 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
                              <IconUserKey className="h-3 w-3 text-emerald-600" />
                            </div>
                            <span className="font-medium text-slate-900 truncate min-w-0 flex-1">{p.name}</span>
                            {!p.active && <Badge color="slate" size="sm">Inactive</Badge>}
                            {p.system && <Badge color="amber" size="sm">System</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10 opacity-60">
                      <span className="text-xs">No profiles selected</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {violations.length > 0 && (
              <div className="mt-4">
                <SodViolationPanel violations={violations} />
                {hasBlockingViolation && (
                  <p className="mt-2 text-xs font-medium text-rose-600">
                    Resolve the blocked conflict(s) above before saving.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </FormModal>
      {!isLocalMode && signatureModal}
    </>
  );
};
