import { User, DocumentSummary } from '@/types';

// ─── Cell Status (color logic) ───────────────────────────────────────
export type CellStatus =
  | "NotRequired"     // Gray   ⚪ — Không thuộc diện phải học
  | "Required"        // Red    ❌ — Thuộc diện phải học nhưng chưa Assign/chưa có điểm
  | "InProgress"      // Yellow ⏳ — Đã tạo Assignment nhưng chưa nhập điểm
  | "Qualified";      // Green  ✅ — Đã có điểm đạt/vượt qua

// ─── SOP / Training Material Column ─────────────────────────────────
export interface SOPColumn extends Omit<DocumentSummary, "documentName"> {
  category: string;   // e.g. "GMP", "Safety", "Technical"
  materialId: string;
  materialNumber: string;
  materialName: string;
  documentName?: string;
  title?: string;
  version?: string;
}

// ─── Employee Row ────────────────────────────────────────────────────
export interface EmployeeRow extends Pick<User, 'id' | 'fullName' | 'employeeCode' | 'email' | 'department' | 'position'> {
  businessUnit?: string;
  hireDate: string;
}

// ─── Training Cell (intersection of Employee × SOP) ─────────────────
export interface TrainingCell {
  employeeId: string;
  sopId: string;
  status: CellStatus;
  lastTrainedDate: string | null;
  expiryDate: string | null;
  score: number | null;       // 0-100 or null
  attempts: number;
}

// ─── KPI Summary ─────────────────────────────────────────────────────
export interface MatrixKPI {
  complianceRate: number;     // 0-100%
  totalOverdue: number;
  expiringSoon: number;
  daysUntilNextAudit: number;
}

// ─── Filter state ────────────────────────────────────────────────────
export interface MatrixFilters {
  searchQuery: string;
  department: string;
  position: string;
  status: CellStatus | "All";
  gapAnalysis: boolean;       // hide "Qualified" cells
}
