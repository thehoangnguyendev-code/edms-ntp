---
trigger: always_on
---

# 🏛️ Compliance Rules — ALCOA+ & 21 CFR Part 11

> **MANDATORY:** Mọi mã nguồn và giải pháp kỹ thuật được tạo ra PHẢI tuân thủ tuyệt đối nguyên tắc **ALCOA+** (Attributable, Legible, Contemporaneous, Original, Accurate) và tiêu chuẩn **21 CFR Part 11**.

---

## 1. Quy tắc Data Integrity (Tính toàn vẹn dữ liệu)

### 1.1 Audit Trail

Mọi thao tác **CRUD** (Create, Read, Update, Delete) trên dữ liệu nhạy cảm phải được ghi log tự động.

**Log bắt buộc phải bao gồm:**

| Trường       | Mô tả                                      | Ví dụ                          |
| ------------ | ------------------------------------------- | ------------------------------ |
| **Who**      | Người thực hiện (user ID + tên)             | `USR-001 / Nguyen Van An`      |
| **When**     | Thời điểm chính xác (UTC timestamp)         | `2026-04-24T03:14:00.000Z`     |
| **What**     | Hành động cụ thể                            | `UPDATE document status`       |
| **Why**      | Lý do thay đổi (bắt buộc khi sửa/xóa)     | `Correction of typo in title`  |
| **Old Value** | Giá trị trước khi thay đổi                 | `Draft`                        |
| **New Value** | Giá trị sau khi thay đổi                   | `Under Review`                 |

**Quy tắc thực thi:**
- Audit trail phải được ghi **tự động** tại tầng service/repository, không phụ thuộc vào frontend.
- Audit trail **không được phép sửa hoặc xóa** (immutable, append-only).
- Phải hỗ trợ truy vấn audit trail theo: thời gian, người dùng, loại hành động, đối tượng bị tác động.

### 1.2 No Hard Deletes (Cấm xóa vật lý)

> 🔴 **TUYỆT ĐỐI KHÔNG** sử dụng lệnh xóa vật lý (`DELETE FROM`) trên bất kỳ bảng dữ liệu nào chứa thông tin nghiệp vụ.

**Bắt buộc sử dụng Soft Delete:**

```typescript
// ❌ KHÔNG BAO GIỜ
await db.document.delete({ where: { id } });

// ✅ LUÔN LUÔN
await db.document.update({
  where: { id },
  data: {
    is_deleted: true,
    deleted_by: currentUserId,
    deleted_at: new Date(),
    deletion_reason: reason, // Bắt buộc ghi lý do
  },
});
```

**Lý do:** Bảo toàn dữ liệu lịch sử cho mục đích thanh tra (audit). Dữ liệu đã soft-delete phải vẫn truy xuất được khi cần thiết.

### 1.3 Data Attribution (Truy nguồn dữ liệu)

Mỗi bản ghi trong cơ sở dữ liệu **bắt buộc** phải có các cột sau:

```typescript
interface BaseEntity {
  id: string;           // UUID, primary key
  created_by: string;   // ID người tạo
  created_at: Date;     // Thời điểm tạo (UTC)
  updated_by: string;   // ID người cập nhật cuối
  updated_at: Date;     // Thời điểm cập nhật cuối (UTC)
  is_deleted: boolean;  // Soft delete flag (default: false)
  deleted_by?: string;  // ID người xóa (nếu có)
  deleted_at?: Date;    // Thời điểm xóa (nếu có)
}
```

**Quy tắc:**
- `created_at` và `updated_at` phải được ghi tự động bởi hệ thống, **không** do client gửi lên.
- `created_by` và `updated_by` phải lấy từ session/token đã xác thực, **không** từ input của người dùng.
- Mọi bảng mới tạo phải kế thừa (extend) `BaseEntity`.

### 1.4 Validation (Xác thực dữ liệu đầu vào)

Mọi dữ liệu đầu vào **phải** được xác thực bằng Schema Validation để đảm bảo tính chính xác (Accurate) trước khi lưu vào DB.

**Công cụ chuẩn:** Sử dụng **Zod** (ưu tiên) hoặc **Joi**.

```typescript
// ✅ Ví dụ chuẩn: Zod schema cho document
const createDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  documentType: z.enum(["SOP", "WI", "FORM", "POLICY"]),
  departmentId: z.string().uuid("Invalid department ID"),
  effectiveDate: z.date().min(new Date(), "Effective date must be in the future"),
});

// Validate TRƯỚC khi ghi DB
const validated = createDocumentSchema.parse(input);
await db.document.create({ data: validated });
```

**Quy tắc:**
- Validation phải thực hiện **cả hai phía**: client-side (UX) và server-side (bảo mật).
- Server-side validation là **bắt buộc** và là nguồn tin cậy duy nhất (single source of truth).
- Lỗi validation phải trả về message rõ ràng, cụ thể cho từng trường.

---

## 2. Quy tắc CSV (Computer System Validation)

### 2.1 Traceability (Truy xuất nguồn gốc)

Mỗi hàm/tính năng mới **phải** đi kèm comment giải thích mục đích (Functional Specification) để phục vụ việc truy xuất nguồn gốc (Traceability Matrix).

