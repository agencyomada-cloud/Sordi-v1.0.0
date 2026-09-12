-- Sordi seed: August 2026 expenses
-- Zakaria's salary recorded as a standalone Subcontracting/Outsourcing
-- expense per spec, not re-added to employees.
-- Idempotent by (expense_date, description).
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '7653c21b-e0e2-4538-b484-3e492b270088', '2026-08-01', 'Office Supplies', 'Office Air Freshener (Désodorisant)', 290.0, NULL, NULL, NULL, NULL, '2026-08-01T09:00:00.000000+00:00', '2026-08-01T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-01' AND description = 'Office Air Freshener (Désodorisant)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'f33e6a69-eb83-44a4-aa2e-3706ce929d96', '2026-08-02', 'Office Supplies', 'Outdoor Plants & Office Decor', 4500.0, NULL, NULL, NULL, NULL, '2026-08-02T09:01:00.000000+00:00', '2026-08-02T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-02' AND description = 'Outdoor Plants & Office Decor');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '43eedac5-b0da-4cb9-a347-d711262dc6c9', '2026-08-10', 'Utilities', 'Internet Recharge', 2000.0, NULL, NULL, NULL, NULL, '2026-08-10T09:02:00.000000+00:00', '2026-08-10T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-10' AND description = 'Internet Recharge');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '8dde0e07-e509-40f8-b780-b5d7add6eb24', '2026-08-26', 'Software / SaaS', 'Claude Subscription', 7839.0, NULL, NULL, NULL, NULL, '2026-08-26T09:03:00.000000+00:00', '2026-08-26T09:03:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-26' AND description = 'Claude Subscription');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'c8d211ed-bc60-41cc-b825-aeff1961a0e3', '2026-08-26', 'Software / SaaS', 'Adobe Creative Cloud', 4272.0, NULL, NULL, NULL, NULL, '2026-08-26T09:04:00.000000+00:00', '2026-08-26T09:04:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-26' AND description = 'Adobe Creative Cloud');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '8aa19f2a-d7e3-4e93-b606-905c0d35d4e7', '2026-08-29', 'Subcontracting / Outsourcing', 'Zakaria Salary Settlement (August)', 50000.0, NULL, NULL, NULL, NULL, '2026-08-29T09:05:00.000000+00:00', '2026-08-29T09:05:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-29' AND description = 'Zakaria Salary Settlement (August)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '79628044-7901-4631-bbdd-9389a98a9ba4', '2026-08-30', 'Utilities', 'Internet Recharge', 2000.0, NULL, NULL, NULL, NULL, '2026-08-30T09:06:00.000000+00:00', '2026-08-30T09:06:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-08-30' AND description = 'Internet Recharge');
COMMIT;
