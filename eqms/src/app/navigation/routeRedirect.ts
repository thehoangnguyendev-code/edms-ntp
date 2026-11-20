export const ROUTE_REDIRECT_EVENT = "eqms:route-redirect";

export interface RouteRedirectDetail {
  path: string;
  replace?: boolean;
}

/**
 * The server ended the session (revoked, expired, refresh refused). The sign-in state kept in React must
 * be dropped too; otherwise the login page sees "signed in" and sends the person straight back, and
 * the two ping-pong, each round firing new API calls until the rate limit trips.
 */
export const SESSION_ENDED_EVENT = "eqms:session-ended";

export const dispatchSessionEnded = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
};

/** The server refused a request because this session ended: the same account signed in on another device. A modal tells the person, then signs this browser out. */
export const SESSION_REPLACED_EVENT = "eqms:session-replaced";

export const dispatchSessionReplaced = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SESSION_REPLACED_EVENT));
};

export const dispatchRouteRedirect =(path: string, replace = true) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RouteRedirectDetail>(ROUTE_REDIRECT_EVENT, {
      detail: { path, replace },
    }),
  );
};
