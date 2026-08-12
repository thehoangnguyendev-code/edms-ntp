DO $$
DECLARE
    v_row record;
    v_new_number text;
    v_max_seq integer;
BEGIN
    FOR v_row IN
        SELECT id, controlled_copy_number
        FROM controlled_copies
        WHERE controlled_copy_number ILIKE 'CC%.EXT.%'
        ORDER BY created_at, id
    LOOP
        v_new_number := regexp_replace(v_row.controlled_copy_number, '\.EXT\.', '.', 'gi');

        IF v_new_number IS NULL OR trim(v_new_number) = '' THEN
            CONTINUE;
        END IF;

        SELECT COALESCE(MAX((substring(controlled_copy_number from '([0-9]{3})$'))::int), 0)
        INTO v_max_seq
        FROM controlled_copies
        WHERE controlled_copy_number LIKE regexp_replace(v_new_number, '\.[0-9]{3}$', '.%');

        IF EXISTS (
            SELECT 1
            FROM controlled_copies
            WHERE controlled_copy_number = v_new_number
              AND id <> v_row.id
        ) THEN
            v_new_number := regexp_replace(v_new_number, '([0-9]{3})$', LPAD((v_max_seq + 1)::text, 3, '0'));
        END IF;

        UPDATE controlled_copies
        SET controlled_copy_number = v_new_number,
            updated_at = NOW()
        WHERE id = v_row.id;
    END LOOP;
END $$;
