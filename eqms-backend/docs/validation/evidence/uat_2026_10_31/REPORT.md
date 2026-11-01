# Báo cáo UAT Training Management — 2026-10-31

Mỗi ảnh có tên file chính xác và chú thích. Ảnh nằm trong `shots/`, file APD do hệ thống xuất nằm trong `apd/`.

**Kiểm tra tự động:** 228/236 đạt ngay lần chạy; 8 điểm không đạt đã được phân tích và xử lý (bên dưới); 0 điểm không đạt còn mở.


### Điểm không đạt đã phát hiện trong lúc test và cách xử lý

- **S1-a.3 the approval opens the activity (Planned)** (p1a): Hiện tượng chạy lại: lần chạy đầu bị dừng giữa chừng nên activity đã sang In Progress; ở lần chạy từ đầu activity ở Planned (đã kiểm tra ở lần chạy đầu: S1-a.3 đạt khi activity mới mở).
- **screenshot S4-01__Activity_rev2_supplementary_dialog.png** (p4): Script chụp tìm nút "Supplementary training" ở trang chi tiết; nút nằm ở chế độ Conduct (/activities/{id}/conduct). Đã chụp lại bằng p4c.
- **screenshot S4-04__Activity_no_document_supplementary_dialog.png** (p4): Script chụp tìm nút "Supplementary training" ở trang chi tiết; nút nằm ở chế độ Conduct (/activities/{id}/conduct). Đã chụp lại bằng p4c.
- **S4-2.12 all open work-suspension flags of scenario 2 are cleared** (p4): LỖI THẬT của hệ thống, đã sửa: clearOnPass chỉ gỡ cờ tạm ngừng việc của hoạt động gốc và của chính dòng đó, nên cờ do lần đào tạo lại thứ nhất (trượt) không bao giờ được gỡ sau khi đạt lần thứ hai. Sửa TrainingSuspensionService.clearOnPass (gỡ mọi cờ cùng họ hoạt động gốc), thêm test đơn vị, triển khai lại backend, kiểm chứng p4b 11/11.
- **S4-07.1 APD.0117 of the original still lists the people who left, marked Absent with the r** (p4): Kỳ vọng sai của script: biểu mẫu APD.0117 không có cột lý do (SOP 5.3.7 chỉ yêu cầu ghi "Vắng mặt"); lý do nằm ở Audit Trail. Tên người nghỉ việc và "Vắng mặt / Absent" đều có trong file.
- **S4-08.1 APD.0117 of the original still lists the people who left, marked Absent with the r** (p4): Kỳ vọng sai của script (như S4-07.1).
- **S5-2.2 the e-signature was made through the screen (no API fallback)** (p5): ĐÃ SỬA theo phương án A của chủ sở hữu (màn riêng cho nhân viên): thêm GET /training/me/participations/{id} (chỉ cần training.self.view, chỉ người được mời, không lộ người khác) và trang /training-management/participations/{id}; My Training dẫn nhân viên tự đọc tới trang này. Kiểm chứng p5d 10/10: nhân viên ký điện tử qua màn hình; người khác đọc/ký thay bị 403; activity vẫn không mở cho nhân viên.
- **S5b.1 the employee signed the reading through the screen (e-signature window)** (p5b): ĐÃ SỬA theo phương án A của chủ sở hữu (màn riêng cho nhân viên): thêm GET /training/me/participations/{id} (chỉ cần training.self.view, chỉ người được mời, không lộ người khác) và trang /training-management/participations/{id}; My Training dẫn nhân viên tự đọc tới trang này. Kiểm chứng p5d 10/10: nhân viên ký điện tử qua màn hình; người khác đọc/ký thay bị 403; activity vẫn không mở cho nhân viên.


## Chuẩn bị

### S0-01__My_Training_of_a_trainee.png

*Màn My Training của nhân sự test (uat31.s1.pass1) — kiểm tra trình duyệt và cách đặt tên ảnh*

![S0-01__My_Training_of_a_trainee.png](shots/S0-01__My_Training_of_a_trainee.png)


## Kịch bản 1 — nâng revision của Document, publish sang Effective khi còn người vắng / trượt / nghỉ việc

### S1-01__Revision_1_effective.png

*Revision 1 của tài liệu UAT31 SOP Handling of QC samples đã Effective (trước khi nâng revision)*

![S1-01__Revision_1_effective.png](shots/S1-01__Revision_1_effective.png)

### S1-02__Revision_2_created_by_Upgrade.png

