import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Bell } from "lucide-react";
import { getNotificationTypeIcon, getNotificationIconStyles } from "../notificationMeta";
import { parseIconKey, resolveIcon, loadIconLibraries, iconKey } from "../notificationIcons";

afterEach(cleanup);

describe("the icon of a notification", () => {
  it("is the icon of its kind when none is chosen, and the chosen icon of Lucide or Tabler when one is", async () => {
    expect(getNotificationTypeIcon("security.access_profile_changed")).toBe(getNotificationTypeIcon("system"));
    const Chosen = getNotificationTypeIcon("security.access_profile_changed", "tabler:IconShieldLock");
    expect(Chosen).not.toBe(getNotificationTypeIcon("system"));
    expect(getNotificationTypeIcon("x", "tabler:IconShieldLock")).toBe(getNotificationTypeIcon("x", "tabler:IconShieldLock"));
    const libraries = await loadIconLibraries();
    const Shield = resolveIcon(libraries, "tabler:IconShieldLock");
    expect(Shield).toBeTruthy();
    render(<Chosen className="probe" />);
    await waitFor(() => expect(document.querySelector("svg.probe")?.getAttribute("class")).toContain("tabler-icon-shield-lock"));
  }, 30000);

  it("falls back to the icon of its kind for a name that does not exist or a key that is not one", async () => {
    const Missing = getNotificationTypeIcon("system", "lucide:NoSuchIconAnywhere");
    await loadIconLibraries();
    render(<Missing className="probe" />);
    await waitFor(() => expect(document.querySelector("svg.probe")).toBeTruthy());
    expect(getNotificationTypeIcon("system", "not a key")).toBe(Bell);
    expect(parseIconKey("lucide:BellRing")).toEqual({ library: "lucide", name: "BellRing" });
    expect(parseIconKey("fontawesome:Bell")).toBeNull();
    expect(iconKey("tabler", "IconBell")).toBe("tabler:IconBell");
  }, 30000);

  it("colours the icon by the priority: Low green, Medium yellow, High and Critical red", () => {
    expect(getNotificationIconStyles("low")).toEqual({ bg: "bg-emerald-50", text: "text-emerald-600" });
    expect(getNotificationIconStyles("MEDIUM")).toEqual({ bg: "bg-amber-50", text: "text-amber-600" });
    expect(getNotificationIconStyles("high")).toEqual({ bg: "bg-red-50", text: "text-red-600" });
    expect(getNotificationIconStyles("critical")).toEqual({ bg: "bg-red-50", text: "text-red-600" });
  });

  it("falls back to Medium when the priority is missing or unknown", () => {
    expect(getNotificationIconStyles(undefined)).toEqual(getNotificationIconStyles("medium"));
    expect(getNotificationIconStyles("nope")).toEqual(getNotificationIconStyles("medium"));
  });
});
