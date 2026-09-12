-- Sordi seed: Smati Logistics expenses (follow-up to step 3)
-- Idempotent by (expense_date, description): safe to re-run.
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '0cb9b705-219c-4913-9c8b-324192aa277c', '2026-04-04', 'Hosting & Domains', 'Smati Logistics - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2026-04-04T09:00:00.000000+00:00', '2026-04-04T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-04' AND description = 'Smati Logistics - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'cb174670-81cf-4c54-b507-4695c3b42965', '2026-04-04', 'Hosting & Domains', 'Smati Logistics - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2026-04-04T09:01:00.000000+00:00', '2026-04-04T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-04' AND description = 'Smati Logistics - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '2dcdd0c0-aff6-48ad-8044-4c7eb8f22f31', '2026-04-04', 'Software / SaaS', 'Smati Logistics - Email Pro', 4500, NULL, NULL, NULL, NULL, '2026-04-04T09:02:00.000000+00:00', '2026-04-04T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-04' AND description = 'Smati Logistics - Email Pro');
COMMIT;
