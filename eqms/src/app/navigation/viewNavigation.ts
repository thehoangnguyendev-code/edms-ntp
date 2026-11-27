import { getActiveUserId } from "@/services/activeUser";

type Entry = { href: string; pathname: string; backTo?: string };
type Journal = { current?: Entry; entries: Record<string, Entry>; paths: Record<string, string> };
const memory = new Map<string, Journal>();
const LIMIT = 100;

const internal = (value: unknown): value is string => typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
const userScope = () => {
  try { return getActiveUserId() ?? "anonymous"; } catch { return "anonymous"; }
};
const read = (scope: string): Journal => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`eqms.navigation.${scope}`) ?? "null");
    if (saved && saved.entries && saved.paths) return saved;
    return { entries: {}, paths: {} };
  } catch { /* Navigation must still work when browser storage is unavailable. */ }
  return memory.get(scope) ?? { entries: {}, paths: {} };
};

/** Remember addresses and return addresses only, never record data, tokens or form drafts. */
export function recordViewLocation(
  location: { pathname: string; search?: string; hash?: string; state?: unknown },
  action: "POP" | "PUSH" | "REPLACE",
  scope = userScope(),
) {
  const journal = read(scope);
  const href = `${location.pathname}${location.search ?? ""}${location.hash ?? ""}`;
  const state = location.state as { from?: unknown; returnTo?: unknown; workspaceReturnPath?: unknown; workspaceState?: { from?: unknown; returnTo?: unknown; workspaceReturnPath?: unknown } } | null;
  const explicit = state?.workspaceState?.workspaceReturnPath || state?.workspaceState?.returnTo || state?.workspaceState?.from || state?.workspaceReturnPath || state?.returnTo || state?.from;
  const previous = journal.current;
  let backTo = internal(explicit) ? explicit : undefined;
  if (!backTo) {
    if (previous?.pathname === location.pathname) backTo = previous.backTo;
    else if (action === "REPLACE" && previous) backTo = previous.backTo;
    else if (action === "PUSH" && previous) backTo = previous.href;
    else backTo = journal.entries[href]?.backTo;
  }
  const entry: Entry = { href, pathname: location.pathname, backTo: backTo === href ? undefined : backTo };
  delete journal.entries[href];
  journal.entries[href] = entry;
  journal.current = entry;
  journal.paths[location.pathname] = href;
  const stale = Object.keys(journal.entries).slice(0, -LIMIT);
  for (const key of stale) delete journal.entries[key];
  for (const [pathname, key] of Object.entries(journal.paths)) if (!journal.entries[key]) delete journal.paths[pathname];
  memory.set(scope, journal);
  try { sessionStorage.setItem(`eqms.navigation.${scope}`, JSON.stringify(journal)); } catch { /* Memory fallback above. */ }
}

/** A return from C to B also carries B's return to A, so nested details cannot bounce back to C. */
export function rememberedBackNavigation(target?: string) {
  const journal = read(userScope());
  const chosen = target ?? journal.current?.backTo;
  if (!chosen) return undefined;
  const href = internal(chosen) && !chosen.includes("?") && !chosen.includes("#") ? journal.paths[chosen] ?? chosen : chosen;
  const backTo = journal.entries[href]?.backTo;
  return { href, state: internal(backTo) && backTo !== href ? { from: backTo } : undefined };
}
