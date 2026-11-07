# Department rules visibility: full-flow test report (DEV, 2026-11-02/03)

**Result: 416 of 419 checks passed.** 3 first-attempt failures were investigated (see "Findings").

## What was tested

Two documents of Quality Control (a SOP and an Instruction) went through the real flow by API, signed at each step: the DCO created the document and the revision, the Author wrote it, the DCO submitted it for review, the Reviewer reviewed, the Approver approved, the DCO published it. The SOP was then **upgraded** to revision 2 and taken to Effective again; a **Controlled Copy** and an **Uncontrolled Copy** were requested. Six more SOPs (and a seventh later) were created to test **one type with many documents**.

Record Visibility was set to **Department rules**. Everything was done through the application API as the users listed below; the database was used only to play the *administrator* (granting the module permission, scope of a profile) and to flip Document Properties settings, and the backend was restarted after those changes because it keeps each user's permissions in memory.

## People

| Role in the test | Account | Notes |
|---|---|---|
| DCO (creates documents, publishes) | dco.test1 | holds the view-all permissions |
| Administrator (no part in any flow) | user.a.test | holds the view-all permissions |
| Author | author.test1 | writes the documents |
| Co-Author | coauthor.test1 |  |
| Reviewer | reviewer.test1 |  |
| Approver | approver.test1 |  |
| Department Head of Quality Control | reviewer.test2 | named as Department Head for the run; holds the new permission |
| Group 1, member A | coauthor.test2 | already holds the View permission |
| Group 1, member B | trainee.test1 | receives the module permission from the administrator during the run |
| Group 2, member A | trainee.test2 | same |
| Group 2, member B | trainer.test1 | same |

## Documents created (all titled "DV-TEST ...", left in DEV)

- SOP **SOP.10413** (revision 1 Effective, revision 2 Effective, one Controlled Copy for G2B, one Uncontrolled Copy for G2A)
- Instruction **INS.0004** (revision 1 Effective)
- SOP SOP.10412 (the probe document, Effective, one Controlled Copy)
- SOPs SOP.10414, SOP.10415, SOP.10416, SOP.10417, SOP.10418, SOP.10419, SOP.10420 (Draft)

## Results by scenario

Every row of a matrix checks, for one user, that the **list** and the **detail** of revisions, documents, Controlled Copies and Uncontrolled Copies agree with each other and with the expected set.


### S1: Documents exist, no revision yet

| Check | Result | Detail |
|---|---|---|
| S1.DCO documents only, no revision yet: dco.test1 | PASS |  |
| S1.ADMIN documents only, no revision yet: user.a.test | PASS |  |
| S1.AUTHOR documents only, no revision yet: author.test1 | PASS |  |
| S1.COAUTHOR documents only, no revision yet: coauthor.test1 | PASS |  |
| S1.REVIEWER documents only, no revision yet: reviewer.test1 | PASS |  |
| S1.APPROVER documents only, no revision yet: approver.test1 | PASS |  |
| S1.HEAD documents only, no revision yet: reviewer.test2 | PASS |  |
| S1.G1A documents only, no revision yet: coauthor.test2 | PASS |  |
| S1.G1B documents only, no revision yet: trainee.test1 | PASS |  |
| S1.G2A documents only, no revision yet: trainee.test2 | PASS |  |
| S1.G2B documents only, no revision yet: trainer.test1 | PASS |  |

### S2: Revision 1 in Draft

| Check | Result | Detail |
|---|---|---|
| S2.DCO revision 1 in Draft: dco.test1 | PASS |  |
| S2.ADMIN revision 1 in Draft: user.a.test | PASS |  |
| S2.AUTHOR revision 1 in Draft: author.test1 | PASS |  |
| S2.COAUTHOR revision 1 in Draft: coauthor.test1 | PASS |  |
| S2.REVIEWER revision 1 in Draft: reviewer.test1 | PASS |  |
| S2.APPROVER revision 1 in Draft: approver.test1 | PASS |  |
| S2.HEAD revision 1 in Draft: reviewer.test2 | PASS |  |
| S2.G1A revision 1 in Draft: coauthor.test2 | PASS |  |
| S2.G1B revision 1 in Draft: trainee.test1 | PASS |  |
| S2.G2A revision 1 in Draft: trainee.test2 | PASS |  |
| S2.G2B revision 1 in Draft: trainer.test1 | PASS |  |

### F-A: Flow of document A

| Check | Result | Detail |
|---|---|---|
| F-A.0 SOP Sampling of raw materials: the Author completes the editing | PASS |  |
| F-A.1 SOP Sampling of raw materials: the DCO submits it for review | PASS |  |

### S3: Pending Review

| Check | Result | Detail |
|---|---|---|
| S3.state revision of document A is Pending Review | PASS |  |
| S3.DCO A and B, A is Pending Review: dco.test1 | PASS |  |
| S3.ADMIN A and B, A is Pending Review: user.a.test | PASS |  |
| S3.AUTHOR A and B, A is Pending Review: author.test1 | PASS |  |
| S3.COAUTHOR A and B, A is Pending Review: coauthor.test1 | PASS |  |
| S3.REVIEWER A and B, A is Pending Review: reviewer.test1 | PASS |  |
| S3.APPROVER A and B, A is Pending Review: approver.test1 | PASS |  |
| S3.HEAD A and B, A is Pending Review: reviewer.test2 | PASS |  |
| S3.G1A A and B, A is Pending Review: coauthor.test2 | PASS |  |
| S3.G1B A and B, A is Pending Review: trainee.test1 | PASS |  |
| S3.G2A A and B, A is Pending Review: trainee.test2 | PASS |  |
| S3.G2B A and B, A is Pending Review: trainer.test1 | PASS |  |

### F-A: Flow of document A

| Check | Result | Detail |
|---|---|---|
| F-A.2 SOP Sampling of raw materials: the Reviewer completes the review | PASS |  |

### S4: Pending Approval

