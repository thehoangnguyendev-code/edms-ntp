import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { NotificationEventView } from "../NotificationEventView";

const api = vi.hoisted(() => ({ getDetail: vi.fn(), variables: vi.fn(), updateTemplate: vi.fn(), updateAppearance: vi.fn(), updatePolicy: vi.fn(), testSend: vi.fn(), preview: vi.fn() }));
const everything = vi.hoisted(() => ({ placeholders: vi.fn(), recipientRules: vi.fn(), recipientPreview: vi.fn(), recipientValues: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
const perms = vi.hoisted(() => ({ manage: true }));

vi.mock("@/services/api/notificationPolicy", async () => {
  const actual = await vi.importActual<typeof import("@/services/api/notificationPolicy")>("@/services/api/notificationPolicy");
  return { ...actual, notificationPolicyApi: api };
});
vi.mock("@/components/ui/color-picker/ColorPickerInput", () => ({
  ColorPickerInput: ({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) => (
    <label>
      {label}
      <input aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  ),
}));
vi.mock("@/services/api/notificationAdministration", () => ({ notificationAdministrationApi: everything }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => perms.manage }) }));
const branding = vi.hoisted(() => ({ navigationLabelOverrides: {} }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => branding }));

const version = (channel: string, over: Record<string, unknown> = {}) => ({
  id: `v-${channel}`, channel, versionNumber: 3, status: "ACTIVE", title: null, summary: null, subject: null, body: null, actionUrlTemplate: null, actionLabel: null,
  variablesUsed: null, changeSummary: null, createdByName: "admin", createdAt: "2026-11-12T01:00:00Z", ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  eventCode: "controlled_copy.recalled", name: "Controlled Copy Recalled", description: "A controlled copy was recalled.", module: "CONTROLLED_COPIES", priority: "CRITICAL",
  complianceGroup: "GMP_MANDATORY", relatedAction: null, dataObject: null, supportedChannels: "IN_APP,EMAIL", availableVariables: "documentNumber,controlledCopyNumber,recallReason",
  policyStatus: "ACTIVE", enabledChannels: "IN_APP,EMAIL", recipientRules: [{ type: "COPY_HOLDER" }], digestMode: "IMMEDIATE",
  quietHoursStart: null, quietHoursEnd: null, escalationEnabled: true, escalationAfterMinutes: 1440, escalationRecipientRules: [{ type: "ROLE", value: "Production Head" }], updatedByName: "admin", updatedAt: "2026-11-12T01:00:00Z",
  activeTemplates: [
    version("IN_APP", { title: "Controlled copy {{controlledCopyNumber}} was recalled", summary: "Return it. Reason: {{recallReason}}", actionUrlTemplate: "/controlled-copies/1" }),
    version("EMAIL", { subject: "Return {{controlledCopyNumber}}", body: "<p>Please return {{documentNumber}}</p>", actionLabel: "Open the recall" }),
  ],
  ...over,
});

const VARIABLES = [
  { name: "documentNumber", token: "{{documentNumber}}", label: "Document number", sample: "SOP.0001" },
  { name: "controlledCopyNumber", token: "{{controlledCopyNumber}}", label: "Controlled copy number", sample: "CC-0001" },
  { name: "recallReason", token: "{{recallReason}}", label: "Recall reason", sample: "Obsoleted" },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.showToast.mockReset();
  perms.manage = true;
  api.getDetail.mockResolvedValue(detail());
  api.variables.mockResolvedValue(VARIABLES);
  api.updateTemplate.mockResolvedValue(version("IN_APP"));
  api.updateAppearance.mockResolvedValue(detail());
  api.updatePolicy.mockResolvedValue(detail());
  everything.recipientRules.mockReset();
  everything.recipientPreview.mockReset();
  everything.recipientPreview.mockResolvedValue({ rules: [], inAppPeople: 0, emailPeople: 0 });
  everything.recipientValues.mockReset();
  everything.recipientValues.mockResolvedValue([{ value: "QA Manager", label: "QA Manager", description: "" }, { value: "QC Analyst", label: "QC Analyst", description: "" }]);
  everything.recipientRules.mockResolvedValue([
    { type: "COPY_HOLDER", kind: "CONTEXT", label: "Holder of the copy", description: "d", needsValue: false, valueLabel: null },
    { type: "ROLE", kind: "AUDIENCE", label: "People of a role", description: "d", needsValue: true, valueLabel: "Role name" },
  ]);
  everything.placeholders.mockReset();
  everything.placeholders.mockResolvedValue([
    ...VARIABLES,
    { name: "roleName", token: "{{roleName}}", label: "Role name", sample: "QA Manager", module: "Security and Access" },
    { name: "suspendReason", token: "{{suspendReason}}", label: "Suspension reason", sample: "Long leave", module: "Security and Access" },
    { name: "trainingPlannedDate", token: "{{trainingPlannedDate}}", label: "Planned date of the training", sample: "20/11/2026", module: "Training Management" },
    { name: "weirdOne", token: "{{weirdOne}}", label: "Weird one", sample: "(example)", module: null },
  ]);
  api.preview.mockResolvedValue({ renderedTitle: "", renderedSummary: "", renderedSubject: "Return CC-0001", renderedBody: "", renderedActionUrl: null, renderedHtml: "<html><body>mail</body></html>" });
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});
afterEach(cleanup);

