export const extractApiMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const candidate = error as {
    response?: {
      statusText?: string;
      data?: unknown;
    };
    message?: string;
  };

  const data = candidate.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (typeof data === "object" && data !== null) {
    const payload = data as {
      error?: string | { message?: string };
      message?: string;
      detail?: string;
      title?: string;
    };

    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error;
    }

    if (payload.error && typeof payload.error === "object" && payload.error.message?.trim()) {
      return payload.error.message;
    }

    if (payload.message?.trim()) {
      return payload.message;
    }

    if (payload.detail?.trim()) {
      return payload.detail;
    }

    if (payload.title?.trim()) {
      return payload.title;
    }
  }

  return candidate.response?.statusText || candidate.message || fallback;
};
