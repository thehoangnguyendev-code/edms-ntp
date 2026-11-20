import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SeparationRule } from "@/services/api";
import { SeparationRulesPanel, separationRuleSentence } from "../SeparationRulesPanel";

const rule = (over: Partial<SeparationRule>): SeparationRule => ({
  id: "r1", moduleKey: "SECURITY_REVIEW", moduleLabel: "Access Review & Audit Trail Review", workflowKey: "ACCESS_REVIEW_CAMPAIGN", workflowLabel: "Access Review Campaign",
  objectType: "ACCESS_REVIEW_CAMPAIGN", actionCode: "COMPLETE", actionLabel: "Complete", fromStatus: "IN_PROGRESS", fromStatusLabel: "In Progress",
  relationCode: "CAMPAIGN_CREATOR", relationLabel: "Creator of the campaign", description: "The person who created the campaign.",
  enabled: false, policyId: "p1", policyActive: true, ...over,
});

const base = { moduleLabel: "Reports", isLoading: false, failed: false, isEditing: true, canManage: true, onToggle: vi.fn() };
afterEach(() => { cleanup(); base.onToggle.mockReset(); });

it("writes each rule as one plain sentence", () => {
  expect(separationRuleSentence(rule({}))).toBe("The creator of the campaign cannot complete");
  expect(separationRuleSentence(rule({ relationLabel: "Author of the version", actionLabel: "Approve Template" }))).toBe("The author of the version cannot approve template");
});

it("shows a title, a short explanation and one tick box per rule, like Document Revision Integrity", () => {
  render(<SeparationRulesPanel {...base} rules={[rule({}), rule({ id: "r2", actionLabel: "Decide Item", relationLabel: "Person the item is about", enabled: true })]} draft={{ r1: false, r2: true }} />);
  expect(screen.getByText("Reports Separation Rules")).toBeTruthy();
  expect(screen.getByText(/stop the same person from doing two jobs/)).toBeTruthy();
  const boxes = screen.getAllByRole("checkbox");
  expect(boxes).toHaveLength(2);
  expect((boxes[0] as HTMLInputElement).checked).toBe(false);
  expect((boxes[1] as HTMLInputElement).checked).toBe(true);
  expect(screen.getAllByText(/Applies when the record is "In Progress"/)).toHaveLength(2);
});

it("the tick boxes change only while editing and only for a person who may manage", () => {
  const { rerender } = render(<SeparationRulesPanel {...base} isEditing={false} rules={[rule({})]} draft={{ r1: false }} />);
  expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  rerender(<SeparationRulesPanel {...base} canManage={false} rules={[rule({})]} draft={{ r1: false }} />);
  expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(true);
  rerender(<SeparationRulesPanel {...base} rules={[rule({})]} draft={{ r1: false }} />);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(base.onToggle).toHaveBeenCalledWith("r1", true);
});

it("keeps the steps of one workflow together under its name", () => {
  render(<SeparationRulesPanel {...base} rules={[rule({}), rule({ id: "r2", workflowLabel: "Audit Review Campaign" })]} draft={{ r1: false, r2: false }} />);
  expect(screen.getByText("Access Review Campaign")).toBeTruthy();
  expect(screen.getByText("Audit Review Campaign")).toBeTruthy();
});

it("says so when the policy of a step is switched off, and when there is no rule or it could not be loaded", () => {
  const { rerender } = render(<SeparationRulesPanel {...base} rules={[rule({ policyActive: false })]} draft={{ r1: false }} />);
  expect(screen.getByText(/policy is switched off/)).toBeTruthy();
  rerender(<SeparationRulesPanel {...base} rules={[]} draft={{}} />);
  expect(screen.getByText("There are no separation rules for Reports.")).toBeTruthy();
  rerender(<SeparationRulesPanel {...base} failed rules={[]} draft={{}} />);
  expect(screen.getByText(/could not be loaded/)).toBeTruthy();
});
