import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";

export const TRAINING_PERMISSION_CODES = {
  viewModule: "training.module.view",
  manageMaterials: "training.material.manage",
} as const;

export function useTrainingPermissions() {
  const {
    user,
    role,
    hasPermission,
    hasPermissionAlias,
    hasAnyPermission,
    hasAllPermissions,
    isAdministrator,
    isSuperAdmin,
  } = usePermissions();

  const canManageTrainingMaterials = hasPermissionAlias(
    TRAINING_PERMISSION_CODES.manageMaterials,
  );
  const canViewTraining = hasPermissionAlias(TRAINING_PERMISSION_CODES.viewModule);

  return useMemo(
    () => ({
      user,
      role,
      isAdministrator,
      isSuperAdmin,
      hasPermission,
      hasPermissionAlias,
      hasAnyPermission,
      hasAllPermissions,
      canViewTraining,
      canManageTrainingMaterials,
      canCreateTrainingMaterials: canManageTrainingMaterials,
      canEditTrainingMaterials: canManageTrainingMaterials,
      canSubmitTrainingMaterials: canManageTrainingMaterials,
      canReviewTrainingMaterials: canManageTrainingMaterials,
      canApproveTrainingMaterials: canManageTrainingMaterials,
      canObsoleteTrainingMaterials: canManageTrainingMaterials,
      canCreateCourses: canManageTrainingMaterials,
      canEditCourses: canManageTrainingMaterials,
      canSubmitCourses: canManageTrainingMaterials,
      canReviewCourses: canManageTrainingMaterials,
      canApproveCourses: canManageTrainingMaterials,
      canObsoleteCourses: canManageTrainingMaterials,
    }),
    [
      user,
      role,
      isAdministrator,
      isSuperAdmin,
      hasPermission,
      hasPermissionAlias,
      hasAnyPermission,
      hasAllPermissions,
      canViewTraining,
      canManageTrainingMaterials,
    ],
  );
}