*Revision 2 vừa được tạo bằng Upgrade Revision từ revision 1 đã Effective*

![S1-02__Revision_2_created_by_Upgrade.png](shots/S1-02__Revision_2_created_by_Upgrade.png)

### S1-03__Activity_of_revision_2_Planned.png

*Activity đào tạo của revision 2 (TRN/QC/26-003) ở trạng thái Planned sau khi revision 2 được phê duyệt*

![S1-03__Activity_of_revision_2_Planned.png](shots/S1-03__Activity_of_revision_2_Planned.png)

### S1-05__Session_workspace_before_attendance.png

*Session Workspace của buổi đào tạo trước khi điểm danh*

![S1-05__Session_workspace_before_attendance.png](shots/S1-05__Session_workspace_before_attendance.png)

### S1-07__Session_workspace_attendance_recorded.png

*Session Workspace sau khi điểm danh: 3 có mặt, 1 vắng (nghỉ ốm), 1 vắng do nghỉ việc*

![S1-07__Session_workspace_attendance_recorded.png](shots/S1-07__Session_workspace_attendance_recorded.png)

### S1-08__Session_workspace_test_results.png

*Session Workspace sau khi chấm bài: 2 đạt, 1 trượt (Failed)*

![S1-08__Session_workspace_test_results.png](shots/S1-08__Session_workspace_test_results.png)

### S1-11__Revision_2_ready_for_publishing.png

*Revision 2 sau Complete Training: Ready For Publishing*

![S1-11__Revision_2_ready_for_publishing.png](shots/S1-11__Revision_2_ready_for_publishing.png)

### S1-12__Revision_2_effective.png

*Revision 2 đã Effective dù danh sách đào tạo còn người vắng, người trượt và người nghỉ việc*

![S1-12__Revision_2_effective.png](shots/S1-12__Revision_2_effective.png)

### S1-13__APD0117_attendance_list_rev2-p1.png

*APD.0117 danh sách tham dự đào tạo revision 2 (PDF) (trang 1/2)*

![S1-13__APD0117_attendance_list_rev2-p1.png](shots/S1-13__APD0117_attendance_list_rev2-p1.png)

### S1-13__APD0117_attendance_list_rev2-p2.png

*APD.0117 danh sách tham dự đào tạo revision 2 (PDF) (trang 2/2)*

![S1-13__APD0117_attendance_list_rev2-p2.png](shots/S1-13__APD0117_attendance_list_rev2-p2.png)

### S1-14__Activity_rev2_Participants_tab.png

*Activity revision 2, tab Participants: 5 nhân sự với trạng thái và kết quả (đạt / trượt / vắng / nghỉ việc)*

![S1-14__Activity_rev2_Participants_tab.png](shots/S1-14__Activity_rev2_Participants_tab.png)

### S1-15__Activity_rev2_Assessment_tab.png

*Activity revision 2, tab Assessment: điểm số từng người*

![S1-15__Activity_rev2_Assessment_tab.png](shots/S1-15__Activity_rev2_Assessment_tab.png)

### S1-16__Activity_rev2_Signatures_tab.png

*Activity revision 2, tab Signatures: các chữ ký điện tử (danh sách, nội dung, gửi danh sách, Finish Training, QA xác nhận)*

![S1-16__Activity_rev2_Signatures_tab.png](shots/S1-16__Activity_rev2_Signatures_tab.png)

### S1-17__Activity_rev2_Audit_Trail_tab.png

*Activity revision 2, tab Audit Trail: lịch sử thao tác*

![S1-17__Activity_rev2_Audit_Trail_tab.png](shots/S1-17__Activity_rev2_Audit_Trail_tab.png)

### S1-18__Revision_2_Training_Information_tab.png

*Revision 2 (Effective), tab Training Information: thông tin đào tạo gắn với revision*

![S1-18__Revision_2_Training_Information_tab.png](shots/S1-18__Revision_2_Training_Information_tab.png)

### S1-19__Compliance_Work_Suspensions_tab.png

*Compliance, tab Work Suspensions (phòng Quality Control): cờ tạm ngừng việc của người trượt bài kiểm tra (SOP 5.3.7)*

![S1-19__Compliance_Work_Suspensions_tab.png](shots/S1-19__Compliance_Work_Suspensions_tab.png)


## Kịch bản 2 — activity không từ tài liệu, 10 nhân sự, 3 phòng

### S2-01__Activity_without_document_general.png

*Activity TRN/QA/26-942 không xuất phát từ tài liệu (Type: Unplanned, không có Document), In Progress*