| Check | Result | Detail |
|---|---|---|
| S4.state revision of document A is Pending Approval | PASS |  |
| S4.DCO A and B, A is Pending Approval: dco.test1 | PASS |  |
| S4.ADMIN A and B, A is Pending Approval: user.a.test | PASS |  |
| S4.AUTHOR A and B, A is Pending Approval: author.test1 | PASS |  |
| S4.COAUTHOR A and B, A is Pending Approval: coauthor.test1 | PASS |  |
| S4.REVIEWER A and B, A is Pending Approval: reviewer.test1 | PASS |  |
| S4.APPROVER A and B, A is Pending Approval: approver.test1 | PASS |  |
| S4.HEAD A and B, A is Pending Approval: reviewer.test2 | PASS |  |
| S4.G1A A and B, A is Pending Approval: coauthor.test2 | PASS |  |
| S4.G1B A and B, A is Pending Approval: trainee.test1 | PASS |  |
| S4.G2A A and B, A is Pending Approval: trainee.test2 | PASS |  |
| S4.G2B A and B, A is Pending Approval: trainer.test1 | PASS |  |

### F-A: Flow of document A

| Check | Result | Detail |
|---|---|---|
| F-A.3 SOP Sampling of raw materials: the Approver approves | PASS |  |
| F-A.4 SOP Sampling of raw materials: the DCO publishes it (status Effective) | PASS |  |

### F-B: Flow of document B

| Check | Result | Detail |
|---|---|---|
| F-B.0 Instruction Weighing room cleaning: the Author completes the editing | PASS |  |
| F-B.1 Instruction Weighing room cleaning: the DCO submits it for review | PASS |  |
| F-B.2 Instruction Weighing room cleaning: the Reviewer completes the review | PASS |  |
| F-B.3 Instruction Weighing room cleaning: the Approver approves | PASS |  |
| F-B.4 Instruction Weighing room cleaning: the DCO publishes it (status Effective) | PASS |  |

### S5: Both documents Effective

| Check | Result | Detail |
|---|---|---|
| S5.state both revisions are Effective | PASS |  |
| S5.DCO A and B Effective: dco.test1 | PASS |  |
| S5.ADMIN A and B Effective: user.a.test | PASS |  |
| S5.AUTHOR A and B Effective: author.test1 | PASS |  |
| S5.COAUTHOR A and B Effective: coauthor.test1 | PASS |  |
| S5.REVIEWER A and B Effective: reviewer.test1 | PASS |  |
| S5.APPROVER A and B Effective: approver.test1 | PASS |  |
| S5.HEAD A and B Effective: reviewer.test2 | PASS |  |
| S5.G1A A and B Effective: coauthor.test2 | PASS |  |
| S5.G1B A and B Effective: trainee.test1 | PASS |  |
| S5.G2A A and B Effective: trainee.test2 | PASS |  |
| S5.G2B A and B Effective: trainer.test1 | PASS |  |

### S6: Before any rule (and before the module permission)

| Check | Result | Detail |
|---|---|---|
| S6.DCO no rule yet; G1B, G2A, G2B also lack the module permission: dco.test1 | PASS |  |
| S6.ADMIN no rule yet; G1B, G2A, G2B also lack the module permission: user.a.test | PASS |  |
| S6.AUTHOR no rule yet; G1B, G2A, G2B also lack the module permission: author.test1 | PASS |  |
| S6.COAUTHOR no rule yet; G1B, G2A, G2B also lack the module permission: coauthor.test1 | PASS |  |
| S6.REVIEWER no rule yet; G1B, G2A, G2B also lack the module permission: reviewer.test1 | PASS |  |
| S6.APPROVER no rule yet; G1B, G2A, G2B also lack the module permission: approver.test1 | PASS |  |
| S6.HEAD no rule yet; G1B, G2A, G2B also lack the module permission: reviewer.test2 | PASS |  |
| S6.G1A no rule yet; G1B, G2A, G2B also lack the module permission: coauthor.test2 | PASS |  |
| S6.G1B no rule yet; G1B, G2A, G2B also lack the module permission: trainee.test1 | PASS |  |
| S6.G2A no rule yet; G1B, G2A, G2B also lack the module permission: trainee.test2 | PASS |  |
| S6.G2B no rule yet; G1B, G2A, G2B also lack the module permission: trainer.test1 | PASS |  |

### S7: The Head makes two group rules

| Check | Result | Detail |
|---|---|---|
| S7.1 the Head creates the two rules (signed, audited) | PASS |  |
| S7.DCO rules exist, but only G1A already holds the module permission: dco.test1 | PASS |  |
| S7.ADMIN rules exist, but only G1A already holds the module permission: user.a.test | PASS |  |
| S7.AUTHOR rules exist, but only G1A already holds the module permission: author.test1 | PASS |  |
| S7.COAUTHOR rules exist, but only G1A already holds the module permission: coauthor.test1 | PASS |  |
| S7.REVIEWER rules exist, but only G1A already holds the module permission: reviewer.test1 | PASS |  |
| S7.APPROVER rules exist, but only G1A already holds the module permission: approver.test1 | PASS |  |
| S7.HEAD rules exist, but only G1A already holds the module permission: reviewer.test2 | PASS |  |
| S7.G1A rules exist, but only G1A already holds the module permission: coauthor.test2 | PASS |  |
| S7.G1B rules exist, but only G1A already holds the module permission: trainee.test1 | PASS |  |
| S7.G2A rules exist, but only G1A already holds the module permission: trainee.test2 | PASS |  |
| S7.G2B rules exist, but only G1A already holds the module permission: trainer.test1 | PASS |  |
| S7.2 a person named in a rule but without the module permission still sees nothing (G1B, G2A, G2B above) | PASS |  |

### S8: The administrator grants the module permission

| Check | Result | Detail |
|---|---|---|
| S8.DCO module permission granted: dco.test1 | PASS |  |
| S8.ADMIN module permission granted: user.a.test | PASS |  |
| S8.AUTHOR module permission granted: author.test1 | PASS |  |
| S8.COAUTHOR module permission granted: coauthor.test1 | PASS |  |
| S8.REVIEWER module permission granted: reviewer.test1 | PASS |  |
| S8.APPROVER module permission granted: approver.test1 | PASS |  |
| S8.HEAD module permission granted: reviewer.test2 | PASS |  |
| S8.G1A module permission granted: coauthor.test2 | PASS |  |
| S8.G1B module permission granted: trainee.test1 | PASS |  |
| S8.G2A module permission granted: trainee.test2 | PASS |  |
| S8.G2B module permission granted: trainer.test1 | PASS |  |

