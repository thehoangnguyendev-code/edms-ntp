import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/ui/toast";
import { settingsApi } from "@/services/api/settings";
import type { DocumentAdministrationRule, DocumentAdministrationSettings } from "@/services/api/settings";

const RULE_DEFAULTS: Record<string, boolean> = {
  "reviewer-no-approve": false,
  "require-two-reviewers": false,
  "require-one-approver": true,
  "author-cannot-be-reviewer-or-approver": false,
  "co-author-cannot-be-reviewer-or-approver": false,
  "same-user-cannot-hold-multiple-workflow-roles": false,
  "workflow-coordinator-cannot-be-reviewer-or-approver": false,
  "reviewer-and-approver-different-departments": false,
};

const toRules = (settings: DocumentAdministrationSettings): Record<string, boolean> => {
  if (settings.sodRules?.length) {
    return settings.sodRules.reduce<Record<string, boolean>>(
      (result, rule) => ({ ...result, [rule.code]: rule.enabled }),
      { ...RULE_DEFAULTS },
    );
  }
  return {
    ...RULE_DEFAULTS,
    "reviewer-no-approve": settings.reviewerNoApprove,
    "require-two-reviewers": settings.requireTwoReviewers,
    "require-one-approver": settings.requireOneApprover,
    "author-cannot-be-reviewer-or-approver": settings.authorCannotBeReviewerOrApprover,
    "co-author-cannot-be-reviewer-or-approver": settings.coAuthorCannotBeReviewerOrApprover,
    "same-user-cannot-hold-multiple-workflow-roles": settings.sameUserCannotHoldMultipleWorkflowRoles,
    "workflow-coordinator-cannot-be-reviewer-or-approver": settings.workflowCoordinatorCannotBeReviewerOrApprover,
    "reviewer-and-approver-different-departments": settings.reviewerAndApproverDifferentDepartments,
  };
};

/**
 * Revision integrity rules are governance controls, not organisation-wide role pools.
 * Access profiles grant capability; revision participant assignment grants scope.
 */
export const useDocumentAdministration = () => {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [rules, setRules] = useState<Record<string, boolean>>(RULE_DEFAULTS);
  const [definitions, setDefinitions] = useState<DocumentAdministrationRule[]>([]);
  const [snapshot, setSnapshot] = useState<DocumentAdministrationSettings | null>(null);

  const applySnapshot = useCallback((settings: DocumentAdministrationSettings) => {
    setDefinitions(settings.sodRules ?? []);
    setRules(toRules(settings));
    setSnapshot(settings);
    setIsDirty(false);
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      applySnapshot(await settingsApi.getDocumentAdministration());
    } catch {
      showToast({ type: "error", message: "Unable to load document revision integrity rules." });
    } finally {
      setIsLoading(false);
    }
  }, [applySnapshot, showToast]);

  useEffect(() => { void reload(); }, [reload]);

  const resetAdministration = useCallback(() => {
    if (snapshot) {
      applySnapshot(snapshot);
    } else {
      setRules(RULE_DEFAULTS);
      setIsDirty(false);
    }
  }, [applySnapshot, snapshot]);

  const saveAdministration = useCallback(async (reason: string, signatureToken: string) => {
    if (!snapshot) throw new Error("Revision integrity rules have not loaded yet.");
    const response = await settingsApi.updateDocumentAdministration({
      reviewerNoApprove: !!rules["reviewer-no-approve"],
      requireTwoReviewers: !!rules["require-two-reviewers"],
      requireOneApprover: !!rules["require-one-approver"],
      authorCannotBeReviewerOrApprover: !!rules["author-cannot-be-reviewer-or-approver"],
      coAuthorCannotBeReviewerOrApprover: !!rules["co-author-cannot-be-reviewer-or-approver"],
      sameUserCannotHoldMultipleWorkflowRoles: !!rules["same-user-cannot-hold-multiple-workflow-roles"],
      workflowCoordinatorCannotBeReviewerOrApprover: !!rules["workflow-coordinator-cannot-be-reviewer-or-approver"],
      reviewerAndApproverDifferentDepartments: !!rules["reviewer-and-approver-different-departments"],
      version: snapshot.version,
      reason,
      signatureToken,
    });
    applySnapshot(response);
    return response;
  }, [applySnapshot, rules, snapshot]);

  return {
    isLoading,
    isDirty,
    setIsDirty,
    sodRules: rules,
    setSodRules: ((next: SetStateAction<Record<string, boolean>>) => {
      setRules(next);
      setIsDirty(true);
    }) as Dispatch<SetStateAction<Record<string, boolean>>>,
    sodRuleDefinitions: definitions,
    resetAdministration,
    saveAdministration,
    reload,
  };
};
