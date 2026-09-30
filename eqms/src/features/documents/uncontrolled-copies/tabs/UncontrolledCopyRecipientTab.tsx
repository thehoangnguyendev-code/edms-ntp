import React from "react";
import { CalendarClock } from "lucide-react";
import { CONTROL_STATE_CLASSES } from "@/components/ui/controlState";
import { formatDateTime } from "@/utils/format";
import type { UncontrolledCopy } from "@/services/api/uncontrolledCopy";

const ReadOnlyField: React.FC<{
  label: string;
  value?: string | number | null;
}> = ({ label, value }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <label className="text-xs font-medium text-slate-700 sm:text-sm">
      {label}
    </label>
    <input
      readOnly
      value={value ?? "-"}
      className={CONTROL_STATE_CLASSES.readonlyField}
    />
  </div>
);

const RECIPIENT_TYPE_LABELS: Record<string, string> = {
  SELF: "Myself (the requester)",
  INTERNAL: "Another system user",
  EXTERNAL_HANDOVER: "External party (via internal holder)",
  EXTERNAL: "External (legacy, e-mail only)",
};

export const UncontrolledCopyRecipientTab: React.FC<{
  copy: UncontrolledCopy;
}> = ({ copy }) => (
  <div className="space-y-4 md:space-y-5">
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      <ReadOnlyField
        label="Recipient Type"
        value={
          copy.recipientType
            ? (RECIPIENT_TYPE_LABELS[copy.recipientType] ?? copy.recipientType)
            : "-"
        }
      />
      <ReadOnlyField
        label={copy.externalRecipient ? "Held by (hands over)" : "Recipient"}
        value={copy.recipientName}
      />
      <ReadOnlyField
        label={copy.externalRecipient ? "Holder e-mail" : "Recipient e-mail"}
        value={copy.recipientEmail}
      />
      {copy.externalRecipient && (
        <ReadOnlyField
          label="External recipient (no system access)"
          value={copy.externalRecipient}
        />
      )}
      <ReadOnlyField
        label="Valid until"
        value={
          copy.validUntil
            ? formatDateTime(copy.validUntil)
            : "Set when distributed"
        }
      />
      <ReadOnlyField label="Downloads" value={copy.downloadCount ?? 0} />
      <ReadOnlyField
        label="Last downloaded"
        value={
          copy.lastDownloadedAt ? formatDateTime(copy.lastDownloadedAt) : "-"
        }
      />
    </div>
    {copy.expired && (
      <p className="mt-4 flex items-center gap-1.5 text-xs text-rose-700">
        <CalendarClock className="h-4 w-4" /> The validity window has ended; the
        file can no longer be viewed or downloaded.
      </p>
    )}
  </div>
);
