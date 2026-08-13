import { t } from "@/i18n";
import { getApiErrorMessage } from "@/utils/apiError";

export function extractApiError(error: unknown): { errorCode?: string; message: string } {
  if (error && typeof error === "object" && "response" in error) {
    const resp = (
      error as {
        response?: { data?: { error?: { code?: string; errorCode?: string; message?: string } } };
      }
    ).response;
    const body = resp?.data?.error;
    if (body) {
      return {
        errorCode: body.code ?? body.errorCode,
        message: getApiErrorMessage(error, t("errors.fallback")),
      };
    }
  }
  return { message: getApiErrorMessage(error, t("errors.fallback")) };
}
