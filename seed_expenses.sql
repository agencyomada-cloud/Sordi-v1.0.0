-- Sordi seed: direct project expenses from audit (step 3)
-- Standalone expense records — project_id intentionally left NULL per spec;
-- the project/client name is carried in the description text instead.
-- Idempotent by (expense_date, description): safe to re-run.
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '5bbad035-b804-41ca-940d-4b5c3729966d', '2025-12-10', 'Hosting & Domains', 'Archi Design - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2025-12-10T09:00:00.000000+00:00', '2025-12-10T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2025-12-10' AND description = 'Archi Design - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '1d25f3a8-a1c3-4e4c-a22d-d0bb65b36beb', '2025-12-10', 'Hosting & Domains', 'Archi Design - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2025-12-10T09:01:00.000000+00:00', '2025-12-10T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2025-12-10' AND description = 'Archi Design - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '95f7f062-ddc2-4531-83fe-ec73cdd163a9', '2025-12-10', 'Software / SaaS', 'Archi Design - Email Pro', 4500, NULL, NULL, NULL, NULL, '2025-12-10T09:02:00.000000+00:00', '2025-12-10T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2025-12-10' AND description = 'Archi Design - Email Pro');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'ed379165-d993-4295-aa66-1301666880d8', '2026-01-12', 'Hosting & Domains', 'ETB - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2026-01-12T09:00:00.000000+00:00', '2026-01-12T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-12' AND description = 'ETB - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '06a26d89-7d61-4286-af9b-671a35d83be1', '2026-01-12', 'Hosting & Domains', 'ETB - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2026-01-12T09:01:00.000000+00:00', '2026-01-12T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-12' AND description = 'ETB - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '05c011be-d73f-4464-a97c-d1b29b86936f', '2026-01-12', 'Software / SaaS', 'ETB - Email Pro', 4500, NULL, NULL, NULL, NULL, '2026-01-12T09:02:00.000000+00:00', '2026-01-12T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-12' AND description = 'ETB - Email Pro');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '311bbe3f-5930-4bea-9abb-b612acb8d1fa', '2026-04-21', 'Hosting & Domains', 'Exosafe - Namecheap Domains', 10000, NULL, NULL, NULL, NULL, '2026-04-21T09:00:00.000000+00:00', '2026-04-21T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-21' AND description = 'Exosafe - Namecheap Domains');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'ff58299f-5db7-4ee6-a00a-2a65299d2177', '2026-04-21', 'Hosting & Domains', 'Exosafe - Hostinger Hosting', 24000, NULL, NULL, NULL, NULL, '2026-04-21T09:01:00.000000+00:00', '2026-04-21T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-21' AND description = 'Exosafe - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '67c4b16c-b52a-4d1b-b526-ec10aecefdc1', '2026-04-21', 'Software / SaaS', 'Exosafe - Email Pro', 4500, NULL, NULL, NULL, NULL, '2026-04-21T09:02:00.000000+00:00', '2026-04-21T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-21' AND description = 'Exosafe - Email Pro');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'f87cb7d5-24b6-4411-baf9-9dde472613d6', '2026-05-16', 'Hosting & Domains', 'EGAP DZ - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2026-05-16T09:00:00.000000+00:00', '2026-05-16T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-16' AND description = 'EGAP DZ - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'f92a931c-75fa-44ed-a301-2c4f21ec60df', '2026-05-16', 'Hosting & Domains', 'EGAP DZ - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2026-05-16T09:01:00.000000+00:00', '2026-05-16T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-16' AND description = 'EGAP DZ - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '12c755bb-ec8e-48e4-bc00-834c814820dc', '2026-05-16', 'Software / SaaS', 'EGAP DZ - Email Pro', 4500, NULL, NULL, NULL, NULL, '2026-05-16T09:02:00.000000+00:00', '2026-05-16T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-16' AND description = 'EGAP DZ - Email Pro');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '8a6a1847-fd4d-4448-abf2-9e2846c4a07b', '2026-05-01', 'Hosting & Domains', 'Elfarouk Voyage - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2026-05-01T09:00:00.000000+00:00', '2026-05-01T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-01' AND description = 'Elfarouk Voyage - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '754b625a-5b45-4975-a3ed-d734fdbfcdfd', '2026-05-01', 'Hosting & Domains', 'Elfarouk Voyage - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2026-05-01T09:01:00.000000+00:00', '2026-05-01T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-01' AND description = 'Elfarouk Voyage - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'cd7d0e9b-6904-4873-9911-bbf02053a0b1', '2026-05-26', 'Subcontracting / Outsourcing', 'Hotel Garden - External Design Freelancer (Fouad)', 30000, NULL, NULL, NULL, NULL, '2026-05-26T09:00:00.000000+00:00', '2026-05-26T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-26' AND description = 'Hotel Garden - External Design Freelancer (Fouad)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '10e4ce04-2200-4902-b52a-4dea2946f968', '2026-05-17', 'Hosting & Domains', 'FC Ceram - Namecheap Domain', 5000, NULL, NULL, NULL, NULL, '2026-05-17T09:00:00.000000+00:00', '2026-05-17T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-17' AND description = 'FC Ceram - Namecheap Domain');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '188a3de5-a6a6-4b2a-93cc-bd476dce62af', '2026-05-17', 'Hosting & Domains', 'FC Ceram - Hostinger Hosting', 12000, NULL, NULL, NULL, NULL, '2026-05-17T09:01:00.000000+00:00', '2026-05-17T09:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-17' AND description = 'FC Ceram - Hostinger Hosting');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'a7e02c5a-f74c-45ae-afa0-686ea071bb15', '2026-05-17', 'Software / SaaS', 'FC Ceram - Email Pro', 4500, NULL, NULL, NULL, NULL, '2026-05-17T09:02:00.000000+00:00', '2026-05-17T09:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-17' AND description = 'FC Ceram - Email Pro');
COMMIT;