const open = async (channel: "IN_APP" | "EMAIL" = "IN_APP") => {
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={[`/settings/notifications/events/controlled_copy.recalled${channel === "EMAIL" ? "/email" : ""}`]}>
        <Routes>
          <Route path="/settings/notifications/events/:eventCode" element={<NotificationEventView channel="IN_APP" />} />
          <Route path="/settings/notifications/events/:eventCode/email" element={<NotificationEventView channel="EMAIL" />} />
          <Route path="/settings/notifications" element={<div>the list</div>} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );
  await screen.findByRole("textbox", { name: channel === "EMAIL" ? "Email subject" : "In-app title" });
};

describe("Edit a notification", () => {
  it("shows the wording, every placeholder with its example, and no way to create, copy or delete a notification", async () => {
    await open();
    expect((screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement).value).toContain("{{controlledCopyNumber}}");
    // the in-app screen has the in-app wording only: the email is edited on its own screen
    expect(screen.queryByRole("textbox", { name: "Email subject" })).toBeNull();
    expect(screen.queryByText("Email Wording")).toBeNull();
    expect(screen.getByRole("heading", { name: "Edit In-App Notification" })).toBeTruthy();
    expect(screen.getByText("Placeholders")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy {{recallReason}}" })).toBeTruthy();
    expect(screen.getByText("CC-0001")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /new|create|duplicate|delete/i })).toBeNull();
  });

  it("shows the wording of the email on its own screen, with no in-app wording and no icon", async () => {
    await open("EMAIL");
    expect((screen.getByRole("textbox", { name: "Email subject" }) as HTMLInputElement).value).toBe("Return {{controlledCopyNumber}}");
    expect(screen.queryByRole("textbox", { name: "In-app title" })).toBeNull();
    expect(screen.queryByText("Notification Icon")).toBeNull();
    expect(screen.queryByText("In-App Wording")).toBeNull();
    expect(screen.getByRole("heading", { name: "Edit Email Notification" })).toBeTruthy();
    // the Content tab has the wording, the preview and the placeholders; the delivery is on its own tab, and the timing and the quiet hours are there
    expect(screen.getByRole("tab", { name: "Content" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByLabelText("Email timing")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Delivery" }));
    expect(screen.queryByRole("textbox", { name: "Email subject" })).toBeNull();
    expect(await screen.findByLabelText("Email timing")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Advanced/ })).toBeNull();
    expect(screen.queryByRole("switch", { name: "Escalate when it is not acted on" })).toBeNull();
  });

  it("switches between the in-app notification and the email of the same event with one button", async () => {
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Email Notification" })[0]);
    expect(await screen.findByRole("textbox", { name: "Email subject" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Edit Email Notification" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "In-app Notification" })[0]);
    expect(await screen.findByRole("textbox", { name: "In-app title" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Edit In-App Notification" })).toBeTruthy();
  });

  it("asks before leaving with unsaved changes, and nothing typed is lost unless the person agrees", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Changed" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Email Notification" })[0]);
    // the question is asked and the screen stays where it is
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement).value).toBe("Changed");
    fireEvent.click(screen.getByRole("button", { name: "Stay on page" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement).value).toBe("Changed");
  });

  it("goes without asking when there is nothing to lose, and Back asks like the other button", async () => {
    await open();
    fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
    expect(await screen.findByText("the list")).toBeTruthy();
    cleanup();
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Changed" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Back" })[0]);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByText("the list")).toBeNull();
  });

  it("sends the time the notification had when it was opened with the first change only", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Changed" } });
    // what was typed on the first tab is kept while the other tab is open
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(screen.getByRole("switch", { name: "Send in-app notification" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateTemplate).toHaveBeenCalled());
    // the delivery change goes first and carries the time; the wording after it is this person's own change
    expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", expect.objectContaining({ expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
    expect(api.updateTemplate.mock.calls[0][2].expectedUpdatedAt).toBeUndefined();
  });

  it("says so and offers to reload when someone else saved the notification first, and keeps what was typed until the person reloads", async () => {
    api.updateTemplate.mockRejectedValue({ response: { status: 409, data: { error: { message: "This was changed by someone else after you opened it. Reload it to see their change, then make yours again." } } } });
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "My change" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    expect(await screen.findByText("Someone else changed this after you opened it.")).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement).value).toBe("My change");
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", title: "Not saved: changed by someone else" }));
    api.getDetail.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(api.getDetail).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("Someone else changed this after you opened it.")).toBeNull());
  });

  it("does not offer a reload for a refusal that is something else", async () => {
    api.updateTemplate.mockRejectedValue({ response: { status: 400, data: { error: { message: "An in-app notification needs a title." } } } });
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "My change" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", title: "Not saved" })));
    expect(screen.queryByText("Someone else changed this after you opened it.")).toBeNull();
  });

  it("offers no switch for a notification that can only be sent in the application", async () => {
    api.getDetail.mockResolvedValue(detail({ supportedChannels: "IN_APP", enabledChannels: "IN_APP", activeTemplates: [version("IN_APP", { title: "t", summary: "s" })] }));
    await open();
    expect(screen.queryAllByRole("button", { name: "Email Notification" })).toHaveLength(0);
  });

  it("says so on the email screen of a notification that has no email", async () => {
    api.getDetail.mockResolvedValue(detail({ supportedChannels: "IN_APP", enabledChannels: "IN_APP", activeTemplates: [version("IN_APP", { title: "t", summary: "s" })] }));
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/settings/notifications/events/controlled_copy.recalled/email"]}>
          <Routes><Route path="/settings/notifications/events/:eventCode/email" element={<NotificationEventView channel="EMAIL" />} /></Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    expect(await screen.findByText("This notification has no email.")).toBeTruthy();
  });

  it("says the recipients in words, one row for each rule, with the label of its kind and the value of an audience", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QA Manager" }, { type: "ALL_USERS" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    expect(await screen.findByText("Holder of the copy")).toBeTruthy();
    expect(screen.getByText("People of a role: QA Manager")).toBeTruthy();
    expect(screen.getByText("ALL_USERS")).toBeTruthy();
  });

  it("shows for each recipient the channels it is reached on, and says who it is today", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QA Manager", channels: ["IN_APP"] }] }));
    everything.recipientPreview.mockResolvedValue({
      rules: [{ type: "COPY_HOLDER", value: "", valueLabel: "", named: true, people: 0, names: [] }, { type: "ROLE", value: "QA Manager", valueLabel: "QA Manager", named: false, people: 3, names: ["An", "Binh", "Chi"] }],
      inAppPeople: 3, emailPeople: 0,
    });
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    expect(((await screen.findByRole("checkbox", { name: "Holder of the copy: Email" })) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "People of a role QA Manager: Email" }) as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("checkbox", { name: "People of a role QA Manager: In-app" }) as HTMLInputElement).checked).toBe(true);
    expect(await screen.findByText("3 people today: An, Binh, Chi")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("Who it reaches today").textContent).toBe("In-app: 3 peopleEmail: 0 people"));
    expect(screen.getByText("The people the module names when it happens are reached too.")).toBeTruthy();
  });

  it("keeps the placeholders on the Content tab only, and the delivery on its own tab", async () => {
    await open();
    expect(screen.getByText("Placeholders")).toBeTruthy();
    expect(screen.queryByText("Delivery", { selector: "h3" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Delivery" }));
    expect(await screen.findByRole("switch", { name: "Send in-app notification" })).toBeTruthy();
    expect(screen.queryByText("Placeholders")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "In-app title" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    expect(await screen.findByRole("textbox", { name: "In-app title" })).toBeTruthy();
    expect(screen.getByText("Placeholders")).toBeTruthy();
  });

  it("opens the Delivery tab by itself when what stops the save is in the delivery", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Holder of the copy" }));
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(screen.getByRole("tab", { name: "Delivery" }).getAttribute("aria-selected")).toBe("true"));
    expect(api.updatePolicy).not.toHaveBeenCalled();
  });

  it("shows three names of a long list and the rest in a window on request, so opening them never changes the height of the screen", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "ROLE", value: "QA Manager" }] }));
    const names = ["An", "Binh", "Chi", "Dung", "Em", "Phuong", "Giang", "Hoa"];
    everything.recipientPreview.mockResolvedValue({
      rules: [{ type: "ROLE", value: "QA Manager", valueLabel: "QA Manager", named: false, people: 8, names }],
      inAppPeople: 8, emailPeople: 8,
    });
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    expect(await screen.findByText(/8 people today: An, Binh, Chi/)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "People" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show all" }));
    const dialog = await screen.findByRole("dialog");
    const chips = within(within(dialog).getByRole("list", { name: "People" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(chips).toEqual(names);
    expect(within(dialog).getByText(/reached without changing this list/)).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" }).at(-1) as HTMLElement);
    await waitFor(() => expect(screen.queryByRole("list", { name: "People" })).toBeNull());
  });

  it("says how many people of a very long list are not named on the screen", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "ALL_USERS" }] }));
    everything.recipientPreview.mockResolvedValue({
      rules: [{ type: "ALL_USERS", value: "", valueLabel: "", named: false, people: 609, names: ["An", "Binh", "Chi", "Dung"] }],
      inAppPeople: 609, emailPeople: 609,
    });
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("button", { name: "Show all" }));
    expect(await screen.findByText("and 605 more not listed here.")).toBeTruthy();
  });

  it("saves the channel of one recipient only, and goes back to every channel when all are ticked again", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QA Manager" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "People of a role QA Manager: Email" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QA Manager", channels: ["IN_APP"] }], expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("goes back to every channel when all the channels of a recipient are ticked again", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "ROLE", value: "QA Manager", channels: ["IN_APP"] }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "People of a role QA Manager: Email" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { recipientRules: [{ type: "ROLE", value: "QA Manager" }], expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("refuses to save a recipient that is reached on no channel", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER", channels: ["EMAIL"] }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Holder of the copy: Email" }));
    expect(screen.getByText(/needs at least one channel/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: expect.stringContaining("at least one channel") })));
    expect(api.updatePolicy).not.toHaveBeenCalled();
  });

  it("adds a role chosen from the list, with no code typed", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    // the list of the recipients is the lower section; the escalation above it has a picker of its own
    fireEvent.click((await screen.findAllByRole("combobox", { name: "Kind of recipient" })).at(-1)!);
    fireEvent.click(await screen.findByText("People of a role"));
    fireEvent.click((await screen.findAllByRole("combobox", { name: "Role name" })).at(-1)!);
    fireEvent.click(await screen.findByText("QC Analyst"));
    fireEvent.click(screen.getAllByRole("button", { name: "Add" }).at(-1)!);
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QC Analyst" }], expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("lets the priority be chosen from Low, Medium and High, and saves only the priority", async () => {
    api.getDetail.mockResolvedValue(detail({ priority: "MEDIUM", defaultPriority: "MEDIUM" }));
    await open();
    fireEvent.click(await screen.findByRole("combobox", { name: "Priority" }));
    for (const name of ["Low", "Medium", "High"]) expect(await screen.findByRole("option", { name })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Critical" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "High" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { priority: "HIGH", expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
    expect(api.updateTemplate).not.toHaveBeenCalled();
  });

  it("says what the default is and goes back to it when it is chosen again", async () => {
    api.getDetail.mockResolvedValue(detail({ priority: "HIGH", defaultPriority: "MEDIUM" }));
    await open();
    expect(await screen.findByText(/The default is Medium; choose it to go back/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("combobox", { name: "Priority" }));
    fireEvent.click(screen.getByRole("option", { name: "Medium" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { priority: "MEDIUM", expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("offers Critical only for a notification the catalog marks critical", async () => {
    api.getDetail.mockResolvedValue(detail({ priority: "CRITICAL", defaultPriority: "CRITICAL" }));
    await open();
    fireEvent.click(await screen.findByRole("combobox", { name: "Priority" }));
    for (const name of ["Low", "Medium", "High", "Critical"]) expect(await screen.findByRole("option", { name })).toBeTruthy();
  });

  it("turns the in-app notification off without touching the email, and saves only what changed", async () => {
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Send in-app notification" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalled());
    expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { enabledChannels: ["EMAIL"], expectedUpdatedAt: "2026-11-12T01:00:00Z" });
    expect(api.updateTemplate).not.toHaveBeenCalled();
  });

  it("switches the whole notification off when the last channel is turned off", async () => {
    api.getDetail.mockResolvedValue(detail({ enabledChannels: "IN_APP" }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Send in-app notification" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { status: "DISABLED", expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("turns the email off from the email screen", async () => {
    await open("EMAIL");
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("switch", { name: "Send email" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { enabledChannels: ["IN_APP"], expectedUpdatedAt: "2026-11-12T01:00:00Z" }));
  });

  it("removes a recipient and adds a role, and sends the new list", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }, { type: "ROLE", value: "QA Manager" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove People of a role QA Manager" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updatePolicy).toHaveBeenCalled());
    expect(api.updatePolicy).toHaveBeenCalledWith("controlled_copy.recalled", { recipientRules: [{ type: "COPY_HOLDER" }], expectedUpdatedAt: "2026-11-12T01:00:00Z" });
  });

  it("refuses to save an active notification with no recipient or no channel", async () => {
    api.getDetail.mockResolvedValue(detail({ recipientRules: [{ type: "COPY_HOLDER" }] }));
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove Holder of the copy" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: expect.stringContaining("at least one recipient") })));
    expect(api.updatePolicy).not.toHaveBeenCalled();
  });

  it("shows the delivery but no controls to a person who may only view", async () => {
    perms.manage = false;
    await open();
    fireEvent.click(await screen.findByRole("tab", { name: "Delivery" }));
    expect(await screen.findByText("Holder of the copy")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Remove (Holder|People)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
  });

  it("has no field for the address the notification opens, and sends the saved address back unchanged", async () => {
    await open();
    expect(screen.queryByText("Opens (address)")).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Opens (address)" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Recalled" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateTemplate).toHaveBeenCalled());
    expect(api.updateTemplate).toHaveBeenCalledWith("controlled_copy.recalled", "IN_APP", expect.objectContaining({ actionUrlTemplate: "/controlled-copies/1" }));
  });

  it("does not let the message box be resized, and wraps a long word in the preview", async () => {
    api.getDetail.mockResolvedValue(detail({ activeTemplates: [
      version("IN_APP", { title: "T", summary: "changed." + "egergergergerger".repeat(12), actionUrlTemplate: "/x" }),
      version("EMAIL", { subject: "S", body: "<p>B</p>" }),
    ] }));
    await open();
    expect(screen.getByRole("textbox", { name: "In-app message" }).className).toContain("resize-none");
    const preview = screen.getByLabelText("Preview");
    const message = Array.from(preview.querySelectorAll("p")).find((p) => p.textContent?.startsWith("changed."));
    expect(message?.className).toContain("overflow-wrap:anywhere");
  });

  it("lists the placeholders at the foot, those the notification offers first and then every other placeholder of the system", async () => {
    await open();
    const palette = screen.getByText("Placeholders").closest("div.bg-white") as HTMLElement;
    const columns = screen.getByLabelText("Preview").closest("div.grid") as HTMLElement;
    expect(columns.contains(palette)).toBe(false);
    expect(palette.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(screen.getByRole("button", { name: "Insert {{recallReason}}" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Copy {{roleName}}" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Insert {{roleName}}" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Copy {{recallReason}}" }).length).toBe(1);
  });

  it("lists the other placeholders after the offered ones, with their module, and searches them all", async () => {
    await open();
    await screen.findByRole("button", { name: "Copy {{roleName}}" });
    const box = screen.getByRole("textbox", { name: "Search placeholders" });
    fireEvent.change(box, { target: { value: "training" } });
    expect(await screen.findByRole("button", { name: "Copy {{trainingPlannedDate}}" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Copy {{roleName}}" })).toBeNull());
    expect(screen.queryByRole("button", { name: "Insert {{recallReason}}" })).toBeNull();
    fireEvent.change(box, { target: { value: "sop.0001" } }); // the example of a placeholder the notification offers
    expect(await screen.findByRole("button", { name: "Insert {{documentNumber}}" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Copy {{trainingPlannedDate}}" })).toBeNull());
    fireEvent.change(box, { target: { value: "security and access" } }); // a module
    expect(await screen.findByRole("button", { name: "Copy {{suspendReason}}" })).toBeTruthy();
    fireEvent.change(box, { target: { value: "no such thing" } });
    expect(await screen.findByText("No results")).toBeTruthy();
    fireEvent.change(box, { target: { value: "" } });
    expect(await screen.findByRole("button", { name: "Copy {{weirdOne}}" })).toBeTruthy();
  }, 10000); // Several sequential debounced searches plus table rendering under parallel test load.

  it("chooses an icon of Lucide or of Tabler, with no colour to choose, and saves it with Publish without touching the wording", async () => {
    await open();
    // nothing chosen yet: the way back to the default is dimmed; the colour of the icon is not chosen here (it follows the priority)
    expect(screen.queryByLabelText("Colour")).toBeNull();
    expect((screen.getByRole("button", { name: "Use default" }) as HTMLButtonElement).disabled).toBe(true);
    const box = screen.getByRole("textbox", { name: "Search icons" });
    fireEvent.change(box, { target: { value: "ShieldAlert" } });
    fireEvent.click(await screen.findByRole("option", { name: "ShieldAlert" }, { timeout: 15000 }));
    fireEvent.click(screen.getByRole("tab", { name: "Tabler" }));
    fireEvent.change(box, { target: { value: "IconBell" } });
    fireEvent.click(await screen.findByRole("option", { name: "IconBell" }));
    // the icon chosen is the one marked in the grid
    expect(screen.getByRole("option", { name: "IconBell" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("button", { name: "Use default" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateAppearance).toHaveBeenCalledWith("controlled_copy.recalled", "tabler:IconBell", "2026-11-12T01:00:00Z"));
    expect(api.updateTemplate).not.toHaveBeenCalled();
  }, 30000);

  it("Test Notification shows the toast with the wording being edited (sample values), without saving anything", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Copy {{documentNumber}} recalled" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Test Notification" })[0]);
    expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Copy SOP.0001 recalled", type: "warning", color: "#DC2626" }));
    const shown = toast.showToast.mock.calls.at(-1)?.[0];
    expect(shown.icon).toBeTruthy();
    expect(shown.message).toBeTruthy();
    expect(shown.duration).toBeUndefined(); // the duration and the position are the administrator's, applied by the toast provider
    expect(api.updateTemplate).not.toHaveBeenCalled();
  });

  it("pages the icons with the shared pagination instead of a Show more button", async () => {
    await open();
    const icons = await screen.findByRole("listbox", { name: "Icons" }, { timeout: 15000 });
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    const firstPage = within(icons).getAllByRole("option");
    expect(firstPage).toHaveLength(48);
    const box = icons.parentElement as HTMLElement;
    expect(within(box).getByLabelText("Rows per page")).toBeTruthy();
    fireEvent.click(within(box).getAllByRole("button", { name: /next/i })[0]);
    const secondPage = within(screen.getByRole("listbox", { name: "Icons" })).getAllByRole("option");
    expect(secondPage[0].getAttribute("aria-label")).not.toBe(firstPage[0].getAttribute("aria-label"));
  }, 30000);

  it("goes back to the icon of its kind with Use default, and Discard Changes forgets a choice", async () => {
    api.getDetail.mockResolvedValue(detail({ icon: "lucide:Clock" }));
    await open();
    expect((screen.getByRole("button", { name: "Use default" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Use default" }));
    expect((screen.getByRole("button", { name: "Use default" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Discard Changes" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Use default" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateAppearance).toHaveBeenCalledWith("controlled_copy.recalled", null, "2026-11-12T01:00:00Z"));
  });

  it("colours the icon of the preview by the priority being chosen: Low green, Medium yellow, High red", async () => {
    api.getDetail.mockResolvedValue(detail({ priority: "MEDIUM", defaultPriority: "MEDIUM" }));
    await open();
    const tile = (bg: string, text: string) => document.querySelector(`.h-8.w-8.rounded-lg.${bg}.${text}`);
    expect(tile("bg-amber-50", "text-amber-600")).toBeTruthy();
    for (const [name, bg, text] of [["Low", "bg-emerald-50", "text-emerald-600"], ["High", "bg-red-50", "text-red-600"]]) {
      fireEvent.click(await screen.findByRole("combobox", { name: "Priority" }));
      fireEvent.click(await screen.findByRole("option", { name }));
      expect(tile(bg, text)).toBeTruthy();
    }
  });

  it("publishes any notification without an electronic signature, and sends nothing of one", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Sign & Publish" })).toBeNull();
    expect(screen.queryByText(/mandatory/i)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Recalled: {{controlledCopyNumber}}" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.updateTemplate).toHaveBeenCalledTimes(1));
    const sent = api.updateTemplate.mock.calls[0][2];
    expect(sent).toEqual(expect.objectContaining({ title: "Recalled: {{controlledCopyNumber}}" }));
    expect(sent).not.toHaveProperty("signatureToken");
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Saved" })));
  });

  it("refuses a placeholder the notification does not offer before anything is sent", async () => {
    api.getDetail.mockResolvedValue(detail());
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "In-app title" }), { target: { value: "Hello {{nonsense}}" } });
    expect(screen.getAllByRole("alert")[0].textContent).toContain("{{nonsense}}");
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", title: "Cannot save" })));
    expect(api.updateTemplate).not.toHaveBeenCalled();
  });

  it("puts a placeholder into the field the person was writing in", async () => {
    api.getDetail.mockResolvedValue(detail());
    await open();
    const title = screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement;
    fireEvent.focus(title);
    title.setSelectionRange(title.value.length, title.value.length);
    fireEvent.click(screen.getByRole("button", { name: "Insert {{documentNumber}}" }));
    await waitFor(() => expect(title.value.endsWith("{{documentNumber}}")).toBe(true));
  });

  it("shows the notification read only to a person who may not manage it", async () => {
    perms.manage = false;
    await open();
    expect((screen.getByRole("textbox", { name: "In-app title" }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /publish/i })).toBeNull();
  });

  it("sends the published email to an address typed in, and only with a valid address", async () => {
    api.testSend.mockResolvedValue(undefined);
    await open("EMAIL");
    fireEvent.click(screen.getAllByRole("button", { name: /^send test$/i })[0]);
    const to = await screen.findByLabelText("Send to");
    const confirm = () => screen.getAllByRole("button", { name: /^send test$/i }).at(-1) as HTMLButtonElement;
    fireEvent.change(to, { target: { value: "not-an-address" } });
    expect(confirm().disabled).toBe(true);
    fireEvent.change(to, { target: { value: "qa@example.test" } });
    fireEvent.click(confirm());
    await waitFor(() => expect(api.testSend).toHaveBeenCalledWith("controlled_copy.recalled", "qa@example.test"));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Test email sent" })));
  });

  it("offers no test mail for a notification that has no email, or to a person who may not manage it", async () => {
    api.getDetail.mockResolvedValue(detail({ supportedChannels: "IN_APP", enabledChannels: "IN_APP", activeTemplates: [version("IN_APP", { title: "t", summary: "s" })] }));
    await open();
    expect(screen.queryAllByRole("button", { name: /^send test$/i })).toHaveLength(0);
    cleanup();
    perms.manage = false;
    api.getDetail.mockResolvedValue(detail());
    await open();
    expect(screen.queryAllByRole("button", { name: /^send test$/i })).toHaveLength(0);
  });

  it("says so when the notification cannot be loaded", async () => {
    api.getDetail.mockRejectedValue(new Error("network"));
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/settings/notifications/events/x"]}>
          <Routes>
            <Route path="/settings/notifications/events/:eventCode" element={<NotificationEventView />} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    expect(await screen.findByText("Unable to open this notification.")).toBeTruthy();
  });
});
