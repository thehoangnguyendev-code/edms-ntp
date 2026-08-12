UPDATE controlled_copies
   SET current_stage = 'Ready for Distribution'
 WHERE UPPER(COALESCE(current_stage, '')) IN ('WAITING FOR QM', 'READY FOR PRINT');

UPDATE controlled_copies
   SET current_stage = 'Obsoleted',
       status = 'Obsoleted',
       status_code = 'OBSOLETED',
       obsolete_reason = COALESCE(
           obsolete_reason,
           CASE UPPER(COALESCE(current_stage, ''))
               WHEN 'RECALLED' THEN 'RECALLED'
               WHEN 'LOST' THEN 'LOST'
               WHEN 'DAMAGED' THEN 'DAMAGED'
               WHEN 'DESTROYED' THEN 'DESTROYED'
               ELSE obsolete_reason
           END
       )
 WHERE UPPER(COALESCE(current_stage, '')) IN ('RECALLED', 'LOST', 'DAMAGED', 'DESTROYED');
