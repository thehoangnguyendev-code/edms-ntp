import type { SelectOption } from "@/components/ui/select/Select";

export type CourseAuditEntry = {
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

export const COURSE_AUDIT_MOCK_DATA: CourseAuditEntry[] = [
  {
    id: "AUD-CRS-2026-001",
    timestamp: "2026-05-10 09:15:22",
    user: {
      id: "USR-001",
      fullName: "Robert Johnson",
      employeeCode: "EMP-001",
      role: "Admin",
      position: "Director",
      department: "Quality Assurance",
    },
    action: "Approved Course",
    actionType: "approve",
    reason: "Course content matches all regulatory requirements.",
    ipAddress: "192.168.1.105",
    device: "Windows 11 Pro - Chrome 124",
  },
  {
    id: "AUD-CRS-2026-002",
    timestamp: "2026-05-09 14:20:15",
    user: {
      id: "USR-005",
      fullName: "Jane Smith",
      employeeCode: "EMP-005",
      role: "QA",
      position: "QA Manager",
      department: "Quality Assurance",
    },
    action: "Reviewed Course",
    actionType: "review",
    changes: [
      {
        field: "Assessment Passing Score",
        oldValue: "70",
        newValue: "80",
      },
    ],
    reason: "Increasing passing score for better competency validation.",
    ipAddress: "192.168.1.103",
    device: "Windows 10 - Firefox 125",
  },
  {
    id: "AUD-CRS-2026-003",
    timestamp: "2026-05-08 11:30:45",
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
    device: "Windows 11 - Edge 124",
  },
  {
    id: "AUD-CRS-2026-004",
    timestamp: "2026-05-08 10:15:33",
    user: {
      id: "USR-012",
      fullName: "John Doe",
      employeeCode: "EMP-012",
      role: "User",
      position: "Document Author",
      department: "Quality Control",
    },
    action: "Created Draft",
    actionType: "create",
    ipAddress: "192.168.1.102",
    device: "Windows 11 - Edge 124",
  },
];

export const COURSE_AUDIT_ACTION_OPTIONS: SelectOption[] = [
  { value: "all", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "edit", label: "Edit" },
  { value: "review", label: "Review" },
  { value: "approve", label: "Approve" },
  { value: "reject", label: "Reject" },
];
