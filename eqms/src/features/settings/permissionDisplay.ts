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

export interface ProfilePermissionState {
  printControlledCopy: boolean;
  viewAuditTrail: boolean;
  createTrainingTest: boolean;
  manageUsers: boolean;
  approveDocuments: boolean;
}

export const PROFILE_PERMISSION_ITEMS: Array<ProfilePermissionDescriptor & { stateKey: keyof ProfilePermissionState }> = [
  {
    id: 'perm-print',
    stateKey: 'printControlledCopy',
    codes: ['REQUEST_CONTROLLED_COPY', 'PRINT_CONTROLLED_COPY'],
    label: 'Request Controlled Copy',
    description: 'Request or print controlled document copies',
  },
  {
    id: 'perm-audit',
    stateKey: 'viewAuditTrail',
    codes: ['VIEW_DOCUMENT_AUDIT_TRAIL'],
    label: 'View Document Audit Trail',
    description: 'Access to the document and revision audit trail',
  },
  {
    id: 'perm-training',
    stateKey: 'createTrainingTest',
    codes: ['MANAGE_TRAINING_PLAN'],
    label: 'Manage Training Plan',
    description: 'Manage training plan and distribution details',
  },
  {
    id: 'perm-users',
    stateKey: 'manageUsers',
    codes: ['VIEW_USERS', 'CREATE_USERS', 'EDIT_USERS'],
    label: 'Manage Users',
    description: 'Create, edit, and manage user accounts and roles',
  },
  {
    id: 'perm-approve',
    stateKey: 'approveDocuments',
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

export const resolveProfilePermissionState = (permissionCodes: string[]): ProfilePermissionState => {
  const hasCode = (codes: string[]) => codes.some((code) => permissionCodes.includes(code));

  return PROFILE_PERMISSION_ITEMS.reduce((state, item) => {
    state[item.stateKey] = hasCode(item.codes);
    return state;
  }, {
    printControlledCopy: false,
    viewAuditTrail: false,
    createTrainingTest: false,
    manageUsers: false,
    approveDocuments: false,
  } as ProfilePermissionState);
};
