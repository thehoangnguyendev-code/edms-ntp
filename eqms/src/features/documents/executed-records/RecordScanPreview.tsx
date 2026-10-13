import React from "react";
import { ScanPreviewModal } from "@/features/documents/shared/components/ScanPreviewModal";
import { useRetainedValue } from "@/features/documents/shared/useRetainedValue";
import { executedRecordApi, type ExecutedRecord } from "@/services/api/executedRecords";

/**
 * The preview modal for one record's scan, shared by the Records page and a document's Records tab. The server checks that the
 * user may see this record (blanket copy viewers, or the copy's named recipient) every time the scan is fetched.
 *
 * The modal stays mounted when the record is cleared, so that it can play its closing animation (it keeps showing the record it
 * was showing until it has faded out).
 */
export const RecordScanPreview: React.FC<{ record: ExecutedRecord | null; onClose: () => void }> = ({ record, onClose }) => {
  const shown = useRetainedValue(record);
  if (!shown) return null;
  // const subtitle = [shown.sourceControlledCopyNumber, shown.formDocumentNumber, shown.fileName].filter(Boolean).join(" · ");
  return (
    <ScanPreviewModal
      isOpen={Boolean(record)}
      onClose={onClose}
      title={shown.recordNumber}
      // subtitle={subtitle}
      fileKey={shown.id}
      loadFile={() => executedRecordApi.fetchExecutedRecordPreview(shown.id)}
    />
  );
};