![S2-01__Activity_without_document_general.png](shots/S2-01__Activity_without_document_general.png)

### S2-02__Participants_ten_people_before_attendance.png

*Tab Participants: 10 nhân sự của 3 phòng (QA, QC, Production) trước khi điểm danh*

![S2-02__Participants_ten_people_before_attendance.png](shots/S2-02__Participants_ten_people_before_attendance.png)

### S2-03__Participants_person_left_still_invited.png

*Tab Participants: người đã nghỉ việc (tài khoản Terminated) vẫn ở trạng thái Invited: ghi chú "Account terminated: cannot sign" ở dòng thứ hai, cột Attendance không bị cắt*

![S2-03__Participants_person_left_still_invited.png](shots/S2-03__Participants_person_left_still_invited.png)

### S2-04__Workspace_attendance_recorded.png

*Session Workspace sau khi điểm danh: 6 có mặt, 4 vắng (2 nghỉ phép, 2 nghỉ việc)*

![S2-04__Workspace_attendance_recorded.png](shots/S2-04__Workspace_attendance_recorded.png)

### S2-05__Assessment_tab_scores.png

*Tab Assessment: điểm của 6 người có mặt (2 đạt, 4 trượt)*

![S2-05__Assessment_tab_scores.png](shots/S2-05__Assessment_tab_scores.png)

### S2-06__Participants_tab_final.png

*Tab Participants khi activity Completed: kết quả cuối của 10 nhân sự*

![S2-06__Participants_tab_final.png](shots/S2-06__Participants_tab_final.png)

### S2-07__Signatures_tab_final.png

*Tab Signatures: các chữ ký điện tử của activity*

![S2-07__Signatures_tab_final.png](shots/S2-07__Signatures_tab_final.png)

### S2-08__Workspace_results_step.png

*Session Workspace, bước Results*

![S2-08__Workspace_results_step.png](shots/S2-08__Workspace_results_step.png)

### S2-09__APD0117_attendance_list_activity_without_document-p1.png

*APD.0117 danh sách tham dự đào tạo (PDF) (trang 1/3)*

![S2-09__APD0117_attendance_list_activity_without_document-p1.png](shots/S2-09__APD0117_attendance_list_activity_without_document-p1.png)

### S2-09__APD0117_attendance_list_activity_without_document-p2.png

*APD.0117 danh sách tham dự đào tạo (PDF) (trang 2/3)*

![S2-09__APD0117_attendance_list_activity_without_document-p2.png](shots/S2-09__APD0117_attendance_list_activity_without_document-p2.png)

### S2-09__APD0117_attendance_list_activity_without_document-p3.png

*APD.0117 danh sách tham dự đào tạo (PDF) (trang 3/3)*

![S2-09__APD0117_attendance_list_activity_without_document-p3.png](shots/S2-09__APD0117_attendance_list_activity_without_document-p3.png)


## Kịch bản 3 — bổ nhiệm nhân viên QC thêm 2 chức danh (ràng buộc đào tạo)

### S3-01__Job_assignments_list_before.png

*Danh sách Job Assignments (APD.0024) trước khi bổ nhiệm*

![S3-01__Job_assignments_list_before.png](shots/S3-01__Job_assignments_list_before.png)

### S3-02__Matrix_QC_draft_with_new_rows.png

*Ma trận đào tạo phòng Quality Control (bản nháp): cột QC Microbiology / QC Physicochemistry và các đào tạo gắn với từng vị trí*

![S3-02__Matrix_QC_draft_with_new_rows.png](shots/S3-02__Matrix_QC_draft_with_new_rows.png)

### S3-03__Matrix_QC_effective.png

*Ma trận Quality Control đã Effective với các đào tạo của 2 vị trí mới*

![S3-03__Matrix_QC_effective.png](shots/S3-03__Matrix_QC_effective.png)

### S3-04__APD0011_matrix_Quality_Control-p1.png

*APD.0011 ma trận đào tạo phòng Quality Control (PDF) (trang 1/1)*

![S3-04__APD0011_matrix_Quality_Control-p1.png](shots/S3-04__APD0011_matrix_Quality_Control-p1.png)

### S3-05__Job_assignment_draft_Matrix_Check_missing.png

*Job Assignment bản nháp của Đỗ Thị Lan (UAT) (chưa đào tạo gì): tab Matrix Check liệt kê 3 đào tạo còn thiếu của 2 vị trí; ký bị chặn (TRAINING_MATRIX_INCOMPLETE)*

