import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getContext: vi.fn() }));

vi.mock("@/services/api/uncontrolledCopy", () => ({ uncontrolledCopyApi: { getUncontrolledCopyRequestContext: mocks.getContext, requestUncontrolledCopy: vi.fn() } }));
vi.mock("@/services/api/metadata", () => ({ metadataApi: { getUsersLookup: vi.fn().mockResolvedValue([]) } }));
vi.mock("@/components/ui/toast/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/ui/esign-modal/ESignatureModal", () => ({ ESignatureModal: () => null }));
vi.mock("../UncontrolledCopyMarkingPreview", () => ({ UncontrolledCopyMarkingPreview: () => null }));

import { RequestUncontrolledCopyModal } from "../RequestUncontrolledCopyModal";

const context = (overrides: Record<string, unknown> = {}) => ({
  documentId: "d1", documentNumber: "SOP.0037", documentTitle: "Cleaning", documentTypeName: "SOP", revisionNumber: "2.0",
  documentTypeEligible: true, canRequest: true, canRequestForOthers: false, approvalRequired: false,
  validityHours: 72, allowRedownload: true, marking: {}, mandatoryWatermarkText: "UNCONTROLLED COPY",
  ...overrides,
});

const open = () => render(<RequestUncontrolledCopyModal isOpen onClose={vi.fn()} documentId="d1" />);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Request Uncontrolled Copy: how long the copy will be valid", () => {
  it("shows the exact date and time worked out from the document's Valid Until date plus the hours", async () => {
    mocks.getContext.mockResolvedValue(context({
      validityBasis: "DOCUMENT_VALID_UNTIL", documentValidUntil: "27/10/2027", computedValidUntil: "30/10/2027 23:59",
    }));

    open();

    expect(await screen.findByText("30/10/2027 23:59")).toBeInTheDocument();
    expect(screen.getByText(/the document's Valid Until date 27\/10\/2027 \+ 72 hours/)).toBeInTheDocument();
    expect(screen.queryByText(/after distribution/)).toBeNull();
  });

  it("keeps saying how many hours after distribution when the policy counts from the distribution", async () => {
    mocks.getContext.mockResolvedValue(context({ validityBasis: "DISTRIBUTION" }));

    open();

    await waitFor(() => expect(screen.getByText(/after distribution/)).toBeInTheDocument());
    expect(screen.getByText("72 hours")).toBeInTheDocument();
  });

  it("says why a document that cannot be issued under the document basis is refused", async () => {
    mocks.getContext.mockResolvedValue(context({
      canRequest: false, validityBasis: "DOCUMENT_VALID_UNTIL", documentValidUntil: null, computedValidUntil: null,
      message: "This document has no Valid Until date, and the Uncontrolled Copies Policy makes a copy valid until the document's Valid Until date, so a copy cannot be issued.",
    }));

    open();

    expect(await screen.findByText(/has no Valid Until date/)).toBeInTheDocument();
  });
});
