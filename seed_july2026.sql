-- Sordi seed: July 2026 payroll + expenses
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '3c06d482-2514-4f55-905d-365f5a89c864', '4d0cb026-557a-4658-9469-7721160ee2e8', '2026-07', 16000, 26, 0, 615.38, 0, 0, 0, 16000, 1, '2026-07-08', '2026-07-08T10:00:00.000000+00:00', '2026-07-08T10:00:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = '4d0cb026-557a-4658-9469-7721160ee2e8' AND month = '2026-07');

INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'f7006365-e026-46de-89d8-2aabea8d73dc', '2026-07-02', 'Subcontracting / Outsourcing', 'Ikram Guelati - Freelance / Subcontracting Settlement (July)', 36000, NULL, NULL, NULL, NULL, '2026-07-02T11:00:00.000000+00:00', '2026-07-02T11:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-02' AND description = 'Ikram Guelati - Freelance / Subcontracting Settlement (July)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '716d4ff6-d93a-480f-81fb-0a1ef34a2341', '2026-07-18', 'Software / SaaS', 'G2A Creative Cloud', 4209.0, NULL, NULL, NULL, NULL, '2026-07-18T11:01:00.000000+00:00', '2026-07-18T11:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-18' AND description = 'G2A Creative Cloud');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '449a2457-2736-4522-af06-878a3a000112', '2026-07-19', 'Hosting & Domains', 'sordi.app Domain', 2906.0, NULL, NULL, NULL, NULL, '2026-07-19T11:02:00.000000+00:00', '2026-07-19T11:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-19' AND description = 'sordi.app Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '9fce13a1-dd9f-43a2-8ad0-26289c0cf8bb', '2026-07-19', 'Utilities', 'Internet Idoom Recharge', 2000.0, NULL, NULL, NULL, NULL, '2026-07-19T11:03:00.000000+00:00', '2026-07-19T11:03:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-19' AND description = 'Internet Idoom Recharge');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '13435ca6-00d9-4702-bc30-b47c24393354', '2026-07-22', 'Software / SaaS', 'Creative Cloud License (Zakaria)', 2761.0, NULL, NULL, NULL, NULL, '2026-07-22T11:04:00.000000+00:00', '2026-07-22T11:04:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-22' AND description = 'Creative Cloud License (Zakaria)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'a7dbadc5-5418-405d-abb4-ce2e7fc2b383', '2026-07-27', 'Office Supplies', 'Paper Ream A4', 700.0, NULL, NULL, NULL, NULL, '2026-07-27T11:05:00.000000+00:00', '2026-07-27T11:05:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-27' AND description = 'Paper Ream A4');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '0c7827bb-8cd0-4002-bc69-8bb69e33d32e', '2026-07-27', 'Software / SaaS', 'Claude Code Pro', 7740.0, NULL, NULL, NULL, NULL, '2026-07-27T11:06:00.000000+00:00', '2026-07-27T11:06:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-27' AND description = 'Claude Code Pro');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'db40e02b-d1e9-44c3-bf72-309398f501f2', '2026-07-29', 'Office Equipment', 'Adapter USB / Type-C', 1900.0, NULL, NULL, NULL, NULL, '2026-07-29T11:07:00.000000+00:00', '2026-07-29T11:07:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-07-29' AND description = 'Adapter USB / Type-C');
COMMIT;