```typescript
/**
 * @功能 Submit document for review workflow
 * @FRS FRS-DOC-012: Document Review Submission
 * @URS URS-3.2.1: Users shall be able to submit documents for review
 * @mục_đích Chuyển trạng thái tài liệu từ "Draft" sang "Under Review",
 *           gửi notification cho reviewer, và ghi audit trail.
 * @validation VAL-DOC-012: Verified via IQ/OQ/PQ test cases
 */
async function submitForReview(documentId: string, reviewerId: string): Promise<void> {
  // Implementation...
}
```

**Quy tắc:**
- Các hàm liên quan đến nghiệp vụ cốt lõi (workflow, approval, status change) **bắt buộc** có annotation `@FRS` hoặc `@URS`.
- Comment phải viết bằng **tiếng Anh** để đảm bảo tính nhất quán và khả năng audit quốc tế.
- Khi thay đổi logic nghiệp vụ, phải cập nhật comment tương ứng.

### 2.2 Error Handling (Xử lý lỗi)

Phải có cơ chế xử lý lỗi tường minh tuân thủ nguyên tắc: **"Chi tiết bên trong, tổng quát bên ngoài"**.

```typescript
// ✅ ĐÚNG: Log chi tiết nội bộ, trả về tổng quát cho client
try {
  await processApproval(documentId);
} catch (error) {
  // Log chi tiết cho hệ thống giám sát (internal)
  logger.error("Approval processing failed", {
    documentId,
    userId: currentUser.id,
    errorMessage: error.message,
    stackTrace: error.stack,
    timestamp: new Date().toISOString(),
  });

  // Trả về thông báo tổng quát cho người dùng (external)
  throw new AppError(
    "Unable to process approval. Please contact system administrator.",
    ErrorCode.APPROVAL_FAILED
  );
}

// ❌ SAI: Lộ stack trace ra giao diện
catch (error) {
  res.status(500).json({ error: error.stack }); // NGHIÊM CẤM
}
```

**Quy tắc:**
- **NGHIÊM CẤM** để lộ thông tin hệ thống (stack trace, query SQL, đường dẫn file) ra giao diện người dùng.
- Mọi lỗi phải được log chi tiết vào hệ thống giám sát (logging/monitoring).
- Sử dụng mã lỗi chuẩn (Error Code) để phân loại và truy xuất lỗi.
- Lỗi nghiêm trọng (critical) phải trigger cảnh báo tự động (alert).

### 2.3 Electronic Signature (Ký điện tử)

Các tác vụ phê duyệt (Approval) **bắt buộc** phải yêu cầu ký điện tử theo 21 CFR Part 11.

**Yêu cầu kỹ thuật:**

| Yêu cầu                    | Mô tả                                                                      |
| --------------------------- | --------------------------------------------------------------------------- |
| **Xác thực danh tính**      | Người ký phải nhập lại username + password tại thời điểm ký                 |
| **Ràng buộc hành động**     | Chữ ký phải gắn liền với hành động cụ thể (approve, reject, release, etc.) |
| **Không thể chối bỏ**       | Sau khi ký, không thể rút lại. Mọi thay đổi phải tạo bản ghi mới          |
| **Timestamp**               | Thời điểm ký phải được ghi chính xác (UTC), do server sinh ra              |
| **Meaning**                 | Phải ghi rõ ý nghĩa của chữ ký (e.g., "Approved", "Reviewed", "Released") |

```typescript
interface ElectronicSignature {
  signatureId: string;       // UUID
  userId: string;            // Người ký
  action: SignatureAction;   // "approve" | "reject" | "review" | "release"
  meaning: string;           // Ý nghĩa: "I approve this document for release"
  targetType: string;        // Loại đối tượng: "document" | "training_record"
  targetId: string;          // ID đối tượng được ký
  signedAt: Date;            // Thời điểm ký (UTC, server-generated)
  ipAddress: string;         // Địa chỉ IP tại thời điểm ký
  isValid: boolean;          // Trạng thái hiệu lực
}
```

**Quy tắc:**
- Ký điện tử **bắt buộc** cho: phê duyệt tài liệu, phát hành tài liệu, ghi nhận kết quả đào tạo, đóng/hủy tài liệu.
- Phải sử dụng component `ESignatureModal` chuẩn của hệ thống (tại `@/components/ui/esign-modal`).
- Mỗi phiên ký phải xác thực lại danh tính (re-authentication), **không** sử dụng session token hiện có.
- Dữ liệu chữ ký phải được lưu trữ **bất biến** (immutable) và liên kết với audit trail.

---

## 3. Tóm tắt — Checklist tuân thủ

Trước khi merge bất kỳ PR nào liên quan đến dữ liệu nghiệp vụ, kiểm tra:

- [ ] **Audit Trail**: Mọi thao tác CRUD có được ghi log đầy đủ (Who/When/What/Why/Old/New)?
- [ ] **No Hard Delete**: Có sử dụng Soft Delete thay vì xóa vật lý?
- [ ] **Data Attribution**: Bảng mới có đầy đủ `created_by`, `created_at`, `updated_by`, `updated_at`?
- [ ] **Validation**: Dữ liệu đầu vào có được validate bằng Zod/Joi trước khi lưu DB?
- [ ] **Traceability**: Hàm nghiệp vụ có annotation `@FRS`/`@URS`?
- [ ] **Error Handling**: Lỗi có được log chi tiết nội bộ và trả message tổng quát cho client?
- [ ] **E-Signature**: Tác vụ phê duyệt có yêu cầu ký điện tử qua `ESignatureModal`?
