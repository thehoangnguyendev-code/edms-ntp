export const ROUTE_REDIRECT_EVENT = "eqms:route-redirect";

export interface RouteRedirectDetail {
  path: string;
  replace?: boolean;
}

export const dispatchRouteRedirect = (path: string, replace = true) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RouteRedirectDetail>(ROUTE_REDIRECT_EVENT, {
      detail: { path, replace },
    }),
  );
};
