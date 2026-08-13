/**
 * API Client Configuration
 * Central place for all API calls
 */

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
import { secureStorage, safeRandomUUID } from "@/utils/security";
import { authTokenStore } from "@/services/authTokenStore";
import { ROUTES } from "@/app/routes.constants";
import { dispatchRouteRedirect } from "@/app/navigation/routeRedirect";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
const SESSION_LOCKED_EVENT = "eqms:session-locked";
const MAINTENANCE_MODE_EVENT = "eqms:maintenance-mode";
export const RATE_LIMITED_EVENT = "eqms:rate-limited";

// Q7 — the login page reads this after a forced redirect to show WHY the session ended,
// so a suspended/terminated account isn't confused with an ordinary expired session.
export const ACCOUNT_NOTICE_STORAGE_KEY = "eqms:account_notice";
const ACCOUNT_NOT_ACTIVE_MESSAGES: Record<
  string,
  { title: string; message: string }
> = {
  ACCOUNT_PENDING_ACTIVATION: {
    title: "Account Not Activated",
    message:
      "Your account has not been activated yet. Please contact your administrator.",
  },
  ACCOUNT_SUSPENDED: {
    title: "Account Suspended",
    message:
      "Your account has been suspended. Please contact your administrator.",
  },
  ACCOUNT_INACTIVE: {
    title: "Account Disabled",
    message: "Your account is inactive. Please contact your administrator.",
  },
  ACCOUNT_TERMINATED: {
    title: "Account Terminated",
    message:
      "Your account has been terminated. Please contact your administrator.",
  },
};
const PUBLIC_AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/reauthenticate",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/reset-password/validate-token",
  "/auth/accept-invitation",
  "/auth/mfa/verify",
  "/auth/mfa/send-email-otp",
];

const COOKIE_AUTH_ENDPOINTS = [
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/reauthenticate",
  "/auth/mfa/verify",
];

const isPublicAuthEndpoint = (url?: string) => {
  if (!url) return false;
  return PUBLIC_AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: false,
  headers: {
    "Content-Type": "application/json",
  },
});

const refreshClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type RetriableRequestConfig = AxiosRequestConfig & { _retry?: boolean };

/** GlobalExceptionHandler returns `{ error: { code, message, details } }`; a few legacy endpoints return `{ code }`. */
const getResponseErrorCode = (data: unknown): string | undefined => {
  if (typeof data !== "object" || data === null) return undefined;
  const response = data as { code?: unknown; error?: { code?: unknown } };
  if (typeof response.error?.code === "string") return response.error.code;
  return typeof response.code === "string" ? response.code : undefined;
};

const inFlightGetRequests = new Map<string, Promise<AxiosResponse<unknown>>>();
const inFlightMutationRequests = new Map<
  string,
  Promise<AxiosResponse<unknown>>
>();
// A very short cache absorbs duplicate GETs caused by React effect re-runs,
// route transitions and several widgets asking for the same summary at once.
// It is deliberately short-lived and is cleared by every mutation below, so
// workflow/status changes remain immediately visible.
const GET_CACHE_TTL_MS = 1500;
const getResponseCache = new Map<
  string,
  { expiresAt: number; response: AxiosResponse<unknown> }
>();

let refreshPromise: Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> | null = null;