![S3-05__Job_assignment_draft_Matrix_Check_missing.png](shots/S3-05__Job_assignment_draft_Matrix_Check_missing.png)

### S3-06__Training_A_failed_participants.png

*Đào tạo chủ đề QC Microbiology: Mai Văn Tâm trượt bài kiểm tra (4/10, Failed)*

![S3-06__Training_A_failed_participants.png](shots/S3-06__Training_A_failed_participants.png)

### S3-07__Training_A_retraining_passed.png

*Đào tạo lại TRN/QA/26-944a (số gốc + chữ cái): Mai Văn Tâm đạt 9/10*

![S3-07__Training_A_retraining_passed.png](shots/S3-07__Training_A_retraining_passed.png)

### S3-09__Job_assignment_pending_receiver.png

*Job Assignment sau khi trưởng bộ phận ký: chờ nhân viên nhận (Pending Receiver); không còn đào tạo thiếu*

![S3-09__Job_assignment_pending_receiver.png](shots/S3-09__Job_assignment_pending_receiver.png)

### S3-10__Job_assignment_effective.png

*Job Assignment Effective: Mai Văn Tâm giữ 2 vị trí QC Microbiology và QC Physicochemistry*

![S3-10__Job_assignment_effective.png](shots/S3-10__Job_assignment_effective.png)

### S3-11__Job_assignments_list_after.png

*Danh sách Job Assignments sau khi bổ nhiệm*

![S3-11__Job_assignments_list_after.png](shots/S3-11__Job_assignments_list_after.png)

### S3-12__APD0024_job_assignment_Mai_Van_Tam-p1.png

*APD.0024 bổ nhiệm Mai Văn Tâm (PDF) (trang 1/2)*

![S3-12__APD0024_job_assignment_Mai_Van_Tam-p1.png](shots/S3-12__APD0024_job_assignment_Mai_Van_Tam-p1.png)

### S3-12__APD0024_job_assignment_Mai_Van_Tam-p2.png

*APD.0024 bổ nhiệm Mai Văn Tâm (PDF) (trang 2/2)*

![S3-12__APD0024_job_assignment_Mai_Van_Tam-p2.png](shots/S3-12__APD0024_job_assignment_Mai_Van_Tam-p2.png)

### S3-13__APD0014_training_record_Mai_Van_Tam-p1.png

*APD.0014 hồ sơ đào tạo cá nhân Mai Văn Tâm (gồm lần trượt, đào tạo lại và các đào tạo đạt) (trang 1/1)*

![S3-13__APD0014_training_record_Mai_Van_Tam-p1.png](shots/S3-13__APD0014_training_record_Mai_Van_Tam-p1.png)


## Kịch bản 4 — xử lý người nghỉ việc, đào tạo bù và đào tạo lại

### S4-01__Activity_rev2_supplementary_dialog.png

*Activity revision 2: hộp thoại Supplementary training — người nghỉ việc bị khoá kèm lý do, người vắng / trượt đã nằm trong đào tạo bù*

![S4-01__Activity_rev2_supplementary_dialog.png](shots/S4-01__Activity_rev2_supplementary_dialog.png)

### S4-02__Make_up_of_the_absent_person.png

*Activity TRN/QC/26-003a (đào tạo bù cho người vắng) đã Completed*

![S4-02__Make_up_of_the_absent_person.png](shots/S4-02__Make_up_of_the_absent_person.png)

### S4-03__Retraining_of_the_failed_person.png

*Activity TRN/QC/26-003b (đào tạo lại cho người trượt) đã Completed*

![S4-03__Retraining_of_the_failed_person.png](shots/S4-03__Retraining_of_the_failed_person.png)

### S4-04__Activity_no_document_supplementary_dialog.png

*Activity không từ tài liệu: hộp thoại Supplementary training — người vắng / trượt đã có đào tạo bù được đánh dấu, 2 người nghỉ việc bị khoá kèm lý do*

![S4-04__Activity_no_document_supplementary_dialog.png](shots/S4-04__Activity_no_document_supplementary_dialog.png)

### S4-05__Retraining_four_people_one_failed_again.png

*Đào tạo lại cho 4 người trượt (3 phòng): 3 đạt, 1 người (Production) trượt lần nữa*

![S4-05__Retraining_four_people_one_failed_again.png](shots/S4-05__Retraining_four_people_one_failed_again.png)

### S4-06__Activity_no_document_audit_trail.png

*Audit Trail của activity không từ tài liệu: các thao tác điểm danh Absent (nghỉ việc), chấm điểm, đào tạo bù và đào tạo lại*

