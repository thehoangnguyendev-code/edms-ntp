import { useEffect, useState } from "react";
import { metadataApi } from "@/services/api/metadata";
import type { Approver, Reviewer } from "@/features/documents/document-list/document-creation/new-tabs/subtabs/types";

export interface MaterialWorkflowUser {
  id: string;
  employeeCode: string;
  fullName: string;
  username: string;
  position: string;
  department: string;
  email: string;
}

const MATERIAL_WORKFLOW_USER_CACHE: MaterialWorkflowUser[] = [];
export const MATERIAL_WORKFLOW_USERS = MATERIAL_WORKFLOW_USER_CACHE;

export const loadMaterialWorkflowUsers = async (): Promise<MaterialWorkflowUser[]> => {
  // Uses the ungated metadata lookup, not the settings.user.view-gated admin user list —
  // any user assembling a training material's reviewer/approver roster needs to pick
  // colleagues without requiring User Management access.
  const response = await metadataApi.getUsersLookup();
  const users: MaterialWorkflowUser[] = (response ?? []).map((user) => ({
    id: user.id,
    employeeCode: user.employeeCode || "",
    fullName: user.fullName || user.username || "",
    username: user.username || "",
    position: user.position || "",
    department: user.department || "",
    email: user.email || "",
  }));

  MATERIAL_WORKFLOW_USER_CACHE.splice(0, MATERIAL_WORKFLOW_USER_CACHE.length, ...users);
  return MATERIAL_WORKFLOW_USER_CACHE;
};

void loadMaterialWorkflowUsers();

export const useMaterialWorkflowUsers = () => {
  const [users, setUsers] = useState<MaterialWorkflowUser[]>(MATERIAL_WORKFLOW_USER_CACHE);

  useEffect(() => {
    let alive = true;
    void loadMaterialWorkflowUsers()
      .then((next) => {
        if (alive) {
          setUsers([...next]);
        }
      })
      .catch(() => {
        if (alive) {
          setUsers([...MATERIAL_WORKFLOW_USER_CACHE]);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  return users;
};

export const findWorkflowUserByUsername = (
  username: string,
  fallbackDepartment: string,
  users: MaterialWorkflowUser[] = MATERIAL_WORKFLOW_USER_CACHE,
): MaterialWorkflowUser => {
  return (
    users.find((user) => user.username === username) ??
    {
      id: `synthetic-${username}`,
      employeeCode: "N/A",
      fullName: username,
      username,
      position: "",
      department: fallbackDepartment || "Unassigned",
      email: "",
    }
  );
};

export const toReviewer = (user: MaterialWorkflowUser, order: number): Reviewer => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  position: user.position,
  email: user.email,
  department: user.department,
  order,
});

export const toApprover = (user: MaterialWorkflowUser): Approver => ({
  id: user.id,
  fullName: user.fullName,
  username: user.username,
  position: user.position,
  email: user.email,
  department: user.department,
});

export const buildInitialReviewers = (
  reviewerValue: string,
  department: string,
  users: MaterialWorkflowUser[] = MATERIAL_WORKFLOW_USER_CACHE,
): Reviewer[] => {
  const usernames = reviewerValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return usernames.map((username, index) =>
    toReviewer(findWorkflowUserByUsername(username, department, users), index + 1),
  );
};

export const buildInitialApprovers = (
  approverValue: string,
  department: string,
  users: MaterialWorkflowUser[] = MATERIAL_WORKFLOW_USER_CACHE,
): Approver[] => {
  if (!approverValue.trim()) return [];
  return [toApprover(findWorkflowUserByUsername(approverValue, department, users))];
};
