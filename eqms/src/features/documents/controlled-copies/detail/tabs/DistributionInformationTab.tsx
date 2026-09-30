import React, { useEffect, useState } from "react";
import { ControlledCopy } from "../../types";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { Badge } from "@/components/ui/badge/Badge";
import { getStatusBadgeColor } from "@/utils/status";
import { formatDateTime } from "@/utils/format";
import { formatControlledCopyNumber } from "../../display";
import { getControlledCopyDistributionListText, getControlledCopyDistributionModeLabel, getControlledCopyMemberRecipientText } from "../../distributionDisplay";
import { normalizeControlledCopyStatusLabel } from "../../status";
import { getCachedControlledCopyChildren, preloadControlledCopyChildren } from "../../components/ExpandControlledCopiesRow";
import { TableMarkup, TABLE_STYLES } from "@/components/ui/table/TablePrimitives";

interface DistributionInformationTabProps {
  controlledCopy: ControlledCopy & { copyIds?: string[] };
  isBatchParent?: boolean;
  onNavigateToLinkedCopy?: (id: string) => void;
}

const getBadgeColor = (statusCode?: string, statusLabel?: string) =>
  getStatusBadgeColor(statusLabel, statusCode) ?? "slate";

const ReadonlyField: React.FC<{
  label: string;
  value?: string | null;
  fullWidth?: boolean;
}> = ({ label, value, fullWidth = false }) => (
  <div className={`flex flex-col gap-1.5 ${fullWidth ? "md:col-span-2" : ""}`}>
    <label className="text-xs sm:text-sm font-medium text-slate-700">{label}</label>
    <input
      type="text"
      value={value || ""}
      readOnly
      className={CONTROL_STATE_CLASSES.readonlyField}
    />
  </div>
);

const SCOPE_LABELS: Record<string, string> = {
  "business-unit": "Business Unit",
  department: "Department",
  individual: "Individual",
};

export const DistributionInformationTab: React.FC<DistributionInformationTabProps> = ({
  controlledCopy,
  isBatchParent = false,
  onNavigateToLinkedCopy,
}) => {
  const mode = getControlledCopyDistributionModeLabel(controlledCopy) || "None";
  const scope = (controlledCopy.distributionScope || "").toLowerCase();
  // Only meaningful for Internal -- External has no further scope to distinguish, and a single
  // (non-batch) record's mode is already unambiguous on its own.
  const distributionMode = mode === "Internal" && SCOPE_LABELS[scope]
    ? `${mode} — ${SCOPE_LABELS[scope]}`
    : mode;

  const batchId = controlledCopy.distributionBatchId || controlledCopy.id;
  const [members, setMembers] = useState<ControlledCopy[] | null>(
    () => (isBatchParent && batchId ? getCachedControlledCopyChildren(batchId) : null),
  );
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  useEffect(() => {
    if (!isBatchParent || !batchId) {
      setMembers(null);
      return;
    }
    const cached = getCachedControlledCopyChildren(batchId);
    if (cached) {
      setMembers(cached);
      return;
    }
    let cancelled = false;
    setIsLoadingMembers(true);
    void preloadControlledCopyChildren(batchId)
      .then((result) => {
        if (!cancelled) setMembers(result);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingMembers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isBatchParent, batchId]);

  // The actual Business Unit(s)/Department(s) selected for this request -- kept as its own field,
  // separate from the person-level list below, so a reviewer can see WHICH unit(s) this was
  // distributed to at a glance (e.g. "Quality Assurance; Quality Control") without having to
  // cross-reference every individual recipient. distributionList already carries every selected
  // unit's name, "; "-joined (see ControlledCopyService#createRequest); it's set for both a batch
  // and a standalone single-recipient request in this scope, so this isn't batch-only.
  const unitScopeLabel = scope === "business-unit" ? "Business Unit(s)" : scope === "department" ? "Department(s)" : null;
  const unitNames = unitScopeLabel ? controlledCopy.distributionList : null;

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <ReadonlyField label="Distribution Mode" value={distributionMode} />
        {unitScopeLabel && <ReadonlyField label={unitScopeLabel} value={unitNames} />}
        {!isBatchParent && (
          <ReadonlyField
            label="Distribution List"
            value={getControlledCopyDistributionListText(controlledCopy)}
            fullWidth
          />
        )}
      </div>

      {isBatchParent && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs sm:text-sm font-medium text-slate-700">
            {unitScopeLabel ? "Recipients" : "Distribution List"}{members && members.length > 0 ? ` (${members.length})` : ""}
          </label>
          {isLoadingMembers || !members ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-6 text-center text-xs sm:text-sm text-slate-400">
              Loading recipients…
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm text-slate-500">
              No recipients found for this batch.
            </div>
          ) : (
            <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
              <TableMarkup.Root className="w-full text-xs sm:text-sm">
                <TableMarkup.Head className="sticky top-0 bg-slate-50">
                  <TableMarkup.Row className="border-b border-slate-200">
                    <TableMarkup.HeaderCell className="py-2 px-3 text-center text-2xs md:text-xs font-semibold text-slate-600 w-10">No.</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className="py-2 px-3 text-left text-2xs md:text-xs font-semibold text-slate-600">Document Number</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className="py-2 px-3 text-left text-2xs md:text-xs font-semibold text-slate-600">Recipient</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.cell17}>Employee Code</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.cell17}>Department</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className="py-2 px-3 text-left text-2xs md:text-xs font-semibold text-slate-600">Email</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className="py-2 px-3 text-left text-2xs md:text-xs font-semibold text-slate-600">Status</TableMarkup.HeaderCell>
                    <TableMarkup.HeaderCell className={TABLE_STYLES.cell17}>Distributed On</TableMarkup.HeaderCell>
                  </TableMarkup.Row>
                </TableMarkup.Head>
                <TableMarkup.Body className="divide-y divide-slate-100 bg-white">
                  {members.map((member, index) => {
                    const statusLabel = normalizeControlledCopyStatusLabel(member.status, member.statusInfo as any);
                    return (
                      <TableMarkup.Row key={member.id} className="hover:bg-slate-50 transition-colors">
                        <TableMarkup.Cell className="py-2 px-3 text-center text-slate-500 font-medium">{index + 1}</TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3">
                          {onNavigateToLinkedCopy ? (
                            <button
                              type="button"
                              onClick={() => onNavigateToLinkedCopy(member.id)}
                              className="font-medium text-emerald-600 hover:underline"
                            >
                              {formatControlledCopyNumber(member.controlledCopyNumber)}
                            </button>
                          ) : (
                            <span className="font-medium text-slate-900">{formatControlledCopyNumber(member.controlledCopyNumber)}</span>
                          )}
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3 text-slate-700">{getControlledCopyMemberRecipientText(member) || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3 text-slate-600 whitespace-nowrap">{member.recipientEmployeeCode || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3 text-slate-600">{member.recipientDepartment || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3 text-slate-600">{member.recipientEmail || "-"}</TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3">
                          <Badge color={getBadgeColor(member.statusCode || member.statusInfo?.id, statusLabel)} size="sm">
                            {statusLabel}
                          </Badge>
                        </TableMarkup.Cell>
                        <TableMarkup.Cell className="py-2 px-3 text-slate-500 whitespace-nowrap">
                          {member.distributedDate ? formatDateTime(member.distributedDate) : "-"}
                        </TableMarkup.Cell>
                      </TableMarkup.Row>
                    );
                  })}
                </TableMarkup.Body>
              </TableMarkup.Root>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
