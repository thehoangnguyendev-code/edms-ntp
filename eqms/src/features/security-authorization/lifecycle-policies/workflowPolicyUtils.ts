const ERROR_MESSAGES: Record<string, string> = {
  WORKFLOW_POLICY_NOT_FOUND: "The requested policy was not found.",
  WORKFLOW_POLICY_DUPLICATE:
    "An active policy already exists for this action, status, document type, and priority.",
  WORKFLOW_POLICY_VALIDATION_ERROR: "Policy validation failed. Please check your inputs.",
  WORKFLOW_POLICY_DEACTIVATION_BLOCKED:
    "This policy cannot be deactivated because it would leave the action without a safe policy.",
  WORKFLOW_POLICY_RESET_NOT_ALLOWED: "This policy cannot be reset to system default.",
  UNKNOWN_PERMISSION_CODE: "The specified permission code is not recognized.",
  INVALID_ACTOR_TYPE_FOR_ACTION: "This actor type is not allowed for the selected workflow action.",
  ACTOR_CODE_REQUIRED: "Actor code is required for this actor type.",
  ACTOR_CODE_NOT_ALLOWED: "Actor code must be empty for this actor type.",
};

export function getWorkflowPolicyErrorMessage(errorCode: string, fallback?: string): string {
  return ERROR_MESSAGES[errorCode] ?? fallback ?? "An unexpected error occurred.";
}

export function extractApiError(error: unknown): { errorCode?: string; message: string } {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (
      error as {
        response?: { data?: { error?: { errorCode?: string; message?: string } } };
      }
    ).response;
    const body = resp?.data?.error;
    if (body) {
      return {
        errorCode: body.errorCode,
        message: body.message
          ? getWorkflowPolicyErrorMessage(body.errorCode ?? "", body.message)
          : "An unexpected error occurred.",
      };
    }
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "An unexpected error occurred." };
}
