import React, { useCallback, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { ROUTES } from "@/app/routes.constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, type SelectOption } from "@/components/ui/select/Select";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { useToast } from "@/components/ui/toast";
import { knowledgeApi, type SharingLink, type SharingLinkCreated, type SharingNode } from "@/services/api/knowledge";
import { errorMessage, refOf, useShareAction, type FooterAction } from "./shareUi";
import { ShareScrollList } from "./ShareScrollList";

interface ShareLinksTabProps {
  node: SharingNode;
  active: boolean;
  registerAction: (action: FooterAction | null) => void;
}

const STATUS_COLOR = { ACTIVE: "emerald", EXPIRED: "slate", REVOKED: "red" } as const;
const STATUS_LABEL = { ACTIVE: "Active", EXPIRED: "Expired", REVOKED: "Revoked" } as const;

/** The address a person pastes into a browser to open the link. */
export const linkAddress = (token: string): string => `${window.location.origin}${ROUTES.DOCUMENTS.KNOWLEDGE_LINK(token)}`;

/**
 * The Links tab: make a link to the item (a folder or a document) with an expiry, copy it once, and see and revoke the links that reach it. The
 * link is shown only when it is made (the server keeps its hash, not the link). Whoever opens it, signed in and holding the Knowledge permission,
 * is given what it points to until it expires or is revoked; a revoked link opens nothing, even if somebody saved it.
 */
export const ShareLinksTab: React.FC<ShareLinksTabProps> = ({ node, active, registerAction }) => {
  const { showToast } = useToast();
  const [reloadKey, setReloadKey] = useState(0);
  const [days, setDays] = useState("30");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<SharingLinkCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<SharingLink | null>(null);

  // only a Head may make a link that never expires
  const expiryOptions: SelectOption[] = [
    { value: "1", label: "1 day" },
    { value: "7", label: "7 days" },
    { value: "30", label: "30 days" },
    { value: "90", label: "90 days" },
    ...(node.canExclude ? [{ value: "never", label: "Never expires" }] : []),
  ];

  const fetchLinks = useCallback(
    ({ search, offset, limit }: { search: string; offset: number; limit: number }) => knowledgeApi.sharingLinks(refOf(node), { search, offset, limit }),
    [node],
  );

  const create = async () => {
    setCreating(true);
    try {
      const result = await knowledgeApi.sharingCreateLink({ ...refOf(node), expiresInDays: days === "never" ? null : Number(days) });
      setCreated(result);
      setCopied(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      showToast({ type: "error", title: "Could not make the link", message: errorMessage(error, "Please try again.") });
    } finally {
      setCreating(false);
    }
  };

  useShareAction(active, registerAction, { label: "Make link", disabled: creating, loading: creating, onClick: () => void create() });

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(linkAddress(created.token));
      setCopied(true);
    } catch {
      showToast({ type: "error", title: "Could not copy", message: "Your browser did not allow access to the clipboard. Select the link and copy it." });
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await knowledgeApi.sharingRevokeLink(revokeTarget.id);
      showToast({ type: "success", title: "Link revoked", message: "It no longer opens anything. The change was recorded in the Audit Trail." });
      setReloadKey((k) => k + 1);
    } catch (error) {
      showToast({ type: "error", title: "Could not revoke", message: errorMessage(error, "Please try again.") });
    } finally {
      setRevokeTarget(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
      <section className="space-y-3 order-1" aria-label="Make a link">
        <h3 className="text-sm font-semibold text-slate-900">Make a link</h3>
        <Select label="Expires after" value={days} onChange={(v) => setDays(String(v))} options={expiryOptions} enableSearch={false} />

        {created && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3" role="status">
            <p className="text-xs font-medium text-emerald-800">Link made. Copy it now: it is shown only once.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={linkAddress(created.token)}
                aria-label="The link"
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 min-w-0 flex-1 rounded-lg border border-emerald-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Button size="sm" variant="outline-emerald" onClick={copy} className="gap-1.5 whitespace-nowrap">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="order-2 min-w-0 space-y-2.5" aria-label="Links">
        <h3 className="text-sm font-semibold text-slate-900">Links that reach this item</h3>
        <ShareScrollList<SharingLink>
          ariaLabel="Links that reach this item"
          fetchPage={fetchLinks}
          getKey={(link) => link.id}
          searchPlaceholder="Search the links"
          emptyText="No link has been made for this item."
          reloadKey={reloadKey}
          renderRow={(link) => (
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <Badge color={STATUS_COLOR[link.status]} size="xs" className="shrink-0">{STATUS_LABEL[link.status]}</Badge>
                  <span className="truncate text-xs font-medium text-slate-700">{link.inherited ? `From ${link.scopeLabel}: ${link.label}` : link.label}</span>
                </div>
                <p className="truncate text-2xs text-slate-500" title={`Made by ${link.createdBy ?? "-"} on ${link.createdAt}`}>
                  {[
                    [link.createdBy, link.createdAt].filter(Boolean).join(" "),
                    link.expiresAt ? `expires ${link.expiresAt}` : "no expiry",
                    link.revokedAt ? `revoked ${link.revokedAt}${link.revokedBy ? ` by ${link.revokedBy}` : ""}` : null,
                    `opened by ${link.opens}`,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              {link.revocable && (
                <Button size="sm" variant="outline" onClick={() => setRevokeTarget(link)} className="shrink-0">Revoke</Button>
              )}
            </div>
          )}
        />
      </section>

      <AlertModal
        isOpen={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={revoke}
        type="confirm"
        title="Revoke this link?"
        description={
          <p className="text-sm text-slate-600">
            The link to <strong>{revokeTarget?.label}</strong> stops opening anything at once, even for people who saved it. People who already
            have access through a share keep it. This is recorded in the Audit Trail.
          </p>
        }
        confirmText="Revoke"
        cancelText="Cancel"
      />
    </div>
  );
};