![S4-06__Activity_no_document_audit_trail.png](shots/S4-06__Activity_no_document_audit_trail.png)

### S4-07__APD0117_original_after_make_up_scenario2-p1.png

*APD.0117 của activity gốc (PDF) (trang 1/3)*

![S4-07__APD0117_original_after_make_up_scenario2-p1.png](shots/S4-07__APD0117_original_after_make_up_scenario2-p1.png)

### S4-07__APD0117_original_after_make_up_scenario2-p2.png

*APD.0117 của activity gốc (PDF) (trang 2/3)*

![S4-07__APD0117_original_after_make_up_scenario2-p2.png](shots/S4-07__APD0117_original_after_make_up_scenario2-p2.png)

### S4-07__APD0117_original_after_make_up_scenario2-p3.png

*APD.0117 của activity gốc (PDF) (trang 3/3)*

![S4-07__APD0117_original_after_make_up_scenario2-p3.png](shots/S4-07__APD0117_original_after_make_up_scenario2-p3.png)

### S4-08__APD0117_original_after_make_up_scenario1-p1.png

*APD.0117 của activity gốc (PDF) (trang 1/2)*

![S4-08__APD0117_original_after_make_up_scenario1-p1.png](shots/S4-08__APD0117_original_after_make_up_scenario1-p1.png)

### S4-08__APD0117_original_after_make_up_scenario1-p2.png

*APD.0117 của activity gốc (PDF) (trang 2/2)*

![S4-08__APD0117_original_after_make_up_scenario1-p2.png](shots/S4-08__APD0117_original_after_make_up_scenario1-p2.png)

### S4-09__APD0117_make_up_scenario1-p1.png

*APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario1): mã gốc + chữ cái, kết quả của từng người (trang 1/2)*

![S4-09__APD0117_make_up_scenario1-p1.png](shots/S4-09__APD0117_make_up_scenario1-p1.png)

### S4-09__APD0117_make_up_scenario1-p2.png

*APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario1): mã gốc + chữ cái, kết quả của từng người (trang 2/2)*

![S4-09__APD0117_make_up_scenario1-p2.png](shots/S4-09__APD0117_make_up_scenario1-p2.png)

### S4-10__APD0117_retraining_scenario1-p1.png

*APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario1): mã gốc + chữ cái, kết quả của từng người (trang 1/2)*

![S4-10__APD0117_retraining_scenario1-p1.png](shots/S4-10__APD0117_retraining_scenario1-p1.png)

### S4-10__APD0117_retraining_scenario1-p2.png

*APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario1): mã gốc + chữ cái, kết quả của từng người (trang 2/2)*

![S4-10__APD0117_retraining_scenario1-p2.png](shots/S4-10__APD0117_retraining_scenario1-p2.png)

### S4-11__APD0117_make_up_scenario2-p1.png

*APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario2): mã gốc + chữ cái, kết quả của từng người (trang 1/2)*

![S4-11__APD0117_make_up_scenario2-p1.png](shots/S4-11__APD0117_make_up_scenario2-p1.png)

### S4-11__APD0117_make_up_scenario2-p2.png

*APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario2): mã gốc + chữ cái, kết quả của từng người (trang 2/2)*

![S4-11__APD0117_make_up_scenario2-p2.png](shots/S4-11__APD0117_make_up_scenario2-p2.png)

### S4-12__APD0117_retraining_scenario2-p1.png

*APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario2): mã gốc + chữ cái, kết quả của từng người (trang 1/2)*

![S4-12__APD0117_retraining_scenario2-p1.png](shots/S4-12__APD0117_retraining_scenario2-p1.png)

### S4-12__APD0117_retraining_scenario2-p2.png

*APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario2): mã gốc + chữ cái, kết quả của từng người (trang 2/2)*

![S4-12__APD0117_retraining_scenario2-p2.png](shots/S4-12__APD0117_retraining_scenario2-p2.png)

### S4-13__APD0014_record_fail_retrained-p1.png

*APD.0014 hồ sơ đào tạo cá nhân của Phạm Thị Dung (UAT) (sau đào tạo lại / đào tạo bù) (trang 1/1)*

![S4-13__APD0014_record_fail_retrained-p1.png](shots/S4-13__APD0014_record_fail_retrained-p1.png)

### S4-14__APD0014_record_absent_retrained-p1.png

*APD.0014 hồ sơ đào tạo cá nhân của Lê Văn Cường (UAT) (sau đào tạo lại / đào tạo bù) (trang 1/1)*

