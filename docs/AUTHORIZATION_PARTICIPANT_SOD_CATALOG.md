# Participant and Segregation of Duties Catalog

This catalog is the BA/QA/Compliance approval reference for participant eligibility
and segregation of duties (SoD) in live authorization modules. It complements the
[Global Action Catalog](AUTHORIZATION_GLOBAL_ACTION_CATALOG.md). A new participant
type, relationship, or exception must be approved here before it is implemented.

## Common rules

* An Access Profile establishes enduring capability only; it never assigns a person
  to a particular record.
* A participant assignment is record-scoped and is authoritative for actor rules.
* Eligible-user queries must validate active account, required permission, workflow
  role eligibility, object scope and every applicable SoD rule server-side.
* Assignment changes are auditable. Revision participant rows remain the source of
  truth until the generic-participant reconciliation gate has passed.
* `SYSTEM_SUPER_ADMIN` does not bypass participant assignment or SoD.

## Documents / Document Revision

| Participant type | Assignment owner | Eligibility | May act at | SoD / exclusion |
|---|---|---|---|---|
| Author | Document owner or DCO, at draft creation | Active user with author capability and document scope | Draft authoring and submission | Cannot review or approve the same revision. |
| Co-author | Author or DCO while draft is editable | Active user with co-author capability and document scope | Draft editing only | Cannot review or approve the same revision. |
| Reviewer | DCO/authorized workflow configurator | Active user with review capability, workflow eligibility and scope | `PENDING_REVIEW` | Cannot be Author, Co-author or DCO actor for the same revision; configured department separation applies. |
| Approver | DCO/authorized workflow configurator | Active user with approval capability, workflow eligibility and scope | `PENDING_APPROVAL` | Cannot be Author, Co-author or Reviewer for the same revision; configured department separation applies. |
| Training coordinator | Workflow configuration | Active user with training-stage capability and scope | Document-training stage | Must satisfy configured training separation rule. |
| DCO / Document Admin | Access Profile and policy actor, not a generic participant assignment | Active user with policy permission and document scope | Policy-defined DCO actions | May not impersonate an assigned Reviewer or Approver. |

## Controlled Copies

| Actor | Source of assignment | Eligibility | SoD / exclusion |
|---|---|---|---|
| Requester | Controlled-copy request | Active user with request permission and source-document scope | Cannot approve their own request unless an approved policy explicitly permits it. |
| Recipient / custodian | Controlled-copy record | Active user assigned as copy holder | May preview/download/report loss only within lifecycle policy. |
| Batch approver | Controlled-copy workflow policy | Active user with approval permission and source-document scope | Must not be requester for a self-approved request. |
| Distributor / DCO | Controlled-copy workflow policy | Active user with distribution permission and source-document scope | May execute only policy-defined lifecycle transitions. |

## Work Management

| Actor | Source of assignment | Eligibility | SoD / exclusion |
|---|---|---|---|
| Project admin | `work_project_members` | Active user, Work Management entitlement and project-admin membership | May manage members; membership remains record-level, not an Access Profile. |
| Member | `work_project_members` | Active user, Work Management entitlement and member membership | May create/update issues when project is active. |
| Viewer | `work_project_members` | Active user, Work Management entitlement and viewer membership | Read only; cannot create/update issues or manage members. |

## Exception process

No UI or API may silently bypass a row above. A business exception requires an
approved policy change, documented reason, e-signature where the security change
requires it, and a composite audit event. The exception must be added to this
catalog before it can be enabled in a migrated action.

## Proposed, not approved for build: Delegate (time-limited substitute)

Chosen in principle by the owner on 2026-11-18 (Decision Log SECURITY-AUTHORIZATION-REVIEW-2026-11-18, D7: "time-limited delegation for one kind of task"). Per the rule at the top of this
file, nothing is built until BA/QA/Compliance approve this row and the actions it lists in the Global Action Catalog.

| Item | Proposal |
|---|---|
| Who delegates | A person who holds an assignment (Reviewer or Approver of a revision, a training approver) while they are away. They choose the substitute, the kind of task and the dates. |
| Who is eligible as substitute | An active person who already holds the base permission of that kind of task, is in scope of the record, and passes every SoD rule for the task as if the assignment were theirs. A person who is Author or Co-author of the revision is refused. |
| What the substitute may do | Only that kind of task, only on tasks assigned to the delegator, only between the dates. Nothing else of the delegator's access passes to them. |
| Signature | Under the substitute's own name and password. The audit record says "acting for" the delegator, with the delegation as its reference. |
| End | Automatic at the end date; the delegator, an administrator or the substitute can end it earlier with a reason. A task already acted on stays valid. |
| Audit | Creating, changing and ending a delegation, and every action taken under it, are audit records in the same transaction as the change. |
| Open for approval | Whether the delegator or the substitute is the participant of record in the revision history; whether delegation is allowed for approval and not only for review; the longest duration; whether a delegation made by an administrator needs a second signature. |