### S9: Deny on a status

| Check | Result | Detail |
|---|---|---|
| S9.1 the Head creates a Deny rule for a status | PASS |  |
| S9.DCO Deny EFFECTIVE for G1B: dco.test1 | PASS |  |
| S9.ADMIN Deny EFFECTIVE for G1B: user.a.test | PASS |  |
| S9.AUTHOR Deny EFFECTIVE for G1B: author.test1 | PASS |  |
| S9.COAUTHOR Deny EFFECTIVE for G1B: coauthor.test1 | PASS |  |
| S9.REVIEWER Deny EFFECTIVE for G1B: reviewer.test1 | PASS |  |
| S9.APPROVER Deny EFFECTIVE for G1B: approver.test1 | PASS |  |
| S9.HEAD Deny EFFECTIVE for G1B: reviewer.test2 | PASS |  |
| S9.G1A Deny EFFECTIVE for G1B: coauthor.test2 | PASS |  |
| S9.G1B Deny EFFECTIVE for G1B: trainee.test1 | PASS |  |
| S9.G2A Deny EFFECTIVE for G1B: trainee.test2 | PASS |  |
| S9.G2B Deny EFFECTIVE for G1B: trainer.test1 | PASS |  |

### S10: A higher Allow beats the Deny

| Check | Result | Detail |
|---|---|---|
| S10.DCO Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: dco.test1 | PASS |  |
| S10.ADMIN Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: user.a.test | PASS |  |
| S10.AUTHOR Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: author.test1 | PASS |  |
| S10.COAUTHOR Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: coauthor.test1 | PASS |  |
| S10.REVIEWER Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: reviewer.test1 | PASS |  |
| S10.APPROVER Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: approver.test1 | PASS |  |
| S10.HEAD Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: reviewer.test2 | PASS |  |
| S10.G1A Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: coauthor.test2 | PASS |  |
| S10.G1B Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: trainee.test1 | PASS |  |
| S10.G2A Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: trainee.test2 | PASS |  |
| S10.G2B Allow EFFECTIVE (90) over the Deny (50): the status rule opens every Effective revision of the Department to G1B: trainer.test1 | PASS |  |
| S10.d the Head deletes a rule | PASS |  |
| S10b.DCO both status rules deleted: back to the groups: dco.test1 | PASS |  |
| S10b.ADMIN both status rules deleted: back to the groups: user.a.test | PASS |  |
| S10b.AUTHOR both status rules deleted: back to the groups: author.test1 | PASS |  |
| S10b.COAUTHOR both status rules deleted: back to the groups: coauthor.test1 | PASS |  |
| S10b.REVIEWER both status rules deleted: back to the groups: reviewer.test1 | PASS |  |
| S10b.APPROVER both status rules deleted: back to the groups: approver.test1 | PASS |  |
| S10b.HEAD both status rules deleted: back to the groups: reviewer.test2 | PASS |  |
| S10b.G1A both status rules deleted: back to the groups: coauthor.test2 | PASS |  |
| S10b.G1B both status rules deleted: back to the groups: trainee.test1 | PASS |  |
| S10b.G2A both status rules deleted: back to the groups: trainee.test2 | PASS |  |
| S10b.G2B both status rules deleted: back to the groups: trainer.test1 | PASS |  |

### S11: Who may manage the rules

| Check | Result | Detail |
|---|---|---|
| S11.1 an employee who is not the Head cannot make a rule for the Department (403) | PASS |  |
| S11.2 the Head of Quality Control cannot read or change the rules of Quality Assurance (403) | PASS |  |
| S11.3 an employee sees no Department to manage | PASS |  |

### S12: Scope of the Access Profiles (gate)

