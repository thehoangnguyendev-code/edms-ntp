type ApiErrorLike = {
  response?: {
    data?: unknown;
    statusText?: string;
  };
  message?: string;
};

type ApiErrorResponseShape = {
  message?: string;
  code?: string;
  error?: {
    message?: string;
    code?: string;
    details?: Array<{ field?: string; message?: string }>;
  };
  details?: Array<{ field?: string; message?: string }>;
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const candidate = error as ApiErrorLike;
  const responseData = candidate.response?.data as ApiErrorResponseShape | undefined;

  const apiMessage =
    responseData?.error?.message ||
    responseData?.message ||
    responseData?.details?.[0]?.message ||
    responseData?.error?.details?.[0]?.message;

  if (apiMessage && apiMessage.trim()) {
    return apiMessage.trim();
  }

  if (candidate.response?.statusText && candidate.response.statusText.trim()) {
    return candidate.response.statusText.trim();
  }

  if (candidate.message && candidate.message.trim()) {
    return candidate.message.trim();
  }

  return fallback;
};
