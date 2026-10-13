import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/services/api/systemInfo", () => ({ systemInfoApi: api }));

import { SystemInformationView } from "../SystemInformationView";

const info = {
  server: {
    applicationName: "eqms", version: "1.4.2", activeProfiles: ["prod"], javaVersion: "21", javaVendor: "Eclipse", jvmName: "OpenJDK",
    osName: "Linux", osArch: "amd64", availableProcessors: 4, timeZone: "UTC", startedAt: "2026-10-01T00:00:00Z",
    uptimeMillis: 90_000_000, heapUsedBytes: 512 * 1024 * 1024, heapMaxBytes: 1024 * 1024 * 1024,
  },
  database: {
    product: "PostgreSQL", productVersion: "16.3 (Debian)", driverName: "pgjdbc", driverVersion: "42.7", schemaMigrationVersion: "553",
    appliedMigrations: 553, poolMax: 10, poolActive: 2, poolIdle: 3,
  },
  techStack: [{ id: "spring-boot", name: "Spring Boot", category: "Framework", version: "3.4" }],
};

const renderView = () => render(<BreadcrumbProvider><MemoryRouter><SystemInformationView /></MemoryRouter></BreadcrumbProvider>);

beforeEach(() => api.get.mockReset());

describe("SystemInformationView", () => {
  it("summarises the server and database from what the server reported, with the heap as its real ratio", async () => {
    api.get.mockResolvedValue(info);
    renderView();

    const summary = await screen.findByRole("region", { name: "Server and database summary" });
    expect(summary).toHaveTextContent("1.4.2");
    expect(summary).toHaveTextContent("v553");
    expect(summary).toHaveTextContent("1d 1h"); // 90,000,000 ms
    expect(screen.getByRole("progressbar", { name: "Heap in use" })).toHaveAttribute("aria-valuenow", "50");
  });

  it("says so and offers a retry when the server cannot be read, without inventing figures", async () => {
    api.get.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(info);
    renderView();

    expect(await screen.findByText("Unable to load server and database information.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Server and database summary" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(await screen.findByRole("region", { name: "Server and database summary" })).toBeInTheDocument();
  });
});
