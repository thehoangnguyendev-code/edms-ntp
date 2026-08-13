import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { FormModal } from "@/components/ui/modal/FormModal";
import { Checkbox } from "@/components/ui/checkbox/Checkbox";
import { Badge } from "@/components/ui/badge/Badge";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { useToast } from "@/components/ui/toast";
import { settingsApi, type AccessProfileResponse } from "@/services/api/settings";
import { useSecurityESign } from "../../shared/useSecurityESign";
import { useSodAccessProfileCheck } from "../../shared/useSodAccessProfileCheck";
import { SodViolationPanel } from "../../shared/SodViolationPanel";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentProfileIds: string[];
  onSaved: () => void;
}

export const EditAccessProfilesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  userId,
  userName,
  currentProfileIds,
  onSaved,
}) => {
  const { showToast } = useToast();
  const { requestSignature, signatureModal } = useSecurityESign();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allProfiles, setAllProfiles] = useState<AccessProfileResponse[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setSearch("");
    setSelectedIds(currentProfileIds);
    settingsApi
      .listAllAccessProfiles()
      .then(setAllProfiles)
      .catch(() =>
        showToast({ type: "error", message: "Failed to load access profiles" }),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const { violations, checking: checkingViolations, hasBlockingViolation } = useSodAccessProfileCheck(
    selectedIds,
    isOpen,
  );

  const toggle = (profile: AccessProfileResponse) => {
    if (profile.system || !profile.active) return;
    setSelectedIds((prev) =>
      prev.includes(profile.id)
        ? prev.filter((id) => id !== profile.id)
        : [...prev, profile.id],
    );
  };

  const clearableSelectedIds = useMemo(
    () =>
      selectedIds.filter((id) => {
        const profile = allProfiles.find((p) => p.id === id);
        return profile ? !profile.system && profile.active : true;
      }),
    [selectedIds, allProfiles],
  );

  const clearAll = () => {
    setSelectedIds((prev) => prev.filter((id) => !clearableSelectedIds.includes(id)));
  };

  const q = search.trim().toLowerCase();
  const filteredProfiles = useMemo(
    () =>
      q
        ? allProfiles.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.code.toLowerCase().includes(q),
          )
        : allProfiles,
    [allProfiles, q],
  );

  const { added, removed } = useMemo(() => {
    const originalSet = new Set(currentProfileIds);
    const nextSet = new Set(selectedIds);
    return {
      added: selectedIds.filter((id) => !originalSet.has(id)),
      removed: currentProfileIds.filter((id) => !nextSet.has(id)),
    };
  }, [currentProfileIds, selectedIds]);

  const isDirty = added.length > 0 || removed.length > 0;

  const handleSave = useCallback(async () => {
    if (!isDirty) {
      onClose();
      return;
    }
    if (hasBlockingViolation) return;
    const sig = await requestSignature("Update Access Profiles", "Access Profile Change");
    if (!sig) return;

    setSaving(true);
    const applied: string[] = [];
    const failed: string[] = [];
    try {
      for (const profileId of added) {
        try {
          await settingsApi.assignUserToAccessProfile(profileId, userId, sig);
          applied.push(profileId);
        } catch {
          failed.push(profileId);
        }
      }
      for (const profileId of removed) {
        try {
          await settingsApi.removeUserFromAccessProfile(profileId, userId, sig);
          applied.push(profileId);
        } catch {
          failed.push(profileId);
        }
      }

      if (failed.length > 0) {
        showToast({
          type: "error",
          title: "Some changes failed to apply",
          message: `${applied.length} change(s) applied, ${failed.length} failed. The list below now reflects the actual server state.`,
        });
      } else {
        showToast({ type: "success", message: "Access profiles updated" });
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [isDirty, hasBlockingViolation, requestSignature, added, removed, userId, showToast, onSaved, onClose]);

  return (
    <>
      <FormModal
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={() => void handleSave()}
        title="Edit Access Profiles"
        description={`Choose which Access Profiles are assigned to ${userName}. Changes apply immediately after you save and require an electronic signature.`}
        confirmText="Save"
        isLoading={saving}
        confirmDisabled={loading || !isDirty || hasBlockingViolation || checkingViolations}
        size="lg"
      >
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-700">
          Unassigning a profile immediately removes every permission it grants once saved. System profiles and inactive profiles cannot be toggled here.
        </div>

        {violations.length > 0 && (
          <div className="mb-4">
            <SodViolationPanel violations={violations} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              className="w-full h-9 pl-9 pr-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search access profiles…"
            />
          </div>
          {clearableSelectedIds.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors whitespace-nowrap"
            >
              Clear All ({clearableSelectedIds.length})
            </button>
          )}
        </div>

        {loading ? (
          <SectionLoading minHeight="200px" />
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
            {filteredProfiles.length === 0 && (
              <p className="p-4 text-sm text-slate-400">No access profiles match your search.</p>
            )}
            {filteredProfiles.map((profile) => {
              const disabled = profile.system || !profile.active;
              return (
                <label
                  key={profile.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    disabled ? "cursor-not-allowed bg-slate-50/60" : "hover:bg-slate-50 cursor-pointer"
                  }`}
                  title={
                    profile.system
                      ? "System profiles cannot be modified."
                      : !profile.active
                        ? "Inactive profiles cannot be assigned."
                        : undefined
                  }
                >
                  <Checkbox
                    id={`edit-access-profile-${profile.id}`}
                    checked={selectedIds.includes(profile.id)}
                    onChange={() => toggle(profile)}
                    disabled={disabled}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-medium text-slate-800">{profile.name}</span>
                      {!profile.active && (
                        <Badge color="slate" size="sm">Inactive</Badge>
                      )}
                      {profile.system && (
                        <Badge color="amber" size="sm">System</Badge>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </FormModal>
      {signatureModal}
    </>
  );
};
