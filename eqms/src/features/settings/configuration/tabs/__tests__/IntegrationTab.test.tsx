import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ test: vi.fn(), preview: vi.fn(), toast: vi.fn() }));
vi.mock("@/services/api/settings", () => ({ settingsApi: { testStorageConnection: mocks.test, getStoragePathPreview: mocks.preview } }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: mocks.toast }) }));

import { IntegrationTab } from "../IntegrationTab";
import type { IntegrationConfig } from "../../types";
import type { IntegrationChecksController } from "../../useIntegrationChecks";

type Storage = IntegrationConfig["storage"];
const storage = (extra: Partial<Storage> = {}): IntegrationConfig =>
  ({ storage: { provider: "minio", minioEndpoint: "http://minio:9000", minioBucket: "eqms-gmp-records", minioAccessKeyId: "key", minioSecretAccessKey: "secret", ...extra } }) as unknown as IntegrationConfig;
const preview = { documents: "documents/{Document Number}/x", controlledCopies: "controlled-copies/{Batch Number}/y", templates: "templates/z", training: "training/t", auditEvidence: "audit/a", temporaryFiles: "tmp/f" };
const controller = (checks: IntegrationChecksController["checks"] = {}, reload = vi.fn()): IntegrationChecksController => ({ checks, loaded: true, reload });

function Harness({ initial, saved, checks }: { initial: IntegrationConfig; saved?: Storage; checks: IntegrationChecksController }) {
  const [config, setConfig] = useState(initial);
  return <IntegrationTab config={config} onChange={setConfig} savedStorage={saved ?? initial.storage} checks={checks} />;
}

beforeEach(() => {
  mocks.test.mockReset(); mocks.preview.mockReset(); mocks.toast.mockReset();
  mocks.preview.mockResolvedValue(preview);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});
afterEach(cleanup);

describe("Storage tab: the state at the top (S1)", () => {
  it("says no test has been run when the server has no result, and a test result stays on the card with its time and who ran it", () => {
    const { unmount } = render(<Harness initial={storage()} checks={controller()} />);
    expect(screen.getByText("No connection test has been run yet.")).toBeTruthy();
    unmount();

    const check = { integration: "STORAGE" as const, success: false, message: "Could not reach http://minio:9000", subject: "MinIO · http://minio:9000 · eqms-gmp-records", steps: [], checkedAt: "2026-11-19T04:00:00Z", checkedBy: "Nguyen The Hoang" };
    render(<Harness initial={storage()} checks={controller({ STORAGE: check })} />);
    expect(screen.getByText("Last test failed")).toBeTruthy();
    expect(screen.getByText("Could not reach http://minio:9000")).toBeTruthy();
    expect(screen.getByText(/19\/11\/2026.*Nguyen The Hoang/)).toBeTruthy();
    // it was the test of this very setup: nothing about another setup
    expect(screen.queryByText(/another setup/)).toBeNull();
  });

  it("says when the last test was of another setup, so that it is not read as the state of this one", () => {
    const check = { integration: "STORAGE" as const, success: true, message: "Storage connection test successful.", subject: "MinIO · http://old:9000 · old-bucket", steps: [], checkedAt: "2026-11-19T04:00:00Z", checkedBy: null };
    render(<Harness initial={storage()} checks={controller({ STORAGE: check })} />);
    expect(screen.getByText(/another setup: MinIO · http:\/\/old:9000 · old-bucket/)).toBeTruthy();
  });

  it("runs the test with the setup as it stands, tells it with a toast, and reads the kept result again", async () => {
    const reload = vi.fn();
    mocks.test.mockResolvedValue({ success: true, message: "Storage connection test successful." });
    render(<Harness initial={storage()} checks={controller({}, reload)} />);

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "success" })));
    expect(mocks.test).toHaveBeenCalledWith(expect.objectContaining({ provider: "minio", minioEndpoint: "http://minio:9000" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it("still reads the kept result when the test itself failed, and does not run when the fields are not filled in", async () => {
    const reload = vi.fn();
    mocks.test.mockRejectedValue({ response: { data: { message: "Bucket not found" } } });
    render(<Harness initial={storage()} checks={controller({}, reload)} />);
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ type: "error", message: "Bucket not found" })));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    cleanup();

    render(<Harness initial={storage({ minioBucket: "" })} checks={controller()} />);
    expect(screen.getByRole("button", { name: "Test connection" })).toBeDisabled();
  });
});

describe("Storage tab: the provider, the retention and the layout (S2, S3, S4, S5)", () => {
  it("chooses the provider with cards (native radio buttons) and shows the fields of the one chosen", () => {
    render(<Harness initial={storage()} checks={controller()} />);
    expect(screen.getByLabelText("MinIO Endpoint")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: /Network Attached Storage/ }));
    expect(screen.getByLabelText("NAS Host / IP")).toBeTruthy();
    expect(screen.queryByLabelText("MinIO Endpoint")).toBeNull();
    expect(screen.queryByText("Retention")).toBeNull(); // retention and layout are MinIO's (Object Lock)

    fireEvent.click(screen.getByRole("radio", { name: /Local Server/ }));
    expect(screen.getByText(/not part of the backup, so a lost disk loses them/)).toBeTruthy();
    expect(screen.getAllByText("Not backed up").length).toBeGreaterThan(0);
  });

  it("keeps the endpoint help closed until it is asked for, and fills the endpoint with the quick buttons", () => {
    render(<Harness initial={storage()} checks={controller()} />);
    expect(screen.queryByText(/Do not use port/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Which endpoint/ }));
    expect(screen.getByText(/Do not use port/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "localhost:9000" }));
    expect(screen.getByLabelText("MinIO Endpoint")).toHaveValue("http://localhost:9000");
  });

  it("says in words until when the records are locked, warns while the retention differs from the saved one, and keeps the years inside the limits", () => {
    const initial = storage();
    render(<Harness initial={initial} saved={initial.storage} checks={controller()} />);
    expect(screen.getByText(/locked until/)).toBeTruthy();
    expect(screen.queryByText(/asked to confirm/)).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "Set years" }));
    expect(screen.getByLabelText("Retention period in years")).toHaveValue(5);
    expect(screen.getByText(/asked to confirm this change when you press Save/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Retention period in years"), { target: { value: "500" } });
    expect(screen.getByLabelText("Retention period in years")).toHaveValue(99);
    fireEvent.change(screen.getByLabelText("Retention period in years"), { target: { value: "0" } });
    expect(screen.getByLabelText("Retention period in years")).toHaveValue(1); // at least one year
    fireEvent.change(screen.getByLabelText("Retention period in years"), { target: { value: "" } });
    expect(screen.getByLabelText("Retention period in years")).toHaveValue(5); // an empty entry falls back to the default
    fireEvent.click(screen.getByRole("radio", { name: "Permanent" }));
    expect(screen.queryByLabelText("Retention period in years")).toBeNull();
  });

  it("lists the data domains with the key the server builds, reserved ones apart, and a button that copies the key", async () => {
    render(<Harness initial={storage()} checks={controller()} />);

    const documents = (await screen.findByText("documents/{Document Number}/x")).closest("tr") as HTMLElement;
    expect(within(documents).getByText("In use")).toBeTruthy();
    expect(within((screen.getByText("Training").closest("tr")) as HTMLElement).getByText("Reserved")).toBeTruthy();

    fireEvent.click(within(documents).getByRole("button", { name: "Copy the object key of Documents" }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("documents/{Document Number}/x"));
    expect(within(documents).getByRole("button", { name: "Copied" })).toBeTruthy();
  });
});
