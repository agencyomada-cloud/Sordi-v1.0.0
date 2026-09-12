-- Sordi migration: Zakaria Reguig re-aligned into payroll_runs.
--
-- NOTE: his standalone "Zakaria Salary Settlement (August)" expense row
-- (50,000 DZD, Subcontracting/Outsourcing) is already gone from `expenses`
-- as of this migration — it was deleted outside these seed scripts
-- (matching created_at pattern on his employees row suggests live app
-- usage, not one of my scripts), so step 2 of the request is a no-op here.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- Settle his existing August draft rather than inserting a duplicate
-- (UNIQUE(employee_id, month) would reject a second 2026-08 row anyway).
UPDATE payroll_runs
SET paid = 1, paid_date = '2026-08-29', updated_at = '2026-08-29T12:00:00.000000+00:00'
WHERE employee_id = (SELECT id FROM employees WHERE name = 'Zakaria Reguig')
  AND month = '2026-08';

-- Drop the empty (0 DZD) September draft — nothing settled yet, not worth
-- keeping as a zero-value row.
DELETE FROM payroll_runs
WHERE employee_id = (SELECT id FROM employees WHERE name = 'Zakaria Reguig')
  AND month = '2026-09'
  AND net_a_payer = 0;

COMMIT;
