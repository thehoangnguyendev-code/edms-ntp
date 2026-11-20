import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PolicyRuleLayout, describePolicy, type PolicyLayoutMode, type PolicyRuleFormValues, type PolicyRuleLayoutProps } from "../PolicyRuleLayouts";
import type { WorkflowActionPolicy } from "../../types";

afterEach(cleanup);

const options = {
  modules: ["TRAINING"], workflows: ["TRAINING_ACTIVITY"], objectTypes: ["TRAINING_ACTIVITY"], permissions: [], documentTypes: [],
  actorTypes: [{ value: "PERMISSION", label: "Permission" }, { value: "OWNER", label: "Owner" }, { value: "AUTHOR", label: "Author" }],
  actions: [
    { value: "START", label: "Start Training", workflowKey: "TRAINING_ACTIVITY", objectType: "TRAINING_ACTIVITY", defaultFromStatuses: ["PLANNED", "NOTIFIED"], allowedActorTypes: ["PERMISSION", "OWNER"] },
    { value: "CANCEL", label: "Cancel", workflowKey: "TRAINING_ACTIVITY", objectType: "TRAINING_ACTIVITY", defaultFromStatuses: ["PLANNED"], allowedActorTypes: ["PERMISSION", "OWNER"] },
  ],
};
const empty: PolicyRuleFormValues = { moduleKey: "TRAINING", workflowKey: "TRAINING_ACTIVITY", objectType: "TRAINING_ACTIVITY", actionCode: "", fromStatus: "", documentTypeId: "", requiredPermissionCode: "", actors: [] };
const taken = { id: "p9", moduleKey: "TRAINING", workflowKey: "TRAINING_ACTIVITY", objectType: "TRAINING_ACTIVITY", actionCode: "START", fromStatus: "NOTIFIED", requiredPermissionCode: "training.activity.organize", priority: 100, active: true, system: true, actors: [] } as unknown as WorkflowActionPolicy;

let latest: PolicyRuleFormValues = empty;
const Harness: React.FC<{ layout: PolicyLayoutMode; initial?: PolicyRuleFormValues; existing?: WorkflowActionPolicy[]; locked?: boolean; actorsRelevant?: boolean }> = ({ layout, initial = empty, existing = [], locked = false, actorsRelevant }) => {
  const [form, setForm] = useState(initial);
  latest = form;
  const allowedActorTypes = options.actorTypes.filter((type) => !form.actionCode || (options.actions.find((a) => a.value === form.actionCode)?.allowedActorTypes ?? []).includes(type.value));
  const props: PolicyRuleLayoutProps = {
    mode: "create", form, setField: (key, value) => setForm((prev) => ({ ...prev, [key]: value })), locked: () => locked,
    options: options as never,
    moduleOptions: [{ label: "Training Management", value: "TRAINING" }],
    workflowOptions: [{ label: "Training Activity", value: "TRAINING_ACTIVITY" }],
    objectTypeOptions: [{ label: "Training Activity", value: "TRAINING_ACTIVITY" }],
    actionOptions: options.actions.map((a) => ({ label: a.label, value: a.value })),
    fromStatusOptions: (options.actions.find((a) => a.value === form.actionCode)?.defaultFromStatuses ?? []).map((s) => ({ label: s, value: s })),
    allowedActorTypes, existing,
    permissionField: <div>PERMISSION FIELD</div>, actorsField: <div>ACTORS FIELD</div>, optionsSection: <div>OPTIONS SECTION</div>, actorsRelevant,
  };
  return <PolicyRuleLayout layout={layout} props={props} />;
};