| Check | Result | Detail |
|---|---|---|
| S12.DCO profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: dco.test1 | PASS |  |
| S12.ADMIN profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: user.a.test | PASS |  |
| S12.AUTHOR profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: author.test1 | PASS |  |
| S12.COAUTHOR profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: coauthor.test1 | PASS |  |
| S12.REVIEWER profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: reviewer.test1 | PASS |  |
| S12.APPROVER profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: approver.test1 | PASS |  |
| S12.HEAD profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: reviewer.test2 | PASS |  |
| S12.G1A profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: coauthor.test2 | PASS |  |
| S12.G1B profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainee.test1 [FIRST A | **FAIL** | profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainee.test1 sees revisions/documents/controlled/uncontrolled = (1, 1, 0, 0); expected (0,0,0,0); lis |
| S12.G2A profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainee.test2 [FIRST A | **FAIL** | profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainee.test2 sees revisions/documents/controlled/uncontrolled = (1, 1, 0, 0); expected (0,0,0,0); lis |
| S12.G2B profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainer.test1 [FIRST A | **FAIL** | profile DV Document Viewer limited to Logistics: G1B, G2A, G2B are named but out of scope; G1A (another profile) is unaffected: trainer.test1 sees revisions/documents/controlled/uncontrolled = (1, 1, 0, 0); expected (0,0,0,0); lis |
| S12b.DCO scope removed: they see again: dco.test1 | PASS |  |
| S12b.ADMIN scope removed: they see again: user.a.test | PASS |  |
| S12b.AUTHOR scope removed: they see again: author.test1 | PASS |  |
| S12b.COAUTHOR scope removed: they see again: coauthor.test1 | PASS |  |
| S12b.REVIEWER scope removed: they see again: reviewer.test1 | PASS |  |
| S12b.APPROVER scope removed: they see again: approver.test1 | PASS |  |
| S12b.HEAD scope removed: they see again: reviewer.test2 | PASS |  |
| S12b.G1A scope removed: they see again: coauthor.test2 | PASS |  |
| S12b.G1B scope removed: they see again: trainee.test1 | PASS |  |
| S12b.G2A scope removed: they see again: trainee.test2 | PASS |  |
| S12b.G2B scope removed: they see again: trainer.test1 | PASS |  |

### S13: Revoking

| Check | Result | Detail |
|---|---|---|
| S13.1 the Head deletes the rule of group 1 | PASS |  |
| S13.DCO group 1 rule gone: dco.test1 | PASS |  |
| S13.ADMIN group 1 rule gone: user.a.test | PASS |  |
| S13.AUTHOR group 1 rule gone: author.test1 | PASS |  |
| S13.COAUTHOR group 1 rule gone: coauthor.test1 | PASS |  |
| S13.REVIEWER group 1 rule gone: reviewer.test1 | PASS |  |
| S13.APPROVER group 1 rule gone: approver.test1 | PASS |  |
| S13.HEAD group 1 rule gone: reviewer.test2 | PASS |  |
| S13.G1A group 1 rule gone: coauthor.test2 | PASS |  |
| S13.G1B group 1 rule gone: trainee.test1 | PASS |  |
| S13.G2A group 1 rule gone: trainee.test2 | PASS |  |
| S13.G2B group 1 rule gone: trainer.test1 | PASS |  |
| S13b.DCO the module permission of G2A withdrawn: dco.test1 | PASS |  |
| S13b.ADMIN the module permission of G2A withdrawn: user.a.test | PASS |  |
| S13b.AUTHOR the module permission of G2A withdrawn: author.test1 | PASS |  |
| S13b.COAUTHOR the module permission of G2A withdrawn: coauthor.test1 | PASS |  |
| S13b.REVIEWER the module permission of G2A withdrawn: reviewer.test1 | PASS |  |
| S13b.APPROVER the module permission of G2A withdrawn: approver.test1 | PASS |  |
| S13b.HEAD the module permission of G2A withdrawn: reviewer.test2 | PASS |  |
| S13b.G1A the module permission of G2A withdrawn: coauthor.test2 | PASS |  |
| S13b.G1B the module permission of G2A withdrawn: trainee.test1 | PASS |  |
| S13b.G2A the module permission of G2A withdrawn: trainee.test2 | PASS |  |
| S13b.G2B the module permission of G2A withdrawn: trainer.test1 | PASS |  |

### S12: Scope of the Access Profiles (gate)

| Check | Result | Detail |
|---|---|---|
| S12r.DCO all their profiles limited to Logistics: they are named but out of scope: dco.test1 | PASS |  |
| S12r.ADMIN all their profiles limited to Logistics: they are named but out of scope: user.a.test | PASS |  |
| S12r.AUTHOR all their profiles limited to Logistics: they are named but out of scope: author.test1 | PASS |  |
| S12r.COAUTHOR all their profiles limited to Logistics: they are named but out of scope: coauthor.test1 | PASS |  |
| S12r.REVIEWER all their profiles limited to Logistics: they are named but out of scope: reviewer.test1 | PASS |  |
| S12r.APPROVER all their profiles limited to Logistics: they are named but out of scope: approver.test1 | PASS |  |
| S12r.HEAD all their profiles limited to Logistics: they are named but out of scope: reviewer.test2 | PASS |  |
| S12r.G1A all their profiles limited to Logistics: they are named but out of scope: coauthor.test2 | PASS |  |
| S12r.G1B all their profiles limited to Logistics: they are named but out of scope: trainee.test1 | PASS |  |
| S12r.G2A all their profiles limited to Logistics: they are named but out of scope: trainee.test2 | PASS |  |
| S12r.G2B all their profiles limited to Logistics: they are named but out of scope: trainer.test1 | PASS |  |
| S12s.DCO limits removed: they see again: dco.test1 | PASS |  |
| S12s.ADMIN limits removed: they see again: user.a.test | PASS |  |
| S12s.AUTHOR limits removed: they see again: author.test1 | PASS |  |
| S12s.COAUTHOR limits removed: they see again: coauthor.test1 | PASS |  |
| S12s.REVIEWER limits removed: they see again: reviewer.test1 | PASS |  |
| S12s.APPROVER limits removed: they see again: approver.test1 | PASS |  |
| S12s.HEAD limits removed: they see again: reviewer.test2 | PASS |  |
| S12s.G1A limits removed: they see again: coauthor.test2 | PASS |  |
| S12s.G1B limits removed: they see again: trainee.test1 | PASS |  |
| S12s.G2A limits removed: they see again: trainee.test2 | PASS |  |
| S12s.G2B limits removed: they see again: trainer.test1 | PASS |  |

### S14: Upgrade: revision 2 (Draft)

| Check | Result | Detail |
|---|---|---|
| S14.1 the DCO upgrades the Effective revision of document A to a new revision | PASS |  |
| S14.2 revision 2 is a Draft | PASS |  |
| S14.DCO revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: dco.test1 | PASS |  |
| S14.ADMIN revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: user.a.test | PASS |  |
| S14.AUTHOR revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: author.test | PASS |  |
| S14.COAUTHOR revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: coauthor.te | PASS |  |
| S14.REVIEWER revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: reviewer.te | PASS |  |
| S14.APPROVER revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: approver.te | PASS |  |
| S14.HEAD revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: reviewer.te | PASS |  |
| S14.G1A revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: coauthor.te | PASS |  |
| S14.G1B revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: trainee.tes | PASS |  |
| S14.G2A revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: trainee.tes | PASS |  |
| S14.G2B revision 2 in Draft: the flow and the Head see it; group 1 sees both revisions of the SOP (rule: every SOP); group 2 sees the Instruction: trainer.tes | PASS |  |

### S15: Deny on Draft for one person

| Check | Result | Detail |
|---|---|---|
| S15.1 the Head creates a Deny rule on the status Draft | PASS |  |
| S15.DCO Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: dco.test1 | PASS |  |
| S15.ADMIN Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: user.a.test | PASS |  |
| S15.AUTHOR Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: author.test1 | PASS |  |
| S15.COAUTHOR Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: coauthor.test1 | PASS |  |
| S15.REVIEWER Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: reviewer.test1 | PASS |  |
| S15.APPROVER Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: approver.test1 | PASS |  |
| S15.HEAD Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: reviewer.test2 | PASS |  |
| S15.G1A Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: coauthor.test2 | PASS |  |
| S15.G1B Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: trainee.test1 | PASS |  |
| S15.G2A Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: trainee.test2 | PASS |  |
| S15.G2B Deny DRAFT for G1B: G1B keeps the document and revision 1, loses revision 2: trainer.test1 | PASS |  |
| S15.2 the Head deletes the Deny rule | PASS |  |

### S16: Revision 2 Effective

| Check | Result | Detail |
|---|---|---|
| S16.complete-editing revision 2: AUTHOR complete-editing | PASS |  |
| S16.submit-review revision 2: DCO submit-review | PASS |  |
| S16.review/complete revision 2: REVIEWER review/complete | PASS |  |
| S16.approve/complete revision 2: APPROVER approve/complete | PASS |  |
| S16.pub revision 2 is published (status Effective) | PASS |  |
| S16.obs revision 1 is no longer Effective (Obsolete) | PASS |  |
| S16.DCO revision 2 Effective, revision 1 Obsolete: nobody loses or gains: dco.test1 | PASS |  |
| S16.ADMIN revision 2 Effective, revision 1 Obsolete: nobody loses or gains: user.a.test | PASS |  |
| S16.AUTHOR revision 2 Effective, revision 1 Obsolete: nobody loses or gains: author.test1 | PASS |  |
| S16.COAUTHOR revision 2 Effective, revision 1 Obsolete: nobody loses or gains: coauthor.test1 | PASS |  |
| S16.REVIEWER revision 2 Effective, revision 1 Obsolete: nobody loses or gains: reviewer.test1 | PASS |  |
| S16.APPROVER revision 2 Effective, revision 1 Obsolete: nobody loses or gains: approver.test1 | PASS |  |
| S16.HEAD revision 2 Effective, revision 1 Obsolete: nobody loses or gains: reviewer.test2 | PASS |  |
| S16.G1A revision 2 Effective, revision 1 Obsolete: nobody loses or gains: coauthor.test2 | PASS |  |
| S16.G1B revision 2 Effective, revision 1 Obsolete: nobody loses or gains: trainee.test1 | PASS |  |
| S16.G2A revision 2 Effective, revision 1 Obsolete: nobody loses or gains: trainee.test2 | PASS |  |
| S16.G2B revision 2 Effective, revision 1 Obsolete: nobody loses or gains: trainer.test1 | PASS |  |

### S17: Controlled Copy

| Check | Result | Detail |
|---|---|---|
| S17.1 the DCO requests a Controlled Copy for G2B | PASS |  |
| S17.DCO Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.ADMIN Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.AUTHOR Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.COAUTHOR Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.REVIEWER Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.APPROVER Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.HEAD Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.G1A Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.G1B Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.G2A Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17.G2B Controlled Copy: view-all (DCO, ADMIN), the recipient G2B, and group 1 (SOP rule + module permission). The Head and G1A lack the base View permission  | PASS |  |
| S17b.DCO the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: dco.test1 | PASS |  |
| S17b.ADMIN the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: user.a.test | PASS |  |
| S17b.AUTHOR the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: author.test1 | PASS |  |
| S17b.COAUTHOR the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: coauthor.test1 | PASS |  |
| S17b.REVIEWER the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: reviewer.test1 | PASS |  |
| S17b.APPROVER the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: approver.test1 | PASS |  |
| S17b.HEAD the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: reviewer.test2 | PASS |  |
| S17b.G1A the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: coauthor.test2 | PASS |  |
| S17b.G1B the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: trainee.test1 | PASS |  |
| S17b.G2A the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: trainee.test2 | PASS |  |
| S17b.G2B the owner switched off "the recipient always sees the copy": G2B (not in the SOP rule) loses it: trainer.test1 | PASS |  |

### S18: Uncontrolled Copy

| Check | Result | Detail |
|---|---|---|
| S18.1 the DCO requests an Uncontrolled Copy for G2A | PASS |  |
| S18.DCO Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): dco.test1 | PASS |  |
| S18.ADMIN Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): user.a.test | PASS |  |
| S18.AUTHOR Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): author.test1 | PASS |  |
| S18.COAUTHOR Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): coauthor.test1 | PASS |  |
| S18.REVIEWER Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): reviewer.test1 | PASS |  |
| S18.APPROVER Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): approver.test1 | PASS |  |
| S18.HEAD Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): reviewer.test2 | PASS |  |
| S18.G1A Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): coauthor.test2 | PASS |  |
| S18.G1B Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): trainee.test1 | PASS |  |
| S18.G2A Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): trainee.test2 | PASS |  |
| S18.G2B Uncontrolled Copy: view-all, the recipient G2A, group 1 (SOP rule): trainer.test1 | PASS |  |

