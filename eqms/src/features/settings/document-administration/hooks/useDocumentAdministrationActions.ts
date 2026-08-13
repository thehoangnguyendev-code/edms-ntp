import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useTranslation } from "@/i18n";

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
  const { t } = useTranslation();
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
        title: t("documentAdministration.resetTitle"),
        message: t("documentAdministration.resetMessage"),
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to reset document administration", error);
      }
      showToast({
        type: "error",
        title: t("documentAdministration.resetFailedTitle"),
        message: t("documentAdministration.resetFailedMessage"),
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
        title: t("documentAdministration.savedTitle"),
        message: t("documentAdministration.savedMessage"),
      });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to save document administration", error);
      }
      showToast({
        type: "error",
        title: t("documentAdministration.saveFailedTitle"),
        message: t("documentAdministration.saveFailedMessage"),
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
