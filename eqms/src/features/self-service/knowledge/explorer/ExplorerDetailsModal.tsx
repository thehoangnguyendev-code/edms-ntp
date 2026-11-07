import React from "react";
import { FormModal } from "@/components/ui/modal/FormModal";
import type { KnowledgePortalDocument } from "@/services/api/knowledge";
import { ExplorerInspector, type InspectorTarget } from "./ExplorerInspector";
import type { FolderEntry } from "./explorerModel";

interface ExplorerDetailsModalProps {
  /** What to show: a document or a folder; nothing (or a location) keeps the modal closed. */
  target: InspectorTarget | null;
  canFeature: boolean;
  onClose: () => void;
  onShareDocument?: (item: KnowledgePortalDocument) => void;
  onShareFolder?: (folder: FolderEntry) => void;
  onOpenDocument: (item: KnowledgePortalDocument) => void;
  onOpenFolder: (folder: FolderEntry) => void;
  onToggleHelpful: (item: KnowledgePortalDocument) => void;
  onToggleFeatured: (item: KnowledgePortalDocument) => void;
  onToggleSubscribe: (key: string) => void;
}

/** "View Details" of a folder or a document of the explorer: the information and the actions that used to sit in the panel on the right. */
export const ExplorerDetailsModal: React.FC<ExplorerDetailsModalProps> = ({
  target, canFeature, onClose, onShareDocument, onShareFolder, onOpenDocument, onOpenFolder, onToggleHelpful, onToggleFeatured, onToggleSubscribe,
}) => {
  const shown = target && target.type !== "location" ? target : null;
  // an action that leaves the modal (open, share) closes it first
  const thenClose = <T,>(action: (value: T) => void) => (value: T) => { onClose(); action(value); };
  return (
    <FormModal isOpen={shown !== null} onClose={onClose} title={shown?.type === "folder" ? "Folder Details" : "Document Details"} showFooter={false} size="md">
      {shown && (
        <ExplorerInspector
          target={shown}
          canFeature={canFeature}
          onShareDocument={onShareDocument ? thenClose(onShareDocument) : undefined}
          onShareFolder={onShareFolder ? thenClose(onShareFolder) : undefined}
          onOpenDocument={thenClose(onOpenDocument)}
          onOpenFolder={thenClose(onOpenFolder)}
          onToggleHelpful={onToggleHelpful}
          onToggleFeatured={onToggleFeatured}
          onToggleSubscribe={onToggleSubscribe}
        />
      )}
    </FormModal>
  );
};