### S19: Conveniences switched off

| Check | Result | Detail |
|---|---|---|
| S19.DCO participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: dco.test1 | PASS |  |
| S19.ADMIN participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: user.a.test | PASS |  |
| S19.AUTHOR participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: author.test1 | PASS |  |
| S19.COAUTHOR participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: coauthor.test1 | PASS |  |
| S19.REVIEWER participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: reviewer.test1 | PASS |  |
| S19.APPROVER participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: approver.test1 | PASS |  |
| S19.HEAD participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: reviewer.test2 | PASS |  |
| S19.G1A participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: coauthor.test2 | PASS |  |
| S19.G1B participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: trainee.test1 | PASS |  |
| S19.G2A participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: trainee.test2 | PASS |  |
| S19.G2B participants lose the automatic right: only view-all (DCO, ADMIN), the Head and the rules remain: trainer.test1 | PASS |  |
| S19b.DCO the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: dco.test1 | PASS |  |
| S19b.ADMIN the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: user.a.test | PASS |  |
| S19b.AUTHOR the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: author.test1 | PASS |  |
| S19b.COAUTHOR the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: coauthor.test1 | PASS |  |
| S19b.REVIEWER the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: reviewer.test1 | PASS |  |
| S19b.APPROVER the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: approver.test1 | PASS |  |
| S19b.HEAD the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: reviewer.test2 | PASS |  |
| S19b.G1A the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: coauthor.test2 | PASS |  |
| S19b.G1B the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: trainee.test1 | PASS |  |
| S19b.G2A the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: trainee.test2 | PASS |  |
| S19b.G2B the Head convenience switched off: the Head of the Department sees only what the rules and a part in the flow give: trainer.test1 | PASS |  |

