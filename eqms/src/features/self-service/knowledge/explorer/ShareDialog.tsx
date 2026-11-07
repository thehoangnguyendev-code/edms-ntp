import React, { useEffect, useMemo, useState } from "react";
import { UserX } from "lucide-react";
import { SectionLoading } from "@/components/ui/loading/Loading";
import { FormModal } from "@/components/ui/modal/FormModal";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { useToast } from "@/components/ui/toast";
import { knowledgeApi, type SharingAccess, type SharingEntry, type SharingNode, type SharingOptions } from "@/services/api/knowledge";
import { ShareDelegatesTab } from "./ShareDelegatesTab";
import { ShareLinksTab } from "./ShareLinksTab";
import { SharePeopleTab } from "./SharePeopleTab";
import { errorMessage, type FooterAction } from "./shareUi";

/** What the Head right-clicked: a folder of the explorer (the server works out what it is) or one document. */
export type ShareTarget =
  | { kind: "folder"; hierarchyId?: string; knowledgeBase: string; path: string[]; label: string }
  | { kind: "document"; documentId: string; label: string };

interface ShareDialogProps {
  target: ShareTarget | null;
  onClose: () => void;
}

type TabId = "people" | "links" | "delegates";

const KIND_WORD: Record<string, string> = {
  BUSINESS_UNIT: "Business Unit folder",
  DEPARTMENT: "Department folder",
  DOCUMENT_TYPE: "Document Type folder",
  DOCUMENT: "Document",
};

/**
 * Share a folder or a document of the Knowledge Base, Google Drive style. Three tabs: People (who has access, and adding people), Links (a link
 * with an expiry that can be revoked) and, for the Heads, Delegates (the people who may share for them). Only a Head of Unit, a Department Head,
 * a person they named, or a person who may share every Department (the server decides) can open it. Every change goes to the Audit Trail; no
 * e-signature is asked. What a delegate does is also e-mailed to the Head.
 */
export const ShareDialog: React.FC<ShareDialogProps> = ({ target, onClose }) => {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [node, setNode] = useState<SharingNode | null>(null);
  const [entries, setEntries] = useState<SharingEntry[]>([]);
  const [options, setOptions] = useState<SharingOptions | null>(null);
  const [tab, setTab] = useState<TabId>("people");
  // a tab stays mounted once it was opened, so what the person typed or picked in it is still there when they come back
  const [opened, setOpened] = useState<TabId[]>(["people"]);
  // the main action of the tab that is shown (Share, Make link, Add), put in the footer
  const [action, setAction] = useState<FooterAction | null>(null);

  useEffect(() => {
    if (!target) return;
    let alive = true;
    setLoading(true);
    setNode(null);
    setEntries([]);
    setTab("people");
    setOpened(["people"]);
    (async () => {
      try {
        let access: SharingAccess;
        if (target.kind === "folder") {
          const resolved = await knowledgeApi.sharingFolder(target.hierarchyId, target.knowledgeBase, target.path);
          if (!alive) return;
          if (!resolved.shareable) {
            setNode(resolved);
            return;
          }
          access = await knowledgeApi.sharingAccess({
            kind: resolved.kind ?? "DEPARTMENT",
            businessUnitId: resolved.kind === "BUSINESS_UNIT" ? resolved.businessUnitId : undefined,
            departmentId: resolved.kind === "BUSINESS_UNIT" ? undefined : resolved.departmentId,
            documentTypeId: resolved.documentTypeId,
          });
        } else {
          access = await knowledgeApi.sharingAccess({ kind: "DOCUMENT", documentId: target.documentId });
        }
        const opts = await knowledgeApi.sharingOptions();
        if (!alive) return;
        setNode(access.node);
        setEntries(access.entries);
        setOptions(opts);
      } catch (error) {
        if (!alive) return;
        showToast({ type: "error", title: "Could not open sharing", message: errorMessage(error, "Please try again.") });
        onClose();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const tabs = useMemo<TabItem[]>(() => {
    const items: TabItem[] = [{ id: "people", label: "People" }, { id: "links", label: "Links" }];
    if (node?.canManageDelegates) items.push({ id: "delegates", label: "Who may share" });
    return items;
  }, [node?.canManageDelegates]);

  const shareable = !!node?.shareable;
  const onChanged = (access: SharingAccess) => {
    setNode(access.node);
    setEntries(access.entries);
  };

  return (
    <FormModal
      isOpen={target !== null}
      onClose={onClose}
      title={target ? `Share "${target.label}"` : "Share"}
      showFooter={shareable && !!node}
      cancelText="Close"
      confirmText={action?.label ?? "Share"}
      confirmDisabled={!action || action.disabled}
      isLoading={action?.loading}
      confirmVariant={action?.destructive ? "destructive" : "default"}
      onConfirm={action?.onClick}
      size="3xl"
    >
      {/* one size whatever is inside, so the dialog does not shrink and grow */}
      <div className="h-[min(66vh,36rem)]">
      {loading && <SectionLoading text="Loading who has access..." />}

      {!loading && node && !node.shareable && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
          <UserX className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{node.reason ?? "This item cannot be shared."}</p>
        </div>
      )}

      {!loading && shareable && node && (
        <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <TabNav
            tabs={tabs}
            activeTab={tab}
            onChange={(id) => {
              setTab(id as TabId);
              setOpened((current) => (current.includes(id as TabId) ? current : [...current, id as TabId]));
            }}
            variant="simple-underline"
            ariaLabel="Sharing"
          />
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
          <div hidden={tab !== "people"}><SharePeopleTab node={node} entries={entries} options={options} onChanged={onChanged} active={tab === "people"} registerAction={setAction} /></div>
          {opened.includes("links") && <div hidden={tab !== "links"}><ShareLinksTab node={node} active={tab === "links"} registerAction={setAction} /></div>}
          {opened.includes("delegates") && node.canManageDelegates && <div hidden={tab !== "delegates"}><ShareDelegatesTab node={node} active={tab === "delegates"} registerAction={setAction} /></div>}
          </div>
        </div>
      )}
      </div>
    </FormModal>
  );
};
