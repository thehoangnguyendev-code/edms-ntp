import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditTimeline } from "../AuditTimeline";
import { groupByDay, initialsOf, normalizeTimelineStyle, toTimelineItem } from "../auditTimelineModel";
import type { AuditTrailRecord } from "../../../types";
import { getInitials } from "@/utils/format";

afterEach(cleanup);

const record = (over: Partial<Omit<AuditTrailRecord, "action">> & { action?: string }): AuditTrailRecord =>
  ({ id: "r", action: "Update", fullName: "Nguyen The Hoang", userId: "u", timestamp: "2026-11-15T10:24:15Z", module: "Report", entityId: "e", entityName: "RPT.0039", description: "", ipAddress: "", severity: "Low", ...over }) as AuditTrailRecord;

const RECORDS = [
  record({ id: "1", action: "Submit", entityName: "Report Template RPT.0039", timestamp: "2026-11-15T10:24:15Z" }),
  record({ id: "2", action: "Reject", fullName: "Approver Test 1", entityName: "Report Template RPT.0039", description: "Reason: add the department column", timestamp: "2026-11-15T09:58:02Z" }),
  record({ id: "3", action: "Create", fullName: "Do Thi Lan (UAT)", entityName: "Training Activity TRN-2026-0042", timestamp: "2026-11-14T04:42:10Z" }),
];

const props = { records: RECORDS, total: 40, isLoading: false, hasMore: true, onLoadMore: vi.fn(), onOpenDetails: vi.fn(), onExport: vi.fn() };

describe("the timeline model", () => {
  it("shows who, when and what of a record, in the time format of the system (UTC+7)", () => {
    const item = toTimelineItem(RECORDS[0]);
    expect(item.who).toBe("Nguyen The Hoang");
    expect(item.fullTime).toBe("15/11/2026 17:24:15");
    expect(item.time).toBe("17:24:15");
    expect(item.dayKey).toBe("15/11/2026");
    expect(item.verb).toBe("Submit");
    expect(item.object).toBe("Report Template RPT.0039");
    expect(item.kind).toBe("submit");
  });

  it("groups the records by the day they happened and names today and yesterday", () => {
    const days = groupByDay(RECORDS, new Date("2026-11-15T12:00:00Z"));
    expect(days.map((day) => [day.label, day.key, day.items.length])).toEqual([["Today", "15/11/2026", 2], ["Yesterday", "14/11/2026", 1]]);
    expect(days[0].dayOfMonth).toBe("15");
    expect(days[0].month).toBe("Nov");
  });

  it("gives initials, one colour for one person, and a safe style", () => {
    expect(initialsOf("Do Thi Lan (UAT)")).toBe("DL");
    expect(initialsOf("qa.guest")).toBe("QA");
    expect(toTimelineItem(RECORDS[0]).avatar).toEqual(toTimelineItem({ ...RECORDS[0], id: "x" }).avatar);
    expect(normalizeTimelineStyle("SCROLL_LIT")).toBe("SCROLL_LIT");
    expect(normalizeTimelineStyle("nonsense")).toBe("COMPACT");
    expect(normalizeTimelineStyle(undefined)).toBe("COMPACT");
  });
});

describe.each(["RAIL", "CENTER", "COMPACT", "SCROLL_LIT"] as const)("the %s timeline", (style) => {
  it("lists every record with who, when and what, grouped by day", () => {
    render(<AuditTimeline {...props} style={style} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getAllByText("Nguyen The Hoang").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Approver Test 1").length).toBeGreaterThan(0);
    expect(screen.getByText("17:24:15")).toBeInTheDocument();
    expect(screen.getAllByText(/Report Template RPT.0039/).length).toBeGreaterThan(0);
    if (style === "SCROLL_LIT") expect(screen.getAllByText("Nov", { selector: ".aud-lit__m" })).toHaveLength(2); // one gutter for each of the two days
    else expect(screen.getAllByText(/15\/11\/2026/).length).toBeGreaterThan(0);
  });

  it("opens the detail and the export of a record, and loads older records on request", () => {
    const handlers = { onOpenDetails: vi.fn(), onExport: vi.fn(), onLoadMore: vi.fn() };
    render(<AuditTimeline {...props} {...handlers} style={style} />);
    fireEvent.click(screen.getAllByRole("button", { name: /View details of/ })[0]);
    expect(handlers.onOpenDetails).toHaveBeenCalledWith(RECORDS[0]);
    fireEvent.click(screen.getAllByRole("button", { name: /^Export/ })[1]);
    expect(handlers.onExport).toHaveBeenCalledWith(RECORDS[1]);
    expect(screen.getByText("Showing 3 of 40 records")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load older records" }));
    expect(handlers.onLoadMore).toHaveBeenCalled();
  });

  it("says when it holds every record", () => {
    render(<AuditTimeline {...props} style={style} hasMore={false} total={3} />);
    expect(screen.queryByRole("button", { name: "Load older records" })).toBeNull();
    expect(screen.getByText("That is every record.")).toBeInTheDocument();
  });
});

describe("the avatar of the person", () => {
  it("is the picture of the profile when the record has it, and the initials when it has none", () => {
    const withPicture = record({ id: "p", fullName: "Do Thi Lan (UAT)", user: { id: "u1", fullName: "Do Thi Lan (UAT)", employeeCode: "E1", role: null, position: null, department: null, avatar: "https://cdn.example.test/lan.png" } as never });
    expect(toTimelineItem(withPicture).avatarUrl).toBe("https://cdn.example.test/lan.png");
    expect(toTimelineItem(RECORDS[0]).avatarUrl).toBeNull();
    expect(toTimelineItem(record({ id: "m", metadata: { userAvatar: "https://cdn.example.test/m.png" } as never })).avatarUrl).toBe("https://cdn.example.test/m.png");
    expect(toTimelineItem(record({ id: "b", user: { avatar: "   " } as never })).avatarUrl).toBeNull();
  });

  it.each(["RAIL", "CENTER", "COMPACT", "SCROLL_LIT"] as const)("is drawn in the %s timeline: the picture, else the initials", (style) => {
    const withPicture = record({ id: "p", fullName: "Do Thi Lan (UAT)", user: { id: "u1", fullName: "Do Thi Lan (UAT)", avatar: "https://cdn.example.test/lan.png" } as never });
    const { container } = render(<AuditTimeline {...props} records={[withPicture, RECORDS[0]]} style={style} />);
    const picture = container.querySelector('img[src="https://cdn.example.test/lan.png"]');
    expect(picture).not.toBeNull();
    expect(picture).toHaveAttribute("alt", "Do Thi Lan (UAT)");
    // the person with no picture has the initials
    expect(screen.getAllByText(getInitials("Nguyen The Hoang")).length).toBeGreaterThan(0);
  });
});
