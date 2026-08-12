-- Hướng B (đã chốt): cho phép Document Viewer tự "Request Controlled Copy"
-- cho chính họ, thay vì bắt buộc DCO/Document Admin khởi tạo mọi request.
--
-- Cơ chế: WorkflowActionPolicyService.resolvePolicy(...) chỉ lấy đúng 1 dòng
-- policy cho mỗi (module, workflow, object_type, action_code, from_status),
-- nên KHÔNG thể thêm 1 dòng policy thứ 2 với permission code khác cho actor
-- DOCUMENT_VIEWER -- phải thêm actor này vào ĐÚNG dòng policy hiện có của
-- REQUEST_COPY, dùng chung permission "documents.controlled_copy.request".
--
-- Giới hạn "chỉ được request 1 bản cho chính mình, không phải batch cho
-- người khác" được enforce ở tầng business logic trong
-- ControlledCopyService.requestControlledCopy(...), KHÔNG phải ở đây --
-- migration này chỉ mở "cửa" actor, không tự nó giới hạn phạm vi.
--
-- APPROVE_REQUEST/REJECT_REQUEST/CANCEL_REQUEST giữ nguyên DCO/DOCUMENT_ADMIN
-- -- không đổi gì ở các action đó.

INSERT INTO workflow_action_policy_actors (id, policy_id, actor_type)
SELECT gen_random_uuid(), wap.id, 'DOCUMENT_VIEWER'
FROM workflow_action_policies wap
WHERE wap.action_code = 'REQUEST_COPY'
  AND wap.object_type = 'CONTROLLED_COPY'
  AND wap.from_status = 'EFFECTIVE'
  AND wap.active = true
AND NOT EXISTS (
    SELECT 1 FROM workflow_action_policy_actors a
    WHERE a.policy_id = wap.id AND a.actor_type = 'DOCUMENT_VIEWER'
);

-- Cấp permission documents.controlled_copy.request cho permission set Viewer
-- hiện có, để user.e.test/user.i.test (đã gán PS_UAT_DOCUMENT_READER) có thể
-- test ngay luồng self-service này.
INSERT INTO permission_set_items (id, permission_set_id, permission_id)
SELECT gen_random_uuid(), ps.id, p.id
FROM permission_sets ps, permissions p
WHERE ps.code = 'PS_UAT_DOCUMENT_READER'
  AND p.code = 'documents.controlled_copy.request'
AND NOT EXISTS (
    SELECT 1 FROM permission_set_items i
    WHERE i.permission_set_id = ps.id AND i.permission_id = p.id
);