### S20: The two older modes

| Check | Result | Detail |
|---|---|---|
| S20a.DCO Participants only: the flow and view-all; the Head and the groups see nothing: dco.test1 | PASS |  |
| S20a.ADMIN Participants only: the flow and view-all; the Head and the groups see nothing: user.a.test | PASS |  |
| S20a.AUTHOR Participants only: the flow and view-all; the Head and the groups see nothing: author.test1 | PASS |  |
| S20a.COAUTHOR Participants only: the flow and view-all; the Head and the groups see nothing: coauthor.test1 | PASS |  |
| S20a.REVIEWER Participants only: the flow and view-all; the Head and the groups see nothing: reviewer.test1 | PASS |  |
| S20a.APPROVER Participants only: the flow and view-all; the Head and the groups see nothing: approver.test1 | PASS |  |
| S20a.HEAD Participants only: the flow and view-all; the Head and the groups see nothing: reviewer.test2 | PASS |  |
| S20a.G1A Participants only: the flow and view-all; the Head and the groups see nothing: coauthor.test2 | PASS |  |
| S20a.G1B Participants only: the flow and view-all; the Head and the groups see nothing: trainee.test1 | PASS |  |
| S20a.G2A Participants only: the flow and view-all; the Head and the groups see nothing: trainee.test2 | PASS |  |
| S20a.G2B Participants only: the flow and view-all; the Head and the groups see nothing: trainer.test1 | PASS |  |
| S20b.DCO Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): dco.test1 | PASS |  |
| S20b.ADMIN Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): user.a.test | PASS |  |
| S20b.AUTHOR Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): author.test1 | PASS |  |
| S20b.COAUTHOR Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): coauthor.test1 | PASS |  |
| S20b.REVIEWER Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): reviewer.test1 | PASS |  |
| S20b.APPROVER Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): approver.test1 | PASS |  |
| S20b.HEAD Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): reviewer.test2 | PASS |  |
| S20b.G1A Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): coauthor.test2 | PASS |  |
| S20b.G1B Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): trainee.test1 | PASS |  |
| S20b.G2A Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): trainee.test2 | PASS |  |
| S20b.G2B Everyone with the View permission: every holder of the View permission sees all documents (all eleven hold it now): trainer.test1 | PASS |  |

### S21: Knowledge Base

| Check | Result | Detail |
|---|---|---|
| S21.ADMIN Knowledge Base of user.a.test: SOP SOP.10413 listed, Instruction INS.0004 listed | PASS |  |
| S21.HEAD Knowledge Base of reviewer.test2: SOP SOP.10413 listed, Instruction INS.0004 listed | PASS |  |
| S21.AUTHOR Knowledge Base of author.test1: SOP SOP.10413 listed, Instruction INS.0004 listed | PASS |  |
| S21.G1A Knowledge Base of coauthor.test2: SOP SOP.10413 listed, Instruction INS.0004 absent | PASS |  |
| S21.G1B Knowledge Base of trainee.test1: SOP SOP.10413 listed, Instruction INS.0004 absent | PASS |  |
| S21.G2A Knowledge Base of trainee.test2: SOP SOP.10413 absent, Instruction INS.0004 listed | PASS |  |
| S21.G2B Knowledge Base of trainer.test1: SOP SOP.10413 absent, Instruction INS.0004 listed | PASS |  |

### S23: Many SOPs: no rule

| Check | Result | Detail |
|---|---|---|
| S23.1 the Head deletes the rule "every SOP" of group 1 | PASS |  |
| S23.DCO ten SOPs and one Instruction of the Department; group 1 has no rule: dco.test1 | PASS |  |
| S23.ADMIN ten SOPs and one Instruction of the Department; group 1 has no rule: user.a.test | PASS |  |
| S23.AUTHOR ten SOPs and one Instruction of the Department; group 1 has no rule: author.test1 | PASS |  |
| S23.COAUTHOR ten SOPs and one Instruction of the Department; group 1 has no rule: coauthor.test1 | PASS |  |
| S23.REVIEWER ten SOPs and one Instruction of the Department; group 1 has no rule: reviewer.test1 | PASS |  |
| S23.APPROVER ten SOPs and one Instruction of the Department; group 1 has no rule: approver.test1 | PASS |  |
| S23.HEAD ten SOPs and one Instruction of the Department; group 1 has no rule: reviewer.test2 | PASS |  |
| S23.G1A ten SOPs and one Instruction of the Department; group 1 has no rule: coauthor.test2 | PASS |  |
| S23.G1B ten SOPs and one Instruction of the Department; group 1 has no rule: trainee.test1 | PASS |  |
| S23.G2A ten SOPs and one Instruction of the Department; group 1 has no rule: trainee.test2 | PASS |  |
| S23.G2B ten SOPs and one Instruction of the Department; group 1 has no rule: trainer.test1 | PASS |  |

### S24: Many SOPs: A sees 2, B sees 3

| Check | Result | Detail |
|---|---|---|
| S24.1 the Head creates the two rules of specific documents | PASS |  |
| S24.DCO A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: dco.test1 | PASS |  |
| S24.ADMIN A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: user.a.test | PASS |  |
| S24.AUTHOR A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: author.test1 | PASS |  |
| S24.COAUTHOR A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: coauthor.test1 | PASS |  |
| S24.REVIEWER A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: reviewer.test1 | PASS |  |
| S24.APPROVER A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: approver.test1 | PASS |  |
| S24.HEAD A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: reviewer.test2 | PASS |  |
| S24.G1A A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: coauthor.test2 | PASS |  |
| S24.G1B A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: trainee.test1 | PASS |  |
| S24.G2A A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: trainee.test2 | PASS |  |
| S24.G2B A sees SOP 1+2 only, B sees SOP 3+4+5 only; the other SOPs stay closed to both: trainer.test1 | PASS |  |

### S25: Deny on one document

