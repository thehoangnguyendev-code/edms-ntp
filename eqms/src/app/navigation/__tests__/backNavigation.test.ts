import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigateBack } from "../backNavigation";
import { recordViewLocation } from "../viewNavigation";
import { setActiveUserId } from "@/services/activeUser";

beforeEach(() => { sessionStorage.clear(); localStorage.clear(); setActiveUserId("user-a"); });

describe("remembered Back navigation", () => {
  it("restores the exact tab, filters, sort and page when a detail only specifies the list path", () => {
    recordViewLocation({ pathname: "/list", search: "?tab=review&search=Tran&page=4&limit=25&status=OPEN&sortBy=name&sortDirection=desc" }, "POP");
    recordViewLocation({ pathname: "/list/record-1" }, "PUSH");
    const navigate = vi.fn();
    navigateBack(navigate, { from: "/list" }, "/fallback");
    expect(navigate).toHaveBeenCalledWith("/list?tab=review&search=Tran&page=4&limit=25&status=OPEN&sortBy=name&sortDirection=desc");
  });

  it("uses the actual originating screen rather than the default list", () => {
    recordViewLocation({ pathname: "/dashboard", search: "?tab=work" }, "POP");
    recordViewLocation({ pathname: "/list/record-1" }, "PUSH");
    const navigate = vi.fn();
    navigateBack(navigate, null, "/list");
    expect(navigate).toHaveBeenCalledWith("/dashboard?tab=work");
  });

  it("preserves a nested return chain and does not bounce between two detail screens", () => {
    recordViewLocation({ pathname: "/list", search: "?page=3" }, "POP");
    recordViewLocation({ pathname: "/detail/b", search: "?tab=records" }, "PUSH");
    recordViewLocation({ pathname: "/detail/c" }, "PUSH");
    const navigate = vi.fn();
    navigateBack(navigate, null, "/fallback");
    expect(navigate).toHaveBeenLastCalledWith("/detail/b?tab=records", { state: { from: "/list?page=3" } });
    recordViewLocation({ pathname: "/detail/b", search: "?tab=records", state: { from: "/list?page=3" } }, "PUSH");
    navigateBack(navigate, { from: "/list?page=3" }, "/fallback");
    expect(navigate).toHaveBeenLastCalledWith("/list?page=3");
  });

  it("keeps the explicit full return query instead of substituting a more recent visit", () => {
    recordViewLocation({ pathname: "/list", search: "?page=8" }, "POP");
    const navigate = vi.fn();
    navigateBack(navigate, { returnTo: "/list?tab=old&page=2" }, "/fallback");
    expect(navigate).toHaveBeenCalledWith("/list?tab=old&page=2");
  });

  it("keeps workspace return priority and retains the original parent through a tab replacement", () => {
    recordViewLocation({ pathname: "/list", search: "?page=2" }, "POP");
    recordViewLocation({ pathname: "/detail/b", search: "?tab=general" }, "PUSH");
    recordViewLocation({ pathname: "/detail/b", search: "?tab=audit" }, "REPLACE");
    const navigate = vi.fn();
    navigateBack(navigate, { from: "/other", workspaceState: { workspaceReturnPath: "/list?page=2" } }, "/fallback");
    expect(navigate).toHaveBeenCalledWith("/list?page=2");
  });

  it("does not disclose another user's remembered addresses", () => {
    recordViewLocation({ pathname: "/list", search: "?search=private&page=4" }, "POP");
    setActiveUserId("user-b");
    const navigate = vi.fn();
    navigateBack(navigate, { from: "/list" }, "/fallback");
    expect(navigate).toHaveBeenCalledWith("/list");
  });

  it("retains the originating list when Save replaces a creation route with its new detail route", () => {
    recordViewLocation({ pathname: "/list", search: "?page=5&search=Tran" }, "POP");
    recordViewLocation({ pathname: "/list/new" }, "PUSH");
    recordViewLocation({ pathname: "/list/new-record" }, "REPLACE");
    const navigate = vi.fn();
    navigateBack(navigate, null, "/list");
    expect(navigate).toHaveBeenCalledWith("/list?page=5&search=Tran");
  });

  it("does not remember form drafts or signature tokens", () => {
    recordViewLocation({ pathname: "/detail/b", state: { from: "/list?page=4", draft: { name: "private" }, signatureToken: "secret" } }, "PUSH");
    const saved = sessionStorage.getItem("eqms.navigation.user-a")!;
    expect(saved).not.toContain("private");
    expect(saved).not.toContain("secret");
    expect(saved).not.toContain("draft");
  });
});
