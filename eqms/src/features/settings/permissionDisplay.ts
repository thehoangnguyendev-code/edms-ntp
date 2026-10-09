import {
  findPermissionDescriptor,
  type PermissionDescriptor as PermissionDisplayDescriptor,
} from "./permissionCatalog";

export interface ProfilePermissionDescriptor {
  id: string;
  label: string;
  description: string;
  codes: string[];
}

// Legacy-code label fallback for findPermissionDescriptor below: a handful of legacy permission
// codes (for example PRINT_CONTROLLED_COPY) aren't listed in any current catalog entry's
// legacyCodes, so getPermissionDisplayDescriptor falls back to this list for their label.
export const PROFILE_PERMISSION_ITEMS: ProfilePermissionDescriptor[] = [
  {
    id: 'perm-print',
    codes: ['REQUEST_CONTROLLED_COPY', 'PRINT_CONTROLLED_COPY'],
    label: 'Request Controlled Copy',
    description: 'Request or print controlled document copies',
  },
  {
    id: 'perm-training',
    codes: ['MANAGE_TRAINING_PLAN'],
    label: 'Manage Training Plan',
    description: 'Manage training plan and distribution details',
  },
  {
    id: 'perm-users',
    codes: ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS'],
    label: 'Manage Users',
    description: 'Create, edit, and manage user accounts and roles',
  },
  {
    id: 'perm-approve',
    codes: ['APPROVE_REVISION'],
    label: 'Approve Revision',
    description: 'Final approval authority for document workflows',
  },
];

export const getPermissionDisplayDescriptor = (code: string): PermissionDisplayDescriptor | null => {
  const catalogDescriptor = findPermissionDescriptor(code);
  if (catalogDescriptor) {
    return catalogDescriptor;
  }
  const profileItem = PROFILE_PERMISSION_ITEMS.find((item) => item.codes.includes(code));
  return profileItem
    ? {
        code,
        label: profileItem.label,
        description: profileItem.description,
        module: "system-admin",
        group: "legacy_profile_permissions",
      }
    : null;
};

export const normalizePermissionDescriptor = (
  code: string,
  fallbackLabel: string,
  fallbackDescription: string
): PermissionDisplayDescriptor => {
  return getPermissionDisplayDescriptor(code) ?? {
    code,
    label: fallbackLabel,
    description: fallbackDescription,
    module: "Unknown",
    group: "Unknown",
  };
};
