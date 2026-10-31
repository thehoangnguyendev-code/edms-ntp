CREATE FUNCTION reject_publishing_command_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Publishing commands are immutable; create a new confirmed job' USING ERRCODE='23514';
END;
$$;
CREATE TRIGGER publishing_commands_immutable
    BEFORE UPDATE OR DELETE ON publishing_job_commands
    FOR EACH ROW EXECUTE FUNCTION reject_publishing_command_mutation();
