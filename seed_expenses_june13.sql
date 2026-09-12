-- Sordi seed: June 13 operational expenses
-- Standalone expenses, idempotent by (expense_date, description).
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '11f46990-dca4-47b1-a970-228ac8826fce', '2026-06-13', 'Utilities', 'Internet Idoom Recharge', 2000, NULL, NULL, NULL, NULL, '2026-06-13T09:00:00.000000+00:00', '2026-06-13T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-13' AND description = 'Internet Idoom Recharge');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '1ae083ae-d5b4-427d-9ca0-8efdd8f43896', '2026-06-13', 'Office / Team', 'Houssem - Operational / Office Payout', 5000, NULL, NULL, NULL, NULL, '2026-06-13T09:01:00.000000+00:00', '2026-06-13T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-13' AND description = 'Houssem - Operational / Office Payout');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'd2412933-3eaf-475a-bfda-752cd02a15b2', '2026-06-13', 'Software / SaaS', 'Claude Code Pro Subscription', 6500, NULL, NULL, NULL, NULL, '2026-06-13T09:02:00.000000+00:00', '2026-06-13T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-13' AND description = 'Claude Code Pro Subscription');
COMMIT;
