import React, { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Select, type SelectOption } from "@/components/ui/select";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import { metadataApi } from "@/services/api/metadata";
import { eformSessionApi } from "@/services/api/eformSessions";

const searchSystemUsers = async (query: string, keep: SelectOption | null): Promise<SelectOption[]> => {
  const users = await metadataApi.getUsersLookup({ search: query.trim() || undefined });
  const options: SelectOption[] = users.map((u) => ({
    value: u.id,
    label: [u.fullName || u.username || u.id, u.email || u.department].filter(Boolean).join(" · "),
  }));
  return keep && !options.some((o) => o.value === keep.value) ? [keep, ...options] : options;
};

interface Row {
  key: string;
  roleName: string;
  user: SelectOption | null;
  sequence: number;
}

/**
 * Sequential signer-chain setup for ONE electronic Controlled Copy, shown at Ready for
 * Distribution before the Distribute action -- see the approved plan "Form / eForm -- Phase 2b:
 * Per-Distribution Sequential Signer Assignment". Scans the Form's committed fillable template for
 * OnlyOffice Role names (the same mechanism Publishing Template uses to discover `{{token}}`
 * placeholders) and lets the DCO assign a person + signing order to each one found.
 */
export const AssignEformSignersModal: React.FC<{
  isOpen: boolean;
  controlledCopyId: string;
  onClose: () => void;
  /** Called once every scanned role has an assignment and the DCO continues to Distribute. */
  onContinue: () => void;
}> = ({ isOpen, controlledCopyId, onClose, onContinue }) => {
  const { showToast } = useToast();
  const [scannedRoles, setScannedRoles] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const labels = useRef(new Map<string, string>());

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setIsLoading(true);
    Promise.all([
      eformSessionApi.scanSignerRoles(controlledCopyId),
      eformSessionApi.listSignerAssignments(controlledCopyId),
    ])
      .then(([roles, existing]) => {
        if (!active) return;
        setScannedRoles(roles);
        setRows(
          roles.map((roleName, index) => {
            const match = existing.find((a) => a.roleName === roleName);
            return {
              key: roleName,
              roleName,
              user: match ? { value: match.assignedUserId, label: match.assignedUserName } : null,
              sequence: match ? match.sequence : index + 1,
            };
          }),
        );
      })
      .catch((err) => {
        showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Unable to scan this Form's signer roles.") });
      })
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, controlledCopyId]);

  const sequencesAreUnique = new Set(rows.map((r) => r.sequence)).size === rows.length;
  const allAssigned = rows.length > 0 && rows.every((r) => r.user) && sequencesAreUnique;

  const handleSaveAndContinue = async () => {
    if (!allAssigned) return;
    setIsSaving(true);
    try {
      await eformSessionApi.updateSignerAssignments(
        controlledCopyId,
        rows.map((r) => ({ roleName: r.roleName, assignedUserId: String(r.user!.value), sequence: r.sequence })),
      );
      onContinue();
    } catch (err) {
      showToast({ type: "error", title: "Error", message: extractApiMessage(err, "Unable to save signer assignments.") });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} title="Assign eForm Signers" onClose={onClose} size="lg">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="h-4 w-4 text-slate-500" /> Signing order for this distribution
        </div>
        <p className="text-xs text-slate-500">
          Found on this Form's fillable template via "Manage Roles" in OnlyOffice. Assign one person and a signing order to
          each -- a Fill/Sign session for a role is refused to anyone else, or if it isn't their turn yet.
        </p>

        {isLoading ? (
          <p className="text-sm text-slate-500">Scanning the Form's fillable template...</p>
        ) : scannedRoles.length === 0 ? (
          <p className="text-sm italic text-slate-400">
            No signer roles found on this Form's template -- the recipient will fill everything in one step.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.key} className="flex items-center gap-2">
                <div className="w-16">
                  <Input
                    type="number"
                    min={1}
                    value={String(row.sequence)}
                    onChange={(e) =>
                      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, sequence: Number(e.target.value) || 1 } : r)))
                    }
                  />
                </div>
                <div className="w-48 shrink-0 text-sm font-medium text-slate-800">{row.roleName}</div>
                <div className="flex-1">
                  <Select
                    value={row.user ? String(row.user.value) : ""}
                    options={row.user ? [row.user] : []}
                    placeholder="Select the signer"
                    searchPlaceholder="Search by name, e-mail or code..."
                    onSearch={async (query) => {
                      const options = await searchSystemUsers(query, row.user);
                      options.forEach((o) => labels.current.set(String(o.value), o.label));
                      return options;
                    }}
                    debounceMs={300}
                    minSearchLength={0}
                    onChange={(next) => {
                      const id = next == null ? "" : String(next);
                      setRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, user: id ? { value: id, label: labels.current.get(id) ?? id } : null } : r)),
                      );
                    }}
                  />
                </div>
              </div>
            ))}
            {!sequencesAreUnique && <p className="text-xs text-rose-600">Each role needs its own signing order number.</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="outline-emerald"
            disabled={isLoading || isSaving || (scannedRoles.length > 0 && !allAssigned)}
            onClick={handleSaveAndContinue}
          >
            {isSaving ? "Saving..." : "Continue to Distribute"}
          </Button>
        </div>
      </div>
    </FormModal>
  );
};
