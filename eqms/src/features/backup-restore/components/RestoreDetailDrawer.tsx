import React from "react";
import { Drawer } from "@/components/ui/drawer/Drawer";
import { Button } from "@/components/ui/button/Button";
import { Badge } from "@/components/ui/badge/Badge";
import { FormSection } from "@/components/ui/form/FormSection";
import { WarningBanner } from "@/components/ui/banner/WarningBanner";
import { COMPONENT_LABEL, RESTORE_STATUS_COLOR, statusLabel, type RestoreRequest } from "../types";
import { formatDateTime } from "../format";

interface Props {
  request?: RestoreRequest;
  onClose: () => void;
  onDecision: (request: RestoreRequest, decision: "approve" | "reject") => void;
}

const RESULT_COLOR = { PASS: "emerald", WARNING: "amber", FAIL: "red" } as const;

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
    <dt className="w-44 shrink-0 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</dt>
    <dd className="min-w-0 break-words text-sm text-slate-800">{children}</dd>
  </div>
);

export const RestoreDetailDrawer: React.FC<Props> = ({ request, onClose, onDecision }) => (
  <Drawer
    open={!!request}
    title="Restore Request"
    subtitle={request?.id}
    onClose={onClose}
    footer={
      request?.status === "PENDING_APPROVAL" && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" variant="destructive" onClick={() => onDecision(request, "reject")}>
            Reject
          </Button>
          <Button size="sm" onClick={() => onDecision(request, "approve")}>
            Approve and Sign
          </Button>
        </div>
      )
    }
  >
    {request && (
      <div className="space-y-4 md:space-y-6">
        {request.status === "PENDING_APPROVAL" && (
          <WarningBanner
            variant="warning"
            title="Approval needed from a second person"
            description="The requester cannot approve their own restore. Approving does not start it; it is run in a maintenance window."
          />
        )}
        <FormSection title="Request">
          <dl className="divide-y divide-slate-100">
            <Row label="Status"><Badge color={RESTORE_STATUS_COLOR[request.status]}>{statusLabel(request.status)}</Badge></Row>
            <Row label="Backup Number">{request.backupNumber}</Row>
            <Row label="Type">{request.kind === "DISASTER_RECOVERY" ? <Badge color="rose">Disaster recovery</Badge> : <Badge color="slate">Restore</Badge>}</Row>
            <Row label="Target">
              {request.target === "PRODUCTION" ? (
                <Badge color="red">Production — replaces live data</Badge>
              ) : request.target === "REBUILT_ENVIRONMENT" ? (
                <Badge color="purple">Rebuilt environment</Badge>
              ) : (
                <Badge color="blue">Validation environment</Badge>
              )}
            </Row>
            <Row label="Restore">{request.components.map((key) => COMPONENT_LABEL[key]).join(", ")}</Row>
            <Row label="Reason">{request.reason}</Row>
            {request.changeControlRef && <Row label="Change control">{request.changeControlRef}</Row>}
            <Row label="Requested by">{request.requestedBy} · {formatDateTime(request.requestedAt)}</Row>
            {request.decidedBy && <Row label="Decided by">{request.decidedBy} · {formatDateTime(request.decidedAt)}</Row>}
          </dl>
        </FormSection>
        {request.verification && (
          <FormSection title="Post-restore verification">
            <ul className="divide-y divide-slate-100">
              {request.verification.map((check) => (
                <li key={check.label} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{check.label}</p>
                    <p className="text-xs text-slate-500">{check.detail}</p>
                  </div>
                  <Badge color={RESULT_COLOR[check.result]}>{statusLabel(check.result)}</Badge>
                </li>
              ))}
            </ul>
          </FormSection>
        )}
        <FormSection title="Events">
          <ol className="space-y-3">
            {request.events.map((event) => (
              <li key={`${event.at}-${event.action}`} className="text-sm">
                <p className="font-medium text-slate-800">{event.action}</p>
                <p className="text-xs text-slate-500">
                  {event.actor} · {formatDateTime(event.at)}
                </p>
                {event.note && <p className="mt-0.5 text-xs text-slate-600">{event.note}</p>}
              </li>
            ))}
          </ol>
        </FormSection>
      </div>
    )}
  </Drawer>
);
