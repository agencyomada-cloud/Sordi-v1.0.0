-- Sordi migration: Almass Jabar + Ikram Guelati move from employees/payroll
-- to standalone subcontracting expenses.
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

DELETE FROM payroll_runs WHERE employee_id IN (
  SELECT id FROM employees WHERE name IN ('Almass Jabar', 'Ikram Guelati')
);

DELETE FROM employees WHERE name IN ('Almass Jabar', 'Ikram Guelati');

INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'c1a0f2b4-7e3d-4a1b-9c5e-1f2a3b4c5d6e', '2026-06-30', 'Subcontracting / Outsourcing', 'Almass Jabar - Freelance / Subcontracting Settlement', 20000, NULL, NULL, NULL, NULL, '2026-06-30T12:00:00.000000+00:00', '2026-06-30T12:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-30' AND description = 'Almass Jabar - Freelance / Subcontracting Settlement');

INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'd2b1a3c5-8f4e-4b2c-ad6f-2a3b4c5d6e7f', '2026-06-30', 'Subcontracting / Outsourcing', 'Ikram Guelati - Freelance / Subcontracting Settlement', 15000, NULL, NULL, NULL, NULL, '2026-06-30T12:01:00.000000+00:00', '2026-06-30T12:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-30' AND description = 'Ikram Guelati - Freelance / Subcontracting Settlement');

COMMIT;
