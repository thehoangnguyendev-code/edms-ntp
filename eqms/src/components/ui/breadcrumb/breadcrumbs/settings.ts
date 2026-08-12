import type { BreadcrumbItem } from "../Breadcrumb";
import { dashboard } from "./shared";
import { ROUTES } from "@/app/routes.constants";

type NavigateFn = (path: string) => void;

// --- Helpers ---

/** Base breadcrumb path for System Administration module */
const systemAdminBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "System Administration" },
];

/** Base breadcrumb path for Application Settings module */
const appSettingsBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Application Settings" },
];

/** Base breadcrumb path for Security & Authorization module */
const securityAuthorizationBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "Security & Authorization" },
];

/** Base breadcrumb path for Advanced security screens */
const securityAdvancedBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Advanced" },
];

/** Access Profiles is the primary screen for access administration. */
const rolesPermissionsBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Access Profiles", onClick: () => navigate?.(ROUTES.SECURITY.ACCESS_PROFILES) },
];

export const securityAuthorization = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Security & Authorization", isActive: true },
];

const documentControlBase = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Document Control" },
];

// --- Exported Breadcrumb Builders ---

export const userManagement = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "User Management", isActive: true },
];

export const addUser = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "User Management", onClick: () => navigate?.(ROUTES.SECURITY.USERS) },
  { label: "Add User", isActive: true },
];

export const editUser = (
  navigate?: NavigateFn,
  employeeId?: string
): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "User Management", onClick: () => navigate?.(ROUTES.SECURITY.USERS) },
  { label: employeeId || "Edit User", isActive: true },
];

export const userProfile = (
  navigate?: NavigateFn,
  _fullName?: string
): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "User Management", onClick: () => navigate?.(ROUTES.SECURITY.USERS) },
  { label: "User Profile", isActive: true },
];

export const rolePermissions = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Access Profiles", isActive: true },
];

export const accessProfiles = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Access Profiles", isActive: true },
];

export const accessProfileDetail = (
  navigate?: NavigateFn,
  mode?: "new" | "edit" | "view",
  profileName?: string
): BreadcrumbItem[] => {
  const labels: Record<string, string> = {
    new: "New Access Profile",
    edit: "Edit Access Profile",
    view: "Access Profile Details",
  };
  void profileName;
  return [
    ...rolesPermissionsBase(navigate),
    { label: labels[mode || "view"], isActive: true },
  ];
};

export const documentAdministration = (
  navigate?: NavigateFn,
  activeTabLabel?: string
): BreadcrumbItem[] => {
  const base: BreadcrumbItem[] = [
    ...securityAuthorizationBase(navigate),
    { label: "Workflow Authorization" },
  ];

  if (activeTabLabel) {
    return [
      ...base,
      { label: activeTabLabel, isActive: true },
    ];
  }

  return [
    ...base,
    { label: "Document Administration", isActive: true },
  ];
};

export const systemInformation = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...systemAdminBase(navigate),
  { label: "System Information", isActive: true },
];

export const roleDetail = (
  navigate?: NavigateFn,
  mode?: "new" | "edit" | "view",
  roleName?: string
): BreadcrumbItem[] => {
  const labels: Record<string, string> = {
    new: "New Access Profile",
    edit: "Edit Access Profile",
    view: "Access Profile Details",
  };
  return [
    ...rolesPermissionsBase(navigate),
    { label: labels[mode || "view"] || roleName || "Access Profile Details", isActive: true },
  ];
};

export const dictionaries = (
  navigate?: NavigateFn,
  activeTabLabel?: string
): BreadcrumbItem[] => {
  if (activeTabLabel) {
    return [
      ...appSettingsBase(navigate),
      { label: "Dictionaries", onClick: () => navigate?.(ROUTES.SETTINGS.DICTIONARIES) },
      { label: activeTabLabel, isActive: true },
    ];
  }
  return [
    ...appSettingsBase(navigate),
    { label: "Dictionaries", isActive: true },
  ];
};

export const configuration = (
  navigate?: NavigateFn,
  activeTabLabel?: string
): BreadcrumbItem[] => {
  if (activeTabLabel) {
    return [
      ...systemAdminBase(navigate),
      { label: "Configuration", onClick: () => navigate?.(ROUTES.SETTINGS.CONFIGURATION) },
      { label: activeTabLabel, isActive: true },
    ];
  }
  return [
    ...systemAdminBase(navigate),
    { label: "Configuration", isActive: true },
  ];
};


export const emailTemplates = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Email Templates", isActive: true },
];

export const emailTemplateCreate = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Email Templates", onClick: () => navigate?.(ROUTES.SETTINGS.EMAIL_TEMPLATES) },
  { label: "Create Template", isActive: true },
];

export const emailTemplateEdit = (
  navigate?: NavigateFn,
  templateName?: string
): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Email Templates", onClick: () => navigate?.(ROUTES.SETTINGS.EMAIL_TEMPLATES) },
  { label: templateName || "Edit Template", isActive: true },
];

export const preferences = (
  navigate?: NavigateFn,
  activeTabLabel?: string
): BreadcrumbItem[] => {
  if (activeTabLabel) {
    return [
      dashboard(navigate),
      { label: "Preferences" },
      { label: activeTabLabel, isActive: true },
    ];
  }
  return [
    dashboard(navigate),
    { label: "Preferences", isActive: true },
  ];
};

export const myProfile = (navigate?: NavigateFn): BreadcrumbItem[] => [
  dashboard(navigate),
  { label: "My Profile", isActive: true },
];

export const publishingTemplates = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...documentControlBase(navigate),
  { label: "Publishing Templates", isActive: true },
];

