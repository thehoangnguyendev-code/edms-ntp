import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, MoreVertical, Check, Pencil, Ban } from "lucide-react";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { AlertModal } from "@/components/ui/modal/AlertModal";
import { FormModal } from "@/components/ui/modal/FormModal";
import { useToast } from "@/components/ui/toast/Toast";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TablePagination } from "@/components/ui/table/TablePagination";
import { settingsApi } from "@/services/api";
import type {
  AccessReviewCampaignDetail,
  AccessReviewCampaignSummary,
  AccessReviewItem,
} from "@/services/api/settings";
import { accessReview as accessReviewBreadcrumb } from "@/components/ui/breadcrumb/breadcrumbs/settings";
import { usePermissions } from "@/hooks/usePermissions";
import { useSecurityESign } from "@/features/security-authorization/shared/useSecurityESign";
import { ROUTES } from "@/app/routes.constants";
import { navigateBack } from "@/app/navigation/backNavigation";
import { useLocalizationPreferences, usePortalDropdown } from "@/hooks";
import { PortalDropdownMenu, DropdownMenuItem } from "@/components/ui/dropdown";
import { formatDateTime, formatDateUS } from "@/utils/format";
import { IconCheck, IconCircleMinus, IconPencilMinus } from "@tabler/icons-react";

const DECISIONS: {
  value: AccessReviewItem["decision"];
  label: string;
  color: string;
}[] = [
  { value: "CONFIRMED", label: "Confirm", color: "emerald" },
  { value: "MODIFY_REQUESTED", label: "Modify", color: "amber" },
  { value: "REVOKE_REQUESTED", label: "Revoke", color: "red" },
];

const labelClass = "text-xs sm:text-sm font-medium text-slate-700 mb-1.5 block";
const textareaClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 resize-none";

const statusBadge = (status: AccessReviewCampaignSummary["status"]) =>
  status === "COMPLETED"
    ? "emerald"
    : status === "CANCELLED"
      ? "slate"
      : "blue";

const userStatusBadge = (status?: string | null) => {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return "emerald";
    case "SUSPENDED":
      return "amber";
    case "INACTIVE":
    case "TERMINATED":
      return "red";
    default:
      return "slate";
  }
};

const DecisionModal: React.FC<{
  item: AccessReviewItem | null;
  decision: AccessReviewItem["decision"] | null;
  saving: boolean;
  note: string;
  onNoteChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ item, decision, saving, note, onNoteChange, onClose, onConfirm }) => {
  if (!item || !decision) return null;
  const label =
    decision === "REVOKE_REQUESTED"
      ? "Revoke"
      : decision === "MODIFY_REQUESTED"
        ? "Modify"
        : "Confirm";
  return (
    <FormModal
      isOpen={Boolean(item && decision)}
      onClose={onClose}
      onConfirm={onConfirm}
      title={`${label} Access for ${item.fullName ?? item.username}`}
      description={
        decision === "CONFIRMED"
          ? "Confirm that this user's current access is appropriate."
          : decision === "MODIFY_REQUESTED"
            ? "Flag this user's access for modification."
            : "Flag this user's access for revocation."
      }
      confirmText={label}
      cancelText="Cancel"
      showCancel
      isLoading={saving}
      confirmVariant={decision === "REVOKE_REQUESTED" ? "destructive" : "default"}
      size="lg"
    >
      <div>
        <label className={labelClass}>
          Note{" "}
          {decision !== "CONFIRMED" && (
            <span className="font-normal text-slate-400 text-xs">
              (optional)
            </span>
          )}
        </label>
        <textarea
          className={textareaClass}
          rows={2}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Reviewer note…"
        />
      </div>
    </FormModal>
  );
};

