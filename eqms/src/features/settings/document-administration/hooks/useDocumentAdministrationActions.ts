import { useState } from "react";
import { useToast } from "@/components/ui/toast";

type ActiveWorkflowConfig = {
  assignedIds: string[];
};

type UseDocumentAdministrationActionsParams = {
  isDirty: boolean;
  setIsEditing: (value: boolean) => void;
  activeWorkflowRoleTab: string;
  activeWorkflowConfig: ActiveWorkflowConfig;
  activeWorkflowTitle: string;
  resetAdministration: () => Promise<unknown>;
  saveAdministration: (reason: string) => Promise<unknown>;
  handleAssignSelected: () => void;
  handleRemoveSelected: () => void;
};

export const useDocumentAdministrationActions = ({
  isDirty,
  setIsEditing,
  activeWorkflowRoleTab,
  activeWorkflowConfig,
  activeWorkflowTitle,
  resetAdministration,
  saveAdministration,
  handleAssignSelected,
  handleRemoveSelected,
}: UseDocumentAdministrationActionsParams) => {
  const { showToast } = useToast();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showESignModal, setShowESignModal] = useState(false);

  const handleCancelEdit = () => {
    if (isDirty) {
      setShowResetModal(true);
    } else {
      setIsEditing(false);
    }
  };

  const handleReset = async () => {
    try {
      await resetAdministration();
      setShowResetModal(false);
      setIsEditing(false);
      showToast({
        type: "info",
        title: "Changes discarded",
        message: "Document administration configuration has been reset.",
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to reset document administration", error);
      }
      showToast({
        type: "error",
        title: "Reset failed",
        message: "Unable to reset document administration from server.",
      });
    }
  };

  const handleSave = async (data: { username: string; password: string; reason: string }) => {
    try {
      await saveAdministration(data.reason);
      setShowESignModal(false);
      setIsEditing(false);
      showToast({
        type: "success",
        title: "Configuration Saved & Signed",
        message: "Document administration settings have been saved.",
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to save document administration", error);
      }
      showToast({
        type: "error",
        title: "Save failed",
        message: "Unable to save document administration to server.",
      });
    }
  };

  return {
    showResetModal,
    setShowResetModal,
    showESignModal,
    setShowESignModal,
    handleCancelEdit,
    handleReset,
    handleSave,
    handleAssignSelected,
    handleRemoveSelected,
  };
};