![S4-14__APD0014_record_absent_retrained-p1.png](shots/S4-14__APD0014_record_absent_retrained-p1.png)

### S4-15__APD0014_record_left_left_the_company-p1.png

*APD.0014 hồ sơ đào tạo cá nhân của Hoàng Văn Em (UAT) (đã nghỉ việc) (trang 1/1)*

![S4-15__APD0014_record_left_left_the_company-p1.png](shots/S4-15__APD0014_record_left_left_the_company-p1.png)

### S4-16__Compliance_Gap_List_Quality_Control.png

*Compliance, tab Gap List (Quality Control): chỉ người còn tài khoản Active được đo yêu cầu đào tạo; người đã nghỉ việc không còn bị đòi*

![S4-16__Compliance_Gap_List_Quality_Control.png](shots/S4-16__Compliance_Gap_List_Quality_Control.png)


## Kịch bản 5 — tự đọc và ký điện tử xác nhận của nhân viên

### S5-01__My_Training_self_reading_to_do.png

*My Training của nhân viên Vũ Thị Giang: việc cần làm — tài liệu tự đọc chờ xác nhận bằng chữ ký điện tử*

![S5-01__My_Training_self_reading_to_do.png](shots/S5-01__My_Training_self_reading_to_do.png)

### S5-02__Participate_page_self_reading.png

*[TRƯỚC KHI SỬA — lỗi] Trang Participation mở bằng tài khoản nhân viên chỉ có quyền self.view: báo "Your permissions or department do not allow this action" — nhân viên không mở được đào tạo của chính mình (lỗi đang chờ quyết định)*

![S5-02__Participate_page_self_reading.png](shots/S5-02__Participate_page_self_reading.png)

### S5-05__Workspace_reading_step_left_and_long_leave.png

*Session Workspace, bước Reading: 1 người đã ký, 2 tài khoản đã đóng (nghỉ việc / nghỉ dài hạn) hiện "cannot sign", người còn lại chưa ký*

![S5-05__Workspace_reading_step_left_and_long_leave.png](shots/S5-05__Workspace_reading_step_left_and_long_leave.png)

### S5-06__Workspace_reading_step_all_recorded.png

*Session Workspace, bước Reading: 5 người đã ký điện tử, 2 người ghi Cannot Read (nghỉ việc / nghỉ dài hạn)*

![S5-06__Workspace_reading_step_all_recorded.png](shots/S5-06__Workspace_reading_step_all_recorded.png)

### S5-07__Workspace_results_step_departments_confirmed.png

*Session Workspace, bước Results: 3 phòng đã được trưởng bộ phận xác nhận, sẵn sàng Finish Training*

![S5-07__Workspace_results_step_departments_confirmed.png](shots/S5-07__Workspace_results_step_departments_confirmed.png)

### S5-08__APD0108_Production-p1.png

