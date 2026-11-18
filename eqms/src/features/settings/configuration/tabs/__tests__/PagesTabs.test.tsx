import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/services/api", () => ({ settingsApi: {} }));
vi.mock("../DeliveryFailuresTable", () => ({ DeliveryFailuresTable: () => <p>Failures table</p> }));
vi.mock("../IntegrationTab", () => ({ IntegrationTab: () => <p>Storage form</p> }));
vi.mock("../StorageUsagePanel", () => ({ StorageUsagePanel: () => <p>Usage panel</p> }));
vi.mock("../OnlyOfficeTab", () => ({ OnlyOfficeTab: ({ onOnlyOfficeValidationChange }: { onOnlyOfficeValidationChange: (v: boolean) => void }) => { onOnlyOfficeValidationChange(true); return <p>OnlyOffice form</p>; } }));

import { NotificationTab } from "../NotificationTab";
import { IntegrationsTabs } from "../IntegrationsTabs";
import { pageTabFromParam, NOTIFICATION_TAB_IDS, INTEGRATION_TAB_IDS } from "../pageTabs";
import type { NotificationConfig, IntegrationConfig, GeneralConfig, OnlyOfficeStorageConfig } from "../../types";

afterEach(() => cleanup());
const open = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const marked = () => screen.getAllByRole("tab").filter((t) => t.querySelector("[role=img]")).map((t) => `${t.textContent}:${t.querySelector("[role=img]")?.getAttribute("aria-label")}`);

const notifications = {
  enableInAppNotifications: true, inAppRetentionDays: 180, enableEmailNotifications: true, publicAppUrl: "http://x",
  emailConfig: { smtpHost: "h", smtpPort: 587, smtpUsername: "u", smtpPassword: "p", senderEmail: "a@b.c", senderName: "n", useSSL: true },
} as unknown as NotificationConfig;

describe("Notifications tabs", () => {
  it("splits channels and delivery from the e-mail settings", () => {
    render(<NotificationTab config={notifications} onChange={vi.fn()} />);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Channels & Delivery", "Email (SMTP)", "History"]);
    expect(screen.getByLabelText("Enable In-App Notifications")).toBeTruthy();
    expect(screen.getByText("Failures table")).toBeTruthy();
    expect(screen.queryByText("SMTP Host")).toBeNull();

    open("Email (SMTP)");
    expect(screen.getByText("SMTP Host")).toBeTruthy();
    expect(screen.getByText("Public App URL")).toBeTruthy();
    expect(screen.queryByText("Failures table")).toBeNull();
  });

  it("marks only the tab whose setting was changed", () => {
    const draft = { ...notifications, emailConfig: { ...notifications.emailConfig, smtpHost: "other" } } as NotificationConfig;
    render(<NotificationTab config={draft} savedConfig={notifications} onChange={vi.fn()} />);

    expect(marked()).toEqual(["Email (SMTP):Not saved yet"]);
  });
});

describe("Integrations tabs", () => {
  const integrations = { storage: { provider: "minio" } } as unknown as IntegrationConfig;
  const onlyOffice = { enabled: true } as unknown as OnlyOfficeStorageConfig;
  const base = { integrations, onIntegrationsChange: vi.fn(), onlyOffice, onOnlyOfficeChange: vi.fn(), onOnlyOfficeValidationChange: vi.fn(), onlyOfficeValid: true, canManage: true, activeTab: "storage" as const, onTabChange: vi.fn() };
  const saved = { integrations, general: { backupSettings: { onlyOffice } } as unknown as GeneralConfig };

  it("shows one section at a time, and keeps the OnlyOffice form mounted (hidden) so the page still hears whether it is valid", async () => {
    const { rerender } = render(<IntegrationsTabs {...base} />);

    expect(await screen.findByText("Storage form")).toBeTruthy();
    expect(screen.queryByText("Usage panel")).toBeNull();
    expect((await screen.findByText("OnlyOffice form")).closest("[hidden]")).toBeTruthy();

    rerender(<IntegrationsTabs {...base} activeTab="onlyoffice" />);
    expect(screen.getByText("OnlyOffice form").closest("[hidden]")).toBeNull();
    expect(screen.queryByText("Storage form")).toBeNull();
  });

  it("leaves Storage Usage out for someone who cannot manage the configuration", () => {
    render(<IntegrationsTabs {...base} canManage={false} activeTab="storage-usage" />);

    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Storage", "OnlyOffice", "History"]);
    expect(screen.getByRole("tab", { name: "Storage" }).getAttribute("aria-selected")).toBe("true");
  });

  it("marks a changed tab, and shows a red dot on OnlyOffice while its settings cannot be saved", () => {
    render(<IntegrationsTabs {...base} saved={saved} integrations={{ storage: { provider: "nas" } } as unknown as IntegrationConfig} onlyOfficeValid={false} />);

    expect(marked()).toEqual(["Storage:Not saved yet", "OnlyOffice:Needs correction"]);
    expect(screen.getByRole("tab", { name: /OnlyOffice/ }).querySelector("[role=img]")?.className).toContain("bg-red-500");
  });
});

describe("tab ids in the address", () => {
  it("falls back to the first tab of the page", () => {
    expect(pageTabFromParam(NOTIFICATION_TAB_IDS, "email")).toBe("email");
    expect(pageTabFromParam(NOTIFICATION_TAB_IDS, "nope")).toBe("channels-delivery");
    expect(pageTabFromParam(INTEGRATION_TAB_IDS, null)).toBe("storage");
  });
});