export const publishingTemplateCreate = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...documentControlBase(navigate),
  { label: "Publishing Templates", onClick: () => navigate?.(ROUTES.SETTINGS.PUBLISHING_TEMPLATES) },
  { label: "New Publishing Template", isActive: true },
];

export const publishingTemplateEdit = (
  navigate?: NavigateFn,
  templateName?: string,
): BreadcrumbItem[] => [
  ...documentControlBase(navigate),
  { label: "Publishing Templates", onClick: () => navigate?.(ROUTES.SETTINGS.PUBLISHING_TEMPLATES) },
  { label: templateName || "Edit Publishing Template", isActive: true },
];

export const controlledCopiesPolicy = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...documentControlBase(navigate),
  { label: "Controlled Copies Policy", isActive: true },
];

export const electronicSignatureSettings = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "E-Sign Config", isActive: true },
];

export const notificationPolicy = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Notification In-app", isActive: true },
];

export const notificationPolicyDetail = (navigate?: NavigateFn, eventName?: string): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Notification In-app", onClick: () => navigate?.(ROUTES.SETTINGS.NOTIFICATION_POLICY) },
  { label: eventName || "Event Detail", isActive: true },
];

export const notificationPolicyEdit = (navigate?: NavigateFn, eventName?: string, eventCode?: string): BreadcrumbItem[] => [
  ...appSettingsBase(navigate),
  { label: "Notification In-app", onClick: () => navigate?.(ROUTES.SETTINGS.NOTIFICATION_POLICY) },
  {
    label: eventName || "Event Detail",
    onClick: eventCode ? () => navigate?.(`${ROUTES.SETTINGS.NOTIFICATION_POLICY}/${eventCode}`) : undefined,
  },
  { label: "Edit Notification In-app", isActive: true },
];

export const permissionSets = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAdvancedBase(navigate),
  { label: "Shared Permission Sets", isActive: true },
];

/** Detail screen for a shared permission set. Keep its terminal label aligned with PageHeader. */
export const permissionSetDetail = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAdvancedBase(navigate),
  { label: "Shared Permission Sets", onClick: () => navigate?.(ROUTES.SECURITY.PERMISSION_SETS) },
  { label: "Shared Permission Set Details", isActive: true },
];

export const workflowRoleCatalog = (navigate?: NavigateFn): BreadcrumbItem[] => [
  ...securityAdvancedBase(navigate),
  { label: "Workflow Role Catalog", isActive: true },
];

export const workflowAuthorization = (navigate?: NavigateFn, activeTabLabel?: string): BreadcrumbItem[] =>
  activeTabLabel
    ? [
        ...securityAuthorizationBase(navigate),
        { label: "Workflow Authorization", onClick: () => navigate?.(ROUTES.SECURITY.WORKFLOW_AUTHORIZATION) },
        { label: activeTabLabel, isActive: true },
      ]
    : [
        ...securityAuthorizationBase(navigate),
        { label: "Workflow Authorization", isActive: true },
      ];

export const authorizationDiagnostics = (navigate?: NavigateFn, activeTabLabel?: string): BreadcrumbItem[] =>
  activeTabLabel
    ? [
        ...securityAuthorizationBase(navigate),
        { label: "Engine Diagnostics", onClick: () => navigate?.(ROUTES.SECURITY.AUTHORIZATION_DIAGNOSTICS) },
        { label: activeTabLabel, isActive: true },
      ]
    : [
        ...securityAuthorizationBase(navigate),
        { label: "Engine Diagnostics", isActive: true },
      ];

/**
 * Breadcrumb for screens nested below a Workflow Authorization tab.
 */
export const lifecyclePoliciesSubPage = (
  navigate: NavigateFn | undefined,
  tab: "Transitions" | "Capabilities",
  leafLabel: string,
): BreadcrumbItem[] => [
  ...securityAuthorizationBase(navigate),
  { label: "Workflow Authorization", onClick: () => navigate?.(ROUTES.SECURITY.WORKFLOW_AUTHORIZATION) },
  {
    label: tab,
    onClick: () =>
      navigate?.(
        tab === "Capabilities"
          ? `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}?tab=capabilities`
          : `${ROUTES.SECURITY.WORKFLOW_AUTHORIZATION}?tab=transitions`,
      ),
  },
  { label: leafLabel, isActive: true },
];

export const objectAccessRules = (navigate?: NavigateFn, activeTabLabel?: string): BreadcrumbItem[] =>
  activeTabLabel
    ? [
        ...securityAdvancedBase(navigate),
        { label: "Object Access Rules", onClick: () => navigate?.(ROUTES.SECURITY.OBJECT_RULES) },
        { label: activeTabLabel, isActive: true },
      ]
    : [
        ...securityAdvancedBase(navigate),
        { label: "Object Access Rules", isActive: true },
      ];

export const segregationOfDuties = (navigate?: NavigateFn, activeTabLabel?: string): BreadcrumbItem[] =>
  activeTabLabel
    ? [
        ...securityAuthorizationBase(navigate),
        { label: "Governance Rules", onClick: () => navigate?.(ROUTES.SECURITY.SOD) },
        { label: activeTabLabel, isActive: true },
      ]
    : [
        ...securityAuthorizationBase(navigate),
        { label: "Governance Rules", isActive: true },
      ];

export const accessReview = (navigate?: NavigateFn, campaignName?: string): BreadcrumbItem[] =>
  campaignName
    ? [
        ...securityAuthorizationBase(navigate),
        { label: "Access Review", onClick: () => navigate?.(ROUTES.SECURITY.ACCESS_REVIEW) },
        { label: campaignName, isActive: true },
      ]
    : [
        ...securityAuthorizationBase(navigate),
        { label: "Access Review", isActive: true },
      ];