describe("Policy form layouts: one policy, four ways to fill it in", () => {
  it("says the rule as a sentence, filled in as far as the form is", () => {
    const base = { ...empty, actionCode: "START", fromStatus: "NOTIFIED", requiredPermissionCode: "training.activity.organize", actors: [{ actorType: "OWNER", actorCode: null }] };
    const props = { form: base, objectTypeOptions: [{ label: "Training Activity", value: "TRAINING_ACTIVITY" }], actionOptions: [{ label: "Start Training", value: "START" }], allowedActorTypes: options.actorTypes } as unknown as PolicyRuleLayoutProps;
    expect(describePolicy(props)).toBe("When a Training Activity is in Notified, “Start Training” may be done by someone who holds training.activity.organize and is Owner.");
    const anyone = { ...props, form: { ...base, actors: [{ actorType: "PERMISSION", actorCode: "training.activity.organize" }] } } as unknown as PolicyRuleLayoutProps;
    expect(describePolicy(anyone)).toBe("When a Training Activity is in Notified, “Start Training” may be done by someone who holds training.activity.organize.");
    expect(describePolicy({ ...props, form: { ...base, objectType: "TRAINING_ACTIVITY", fromStatus: "PENDING_REVIEW" }, objectTypeOptions: [{ label: "TRAINING_ACTIVITY", value: "TRAINING_ACTIVITY" }] } as unknown as PolicyRuleLayoutProps)).toContain("When a Training Activity is in Pending Review");
    expect(describePolicy({ ...props, form: { ...empty } } as PolicyRuleLayoutProps)).toContain("…");
  });

  it("sentence: shows the sentence, the who block and the options, and warns when the policy already exists", () => {
    render(<Harness layout="sentence" initial={{ ...empty, actionCode: "START", fromStatus: "NOTIFIED" }} existing={[taken]} />);
    expect(screen.getByText("PERMISSION FIELD")).toBeTruthy();
    expect(screen.getByText("ACTORS FIELD")).toBeTruthy();
    expect(screen.getByText("OPTIONS SECTION")).toBeTruthy();
    expect(screen.getByText(/A policy already exists for this action and status \(priority 100/)).toBeTruthy();
  });

  it("matrix: a cell chooses the action and the status together; a taken cell is marked", () => {
    render(<Harness layout="matrix" existing={[taken]} />);
    expect(screen.queryByText("PERMISSION FIELD")).toBeNull(); // nothing to say about who until a cell is chosen
    fireEvent.click(screen.getByRole("button", { name: "Start Training from Notified" }));
    expect(latest.actionCode).toBe("START");
    expect(latest.fromStatus).toBe("NOTIFIED");
    expect(screen.getByText("PERMISSION FIELD")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start Training from Notified" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Cancel from Notified" })).toBeNull(); // Cancel does not start from Notified
    expect(screen.getByRole("button", { name: "Cancel from Planned" })).toBeTruthy();
  });

  it("matrix: an existing policy's action and status cannot be moved", () => {
    render(<Harness layout="matrix" locked initial={{ ...empty, actionCode: "START", fromStatus: "NOTIFIED" }} />);
    const cell = screen.getByRole("button", { name: "Start Training from Planned" }) as HTMLButtonElement;
    expect(cell.disabled).toBe(true);
    fireEvent.click(cell);
    expect(latest.fromStatus).toBe("NOTIFIED");
  });

  it("templates: a card sets the actors, only those the action allows are offered, Custom opens the actors list", () => {
    render(<Harness layout="templates" initial={{ ...empty, actionCode: "START", fromStatus: "NOTIFIED", requiredPermissionCode: "training.activity.organize" }} />);
    expect(screen.getByRole("button", { name: /Anyone with the permission/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Only the owner/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Only the author/ })).toBeNull(); // Start does not allow an author
    expect(screen.queryByText("ACTORS FIELD")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Anyone with the permission/ }));
    expect(latest.actors).toEqual([{ actorType: "PERMISSION", actorCode: "training.activity.organize" }]); // the permission itself is the actor
    fireEvent.click(screen.getByRole("button", { name: /Only the owner/ }));
    expect(latest.actors).toEqual([{ actorType: "OWNER", actorCode: null }]);

    fireEvent.click(screen.getByRole("button", { name: /Custom/ }));
    expect(screen.getByText("ACTORS FIELD")).toBeTruthy();
  });

  it("steps: Next waits for the fields of the step; the last step reviews the sentence", () => {
    render(<Harness layout="steps" />);
    const next = () => screen.getByRole("button", { name: "Next" }) as HTMLButtonElement;
    expect(next().disabled).toBe(true); // the action and the status are not chosen
    expect(screen.getByText("Choose all five to go on.")).toBeTruthy();
  });

  it("steps: an existing policy opens at Who, its identity being fixed, and can be reviewed", () => {
    render(<Harness layout="steps" locked initial={{ ...empty, actionCode: "START", fromStatus: "NOTIFIED", requiredPermissionCode: "training.activity.organize", actors: [{ actorType: "OWNER", actorCode: null }] }} />);
    expect(screen.getByText("PERMISSION FIELD")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // Options
    expect(screen.getByText("OPTIONS SECTION")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // Review
    const review = screen.getByText("This policy says").closest("div") as HTMLElement;
    expect(within(review).getByText(/Start Training/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("Policy form layouts: a policy whose actors nothing reads does not ask for them", () => {
  const filled = { ...empty, actionCode: "START", fromStatus: "NOTIFIED", requiredPermissionCode: "training.activity.organize" };

  it("the sentence does not end with 'and is …' and the actors list is not shown", () => {
    const props = { form: filled, objectTypeOptions: [{ label: "Training Activity", value: "TRAINING_ACTIVITY" }], actionOptions: [{ label: "Start Training", value: "START" }], allowedActorTypes: options.actorTypes, actorsRelevant: false } as unknown as PolicyRuleLayoutProps;
    expect(describePolicy(props)).toBe("When a Training Activity is in Notified, “Start Training” may be done by someone who holds training.activity.organize.");
    render(<Harness layout="sentence" initial={filled} actorsRelevant={false} />);
    expect(screen.getByText("PERMISSION FIELD")).toBeTruthy();
    expect(screen.queryByText("ACTORS FIELD")).toBeNull();
  });

  it("steps: the permission alone is enough to go on", () => {
    render(<Harness layout="steps" locked initial={filled} actorsRelevant={false} />);
    expect(screen.queryByText("ACTORS FIELD")).toBeNull();
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("templates: no actor templates, only the permission", () => {
    render(<Harness layout="templates" initial={filled} actorsRelevant={false} />);
    expect(screen.getByText("PERMISSION FIELD")).toBeTruthy();
    expect(screen.queryByText("Anyone with the permission")).toBeNull();
    expect(screen.queryByText("Custom")).toBeNull();
  });
});
