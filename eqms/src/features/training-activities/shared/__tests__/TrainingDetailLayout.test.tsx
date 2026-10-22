import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider } from "@/contexts/BreadcrumbContext";
import { TrainingDetailLayout } from "../TrainingDetailLayout";

const renderLayout = (repeat: boolean) =>
  render(
    <BreadcrumbProvider>
      <MemoryRouter>
        <TrainingDetailLayout
          title="Details"
          breadcrumbItems={[]}
          onBack={vi.fn()}
          steps={["Draft", "Approved"]}
          currentStepIndex={0}
          tabs={[{ id: "overview", label: "Overview" }]}
          activeTab="overview"
          onTab={vi.fn()}
          tabLayoutId="t"
          footer={<><button>Save draft</button><button>Send for review</button></>}
          repeatFooterInHeader={repeat}
        >
          body
        </TrainingDetailLayout>
      </MemoryRouter>
    </BreadcrumbProvider>,
  );

describe("TrainingDetailLayout", () => {
  it("repeats Back and every footer button in the header when asked, so they can be used without scrolling", () => {
    renderLayout(true);
    expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Save draft" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Send for review" })).toHaveLength(2);
  });

  it("keeps the header to Back alone by default, as the other training screens have it", () => {
    renderLayout(false);
    expect(screen.getAllByRole("button", { name: "Back" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Save draft" })).toHaveLength(1);
  });
});
