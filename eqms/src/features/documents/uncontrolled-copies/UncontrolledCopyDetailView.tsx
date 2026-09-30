import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import {
  IconFileCheck,
  IconShare3,
  IconThumbDown,
  IconThumbUp,
  IconX,
} from "@tabler/icons-react";
import { ROUTES } from "@/app/routes.constants";
import { PageHeader } from "@/components/ui/page/PageHeader";
import { Button } from "@/components/ui/button";
import { FullPageLoading } from "@/components/ui/loading/Loading";
import { TableEmptyState } from "@/components/ui/table/TableEmptyState";
import { TabNav, type TabItem } from "@/components/ui/tabs/TabNav";
import { WorkflowStepper } from "@/components/ui/workflow-stepper/WorkflowStepper";
import { uncontrolledCopyDetail as uncontrolledCopyDetailBreadcrumbs } from "@/components/ui/breadcrumb/breadcrumbs.config";
import { useNavigateWithLoading } from "@/hooks/useNavigateWithLoading";
import { navigateBack } from "@/app/navigation/backNavigation";
import { useEntityChanged } from "@/features/realtime/useEntityChanged";
import { extractApiMessage } from "@/features/settings/dictionaries/utils";
import {
  uncontrolledCopyApi,
  type UncontrolledCopy,
} from "@/services/api/uncontrolledCopy";
import { useUncontrolledCopyActions } from "./useUncontrolledCopyActions";
import { UncontrolledCopyInformationTab } from "./tabs/UncontrolledCopyInformationTab";
import { UncontrolledCopyRecipientTab } from "./tabs/UncontrolledCopyRecipientTab";
import { UncontrolledCopyDocumentTab } from "./tabs/UncontrolledCopyDocumentTab";
import { UncontrolledCopyTimelineTab } from "./tabs/UncontrolledCopyTimelineTab";
import { AuditTrailTab } from "@/features/documents/shared/components/AuditTrailTab";

type DetailTab =
  "information" | "recipient" | "document" | "timeline" | "audit";

/** Same 3 phases ControlledCopyDetailView's own stepper uses (minus "Obsoleted", which does not
 *  apply here -- an uncontrolled copy is never superseded, only ever distributed or not).
 *  "Closed - Cancelled" is a real trailing step so WorkflowStepper's built-in terminal-status
 *  detection (and its automatic grey/striped treatment of the skipped "Distributed" step) applies
 *  exactly as it does for Controlled Copy. */
const UNCONTROLLED_COPY_STEPS = [
  "Ready for Distribution",
  "Distributed",
  "Closed - Cancelled",
] as const;

/** Maps the server's granular machine status code to one of the 3 display phases. REQUESTED,
 *  APPROVED and GENERATED are all still "Ready for Distribution" -- the approver rejecting the
 *  request (or the requester cancelling it) is what actually ends the flow, which is why REJECTED
 *  and CANCELLED both map to "Closed - Cancelled" here. EXPIRED still displays as "Distributed":
 *  expiry is not a failure, the copy was already successfully distributed. */
const stepLabelForStatus = (
  statusCode: UncontrolledCopy["statusCode"],
): string => {
  switch (statusCode) {
    case "REQUESTED":
    case "APPROVED":
    case "GENERATED":
      return "Ready for Distribution";
    case "DISTRIBUTED":
    case "EXPIRED":
      return "Distributed";
    case "REJECTED":
    case "CANCELLED":
      return "Closed - Cancelled";
    default:
      return "Ready for Distribution";
  }
};

const DETAIL_TABS: TabItem[] = [
  { id: "information", label: "General Information" },
  { id: "recipient", label: "Recipient & Validity" },
  { id: "document", label: "Document" },
  { id: "timeline", label: "Timeline" },
  { id: "audit", label: "Audit Trail" },
];

