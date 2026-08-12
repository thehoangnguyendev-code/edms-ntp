UPDATE documents
SET
    valid_until = (effective_date + make_interval(months => periodic_review_cycle))::date,
    review_date = (effective_date + make_interval(months => periodic_review_cycle))::date
WHERE effective_date IS NOT NULL
  AND periodic_review_cycle IS NOT NULL
  AND periodic_review_cycle > 0;
