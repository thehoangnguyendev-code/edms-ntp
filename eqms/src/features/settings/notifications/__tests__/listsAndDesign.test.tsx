import { cleanup, within, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { NotificationsView } from "../NotificationsView";
import { EmailDesignView } from "../EmailDesignView";
import { EmailMessageEditView } from "../EmailMessageEditView";

const administration = vi.hoisted(() => ({ list: vi.fn(), placeholders: vi.fn(), messageEvents: vi.fn() }));
const emails = vi.hoisted(() => ({ getEmailTemplates: vi.fn(), getEmailTemplate: vi.fn(), previewDraftEmailTemplate: vi.fn(), updateEmailTemplate: vi.fn(), getEmailTemplateTypes: vi.fn() }));
vi.mock("@/components/ui/color-picker/ColorPickerInput", () => ({ ColorPickerInput: ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => <label>{label}<input value={value} onChange={(event) => onChange(event.target.value)} /></label> }));
const design = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn(), preview: vi.fn() }));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
const perms = vi.hoisted(() => ({ manage: true }));
const branding = vi.hoisted(() => ({ navigationLabelOverrides: {}, compactDesktopFilters: false }));

vi.mock("@/services/api/notificationAdministration", () => ({ notificationAdministrationApi: administration }));
vi.mock("@/services/api/emailTemplates", () => ({ emailTemplateApi: emails }));
vi.mock("@/services/api/emailDesign", () => ({ emailDesignApi: design }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ hasPermissionAlias: () => perms.manage }) }));
vi.mock("@/components/branding/BrandLogo", () => ({ useBranding: () => branding }));
vi.mock("@/components/ui/esign-modal", () => ({
  ESignatureModal: ({ isOpen, onConfirm, meaningCode }: { isOpen: boolean; onConfirm: (d: { reason: string; signatureToken: string }) => void; meaningCode: string }) =>
    isOpen ? <button onClick={() => onConfirm({ reason: "Clearer", signatureToken: "tok" })}>confirm signature {meaningCode}</button> : null,
}));

const page = (rows: unknown[]) => ({ data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 1 } });
const eventRow = (over: Record<string, unknown> = {}) => ({
  id: "controlled_copy.recalled", channel: "IN_APP", name: "Controlled Copy Recalled", code: "controlled_copy.recalled", description: null, module: "CONTROLLED_COPIES",
  priority: "CRITICAL", type: null, sent: null, status: "ACTIVE", updatedAt: "2026-11-12T01:00:00Z", ...over,
});
const emailRow = (over: Record<string, unknown> = {}) => ({
  id: "t-1", channel: "EMAIL", name: "Document Review Notification", code: "document-review", description: "Sent to a reviewer", module: null, priority: null,
  type: "document-review", sent: 180, status: "ACTIVE", updatedAt: "2026-11-11T01:00:00Z", ...over,
});
const template = (over: Record<string, unknown> = {}) => ({
  id: "t-1", name: "Document Review Notification", type: "document-review", subject: "Review {{documentNumber}}", content: "<p>Please review {{documentNumber}}</p>", status: "Active",
  variables: ["documentNumber"], createdBy: "System", createdDate: "2026-07-21T00:00:00Z", usageCount: 180, description: "Sent to a reviewer", ...over,
});
const DESIGN = { logoUrl: null, logoText: "Ngoc Thien Pharma", brandColor: "#059669", buttonColor: "#059669", bodyColor: "#FFFFFF", footerColor: "#F8FAFC", logoAlign: "LEFT", footerAlign: "LEFT", headerTextColor: "#FFFFFF", headerFontFamily: null, bodyTextColor: "#334155", footerTextColor: "#6B7280", fontFamily: "Arial", footerText: "© {year} Ngoc Thien", supportEmail: "qa@example.test", version: 2, updatedBy: "admin", updatedAt: "2026-11-12T01:00:00Z", fonts: ["Arial", "Verdana"], headerTitle: "Ngoc Thien Quality System" };