const runTokenRefresh = () => {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<{
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
      }>("/auth/refresh", {})
      .then((response) => {
        const nextTokens = response.data;
        authTokenStore.set(nextTokens.accessToken);
        return nextTokens;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

const serializeRequestValue = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeRequestValue(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${key}:${serializeRequestValue(item)}`);
    return `{${entries.join(",")}}`;
  }
  return String(value);
};

const buildGetRequestKey = (url: string, config?: AxiosRequestConfig) =>
  [
    "get",
    // Permission-aware GET responses must never be deduplicated across users
    // when one account signs out and another signs in within the same SPA.
    authTokenStore.get() ?? "anonymous",
    url,
    serializeRequestValue(config?.params),
    serializeRequestValue(config?.data),
    serializeRequestValue(config?.responseType),
  ].join("::");

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const requestOnceGet = async <T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<T>> => {
  const requestKey = buildGetRequestKey(url, config);
  const cachedResponse = getResponseCache.get(requestKey);
  if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
    return cachedResponse.response as AxiosResponse<T>;
  }
  if (cachedResponse) getResponseCache.delete(requestKey);
  const inFlight = inFlightGetRequests.get(requestKey);
  if (inFlight) {
    return inFlight as Promise<AxiosResponse<T>>;
  }

  const request = (async () => {
    let attempt = 0;
    while (true) {
      try {
        const response = await apiClient.get<T>(url, config);
        getResponseCache.set(requestKey, {
          expiresAt: Date.now() + GET_CACHE_TTL_MS,
          response: response as AxiosResponse<unknown>,
        });
        return response;
      } catch (error) {
        const status = (error as AxiosError).response?.status;
        // A 429 carries the server's retry window (authentication limits can
        // be 10–15 minutes). Retrying it automatically would amplify load and
        // produce repeated red console entries while the request is guaranteed
        // to fail. Let the UI show the rate-limit notice instead.
        if (
          status === 429 ||
          ![502, 503, 504].includes(status ?? 0) ||
          attempt >= 2
        )
          throw error;
        const retryAfter = Number(
          (error as AxiosError).response?.headers?.["retry-after"],
        );
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 10000)
            : Math.min(500 * 2 ** attempt, 4000);
        attempt += 1;
        await wait(delay);
      }
    }
  })();
  inFlightGetRequests.set(
    requestKey,
    request as Promise<AxiosResponse<unknown>>,
  );

  try {
    return await request;
  } finally {
    inFlightGetRequests.delete(requestKey);
  }
};

const invalidateGetCache = () => getResponseCache.clear();
const buildMutationKey = (
  method: string,
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
) =>
  [
    method,
    authTokenStore.get() ?? "anonymous",
    url,
    serializeRequestValue(data),
    serializeRequestValue(config?.params),
    serializeRequestValue(config?.data),
  ].join("::");

const requiresIdempotencyKey = (url: string) =>
  /\/(documents|revisions|publishing|controlled-copies|electronic-signature|workflow)/i.test(
    url,
  );

const requestOnceMutation = async <T>(
  method: "post" | "put" | "patch" | "delete",
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
) => {
  const key = buildMutationKey(method, url, data, config);
  const existing = inFlightMutationRequests.get(key);
  if (existing) return existing as Promise<AxiosResponse<T>>;
  invalidateGetCache();
  const requestConfig: AxiosRequestConfig | undefined = requiresIdempotencyKey(
    url,
  )
    ? {
        ...config,
        headers: {
          ...(config?.headers ?? {}),
          "Idempotency-Key":
            (config?.headers as Record<string, string> | undefined)?.[
              "Idempotency-Key"
            ] ?? safeRandomUUID(),
        },
      }
    : config;
  const request =
    method === "post"
      ? apiClient.post<T>(url, data, requestConfig)
      : method === "put"
        ? apiClient.put<T>(url, data, requestConfig)
        : method === "patch"
          ? apiClient.patch<T>(url, data, requestConfig)
          : apiClient.delete<T>(url, requestConfig);
  inFlightMutationRequests.set(key, request as Promise<AxiosResponse<unknown>>);
  try {
    return await request;
  } finally {
    inFlightMutationRequests.delete(key);
  }
};

apiClient.interceptors.request.use(
  (config) => {
    const token = authTokenStore.get();
    const requestUrl = config.url || "";
    const needsCookieAuth = COOKIE_AUTH_ENDPOINTS.some((endpoint) =>
      requestUrl.includes(endpoint),
    );

    config.withCredentials = needsCookieAuth;

    // Re-authentication is publicly routable so the response interceptor will not
    // redirect on an expected 401, but the server must still know which locked
    // session and user are being unlocked.
    const requiresLockedSessionIdentity = requestUrl.includes(
      "/auth/reauthenticate",
    );
    if (
      token &&
      (!isPublicAuthEndpoint(requestUrl) || requiresLockedSessionIdentity)
    ) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers["X-Correlation-ID"] = safeRandomUUID();
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    if (error.response) {
      const { status, data } = error.response;

      if (status === 423) {
        const code = getResponseErrorCode(data);
        if (code === "SESSION_LOCKED") {
          window.dispatchEvent(
            new CustomEvent(SESSION_LOCKED_EVENT, { detail: data }),
          );
          return Promise.reject(error);
        }
      }

      if (status === 503) {
        const code = getResponseErrorCode(data);
        if (code === "MAINTENANCE_MODE") {
          window.dispatchEvent(
            new CustomEvent(MAINTENANCE_MODE_EVENT, { detail: data }),
          );
          dispatchRouteRedirect(ROUTES.MAINTENANCE, true);
          return Promise.reject(error);
        }
      }

      switch (status) {
        case 401: {
          const originalRequest = error.config as
            RetriableRequestConfig | undefined;
          const requestUrl = originalRequest?.url || "";
          const responseCode = getResponseErrorCode(data);
          const isAuthEndpoint =
            requestUrl.includes("/auth/login") ||
            requestUrl.includes("/auth/refresh") ||
            requestUrl.includes("/auth/logout") ||
            requestUrl.includes("/auth/reauthenticate") ||
            requestUrl.includes("/auth/me") ||
            requestUrl.includes("/auth/verify-signature") ||
            requestUrl.includes("/auth/mfa/verify") ||
            requestUrl.includes("/auth/mfa/send-email-otp");

          if (responseCode === "PASSWORD_EXPIRED") {
            dispatchRouteRedirect(ROUTES.FORCE_PASSWORD_CHANGE, true);
            return Promise.reject(error);
          }

          if (responseCode && ACCOUNT_NOT_ACTIVE_MESSAGES[responseCode]) {
            try {
              sessionStorage.setItem(
                ACCOUNT_NOTICE_STORAGE_KEY,
                JSON.stringify(ACCOUNT_NOT_ACTIVE_MESSAGES[responseCode]),
              );
            } catch {
              // sessionStorage unavailable — the redirect still happens, only the friendly
              // "why" banner on the login page is skipped.
            }
          }

          if (requestUrl.includes("/auth/reauthenticate")) {
            return Promise.reject(error);
          }

          if (isAuthEndpoint) {
            return Promise.reject(error);
          }

          if (originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
              await runTokenRefresh();
              return apiClient.request(originalRequest);
            } catch {
              // Continue to login redirect below.
            }
          }

          authTokenStore.clear();
          secureStorage.removeItem("authToken");
          secureStorage.removeItem("refreshToken");
          secureStorage.removeItem("user");
          dispatchRouteRedirect(ROUTES.LOGIN, true);
          break;
        }
        case 429: {
          const retryAfterHeader = error.response.headers?.["retry-after"];
          const retryAfterSeconds = retryAfterHeader
            ? Number(retryAfterHeader)
            : undefined;
          window.dispatchEvent(
            new CustomEvent(RATE_LIMITED_EVENT, {
              detail: { retryAfterSeconds },
            }),
          );
          break;
        }
        default:
          break;
      }
    }

    return Promise.reject(error);
  },
);

export const api = {
  get: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => requestOnceGet<T>(url, config),

  post: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return requestOnceMutation<T>("post", url, data, config);
  },

  put: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return requestOnceMutation<T>("put", url, data, config);
  },

  patch: <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return requestOnceMutation<T>("patch", url, data, config);
  },

  delete: <T = unknown>(
    url: string,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> => {
    return requestOnceMutation<T>("delete", url, undefined, config);
  },
};

export const uploadFile = async (
  url: string,
  file: File | null | undefined,
  onUploadProgress?: (progressEvent: unknown) => void,
  fields?: Record<string, string | Blob | undefined>,
): Promise<AxiosResponse> => {
  const payload: Record<string, string | Blob | File> = {};

  if (file) {
    payload.file = file;
  }

  if (fields) {
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        payload[key] = value;
      }
    });
  }

  invalidateGetCache();
  return apiClient.postForm(url, payload, {
    timeout: 120000,
    onUploadProgress,
  });
};

export default apiClient;
