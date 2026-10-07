import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Delegated views are checked at their filter-owning tab rather than the page wrapper.
const screens = [
  "src/features/audit-trail/AuditTrailView.tsx",
  "src/features/settings/email-templates/EmailTemplatesView.tsx",
  "src/features/settings/education/EducationSchoolsView.tsx",
  "src/features/settings/education/EducationDegreeLevelsView.tsx",
  "src/features/settings/document-administration/KnowledgeComponentsView.tsx",
  "src/features/settings/document-administration/KnowledgeCategoriesView.tsx",
  "src/features/settings/dictionaries/tabs/StorageLocationsTab.tsx",
  "src/features/settings/dictionaries/tabs/RetentionPoliciesTab.tsx",
  "src/features/settings/dictionaries/tabs/PositionsTab.tsx",
  "src/features/settings/dictionaries/tabs/DepartmentsTab.tsx",
  "src/features/settings/dictionaries/tabs/BusinessUnitsTab.tsx",
  "src/features/security-authorization/access-review/AccessReviewView.tsx",
  "src/features/security-authorization/object-rules/ObjectAccessRulesView.tsx",
  "src/features/security-authorization/access-profiles/views/AccessProfileListView.tsx",
  "src/features/security-authorization/lifecycle-policies/views/WorkflowRolesView.tsx",
  "src/features/security-authorization/lifecycle-policies/views/StateCapabilitiesView.tsx",
  "src/features/security-authorization/lifecycle-policies/views/RelationDefinitionsTab.tsx",
  "src/features/security-authorization/user-management/time-limited/views/LoggedInUsersView.tsx",
  "src/features/security-authorization/user-management/time-limited/views/TimeLimitedUserListView.tsx",
  "src/features/security-authorization/sod/SegregationOfDutiesView.tsx",
  "src/features/security-authorization/user-management/profile/views/UserManagementView.tsx",
  "src/features/security-authorization/lifecycle-policies/views/WorkflowTransitionsView.tsx",
  "src/features/settings/dictionaries/tabs/DocumentTypesTab.tsx",
  "src/features/settings/dictionaries/tabs/SubTypesTab.tsx",
  "src/features/settings/document-administration/DocumentNameFormatsTab.tsx",
  "src/features/security-authorization/lifecycle-policies/components/ActionStatusMatrix.tsx",
  "src/features/notifications/NotificationsView.tsx",
];

describe("Requested screen compact filter coverage", () => {
  it.each(screens)("%s uses the shared desktop filter UI", (path) => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    expect(source).toMatch(
      /<(ConfiguredDesktopFilters|DesktopSelectFilters)\b/,
    );
    expect(source).toContain("Search");
  });
});