/** Detail view for one Uncontrolled Copy. Server capabilities remain the authority for every file/action request. */
export const UncontrolledCopyDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { navigateTo, isNavigating } = useNavigateWithLoading();
  const [copy, setCopy] = useState<UncontrolledCopy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<DetailTab>("information");
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const { runAction, openFile, busyId, signatureModal } =
    useUncontrolledCopyActions(reload);
  // Refetch as soon as the server announces this record changed (approved/generated/distributed
  // by someone else, another tab, etc.) instead of staying stale until a manual reload.
  useEntityChanged(["UNCONTROLLED_COPY"], reload, { ids: [id], debounceMs: 600 });
  const handleBack = useCallback(() => {
    // location.state.from (set by UncontrolledCopiesView when it navigates here) always wins --
    // it carries the exact search/filter/page querystring the list had, matching how
    // ControlledCopyDetailView/SodConstraintFormView already do this. Falls back to a browser
    // "back" only when that state is missing (e.g. arrived via a direct link).
    navigateBack(navigateTo, location.state, ROUTES.DOCUMENTS.UNCONTROLLED_COPIES.ALL);
  }, [navigateTo, location.state]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    uncontrolledCopyApi
      .getUncontrolledCopyDetail(id)
      .then((data) => {
        if (!active) return;
        setCopy(data);
        setError("");
      })
      .catch((err) => {
        if (active)
          setError(
            extractApiMessage(err, "Unable to load the uncontrolled copy."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, reloadKey]);

  if (loading && !copy)
    return <FullPageLoading text="Loading uncontrolled copy..." />;
  if (!copy) {
    return (
      <div className="flex flex-col gap-4 md:gap-6">
        <PageHeader
          title="Uncontrolled Copy Details"
          breadcrumbItems={uncontrolledCopyDetailBreadcrumbs(
            navigateTo,
            location.state?.from,
          )}
          actions={
            <div className="flex items-center gap-2">
              <Button
                onClick={handleBack}
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
              >
                Back
              </Button>
            </div>
          }
        />
        <div className="rounded-xl border border-slate-200 bg-white p-4 md:p-5">
          <TableEmptyState
            title="Uncontrolled copy unavailable"
            description={error || "The record was not found."}
          />
        </div>
      </div>
    );
  }

  const caps = copy.capabilities;
  const busy = busyId === copy.id;

  return (
    <div className="w-full space-y-4 md:space-y-6">
      {isNavigating && <FullPageLoading text="Loading..." />}
      <PageHeader
        title="Uncontrolled Copy Details"
        breadcrumbItems={uncontrolledCopyDetailBreadcrumbs(
          navigateTo,
          location.state?.from,
        )}
        actions={
          <div className="flex items-center gap-2">
            <Button
              onClick={handleBack}
              size="sm"
              variant="outline-emerald"
              className="whitespace-nowrap"
            >
              Back
            </Button>
            {caps.canPreview && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                disabled={busy}
                onClick={() => void openFile(copy, "preview")}
              >
                Preview
              </Button>
            )}
            {caps.canDownload && (
              <Button
                size="sm"
                variant="outline-emerald"
                className="whitespace-nowrap"
                disabled={busy}
                onClick={() => void openFile(copy, "download")}
              >
                Download
              </Button>
            )}
          </div>
        }
      />

      <WorkflowStepper
        steps={UNCONTROLLED_COPY_STEPS}
        currentStepIndex={UNCONTROLLED_COPY_STEPS.indexOf(
          stepLabelForStatus(
            copy.statusCode,
          ) as (typeof UNCONTROLLED_COPY_STEPS)[number],
        )}
        terminalProgressStep="Ready for Distribution"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <TabNav
          tabs={DETAIL_TABS}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as DetailTab)}
          ariaLabel="Uncontrolled copy detail sections"
        />
        <div className="p-4 md:p-5">
          {activeTab === "information" && (
            <UncontrolledCopyInformationTab copy={copy} />
          )}
          {activeTab === "recipient" && (
            <UncontrolledCopyRecipientTab copy={copy} />
          )}
          {activeTab === "document" && (
            <UncontrolledCopyDocumentTab copy={copy} />
          )}
          {activeTab === "timeline" && (
            <UncontrolledCopyTimelineTab copy={copy} />
          )}
          {activeTab === "audit" && (
            <AuditTrailTab
              entityId={copy.id}
              entityType="Uncontrolled Copy"
              emptyMessage="No audit records available for this uncontrolled copy."
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <Button
          onClick={handleBack}
          size="sm"
          variant="outline-emerald"
          className="whitespace-nowrap"
        >
          Back
        </Button>
        {caps.canPreview && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            disabled={busy}
            onClick={() => void openFile(copy, "preview")}
          >
            Preview
          </Button>
        )}
        {caps.canDownload && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap"
            disabled={busy}
            onClick={() => void openFile(copy, "download")}
          >
            Download
          </Button>
        )}
        {caps.canApprove && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            disabled={busy}
            onClick={() => void runAction(copy, "approve")}
          >
            <IconThumbUp className="h-4 w-4" /> Complete Approve
          </Button>
        )}
        {caps.canReject && (
          <Button
            size="sm"
            variant="outline"
            className="whitespace-nowrap gap-2"
            disabled={busy}
            onClick={() => void runAction(copy, "reject")}
          >
            <IconThumbDown className="h-4 w-4" /> Reject
          </Button>
        )}
        {caps.canGenerate && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            loading={busy}
            onClick={() => void runAction(copy, "generate")}
          >
            <IconFileCheck className="h-4 w-4" /> Generate Copy
          </Button>
        )}
        {caps.canDistribute && (
          <Button
            size="sm"
            variant="outline-emerald"
            className="whitespace-nowrap gap-2"
            disabled={busy}
            onClick={() => void runAction(copy, "distribute")}
          >
            <IconShare3 className="h-4 w-4" /> Distribute
          </Button>
        )}
        {caps.canCancel && (
          <Button
            size="sm"
            variant="outline"
            className="whitespace-nowrap gap-2"
            disabled={busy}
            onClick={() => void runAction(copy, "cancel")}
          >
            <IconX className="h-4 w-4" /> Cancel Request
          </Button>
        )}
      </div>
      {signatureModal}
    </div>
  );
};