| Check | Result | Detail |
|---|---|---|
| S25.1 the Head creates a Deny rule for one document | PASS |  |
| S25.DCO B loses SOP 4 only: dco.test1 | PASS |  |
| S25.ADMIN B loses SOP 4 only: user.a.test | PASS |  |
| S25.AUTHOR B loses SOP 4 only: author.test1 | PASS |  |
| S25.COAUTHOR B loses SOP 4 only: coauthor.test1 | PASS |  |
| S25.REVIEWER B loses SOP 4 only: reviewer.test1 | PASS |  |
| S25.APPROVER B loses SOP 4 only: approver.test1 | PASS |  |
| S25.HEAD B loses SOP 4 only: reviewer.test2 | PASS |  |
| S25.G1A B loses SOP 4 only: coauthor.test2 | PASS |  |
| S25.G1B B loses SOP 4 only: trainee.test1 | PASS |  |
| S25.G2A B loses SOP 4 only: trainee.test2 | PASS |  |
| S25.G2B B loses SOP 4 only: trainer.test1 | PASS |  |
| S25.2 the Head deletes the Deny rule | PASS |  |

### S26: A new SOP does not widen the lists

| Check | Result | Detail |
|---|---|---|
| S26.DCO SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: dco.test1 | PASS |  |
| S26.ADMIN SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: user.a.test | PASS |  |
| S26.AUTHOR SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: author.test1 | PASS |  |
| S26.COAUTHOR SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: coauthor.test1 | PASS |  |
| S26.REVIEWER SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: reviewer.test1 | PASS |  |
| S26.APPROVER SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: approver.test1 | PASS |  |
| S26.HEAD SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: reviewer.test2 | PASS |  |
| S26.G1A SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: coauthor.test2 | PASS |  |
| S26.G1B SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: trainee.test1 | PASS |  |
| S26.G2A SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: trainee.test2 | PASS |  |
| S26.G2B SOP 7 is new: only the flow, the Head and view-all see it; A and B do not: trainer.test1 | PASS |  |

### S27: Server checks

| Check | Result | Detail |
|---|---|---|
| S27.1 a document of another Department cannot be named (400) | PASS |  |
| S27.2 more than 200 documents are refused (400) | PASS |  |
| S27.3 a rule of specific documents without a document is refused (400) | PASS |  |
| S27.4 an unknown document is refused (400) | PASS |  |

### S28: Document picker

| Check | Result | Detail |
|---|---|---|
| S28.1 a search by name finds the document of the Department | PASS |  |
| S28.2 a search without text returns at most the limit | PASS |  |
| S28.3 the character % is searched as text, not as a wildcard | PASS |  |
| S28.4 a user who is not the Head cannot search (403) | PASS |  |
| S28.5 every document found belongs to Quality Control | PASS |  |

### S29: Rule of a document covers its copies

| Check | Result | Detail |
|---|---|---|
| S29.1 the Head names document A (SOP of the run) for B | PASS |  |
| S29.DCO B also sees document A, its revisions and its two copies; the recipients still see their copy: dco.test1 | PASS |  |
| S29.ADMIN B also sees document A, its revisions and its two copies; the recipients still see their copy: user.a.test | PASS |  |
| S29.AUTHOR B also sees document A, its revisions and its two copies; the recipients still see their copy: author.test1 | PASS |  |
| S29.COAUTHOR B also sees document A, its revisions and its two copies; the recipients still see their copy: coauthor.test1 | PASS |  |
| S29.REVIEWER B also sees document A, its revisions and its two copies; the recipients still see their copy: reviewer.test1 | PASS |  |
| S29.APPROVER B also sees document A, its revisions and its two copies; the recipients still see their copy: approver.test1 | PASS |  |
| S29.HEAD B also sees document A, its revisions and its two copies; the recipients still see their copy: reviewer.test2 | PASS |  |
| S29.G1A B also sees document A, its revisions and its two copies; the recipients still see their copy: coauthor.test2 | PASS |  |
| S29.G1B B also sees document A, its revisions and its two copies; the recipients still see their copy: trainee.test1 | PASS |  |
| S29.G2A B also sees document A, its revisions and its two copies; the recipients still see their copy: trainee.test2 | PASS |  |
| S29.G2B B also sees document A, its revisions and its two copies; the recipients still see their copy: trainer.test1 | PASS |  |
| S29.2 the Head deletes the rule | PASS |  |

### S30: Clean-up

| Check | Result | Detail |
|---|---|---|
| S30 the Head deletes a rule of specific documents | PASS |  |
| S30z.DCO no rule of group 1 left: group 1 sees nothing again: dco.test1 | PASS |  |
| S30z.ADMIN no rule of group 1 left: group 1 sees nothing again: user.a.test | PASS |  |
| S30z.AUTHOR no rule of group 1 left: group 1 sees nothing again: author.test1 | PASS |  |
| S30z.COAUTHOR no rule of group 1 left: group 1 sees nothing again: coauthor.test1 | PASS |  |
| S30z.REVIEWER no rule of group 1 left: group 1 sees nothing again: reviewer.test1 | PASS |  |
| S30z.APPROVER no rule of group 1 left: group 1 sees nothing again: approver.test1 | PASS |  |
| S30z.HEAD no rule of group 1 left: group 1 sees nothing again: reviewer.test2 | PASS |  |
| S30z.G1A no rule of group 1 left: group 1 sees nothing again: coauthor.test2 | PASS |  |
| S30z.G1B no rule of group 1 left: group 1 sees nothing again: trainee.test1 | PASS |  |
| S30z.G2A no rule of group 1 left: group 1 sees nothing again: trainee.test2 | PASS |  |
| S30z.G2B no rule of group 1 left: group 1 sees nothing again: trainer.test1 | PASS |  |

## Pictures

**S1** S1: the DCO, who created the two documents, sees both in the Document list (as dco.test1)

![S1](shots/S1__DCO-documents.png)

**S1** S1: an employee with the View permission who is not in the flow and not named by the Head sees nothing (as coauthor.test2)

![S1](shots/S1__outsider-documents.png)

**S2** S2: the Author sees the two Draft revisions of the documents they write (as author.test1)

![S2](shots/S2__author-revisions-draft.png)

**S3** S3: the Reviewer sees the revision waiting for them in their task list (as reviewer.test1)

![S3](shots/S3__task-Pending-Review.png)

**S4** S4: the Approver sees the revision waiting for them in their task list (as approver.test1)

![S4](shots/S4__task-Pending-Approval.png)

