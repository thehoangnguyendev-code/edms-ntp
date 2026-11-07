import React, { useCallback, useState } from "react";
import { UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import { knowledgeApi, type SharingDelegate, type SharingGrantee, type SharingNode, type SharingScope } from "@/services/api/knowledge";
import { errorMessage, useShareAction, type FooterAction } from "./shareUi";
import { ShareScrollList } from "./ShareScrollList";

interface ShareDelegatesTabProps {
  node: SharingNode;
  active: boolean;
  registerAction: (action: FooterAction | null) => void;
}

const userLabel = (u: SharingGrantee) => (u.employeeCode ? `${u.fullName} (${u.employeeCode})` : u.fullName);

/**
 * The Delegates tab (Heads only): the people the Head named to share like the Head. They share, make links and take away what they shared
 * themselves; they never exclude and never remove what a Head shared; the Head is told by e-mail and the Audit Trail knows each time. For a
 * Business Unit folder the scope is the whole Unit; for anything else it is the Department. The picker offers only the people of that scope
 * (the server keeps to it): a Department Head sees the Department's own people, a Head of Unit every person of the Unit. The list of people who
 * may share is read a page at a time as it is scrolled.
 */
export const ShareDelegatesTab: React.FC<ShareDelegatesTabProps> = ({ node, active, registerAction }) => {
  const { showToast } = useToast();
  const unit = node.kind === "BUSINESS_UNIT";
  const scope: SharingScope = {
    scopeKind: unit ? "BUSINESS_UNIT" : "DEPARTMENT",
    businessUnitId: unit ? node.businessUnitId : undefined,
    departmentId: unit ? undefined : node.departmentId,
  };
  const scopeName = unit ? `the Business Unit ${node.businessUnitName ?? ""}` : `the Department ${node.departmentName ?? ""}`;

  const [reloadKey, setReloadKey] = useState(0);
  const [picked, setPicked] = useState<SharingGrantee[]>([]);
  const [searched, setSearched] = useState<SharingGrantee[]>([]);
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<SharingDelegate | null>(null);

  const fetchDelegates = useCallback(
    ({ search, offset, limit }: { search: string; offset: number; limit: number }) =>
      knowledgeApi.sharingDelegates({ scopeKind: scope.scopeKind, businessUnitId: scope.businessUnitId, departmentId: scope.departmentId }, { search, offset, limit }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope.scopeKind, scope.businessUnitId, scope.departmentId],
  );

  const add = async () => {
    if (picked.length === 0) return;
    setAdding(true);
    const failed: string[] = [];
    let added = 0;
    for (const user of picked) {
      try {
        await knowledgeApi.sharingAddDelegate({ ...scope, userId: user.id });
        added += 1;
      } catch (error) {
        failed.push(`${user.fullName}: ${errorMessage(error, "could not be added")}`);
      }
    }
    setPicked(picked.filter((u) => failed.some((f) => f.startsWith(`${u.fullName}:`))));
    if (added > 0) {
      setReloadKey((k) => k + 1);
      showToast({ type: "success", title: "Added", message: `${added === 1 ? "The person" : `${added} people`} may now share like you. The change was recorded in the Audit Trail.` });
    }
    if (failed.length > 0) showToast({ type: "error", title: "Could not add everyone", message: failed.join(" ") });
    setAdding(false);
  };

  useShareAction(active, registerAction, {
    label: picked.length > 1 ? `Add ${picked.length} people` : "Add",
    disabled: picked.length === 0 || adding,
    loading: adding,
    onClick: () => void add(),
  });

  const remove = async () => {
    if (!removeTarget) return;
    try {
      await knowledgeApi.sharingRemoveDelegate(removeTarget.id);
      showToast({ type: "success", title: "Removed", message: "The person may no longer share. What they shared stays until a Head removes it." });
      setReloadKey((k) => k + 1);
    } catch (error) {
      showToast({ type: "error", title: "Could not remove", message: errorMessage(error, "Please try again.") });
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <section className="order-1 space-y-3" aria-label="Add a person who may share">
        <h3 className="text-sm font-semibold text-slate-900">Who may share for you</h3>
        <MultiSelect
          label="Add people"
          value={picked.map((u) => u.id)}
          onChange={(values) =>
            setPicked((current) => {
              const known = new Map([...current, ...searched].map((u) => [u.id, u]));
              return values.map((v) => known.get(String(v))).filter((u): u is SharingGrantee => !!u);
            })
          }
          options={picked.map((u) => ({ value: u.id, label: userLabel(u) }))}
          onSearch={async (query) => {
            const found = await knowledgeApi.sharingUsers(query, scope);
            setSearched((prev) => [...prev, ...found]);
            return found.map((u) => ({ value: u.id, label: userLabel(u) }));
          }}
          minSearchLength={0}
          placeholder={unit ? "Search a person of the Unit" : "Search a person of the Department"}
          searchPlaceholder="Type a name or employee ID"
          maxVisibleTags={4}
        />
      </section>

      <section className="order-2 min-w-0 space-y-2.5" aria-label="People who may share">
        <h3 className="text-sm font-semibold text-slate-900">People who may share</h3>
        <ShareScrollList<SharingDelegate>
          ariaLabel="People who may share"
          fetchPage={fetchDelegates}
          getKey={(d) => d.id}
          searchPlaceholder="Search the people who may share"
          emptyText={`Nobody else may share for ${scopeName} yet.`}
          reloadKey={reloadKey}
          renderRow={(d) => (
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{d.fullName}</span>
                <p className="truncate text-2xs text-slate-500">{[d.employeeCode, d.position].filter(Boolean).join(" · ")}</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove ${d.fullName}`} onClick={() => setRemoveTarget(d)} className="shrink-0 text-slate-500 hover:text-red-600">
                <UserMinus className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </section>

      <AlertModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={remove}
        type="confirm"
        title="Remove this person?"
        description={
          <p className="text-sm text-slate-600">
            <strong>{removeTarget?.fullName}</strong> may no longer share for {scopeName}. What they already shared stays until a Head removes it.
            This is recorded in the Audit Trail.
          </p>
        }
        confirmText="Remove"
        cancelText="Cancel"
      />
    </div>
  );
};
