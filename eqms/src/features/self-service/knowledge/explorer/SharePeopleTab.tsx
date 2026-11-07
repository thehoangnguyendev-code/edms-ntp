import React, { useCallback, useMemo, useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/select/MultiSelect";
import { Switch } from "@/components/ui/switch/Switch";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import {
  knowledgeApi,
  type SharingAccess,
  type SharingEntry,
  type SharingGrantee,
  type SharingNode,
  type SharingOptions,
  type SharingPerson,
} from "@/services/api/knowledge";
import { TabNav } from "@/components/ui/tabs/TabNav";
import { CanShareBadge, errorMessage, LEVEL_LABEL, refOf, useShareAction, type FooterAction } from "./shareUi";
import { ShareScrollList } from "./ShareScrollList";

interface SharePeopleTabProps {
  node: SharingNode;
  entries: SharingEntry[];
  options: SharingOptions | null;
  onChanged: (access: SharingAccess) => void;
  active: boolean;
  registerAction: (action: FooterAction | null) => void;
}

const userLabel = (u: SharingGrantee) => (u.employeeCode ? `${u.fullName} (${u.employeeCode})` : u.fullName);
const personKey = (p: SharingPerson) => `${p.ruleId}:${p.granteeType}:${p.granteeId ?? ""}`;

/**
 * The People tab of the Share dialog: who has access now, one row for each person (read a page at a time as the list is scrolled, searched on
 * the server, each row with its own remove button and a "Remove all" beside the search), and a form to add people. The two "everyone" switches
 * are one row each; every picker takes the full width. Taking someone away asks first; a share made by a higher level shows a lock instead of a bin.
 */
export const SharePeopleTab: React.FC<SharePeopleTabProps> = ({ node, entries, options, onChanged, active, registerAction }) => {
  const { showToast } = useToast();
  const [show, setShow] = useState<"all" | "mine">("all");
  const [reloadKey, setReloadKey] = useState(0);
  const [removeTarget, setRemoveTarget] = useState<SharingPerson | null>(null);
  const [removeAll, setRemoveAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const [effect, setEffect] = useState<"ALLOW" | "DENY">("ALLOW");
  const [everyone, setEveryone] = useState(false);
  const [wholeDepartment, setWholeDepartment] = useState(false);
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [users, setUsers] = useState<SharingGrantee[]>([]);
  const [searchedUsers, setSearchedUsers] = useState<SharingGrantee[]>([]);

  const ownerName = node.kind === "BUSINESS_UNIT" ? node.businessUnitName : node.departmentName;
  const ownerWord = node.kind === "BUSINESS_UNIT" ? "Business Unit" : "Department";
  const formEmpty = !everyone && !wholeDepartment && positionIds.length === 0 && departmentIds.length === 0 && users.length === 0;
  const anyMine = entries.some((e) => e.createdByMe);
  const removable = useMemo(() => entries.filter((e) => e.removable), [entries]);

  const departmentOptions = useMemo(
    () => (options?.departments ?? []).filter((d) => d.value !== node.departmentId).map((d) => ({ value: d.value, label: d.label })),
    [options, node.departmentId],
  );

  const refresh = useCallback(async () => {
    onChanged(await knowledgeApi.sharingAccess(refOf(node)));
    setReloadKey((k) => k + 1);
  }, [node, onChanged]);

  const reset = () => {
    setEffect("ALLOW");
    setEveryone(false);
    setWholeDepartment(false);
    setPositionIds([]);
    setDepartmentIds([]);
    setUsers([]);
  };

  const add = async () => {
    if (formEmpty || !node.kind) return;
    setSaving(true);
    try {
      const access = await knowledgeApi.sharingGrant({
        ...refOf(node),
        effect,
        userIds: users.map((u) => u.id),
        positionIds,
        departmentIds,
        wholeDepartment,
        everyone,
      });
      onChanged(access);
      setReloadKey((k) => k + 1);
      showToast({ type: "success", title: effect === "DENY" ? "Excluded" : "Shared", message: `${node.label ?? "The item"} was updated.` });
      reset();
    } catch (error) {
      showToast({ type: "error", title: "Could not save", message: errorMessage(error, "Please try again.") });
    } finally {
      setSaving(false);
    }
  };

  useShareAction(active, registerAction, {
    label: effect === "DENY" ? "Exclude" : "Share",
    disabled: formEmpty || saving,
    loading: saving,
    destructive: effect === "DENY",
    onClick: () => void add(),
  });

  const removeOne = async () => {
    if (!removeTarget) return;
    try {
      await knowledgeApi.sharingRevokeGrantee(removeTarget.ruleId, removeTarget.granteeType, removeTarget.granteeId);
      await refresh();
      showToast({ type: "success", title: "Removed", message: `${removeTarget.label} was taken out. The change was recorded in the Audit Trail.` });
    } catch (error) {
      showToast({ type: "error", title: "Could not remove", message: errorMessage(error, "Please try again.") });
    } finally {
      setRemoveTarget(null);
    }
  };

  const removeEverything = async () => {
    try {
      for (const entry of removable) await knowledgeApi.sharingRevoke(entry.ruleId);
      await refresh();
      showToast({ type: "success", title: "Removed", message: "Everything you may remove was taken away. The changes were recorded in the Audit Trail." });
    } catch (error) {
      await refresh().catch(() => undefined);
      showToast({ type: "error", title: "Could not remove", message: errorMessage(error, "Please try again.") });
    } finally {
      setRemoveAll(false);
    }
  };

  const fetchPeople = useCallback(
    ({ search, offset, limit }: { search: string; offset: number; limit: number }) =>
      knowledgeApi.sharingPeople(refOf(node), { search, offset, limit, mine: show === "mine" }),
    [node, show],
  );

  const row = (p: SharingPerson) => (
    <div className="flex w-full min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-slate-900">{p.label}</span>
          {p.canShare && <CanShareBadge />}
          <Badge color={p.effect === "ALLOW" ? "emerald" : "red"} size="xs" className="shrink-0">{p.effect === "ALLOW" ? "Shared" : "Excluded"}</Badge>
        </div>
        <p className="truncate text-2xs text-slate-500">
          {[
            p.detail,
            p.inherited ? `From ${p.scopeLabel}` : null,
            p.createdBy,
            p.createdAt,
          ].filter(Boolean).join(" · ")}
        </p>
      </div>
      {p.removable ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${p.label}`} onClick={() => setRemoveTarget(p)} className="shrink-0 text-slate-500 hover:text-red-600">
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : p.inherited ? (
        <span className="shrink-0 text-2xs text-slate-400">Inherited</span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-slate-400" title={`Made by ${LEVEL_LABEL[p.createdByLevel]}: only the same or a higher level can remove it`}>
          <Lock className="h-3 w-3" /> Locked
        </span>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <section className="order-2 min-w-0 space-y-2.5" aria-label="People with access">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Who has access</h3>
          {anyMine && (
            <div className="w-64">
              <TabNav
                variant="pill"
                ariaLabel="Which shares to show"
                tabs={[{ id: "all", label: "All" }, { id: "mine", label: "Shared by me" }]}
                activeTab={show}
                onChange={(id) => setShow(id as "all" | "mine")}
              />
            </div>
          )}
        </div>
        <ShareScrollList<SharingPerson>
          ariaLabel="Who has access"
          fetchPage={fetchPeople}
          renderRow={row}
          getKey={personKey}
          searchPlaceholder="Search who has access"
          emptyText={show === "mine" ? "You have not shared this item yourself." : "Nobody except the Heads can see this yet."}
          reloadKey={`${reloadKey}:${show}`}
          toolbar={
            removable.length > 0 ? (
              <Button variant="outline" size="sm" onClick={() => setRemoveAll(true)} className="shrink-0 gap-1.5 text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4" /> Remove all
              </Button>
            ) : undefined
          }
        />
      </section>

      <section className="order-1 space-y-4" aria-label="Add people">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Add people</h3>
          {node.canExclude && (
            <div className="w-48">
              <TabNav
                variant="pill"
                ariaLabel="Effect"
                tabs={[{ id: "ALLOW", label: "Share" }, { id: "DENY", label: "Exclude" }]}
                activeTab={effect}
                onChange={(id) => setEffect(id as "ALLOW" | "DENY")}
              />
            </div>
          )}
        </div>

        <div className="space-y-4" data-testid="everyone-switches">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Everyone</p>
            </div>
            <Switch checked={everyone} onChange={setEveryone} aria-label="Everyone" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-800">Everyone in {ownerName ?? `the ${ownerWord}`}</p>
            </div>
            <Switch checked={wholeDepartment} onChange={setWholeDepartment} aria-label={`Everyone in the ${ownerWord}`} />
          </div>
        </div>

        <MultiSelect
          label="Other Departments"
          value={departmentIds}
          onChange={(values) => setDepartmentIds(values.map(String))}
          options={departmentOptions}
          placeholder="Everyone of these Departments"
          searchPlaceholder="Search a Department"
          maxVisibleTags={4}
        />
        <MultiSelect
          label="Positions"
          value={positionIds}
          onChange={(values) => setPositionIds(values.map(String))}
          options={(options?.positions ?? []).map((p) => ({ value: p.value, label: p.label }))}
          placeholder="Everyone who holds one of these Positions"
          searchPlaceholder="Search a Position"
          maxVisibleTags={4}
        />
        <MultiSelect
          label="Specific people"
          value={users.map((u) => u.id)}
          onChange={(values) =>
            setUsers((current) => {
              const known = new Map([...current, ...searchedUsers].map((u) => [u.id, u]));
              return values.map((v) => known.get(String(v))).filter((u): u is SharingGrantee => !!u);
            })
          }
          options={users.map((u) => ({ value: u.id, label: userLabel(u) }))}
          onSearch={async (query) => {
            const found = await knowledgeApi.sharingUsers(query);
            setSearchedUsers((prev) => [...prev, ...found]);
            return found.map((u) => ({ value: u.id, label: userLabel(u) }));
          }}
          minSearchLength={0}
          placeholder="Search a person by name or employee ID"
          searchPlaceholder="Type a name or employee ID"
          maxVisibleTags={4}
        />
      </section>

      <AlertModal
        isOpen={removeTarget !== null}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeOne}
        type="confirm"
        title={removeTarget?.effect === "DENY" ? "Remove this exclusion?" : `Remove ${removeTarget?.label ?? "this person"}?`}
        description={
          <p className="text-sm text-slate-600">
            {removeTarget?.effect === "DENY"
              ? `${removeTarget.label} can see this item again if another share reaches them.`
              : `${removeTarget?.label ?? "They"} stop seeing this item unless another share reaches them. The others in the same share keep their access.`}{" "}
            This is recorded in the Audit Trail.
          </p>
        }
        confirmText="Remove"
        cancelText="Cancel"
      />

      <AlertModal
        isOpen={removeAll}
        onClose={() => setRemoveAll(false)}
        onConfirm={removeEverything}
        type="confirm"
        title="Remove all?"
        description={
          <p className="text-sm text-slate-600">
            Every share and exclusion on this item that you may remove ({removable.length}) is taken away. What a higher level shared, and what
            the item inherits, stays. This is recorded in the Audit Trail.
          </p>
        }
        confirmText="Remove all"
        cancelText="Cancel"
      />
    </div>
  );
};