**S5** S5: the administrator (view-all permission, no part in any flow) sees both documents (as user.a.test)

![S5](shots/S5__ADMIN-documents.png)

**S5** S5: the Department Head of Quality Control sees both documents of the Department (as reviewer.test2)

![S5](shots/S5__HEAD-documents.png)

**S7** S7: the Department Head lists the rules of Quality Control: group 1 for SOP, group 2 for Instruction (as reviewer.test2)

![S7](shots/S7__head-rules-screen.png)

**S7** S7: the Department Head lists the rules of Quality Control: group 2 for the Instruction, and (here) the rules of specific documents: A for SOP 1 and 2, B for SOP 3, 4 and 5, and a Deny for SOP 4 (as reviewer.test2)

![S7](shots/S7__head-rules-screen.png)

**S8** S8: a member of group 1 sees the SOP and not the Instruction (as coauthor.test2)

![S8](shots/S8__group1-documents.png)

**S8** S8: the revisions list of a group 1 member shows the SOP revision only (as trainee.test1)

![S8](shots/S8__group1-revisions.png)

**S8** S8: a member of group 2 sees the Instruction and not the SOP (as trainee.test2)

![S8](shots/S8__group2-documents.png)

**S11** S11: an employee who is not a Department Head opens the screen and finds nothing to manage (as coauthor.test2)

![S11](shots/S11__employee-no-department.png)

**S14** S14: the Author sees revision 2 (Draft) next to revision 1 (Effective) (as author.test1)

![S14](shots/S14__author-revisions-rev2.png)

**S14** S14: a member of group 1 sees the Draft revision 2 as well: the rule is for every SOP, whatever its status (as coauthor.test2)

![S14](shots/S14__group1-sees-draft.png)

**S15** S15: G1B (Deny on Draft) sees revision 1 only; the Draft revision 2 is hidden from this one person (as trainee.test1)

![S15](shots/S15__G1B-draft-hidden.png)

**S17** S17: G2A (group 2, not the recipient) does not see the SOP copy (as trainee.test2)

![S17](shots/S17__group2-no-copy.png)

**S17** S17: G2B, the recipient, sees the Controlled Copy although the SOP is not in the rule of group 2 (as trainer.test1)

![S17](shots/S17__recipient-controlled-copies.png)

**S18** S18: G1B sees the copy because the SOP rule of the Head covers the copies of the SOP (as trainee.test1)

![S18](shots/S18__group1-uncontrolled-copies.png)

**S18** S18: G2A, the recipient, sees the Uncontrolled Copy (as trainee.test2)

![S18](shots/S18__recipient-uncontrolled-copies.png)

**S20** S20: Document Properties > Record Visibility, with the three modes (as user.a.test)

![S20](shots/S20__document-properties-mode.png)

**S21** S21: the Knowledge Base of a group 1 member lists the SOP of Quality Control only (as coauthor.test2)

![S21](shots/S21__knowledge-group1.png)

**S21** S21: the Knowledge Base of a group 2 member lists the Instruction only (as trainee.test2)

![S21](shots/S21__knowledge-group2.png)

**S23** S23: with no rule, G1A sees none of the ten documents of Quality Control (as coauthor.test2)

![S23](shots/S23__G1A-no-rule.png)

**S23** S23: with no rule, G1A sees none of the ten documents of Quality Control (as coauthor.test2)

![S23](shots/S23__G1A-no-rule.png)

**S24** S24: A (G1A) sees 2 of the 10 documents of the Department (as coauthor.test2)

![S24](shots/S24__A-two-of-ten.png)

**S24** S24: B (G1B) sees 3 of the 10 documents of the Department (as trainee.test1)

![S24](shots/S24__B-three-of-ten.png)

**S29** S29: B sees the Controlled Copy of document A because the rule names that document (as trainee.test1)

![S29](shots/S29__B-copy-by-document-rule.png)

**S31** S31: the form of a rule with the target "Specific documents" (as reviewer.test2)

![S31](shots/S31__form-specific-documents.png)

**S31** S31: the picker lists the documents of Quality Control; a search runs on the server (as reviewer.test2)

![S31](shots/S31__picker-open.png)

## Findings during the run, and what was done

1. **Access Denied on the Head screen (found by the pictures, fixed).** The menu showed "Department Record Visibility" to the Head, but the page answered "Access Denied": the parent route guard of `/security` did not list the new permission. The API tests could not see this. Fixed in `SecurityRoutes.tsx`, rebuilt, the pictures were retaken.
2. **Scope of several profiles is a union (documented, kept).** S12 failed at first attempt: limiting the department scope of one profile did nothing for people who also hold a profile without a scope (a scope of one profile is lifted by another profile with no scope). This is the behaviour of the existing authorization, not of the new feature. The test was corrected (S12r limits every profile of the three people) and passes. If a stricter rule is wanted (intersection), it is a separate decision.
3. **"Specific documents" was missing (fixed).** The owner asked what happens when ten SOPs share one type. A rule target for named documents (up to 200 per rule, only documents of the Department, searched on the server, covers revisions and copies) was added and tested in S23-S29.
4. **The backend keeps user permissions in memory.** A permission set or profile changed straight in the database is not seen until the backend restarts; changes made through the application evict the cache. Only the test harness is affected.
5. **Test harness bugs fixed on the way** (a check helper argument, an interrupted first run that left rules behind, which were deleted through the Head API). They are not product defects.

## Not covered

- The administrator was played with `user.a.test` and direct database changes; the real administrator screens (assign Access Profile, Document Properties) were not driven for these steps, except that the Document Properties screen was photographed.
- Rules have no expiry date and Access Review does not list the visibility granted by the Heads yet (design proposal pending the owner's decision).
- Training Management does not exist yet; the design keeps room for it (training assignment as a source of read access).
- Documents that are Obsolete or Cancelled, Controlled Copy batches, legacy import and the search page were not exercised.
- Performance with thousands of documents was not measured.

## DEV state afterwards

Settings put back by `dv_restore.py`: Record Visibility mode, Department Head of Quality Control, the permission link, the temporary profile "DV Document Viewer" and the rules of the run. The documents, revisions and copies of the run stay in DEV.