beforeEach(() => {
  [administration, emails, design, toast].forEach((group) => Object.values(group).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset()));
  perms.manage = true;
  administration.list.mockImplementation(async (params: { channel?: string }) => {
    const rows = [eventRow(), eventRow({ id: "document.approved", name: "Document Approved", code: "document.approved", priority: "MEDIUM" }), emailRow()]
      .filter((row) => !params.channel || row.channel === params.channel);
    return page(rows);
  });
  administration.messageEvents.mockResolvedValue([]);
  emails.getEmailTemplate.mockResolvedValue(template());
  emails.getEmailTemplateTypes.mockResolvedValue(["document-review", "password-reset"]);
  administration.placeholders.mockResolvedValue([
    { name: "documentNumber", token: "{{documentNumber}}", label: "Document number", sample: "SOP.0001" },
    { name: "roleName", token: "{{roleName}}", label: "Role name", sample: "QA Manager" },
  ]);
  emails.previewDraftEmailTemplate.mockResolvedValue({ content: "<html>framed</html>" });
  emails.updateEmailTemplate.mockResolvedValue(template());
  design.get.mockResolvedValue(DESIGN);
  design.preview.mockResolvedValue("<html>sample</html>");
  design.update.mockResolvedValue({ ...DESIGN, version: 3 });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() }));
  Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
});
afterEach(cleanup);

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;
const renderAt = (path: string) =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter initialEntries={[path]}>
        <Where />
        <Routes>
          <Route path="/settings/notifications" element={<NotificationsView />} />
          <Route path="/settings/notifications/events/:eventCode" element={<div>the event editor</div>} />
          <Route path="/settings/notifications/events/:eventCode/email" element={<div>the event email editor</div>} />
          <Route path="/settings/notifications/emails/:id" element={<EmailMessageEditView />} />
          <Route path="/settings/notifications/email-design" element={<EmailDesignView />} />
        </Routes>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );

describe("Notifications Administration: three tabs, a list to open and edit, never to create", () => {
  it("shows both kinds in the first tab, with the Channel filter on All and no Created filter", async () => {
    renderAt("/settings/notifications");
    await screen.findByText("Controlled Copy Recalled");
    expect(screen.getByText("Document Review Notification")).toBeTruthy();
    expect(screen.queryByText("Mandatory")).toBeNull();
    expect(screen.queryByText("Kind")).toBeNull();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All Notifications", "In-app Notification", "Email Notification"]);
    expect(administration.list).toHaveBeenCalledWith(expect.objectContaining({ channel: undefined, sortBy: "name", sortDirection: "asc", page: 1, limit: 10 }));
    expect(screen.getByText("Updated Date Range")).toBeTruthy();
    expect(screen.queryByText("Created")).toBeNull();
    expect(screen.queryByRole("button", { name: "Email Design" })).toBeNull();
    expect(screen.queryByRole("button", { name: "In-App Notification Design" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "More actions" }).length).toBe(3);
    expect(screen.queryByRole("button", { name: /new|create|duplicate|delete/i })).toBeNull();
  });

  it("limits the second tab to in-app notifications and the third to email, and the Channel filter cannot be changed", async () => {
    renderAt("/settings/notifications?tab=in-app");
    await screen.findByText("Controlled Copy Recalled");
    expect(screen.queryByText("Document Review Notification")).toBeNull();
    expect(administration.list).toHaveBeenCalledWith(expect.objectContaining({ channel: "IN_APP" }));
    // the design of the toast is reached from this tab, and the design of the email is not
    expect(screen.getByRole("button", { name: "In-App Notification Design" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Email Design" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Channel" }).hasAttribute("disabled") || screen.getByRole("combobox", { name: "Channel" }).getAttribute("aria-disabled") === "true").toBe(true);
    cleanup();
    renderAt("/settings/notifications?tab=email");
    await screen.findByText("Document Review Notification");
    expect(screen.queryByText("Controlled Copy Recalled")).toBeNull();
    expect(administration.list).toHaveBeenCalledWith(expect.objectContaining({ channel: "EMAIL" }));
    expect(emails.getEmailTemplateTypes).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Email Design" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "In-App Notification Design" })).toBeNull();
  });

  it("opens the editor of an event, and of an email message, from the Edit item of the row menu", async () => {
    renderAt("/settings/notifications");
    await screen.findByText("Controlled Copy Recalled");
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    fireEvent.click(await screen.findByText("Edit In-App Notification"));
    expect(await screen.findByText("the event editor")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/settings/notifications/events/controlled_copy.recalled");
    cleanup();
    renderAt("/settings/notifications?tab=email");
    await screen.findByText("Document Review Notification");
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[0]);
    fireEvent.click(await screen.findByText("Edit Email Message"));
    expect(await screen.findByRole("textbox", { name: "Email subject" })).toBeTruthy();
  });

  it("opens the email of an event on its own screen, not the screen of its in-app notification", async () => {
    administration.list.mockImplementation(async () => page([eventRow(), eventRow({ channel: "EMAIL" })]));
    renderAt("/settings/notifications");
    await screen.findAllByText("Controlled Copy Recalled");
    expect(screen.getAllByText("Controlled Copy Recalled")).toHaveLength(2);   // one row for the in-app notification, one for the email
    fireEvent.click(screen.getAllByRole("button", { name: "More actions" })[1]);
    fireEvent.click(await screen.findByText("Edit Email Notification"));
    expect(await screen.findByText("the event email editor")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/settings/notifications/events/controlled_copy.recalled/email");
  });

  it("says so when the list cannot be read", async () => {
    administration.list.mockRejectedValue(new Error("network"));
    renderAt("/settings/notifications");
    expect((await screen.findAllByText(/network|could not be loaded/)).length).toBeGreaterThan(0);
  });
});

describe("Email message that is also a notification", () => {
  it("says where the notification is really edited, and takes the person there", async () => {
    administration.messageEvents.mockResolvedValue([{ messageType: "document-review", code: "document.review_request", name: "Document Review Requested", module: "DOCUMENT_CONTROL" }]);
    render(
      <BreadcrumbProvider>
        <MemoryRouter initialEntries={["/settings/notifications/emails/t-1"]}>
          <Where />
          <Routes>
            <Route path="/settings/notifications/emails/:id" element={<EmailMessageEditView />} />
            <Route path="/settings/notifications/events/:eventCode/email" element={<div>the event email editor</div>} />
            <Route path="/settings/notifications/events/:eventCode" element={<div>the event editor</div>} />
          </Routes>
        </MemoryRouter>
      </BreadcrumbProvider>,
    );
    expect(await screen.findByText(/The notification itself is edited as "Document Review Requested"/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit Email Notification" }));
    expect(await screen.findByText("the event email editor")).toBeTruthy();
    expect(screen.getByTestId("where").textContent).toBe("/settings/notifications/events/document.review_request/email");
  });

  it("says nothing for a message that is only an e-mail, and does not ask the server for a preview of an empty message", async () => {
    renderAt("/settings/notifications/emails/t-1");
    await screen.findByRole("textbox", { name: "Email subject" });
    expect(screen.queryByText(/The notification itself is edited as/)).toBeNull();
    expect(emails.previewDraftEmailTemplate).not.toHaveBeenCalledWith(expect.objectContaining({ subject: "", content: "" }));
  });

  it("does not let the person leave with unsaved changes", async () => {
    administration.messageEvents.mockResolvedValue([{ messageType: "document-review", code: "document.review_request", name: "Document Review Requested", module: "DOCUMENT_CONTROL" }]);
    renderAt("/settings/notifications/emails/t-1");
    const subject = (await screen.findByRole("textbox", { name: "Email subject" })) as HTMLInputElement;
    fireEvent.change(subject, { target: { value: "Changed {{documentNumber}}" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit Email Notification" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();                                   // it asks first
    expect((screen.getByRole("textbox", { name: "Email subject" }) as HTMLInputElement).value).toBe("Changed {{documentNumber}}");   // and nothing is lost
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Leave Anyway" }));
    expect(await screen.findByText("the event email editor")).toBeTruthy();
  });
});

describe("Email message: wording", () => {
  it("saves the wording with Save, without an electronic signature, keeping the name and the type", async () => {
    renderAt("/settings/notifications/emails/t-1");
    const subject = (await screen.findByRole("textbox", { name: "Email subject" })) as HTMLInputElement;
    fireEvent.change(subject, { target: { value: "Please review {{documentNumber}} today" } });
    expect(screen.queryByRole("button", { name: "Sign & Publish" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(emails.updateEmailTemplate).toHaveBeenCalled());
    const sent = emails.updateEmailTemplate.mock.calls[0][1];
    expect(sent).toEqual(expect.objectContaining({ name: "Document Review Notification", type: "document-review", subject: "Please review {{documentNumber}} today" }));
    expect(sent.signatureToken).toBeUndefined();
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Saved" })));
  });

  it("sends the time the message had when it was opened, and says so when someone else saved it first", async () => {
    emails.getEmailTemplate.mockResolvedValue(template({ updatedDate: "2026-11-11T05:00:00.123456Z" }));
    emails.updateEmailTemplate.mockRejectedValue({ response: { status: 409, data: { error: { message: "This was changed by someone else after you opened it. Reload it to see their change, then make yours again." } } } });
    renderAt("/settings/notifications/emails/t-1");
    const subject = (await screen.findByRole("textbox", { name: "Email subject" })) as HTMLInputElement;
    fireEvent.change(subject, { target: { value: "Please review {{documentNumber}} today" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(emails.updateEmailTemplate).toHaveBeenCalled());
    expect(emails.updateEmailTemplate.mock.calls[0][1].expectedUpdatedDate).toBe("2026-11-11T05:00:00.123456Z");
    expect(await screen.findByText("Someone else changed this after you opened it.")).toBeTruthy();
    expect(subject.value).toBe("Please review {{documentNumber}} today");   // what was typed is still there
    emails.getEmailTemplate.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(emails.getEmailTemplate).toHaveBeenCalled());
  });

  it("lists the placeholders at the foot at full width, with every other placeholder of the system after those of the message", async () => {
    renderAt("/settings/notifications/emails/t-1");
    await screen.findByRole("textbox", { name: "Email subject" });
    const palette = screen.getByText("Placeholders").closest("div.bg-white") as HTMLElement;
    const columns = screen.getByLabelText("Preview").closest("div.grid") as HTMLElement;
    expect(columns.contains(palette)).toBe(false);
    expect(palette.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(await screen.findByRole("button", { name: "Insert {{documentNumber}}" }, { timeout: 5000 })).toBeTruthy();
    const box = screen.getByRole("textbox", { name: "Search placeholders" });
    fireEvent.change(box, { target: { value: "role" } });
    expect(await screen.findByRole("button", { name: "Copy {{roleName}}" }, { timeout: 5000 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Insert {{roleName}}" })).toBeNull();
  });

  it("searches the placeholders of an email message too", async () => {
    renderAt("/settings/notifications/emails/t-1");
    await screen.findByRole("textbox", { name: "Email subject" });
    const box = await screen.findByRole("textbox", { name: "Search placeholders" });
    fireEvent.change(box, { target: { value: "role" } });
    expect(await screen.findByRole("button", { name: "Copy {{roleName}}" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Insert {{documentNumber}}" })).toBeNull();
  });

  it("offers the placeholders the message already uses first", async () => {
    renderAt("/settings/notifications/emails/t-1");
    await screen.findByRole("textbox", { name: "Email subject" });
    const first = screen.getAllByRole("button", { name: /^Insert \{\{/ })[0];
    expect(first.getAttribute("aria-label")).toBe("Insert {{documentNumber}}");
  });
});

describe("Email Design: one look for every email", () => {
  it("shows the design and a preview, and saves a change", async () => {
    renderAt("/settings/notifications/email-design");
    const colour = (await screen.findByLabelText("Header Colour")) as HTMLInputElement;
    expect(colour.value).toBe("#059669");
    await waitFor(() => expect(design.preview).toHaveBeenCalled());
    fireEvent.change(colour, { target: { value: "#0B5FFF" } });
    fireEvent.change(screen.getByLabelText("Button Colour"), { target: { value: "#E11D48" } });
    fireEvent.change(screen.getByLabelText("Body Colour"), { target: { value: "#FEF3C7" } });
    fireEvent.change(screen.getByLabelText("Footer Colour"), { target: { value: "#1E293B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(design.update).toHaveBeenCalledWith(expect.objectContaining({ brandColor: "#0B5FFF", buttonColor: "#E11D48", bodyColor: "#FEF3C7", footerColor: "#1E293B", logoAlign: "LEFT", footerAlign: "LEFT", fontFamily: "Arial" }), 2));
    await waitFor(() => expect(toast.showToast).toHaveBeenCalledWith(expect.objectContaining({ type: "success", title: "Saved" })));
  });

  it("says so and offers to reload when someone else saved the design first", async () => {
    design.update.mockRejectedValue({ response: { status: 409, data: { error: { message: "This was changed by someone else after you opened it. Reload it to see their change, then make yours again." } } } });
    renderAt("/settings/notifications/email-design");
    const colour = (await screen.findByLabelText("Header Colour")) as HTMLInputElement;
    fireEvent.change(colour, { target: { value: "#0B5FFF" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Someone else changed this after you opened it.")).toBeTruthy();
    expect(colour.value).toBe("#0B5FFF");
    design.get.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    await waitFor(() => expect(design.get).toHaveBeenCalled());
  });

  it("makes the preview of the text as it is typed, and sends it with the text colours", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    await waitFor(() => expect(design.preview).toHaveBeenCalled());
    design.preview.mockClear();
    const field = screen.getByPlaceholderText("The text of the header, for example the name of your company");
    fireEvent.change(field, { target: { value: "Ngoc" } });
    await waitFor(() => expect(design.preview).toHaveBeenLastCalledWith(expect.objectContaining({ logoText: "Ngoc" })));
    fireEvent.change(field, { target: { value: "Ngoc Thien QMS" } });
    await waitFor(() => expect(design.preview).toHaveBeenLastCalledWith(expect.objectContaining({ logoText: "Ngoc Thien QMS" })));
    fireEvent.change(screen.getByLabelText("Header Text Colour"), { target: { value: "#FDE68A" } });
    fireEvent.change(screen.getByLabelText("Body Text Colour"), { target: { value: "#111827" } });
    fireEvent.change(screen.getByLabelText("Footer Text Colour"), { target: { value: "#A7F3D0" } });
    expect(screen.getByRole("button", { name: "Upload logo" })).toBeTruthy();
    expect(screen.queryByText(/web address/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(design.update).toHaveBeenCalledWith(expect.objectContaining({ logoText: "Ngoc Thien QMS", headerTextColor: "#FDE68A", bodyTextColor: "#111827", footerTextColor: "#A7F3D0" }), 2));
  });

  it("does not let the design be saved with neither a text nor a logo", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    fireEvent.change(screen.getByLabelText("Footer line"), { target: { value: "A new footer" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByPlaceholderText("The text of the header, for example the name of your company"), { target: { value: "" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.queryByText(/Type a text for the header/)).toBeNull();
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("offers the colour and the font of the header words only when there are words, and never fills the text in", async () => {
    design.get.mockResolvedValue({ ...DESIGN, logoText: null });
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    const field = screen.getByPlaceholderText("The text of the header, for example the name of your company") as HTMLInputElement;
    expect(field.value).toBe("");
    expect(screen.queryByLabelText("Header Text Colour")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Header font" })).toBeNull();
    fireEvent.change(field, { target: { value: "Ngoc" } });
    expect(await screen.findByLabelText("Header Text Colour")).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Header font" })).toBeTruthy();
    fireEvent.change(field, { target: { value: "   " } });
    await waitFor(() => expect(screen.queryByLabelText("Header Text Colour")).toBeNull());
  });

  it("keeps the text field closed while a logo picture is uploaded", async () => {
    design.get.mockResolvedValue({ ...DESIGN, logoUrl: "data:image/png;base64,AAAA", logoText: null });
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    const field = screen.getByPlaceholderText("A logo is uploaded (remove it to type a text)") as HTMLInputElement;
    expect(field.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(((await screen.findByPlaceholderText("The text of the header, for example the name of your company")) as HTMLInputElement).disabled).toBe(false);
    await waitFor(() => expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true));
    expect(screen.queryByText(/Type a text for the header/)).toBeNull();
  });

  it("shows the reason when the preview cannot be made", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    design.preview.mockRejectedValue(new Error("The logo is too large"));
    fireEvent.change(screen.getByPlaceholderText("The text of the header, for example the name of your company"), { target: { value: "Another text" } });
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("lets the header have its own font, or the font of the body", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    fireEvent.click(screen.getByRole("combobox", { name: "Header font" }));
    fireEvent.click(await screen.findByRole("option", { name: "Verdana" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(design.update).toHaveBeenCalledWith(expect.objectContaining({ headerFontFamily: "Verdana", fontFamily: "Arial" }), 2));
  });

  it("has one section with the header, the body and the footer in areas, and the two colours of a part in one row", async () => {
    renderAt("/settings/notifications/email-design");
    const bodyColour = await screen.findByLabelText("Body Colour");
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Email Design", "Preview"]);
    for (const area of ["Header", "Body", "Footer"]) expect(screen.getByText(area)).toBeTruthy();
    const row = (a: string, b: string) => screen.getByLabelText(a).closest(".grid") === screen.getByLabelText(b).closest(".grid");
    expect(row("Body Colour", "Body Text Colour")).toBe(true);
    expect(row("Footer Colour", "Footer Text Colour")).toBe(true);
    expect(row("Body Colour", "Footer Colour")).toBe(false);
    expect(bodyColour).toBeTruthy();
  });

  it("shows a preview whose links and button cannot be clicked", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    await waitFor(() => expect(design.preview).toHaveBeenCalled());
    const frame = (await screen.findByTitle("Email preview")) as HTMLIFrameElement;
    expect(frame.getAttribute("srcdoc")).toContain("pointer-events:none");
  });

  it("sends the alignment of the logo and of the footer", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    fireEvent.click(screen.getByRole("combobox", { name: "Logo alignment" }));
    fireEvent.click(await screen.findByRole("option", { name: "Center" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Footer alignment" }));
    fireEvent.click(await screen.findByRole("option", { name: "Right" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(design.update).toHaveBeenCalledWith(expect.objectContaining({ logoAlign: "CENTER", footerAlign: "RIGHT" }), 2));
  });

  it("keeps Back and Save in the header, and Desktop and Mobile as tabs", async () => {
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    const save = screen.getByRole("button", { name: "Save" });
    const back = screen.getByRole("button", { name: "Back" });
    expect(back.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Mobile" })).toBeTruthy();
  });

  it("does not let a colour that is not #RRGGBB be saved", async () => {
    renderAt("/settings/notifications/email-design");
    const colour = (await screen.findByLabelText("Body Text Colour")) as HTMLInputElement;
    fireEvent.change(colour, { target: { value: "green" } });
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("is read only for a person who may not manage it", async () => {
    perms.manage = false;
    renderAt("/settings/notifications/email-design");
    await screen.findByLabelText("Body Colour");
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect((screen.getByLabelText("Footer line") as HTMLInputElement).disabled).toBe(true);
  });
});