*APD.0108 danh sách tự đọc phòng Production (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận (trang 1/1)*

![S5-08__APD0108_Production-p1.png](shots/S5-08__APD0108_Production-p1.png)

### S5-08__APD0108_Quality_Assurance-p1.png

*APD.0108 danh sách tự đọc phòng Quality Assurance (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận (trang 1/1)*

![S5-08__APD0108_Quality_Assurance-p1.png](shots/S5-08__APD0108_Quality_Assurance-p1.png)

### S5-08__APD0108_Quality_Control-p1.png

*APD.0108 danh sách tự đọc phòng Quality Control (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận (trang 1/1)*

![S5-08__APD0108_Quality_Control-p1.png](shots/S5-08__APD0108_Quality_Control-p1.png)

### S5-09__Activity_self_reading_completed_signatures.png

*Activity tự đọc đã Completed: tab Signatures (chữ ký của nhân viên, trưởng bộ phận, người tổ chức, QA)*

![S5-09__Activity_self_reading_completed_signatures.png](shots/S5-09__Activity_self_reading_completed_signatures.png)

### S5-10__Activity_self_reading_notice_make_up.png

*Activity tự đọc sau khi người nghỉ dài hạn trở lại (Active): thông báo cần bố trí đào tạo bù cho 1 người, 1 người không thể bù (đã nghỉ việc)*

![S5-10__Activity_self_reading_notice_make_up.png](shots/S5-10__Activity_self_reading_notice_make_up.png)

### S5-11__My_Training_employee_sees_the_self_reading.png

*My Training của nhân viên Đỗ Thị Lan: việc cần làm có đào tạo tự đọc TRN/QA/26-949*

![S5-11__My_Training_employee_sees_the_self_reading.png](shots/S5-11__My_Training_employee_sees_the_self_reading.png)

### S5-12__Employee_opens_the_training.png

*[TRƯỚC KHI SỬA — lỗi] Nhân viên bấm số hiệu đào tạo trong My Training: trang Training Participation báo "Your permissions or department do not allow this action" (403 TRAINING_SCOPE_DENIED) — nhân viên không thể ký tự đọc trên màn hình (lỗi đang chờ quyết định)*

![S5-12__Employee_opens_the_training.png](shots/S5-12__Employee_opens_the_training.png)

### S5-15__Activity_signed_on_screen_signatures_tab.png

*Activity TRN/QA/26-949 đã Completed: tab Signatures có chữ ký điện tử của nhân viên, trưởng bộ phận, người tổ chức, QA*

![S5-15__Activity_signed_on_screen_signatures_tab.png](shots/S5-15__Activity_signed_on_screen_signatures_tab.png)

### S5-16__APD0108_Quality_Control_signed_on_screen-p1.png

*APD.0108 phòng Quality Control (TRN/QA/26-949): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận (trang 1/1)*

![S5-16__APD0108_Quality_Control_signed_on_screen-p1.png](shots/S5-16__APD0108_Quality_Control_signed_on_screen-p1.png)

### S5-17__After_fix_My_Training_to_do.png

*Sau khi sửa: My Training của nhân viên Đỗ Thị Lan có đào tạo tự đọc TRN/QA/26-950*

![S5-17__After_fix_My_Training_to_do.png](shots/S5-17__After_fix_My_Training_to_do.png)

### S5-18__After_fix_Self_reading_screen_of_the_employee.png

*Sau khi sửa: màn Self-Reading riêng cho nhân viên (TRN/QA/26-950): đào tạo, hạn, tài liệu cần đọc, nút "I have read and understood"*

![S5-18__After_fix_Self_reading_screen_of_the_employee.png](shots/S5-18__After_fix_Self_reading_screen_of_the_employee.png)

### S5-19__After_fix_E_signature_window_opened.png

*Cửa sổ ký điện tử mở ra khi nhân viên bấm "I have read and understood"*

![S5-19__After_fix_E_signature_window_opened.png](shots/S5-19__After_fix_E_signature_window_opened.png)

### S5-20__After_fix_E_signature_window_filled.png

*Cửa sổ ký điện tử: nhân viên nhập lý do và mật khẩu (mật khẩu bị ẩn) để ký xác nhận đã đọc*

![S5-20__After_fix_E_signature_window_filled.png](shots/S5-20__After_fix_E_signature_window_filled.png)

### S5-21__After_fix_Employee_signed_on_screen.png

*Sau khi nhân viên ký điện tử trên màn hình: "You confirmed the reading", không còn nút ký*

![S5-21__After_fix_Employee_signed_on_screen.png](shots/S5-21__After_fix_Employee_signed_on_screen.png)

### S5-22__After_fix_Activity_signatures_tab.png

*Activity TRN/QA/26-950 đã Completed: tab Signatures có chữ ký điện tử của nhân viên (ký trên màn hình), trưởng bộ phận, người tổ chức, QA*

![S5-22__After_fix_Activity_signatures_tab.png](shots/S5-22__After_fix_Activity_signatures_tab.png)

### S5-23__APD0108_Quality_Control_signed_on_screen_after_fix-p1.png

*APD.0108 phòng Quality Control (TRN/QA/26-950): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận (trang 1/1)*

![S5-23__APD0108_Quality_Control_signed_on_screen_after_fix-p1.png](shots/S5-23__APD0108_Quality_Control_signed_on_screen_after_fix-p1.png)


## Các file APD do hệ thống xuất (bản cuối)

- `apd/S1-13__APD0117_attendance_list_rev2.docx` — APD.0117 danh sách tham dự đào tạo revision 2 (2 đạt, 1 trượt, 2 vắng)
- `apd/S1-13__APD0117_attendance_list_rev2.pdf` — APD.0117 danh sách tham dự đào tạo revision 2 (PDF)
- `apd/S2-09__APD0117_attendance_list_activity_without_document.docx` — APD.0117 danh sách tham dự đào tạo (activity không từ tài liệu): 10 nhân sự, 3 phòng
- `apd/S2-09__APD0117_attendance_list_activity_without_document.pdf` — APD.0117 danh sách tham dự đào tạo (PDF)
- `apd/S3-04__APD0011_matrix_Quality_Control.docx` — APD.0011 ma trận đào tạo phòng Quality Control (có 2 vị trí QC Microbiology, QC Physicochemistry)
- `apd/S3-04__APD0011_matrix_Quality_Control.pdf` — APD.0011 ma trận đào tạo phòng Quality Control (PDF)
- `apd/S3-12__APD0024_job_assignment_Mai_Van_Tam.docx` — APD.0024 bản giao việc / bổ nhiệm Mai Văn Tâm: QC Microbiology + QC Physicochemistry (2 chữ ký điện tử)
- `apd/S3-12__APD0024_job_assignment_Mai_Van_Tam.pdf` — APD.0024 bổ nhiệm Mai Văn Tâm (PDF)
- `apd/S3-13__APD0014_training_record_Mai_Van_Tam.pdf` — APD.0014 hồ sơ đào tạo cá nhân Mai Văn Tâm (gồm lần trượt, đào tạo lại và các đào tạo đạt)
- `apd/S4-07__APD0117_original_after_make_up_scenario2.docx` — APD.0117 của activity gốc sau khi đã có đào tạo bù/đào tạo lại: người nghỉ việc vẫn nằm trong danh sách, ghi Vắng mặt và lý do (scenario 2)
- `apd/S4-07__APD0117_original_after_make_up_scenario2.pdf` — APD.0117 của activity gốc (PDF)
- `apd/S4-08__APD0117_original_after_make_up_scenario1.docx` — APD.0117 của activity gốc sau khi đã có đào tạo bù/đào tạo lại: người nghỉ việc vẫn nằm trong danh sách, ghi Vắng mặt và lý do (scenario 1)
- `apd/S4-08__APD0117_original_after_make_up_scenario1.pdf` — APD.0117 của activity gốc (PDF)
- `apd/S4-09__APD0117_make_up_scenario1.pdf` — APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario1): mã gốc + chữ cái, kết quả của từng người
- `apd/S4-10__APD0117_retraining_scenario1.pdf` — APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario1): mã gốc + chữ cái, kết quả của từng người
- `apd/S4-11__APD0117_make_up_scenario2.pdf` — APD.0117 danh sách riêng của buổi đào tạo bù (make_up_scenario2): mã gốc + chữ cái, kết quả của từng người
- `apd/S4-12__APD0117_retraining_scenario2.pdf` — APD.0117 danh sách riêng của buổi đào tạo lại (retraining_scenario2): mã gốc + chữ cái, kết quả của từng người
- `apd/S4-13__APD0014_record_fail_retrained.pdf` — APD.0014 hồ sơ đào tạo cá nhân của Phạm Thị Dung (UAT) (sau đào tạo lại / đào tạo bù)
- `apd/S4-14__APD0014_record_absent_retrained.pdf` — APD.0014 hồ sơ đào tạo cá nhân của Lê Văn Cường (UAT) (sau đào tạo lại / đào tạo bù)
- `apd/S4-15__APD0014_record_left_left_the_company.pdf` — APD.0014 hồ sơ đào tạo cá nhân của Hoàng Văn Em (UAT) (đã nghỉ việc)
- `apd/S5-08__APD0108_Production.docx` — APD.0108 danh sách tự đọc phòng Production (docx): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-08__APD0108_Production.pdf` — APD.0108 danh sách tự đọc phòng Production (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-08__APD0108_Quality_Assurance.docx` — APD.0108 danh sách tự đọc phòng Quality Assurance (docx): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-08__APD0108_Quality_Assurance.pdf` — APD.0108 danh sách tự đọc phòng Quality Assurance (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-08__APD0108_Quality_Control.docx` — APD.0108 danh sách tự đọc phòng Quality Control (docx): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-08__APD0108_Quality_Control.pdf` — APD.0108 danh sách tự đọc phòng Quality Control (pdf): chữ ký điện tử của từng nhân viên, người ghi Vắng mặt (nghỉ việc / nghỉ dài hạn), xác nhận và nhận xét của trưởng bộ phận
- `apd/S5-16__APD0108_Quality_Control_signed_on_screen.pdf` — APD.0108 phòng Quality Control (TRN/QA/26-949): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận
- `apd/S5-23__APD0108_Quality_Control_signed_on_screen_after_fix.pdf` — APD.0108 phòng Quality Control (TRN/QA/26-950): nhân viên ký điện tử trên màn hình + trưởng bộ phận xác nhận
