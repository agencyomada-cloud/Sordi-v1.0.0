-- Sordi seed: software subscriptions & ad charges (step 4)
-- Standalone expenses, no project_id. Idempotent by (expense_date, description).
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '7a7e897a-c669-44d3-8d51-1a89c1da2065', '2026-01-02', 'Software / SaaS', 'Adobe Creative Cloud (6 Months)', 32000, NULL, NULL, NULL, NULL, '2026-01-02T09:00:00.000000+00:00', '2026-01-02T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-02' AND description = 'Adobe Creative Cloud (6 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '4e48a2eb-b9b4-4f89-a586-dadfa64d1d60', '2026-01-05', 'Software / SaaS', 'Slack Pro (2.5 Months)', 14000, NULL, NULL, NULL, NULL, '2026-01-05T09:00:00.000000+00:00', '2026-01-05T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-05' AND description = 'Slack Pro (2.5 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '010d116e-6ba8-41be-bdf0-6f260ae8fce4', '2026-02-15', 'Software / SaaS', 'Google AI Pro (4 Months)', 22000, NULL, NULL, NULL, NULL, '2026-02-15T09:00:00.000000+00:00', '2026-02-15T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-02-15' AND description = 'Google AI Pro (4 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'ed5d33aa-72f9-4d3a-802a-6822dca9a95e', '2026-03-10', 'Software / SaaS', 'Lovable AI (2 Months)', 15000, NULL, NULL, NULL, NULL, '2026-03-10T09:00:00.000000+00:00', '2026-03-10T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-03-10' AND description = 'Lovable AI (2 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '767a4e82-5f2d-49fe-9b84-963120421cfe', '2026-05-01', 'Marketing', 'Digital Marketing & Ads (1 Month)', 5000, NULL, NULL, NULL, NULL, '2026-05-01T09:00:00.000000+00:00', '2026-05-01T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-01' AND description = 'Digital Marketing & Ads (1 Month)');
COMMIT;
