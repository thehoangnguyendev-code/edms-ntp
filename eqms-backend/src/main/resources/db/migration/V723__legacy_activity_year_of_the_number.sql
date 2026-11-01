-- A historical activity of a Legacy Import took its year from the day of the paper training, but the log of the Training Numbers is by the year written in the number (TRN/DC/YY-XXX): the
-- paper number TRN/QA/26-043 was filed under 2020 (the year of the paper training) and did not appear in the log of 2026. The year and the serial are now the ones of the number;
-- the activities made before this are corrected here. A number of another form keeps the year of the paper training.
UPDATE training_activities
   SET year = 2000 + substring(training_number from '(?i)^TRN/[A-Z0-9]{1,40}/([0-9]{2})-[0-9]{1,6}$')::int,
       serial = substring(training_number from '-([0-9]{1,6})$')::int
 WHERE kind = 'LEGACY' AND training_number ~* '^TRN/[A-Z0-9]{1,40}/[0-9]{2}-[0-9]{1,6}$';