export const AccessReviewCampaignDetailView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  useLocalizationPreferences();
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const { hasPermissionAlias } = usePermissions();
  const canManage = hasPermissionAlias("security.access_review.manage");
  const { requestSignature, signatureModal } = useSecurityESign();
  const { openId, position, getRef, toggle, close } = usePortalDropdown();

  const [detail, setDetail] = useState<AccessReviewCampaignDetail | null>(null);
  const [items, setItems] = useState<AccessReviewItem[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [itemTotalPages, setItemTotalPages] = useState(1);
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [decisionTarget, setDecisionTarget] = useState<{
    item: AccessReviewItem;
    decision: AccessReviewItem["decision"];
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [campaign, page] = await Promise.all([
        settingsApi.getAccessReviewSummary(id),
        settingsApi.listAccessReviewItemsPaged(id, {
          page: itemPage,
          limit: itemPageSize,
          sortBy: "username",
          sortDir: "asc",
        }),
      ]);
      setDetail({ campaign, items: [] });
      setItems(page.data ?? []);
      setItemTotal(page.pagination?.total ?? 0);
      setItemTotalPages(page.pagination?.totalPages ?? 1);
    } catch {
      showToast({ type: "error", message: "Failed to load campaign" });
    } finally {
      setLoading(false);
    }
  }, [id, itemPage, itemPageSize, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleBack = () =>
    navigateBack(navigate, location.state, ROUTES.SECURITY.ACCESS_REVIEW);

  const openDecision = (
    item: AccessReviewItem,
    decision: AccessReviewItem["decision"],
  ) => {
    setDecisionNote("");
    setDecisionTarget({ item, decision });
  };

  const confirmDecision = async () => {
    if (!decisionTarget || !detail) return;
    const { item, decision } = decisionTarget;
    setDecisionSaving(true);
    try {
      await settingsApi.decideAccessReviewItem(
        detail.campaign.id,
        item.id,
        { decision, note: decisionNote.trim() || undefined },
      );
      setDecisionTarget(null);
      await load();
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to record decision",
      });
    } finally {
      setDecisionSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!detail) return;
    const sig = await requestSignature(
      `Complete Access Review "${detail.campaign.name}"`,
      "Security Configuration Change",
    );
    if (!sig) return;
    setCompleting(true);
    try {
      const updated = await settingsApi.completeAccessReview(
        detail.campaign.id,
        sig,
      );
      showToast({
        type: "success",
        message: "Access review completed and signed",
      });
      setDetail(updated);
      await load();
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to complete review",
      });
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    if (!detail) return;
    try {
      setDetail(await settingsApi.cancelAccessReview(detail.campaign.id));
      await load();
      showToast({ type: "success", message: "Campaign cancelled" });
      setCancelConfirmOpen(false);
    } catch (e: any) {
      showToast({
        type: "error",
        message: e?.response?.data?.message ?? "Failed to cancel",
      });
    }
  };

  if (loading) {
    return <FullPageLoading text="Loading access review campaign..." />;
  }

  if (!detail) {
    return (
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Access Review"
          breadcrumbItems={accessReviewBreadcrumb(navigate)}
          actions={
            <Button variant="outline-emerald" size="sm" onClick={handleBack}>
              Back
            </Button>
          }
        />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 flex flex-col items-center text-center gap-3">
          <p className="text-sm font-medium text-slate-700">
            Campaign not found
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={handleBack}
          >
            Back to Access Review
          </Button>
        </div>
      </div>
    );
  }

  const { campaign } = detail;
  const inProgress = campaign.status === "IN_PROGRESS";

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Access Review Campain Detail"
        breadcrumbItems={accessReviewBreadcrumb(navigate, "Access Review Campain Detail")}
        actions={
          <>
            <Button
              variant="outline-emerald"
              size="sm"
              onClick={handleBack}
              className="whitespace-nowrap"
            >
              Back
            </Button>
            {canManage && inProgress && (
              <>
                <Button
                  variant="outline-emerald"
                  size="sm"
                  onClick={() => setCancelConfirmOpen(true)}
                  className="whitespace-nowrap"
                >
                  Cancel Campaign
                </Button>
                <Button
                  size="sm"
                  onClick={() => void handleComplete()}
                  disabled={completing || campaign.pendingItems > 0}
                  title={
                    campaign.pendingItems > 0
                      ? `${campaign.pendingItems} item(s) still pending`
                      : undefined
                  }
                  className="whitespace-nowrap"
                >
                  {completing ? "Completing…" : "Complete & Sign"}
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            {campaign.name}
          </h2>
                    <Badge color={statusBadge(campaign.status)} size="xs">
            {campaign.statusLabel}
          </Badge>
        </div>
        {campaign.description && (
          <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-6 text-xs text-slate-500">
          <span>
            Total users: <b className="text-slate-700">{campaign.totalItems}</b>
          </span>
          <span>
            Pending:{" "}
            <b
              className={
                campaign.pendingItems > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
              }
            >
              {campaign.pendingItems}
            </b>
          </span>
          <span>
            Review Period Start:{" "}
            <b className="text-slate-700">
              {campaign.reviewPeriodStart
                ? formatDateUS(campaign.reviewPeriodStart)
                : "—"}
            </b>
          </span>
          <span>
            Review Period End:{" "}
            <b className="text-slate-700">
              {campaign.reviewPeriodEnd
                ? formatDateUS(campaign.reviewPeriodEnd)
                : "—"}
            </b>
          </span>
          {campaign.reviewerName && (
            <span>
              Reviewer:{" "}
              <b className="text-slate-700">{campaign.reviewerName}</b>
            </span>
          )}
          {campaign.signedAt && (
            <span>
              Signed:{" "}
              <b className="text-slate-700">
                {formatDateTime(campaign.signedAt)}
              </b>
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b px-5 py-3 bg-slate-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            Reviewed Users
          </h3>
          <span className="text-xs text-slate-400">{itemTotal} users</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px]">
            <thead className="sticky top-0 z-30">
              <tr>
                <th className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap w-12">
                  No.
                </th>
                {[
                  "Employee ID",
                  "User",
                  "User Name",
                  "Status",
                  "Access Profiles",
                  "Permissions",
                  "Flags",
                  "Decision",
                ].map((h) => (
                  <th
                    key={h}
                    className="sticky top-0 z-20 bg-slate-50 py-3 px-4 text-left text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
                {inProgress && canManage && (
                  <th className="sticky top-0 right-0 z-30 bg-slate-50 py-3 px-4 text-center text-2xs md:text-xs font-bold text-slate-500 uppercase tracking-wider border-b-2 border-slate-200 whitespace-nowrap before:absolute before:inset-y-0 before:left-0 before:w-px before:bg-slate-200 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.05)]">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-center text-slate-500">
                    {(itemPage - 1) * itemPageSize + idx + 1}
                  </td>
                  <td
                    className={`py-3 px-4 text-xs sm:text-sm whitespace-nowrap font-medium ${
                      item.userId
                        ? "text-emerald-600 cursor-pointer hover:underline"
                        : "text-slate-400"
                    }`}
                    onClick={(event) => {
                      if (!item.userId) return;
                      event.stopPropagation();
                      navigate(ROUTES.SETTINGS.USERS_PROFILE(item.userId), {
                        state: { returnTo: location.pathname },
                      });
                    }}
                  >
                    {item.employeeCode ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <div className="font-medium text-slate-800">
                      {item.fullName ?? item.username}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                    {item.username}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <Badge color={userStatusBadge(item.userStatus)} size="xs">
                      {item.userStatusLabel ?? "—"}
                    </Badge>
                  </td>
                  <td
                    className="py-3 px-4 text-xs sm:text-sm text-slate-600 max-w-[240px] truncate"
                    title={item.accessProfiles ?? undefined}
                  >
                    {item.accessProfiles || (
                      <span className="italic text-slate-400">None</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap text-slate-600">
                    {item.superAdmin
                      ? "All (super admin)"
                      : item.permissionCount}
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <div className="flex gap-1">
                      {item.superAdmin && (
                        <Badge color="purple" size="xs">
                          Super Admin
                        </Badge>
                      )}
                      {!item.superAdmin && item.permissionCount === 0 && (
                        <Badge color="slate" size="xs">
                          No Permissions
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs sm:text-sm whitespace-nowrap">
                    <Badge
                      size="xs"
                      color={
                        item.decision === "CONFIRMED"
                          ? "emerald"
                          : item.decision === "PENDING"
                            ? "slate"
                            : item.decision === "REVOKE_REQUESTED"
                              ? "red"
                              : "amber"
                      }
                    >
                      {item.decisionLabel}
                    </Badge>
                    {item.decisionNote && (
                      <div
                        className="mt-0.5 max-w-[200px] truncate text-slate-400"
                        title={item.decisionNote}
                      >
                        {item.decisionNote}
                      </div>
                    )}
                  </td>
                  {inProgress && canManage && (
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="sticky right-0 bg-white py-3 px-4 text-center z-10 whitespace-nowrap before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[1px] before:bg-slate-200 shadow-[-4px_0_12px_-4px_rgba(0,0,0,0.05)] group-hover:bg-slate-50"
                    >
                      <button
                        ref={getRef(item.id)}
                        onClick={(e) => toggle(item.id, e)}
                        className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-slate-100 transition-colors"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-600" />
                      </button>
                      <PortalDropdownMenu
                        isOpen={openId === item.id}
                        onClose={close}
                        position={position}
                      >
                        <div className="py-1">
                          {DECISIONS.map((d) => (
                            <DropdownMenuItem
                              key={d.value}
                              icon={
                                d.value === "CONFIRMED" ? (
                                  <IconCheck className="h-4 w-4" />
                                ) : d.value === "MODIFY_REQUESTED" ? (
                                  <IconPencilMinus className="h-4 w-4" />
                                ) : (
                                  <IconCircleMinus className="h-4 w-4" />
                                )
                              }
                              disabled={item.decision === d.value}
                              onClick={() => {
                                close();
                                openDecision(item, d.value);
                              }}
                            >
                              {d.label}
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </PortalDropdownMenu>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {itemTotal > 0 && (
          <div className="border-t border-slate-200">
            <TablePagination
              currentPage={itemPage}
              totalPages={itemTotalPages}
              totalItems={itemTotal}
              itemsPerPage={itemPageSize}
              isLoading={loading}
              onPageChange={setItemPage}
              onItemsPerPageChange={(value) => { setItemPageSize(value); setItemPage(1); }}
              itemsPerPageOptions={[10, 20, 50]}
            />
          </div>
        )}
      </div>

      <DecisionModal
        item={decisionTarget?.item ?? null}
        decision={decisionTarget?.decision ?? null}
        saving={decisionSaving}
        note={decisionNote}
        onNoteChange={setDecisionNote}
        onClose={() => setDecisionTarget(null)}
        onConfirm={() => void confirmDecision()}
      />

      <AlertModal
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => void handleCancel()}
        type="warning"
        title="Cancel Access Review Campaign"
        description={`Are you sure you want to cancel "${campaign.name}"? This action cannot be undone.`}
        confirmText="Cancel Campaign"
        cancelText="Back"
        showCancel
      />

      {signatureModal}
    </div>
  );
};
