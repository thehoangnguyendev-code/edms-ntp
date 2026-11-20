import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (event: { type: string; data: string }) => void;
const realtime = vi.hoisted(() => ({ listener: null as null | ((event: { type: string; data: string }) => void) }));
vi.mock("@/features/notifications/notificationRealtime", () => ({
  subscribeNotificationRealtime: (listener: Listener) => {
    realtime.listener = listener;
    return () => { realtime.listener = null; };
  },
}));

import { SessionReplacedModal, SESSION_REPLACED_MESSAGE, currentSessionId } from "../SessionReplacedModal";
import { dispatchSessionReplaced, SESSION_ENDED_EVENT } from "@/app/navigation/routeRedirect";
import { authTokenStore } from "@/services/authTokenStore";

const tokenFor = (sid: string) => {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${encode({ alg: "none" })}.${encode({ sid })}.signature`;
};

const mount = () => render(
  <MemoryRouter initialEntries={["/dashboard"]}>
    <Routes>
      <Route path="/dashboard" element={<SessionReplacedModal isAuthenticated />} />
      <Route path="/login" element={<p>Login page</p>} />
    </Routes>
  </MemoryRouter>,
);

describe("SessionReplacedModal", () => {
  beforeEach(() => authTokenStore.set(tokenFor("session-a")));
  afterEach(() => { cleanup(); authTokenStore.clear(); realtime.listener = null; });

  it("shows nothing until the server says the session ended", () => {
    mount();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the notice in English when a request was refused with the session-ended code", async () => {
    mount();
    await act(async () => { dispatchSessionReplaced(); });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Signed Out")).toBeTruthy();
    expect(screen.getByText(SESSION_REPLACED_MESSAGE)).toBeTruthy();
    expect(SESSION_REPLACED_MESSAGE).toBe("This session has ended because the account was signed in on another device.");
  });

  it("shows it at once when the server pushes this browser's own session id", async () => {
    mount();
    await act(async () => { realtime.listener?.({ type: "session-revoked", data: JSON.stringify({ sessionIds: ["other", "session-a"] }) }); });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("ignores the push when it is about another session of the account", async () => {
    mount();
    await act(async () => { realtime.listener?.({ type: "session-revoked", data: JSON.stringify({ sessionIds: ["session-b"] }) }); });
    await act(async () => { realtime.listener?.({ type: "entity-changed", data: "{}" }); });
    await act(async () => { realtime.listener?.({ type: "session-revoked", data: "not json" }); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("OK clears the credentials and goes to the sign-in page", async () => {
    const ended = vi.fn();
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    mount();
    await act(async () => { dispatchSessionReplaced(); });

    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(authTokenStore.get()).toBeNull();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Login page")).toBeTruthy();
    window.removeEventListener(SESSION_ENDED_EVENT, ended);
  });

  it("has no Cancel, and closing it any other way (Escape, the X) also signs this browser out", async () => {
    mount();
    await act(async () => { dispatchSessionReplaced(); });
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(authTokenStore.get()).toBeNull();
    expect(screen.getByText("Login page")).toBeTruthy();
  });

  it("reads the session id from the access token and gives null for a token it cannot read", () => {
    expect(currentSessionId()).toBe("session-a");
    authTokenStore.set("not-a-token");
    expect(currentSessionId()).toBeNull();
  });
});
