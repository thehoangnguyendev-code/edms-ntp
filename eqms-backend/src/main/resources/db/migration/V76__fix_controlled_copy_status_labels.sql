-- V76: Update status column in controlled_copies to use the label from controlled_copy_statuses
UPDATE controlled_copies cc
SET status = ccs.label
FROM controlled_copy_statuses ccs
WHERE cc.status_code = ccs.code AND cc.status != ccs.label;
