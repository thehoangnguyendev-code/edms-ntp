import type { SelectOption } from "@/components/ui/select/Select";

export type MaterialSelectableUser = {
  id: string;
  employeeCode: string;
  fullName: string;
  username: string;
  position: string;
  department: string;
  email: string;
};

export type MaterialMockReviewer = {
  id: string;
  fullName: string;
  username: string;
  position: string;
  email: string;
  department: string;
  order: number;
};

export type MaterialMockApprover = {
  id: string;
  fullName: string;
  username: string;
  position: string;
  email: string;
  department: string;
};

export type MaterialAuditEntry = {
  id: string;
  timestamp: string;
  user: {
    id: string;
    fullName: string;
    employeeCode: string;
    role: string;
    position: string;
    department: string;
  };
  action: string;
  actionType: string;
  changes?: Array<{
    field: string;
    oldValue: string;
    newValue: string;
  }>;
  reason?: string;
  ipAddress: string;
  device: string;
};

export const MATERIAL_TAB_MOCK_USERS: MaterialSelectableUser[] = [
  {
    id: "USR-001",
    employeeCode: "EMP-001",
    fullName: "Robert Johnson",
    username: "robert.johnson",
    position: "Director",
    department: "Quality Assurance",
    email: "robert.johnson@eqms.local",
  },
  {
    id: "USR-005",
    employeeCode: "EMP-005",
    fullName: "Jane Smith",
    username: "jane.smith",
    position: "QA Manager",
    department: "Quality Assurance",
    email: "jane.smith@eqms.local",
  },
  {
    id: "USR-012",
    employeeCode: "EMP-012",
    fullName: "John Doe",
    username: "john.doe",
    position: "Document Author",
    department: "Quality Control",
    email: "john.doe@eqms.local",
  },
  {
    id: "USR-024",
    employeeCode: "EMP-024",
    fullName: "Sarah Williams",
    username: "sarah.williams",
    position: "QA Specialist",
    department: "Quality Assurance",
    email: "sarah.williams@eqms.local",
  },
  {
    id: "USR-042",
    employeeCode: "EMP-042",
    fullName: "Alice Brown",
    username: "alice.brown",
    position: "Training Coordinator",
    department: "Human Resources",
    email: "alice.brown@eqms.local",
  },
];

export const MATERIAL_TAB_MOCK_REVIEWERS: MaterialMockReviewer[] = [
  {
    id: "USR-005",
    fullName: "Jane Smith",
    username: "jane.smith",
    position: "QA Manager",
    email: "jane.smith@eqms.local",
    department: "Quality Assurance",
    order: 1,
  },
  {
    id: "USR-024",
    fullName: "Sarah Williams",
    username: "sarah.williams",
    position: "QA Specialist",
    email: "sarah.williams@eqms.local",
    department: "Quality Assurance",
    order: 2,
  },
];

export const MATERIAL_TAB_MOCK_APPROVERS: MaterialMockApprover[] = [
  {
    id: "USR-001",
    fullName: "Robert Johnson",
    username: "robert.johnson",
    position: "Director",
    email: "robert.johnson@eqms.local",
    department: "Quality Assurance",
  },
];

export const MATERIAL_TAB_AUDIT_MOCK_DATA: MaterialAuditEntry[] = [
  {
    id: "AUD-2025-001",
    timestamp: "2025-12-27 14:30:05",
    user: {
      id: "USR-001",
      fullName: "Robert Johnson",
      employeeCode: "EMP-001",
      role: "Admin",
      position: "Director",
      department: "Quality Assurance",
    },
    action: "Approved Document",
    actionType: "approve",
    reason: "Document meets all GMP requirements and is ready for implementation",
    ipAddress: "192.168.1.105",
    device: "Windows 11 Pro - Chrome 120",
  },
  {
    id: "AUD-2025-002",
    timestamp: "2025-12-26 16:45:22",
    user: {
      id: "USR-005",
      fullName: "Jane Smith",
      employeeCode: "EMP-005",
      role: "QA",
      position: "QA Manager",
      department: "Quality Assurance",
    },
    action: "Reviewed Document",
    actionType: "review",
    changes: [
      {
        field: "Section 4.2",
        oldValue: "Process must be validated",
        newValue: "Process must be validated and documented",
      },
      {
        field: "Effective Date",
        oldValue: "2025-12-20",
        newValue: "2025-12-27",
      },
    ],
    reason: "Added clarification on documentation requirements",
    ipAddress: "192.168.1.103",
    device: "Windows 10 - Firefox 121",
  },
  {
    id: "AUD-2025-003",
    timestamp: "2025-12-25 10:15:33",
    user: {
      id: "USR-012",
      fullName: "John Doe",
      employeeCode: "EMP-012",
      role: "User",
      position: "Document Author",
      department: "Quality Control",
    },
    action: "Submitted for Review",
    actionType: "review",
    ipAddress: "192.168.1.102",
    device: "Windows 11 - Edge 120",
  },
  {
    id: "AUD-2025-004",
    timestamp: "2025-12-24 09:20:15",
    user: {
      id: "USR-012",
      fullName: "John Doe",
      employeeCode: "EMP-012",
      role: "User",
      position: "Document Author",
      department: "Quality Control",
    },
    action: "Edited Draft",
    actionType: "edit",
    changes: [
      {
        field: "Purpose",
        oldValue: "To establish procedure for...",
        newValue: "To establish comprehensive procedure for...",
      },
    ],
    reason: "Improved clarity of document purpose",
    ipAddress: "192.168.1.102",
    device: "Windows 11 - Edge 120",
  },
];

export const MATERIAL_TAB_AUDIT_ACTION_OPTIONS: SelectOption[] = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "edit", label: "Edit" },
  { value: "review", label: "Review" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
  { value: "download", label: "Download" },
  { value: "print", label: "Print" },
];
