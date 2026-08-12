-- Restores the uniqueness guarantee for batch_number that was dropped in
-- V122__allow_repeated_controlled_copy_batch_numbers.sql. The underlying generation
-- race that motivated that drop is now fixed via a pessimistic lock on the document row
-- (see ControlledCopyService.requestControlledCopy / DocumentRecordRepository.lockById),
-- so duplicate batch numbers should never occur going forward. No existing duplicates
-- were found at the time this migration was written.
ALTER TABLE controlled_copy_distribution_batches
    ADD CONSTRAINT uq_controlled_copy_distribution_batches_batch_number UNIQUE (batch_number);
