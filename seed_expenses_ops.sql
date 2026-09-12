-- Sordi seed: operational, utility & equipment expenses (step 5)
-- Standalone expenses, no project_id. Idempotent by (expense_date, description).
BEGIN TRANSACTION;
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '8ca72ecf-5615-40ae-8736-fc2dae8e4365', '2026-01-03', 'Office Supplies', 'Office Supplies & Stationery (Techno)', 32000, NULL, NULL, NULL, NULL, '2026-01-03T09:00:00.000000+00:00', '2026-01-03T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-03' AND description = 'Office Supplies & Stationery (Techno)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '25e1d873-2a0f-4968-84d9-42b30ae5a65c', '2026-01-07', 'Office Equipment', 'Office Water Cooler Purchase', 24000, NULL, NULL, NULL, NULL, '2026-01-07T09:00:00.000000+00:00', '2026-01-07T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-07' AND description = 'Office Water Cooler Purchase');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '2979a9f8-91ff-47f2-8d1b-a35ee03fafad', '2026-01-12', 'Maintenance', 'External Door Repair', 3600, NULL, NULL, NULL, NULL, '2026-01-12T09:00:00.000000+00:00', '2026-01-12T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-12' AND description = 'External Door Repair');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '3e3cea0a-b222-4ce4-92e1-d54f85827972', '2026-01-18', 'Maintenance', 'Garage Door Repair', 4000, NULL, NULL, NULL, NULL, '2026-01-18T09:00:00.000000+00:00', '2026-01-18T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-01-18' AND description = 'Garage Door Repair');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '648cd650-0dc5-4ee9-85e4-bca44e93fa79', '2026-02-05', 'Hardware Maintenance', 'Miloud PC Repair (Part 1)', 22000, NULL, NULL, NULL, NULL, '2026-02-05T09:00:00.000000+00:00', '2026-02-05T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-02-05' AND description = 'Miloud PC Repair (Part 1)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '56db08a5-3808-441c-a014-77b13b8c1d9c', '2026-02-20', 'Marketing', 'Branding Stickers & Decals', 2800, NULL, NULL, NULL, NULL, '2026-02-20T09:00:00.000000+00:00', '2026-02-20T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-02-20' AND description = 'Branding Stickers & Decals');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '19978b3f-6137-4c76-85b0-bffb86a05728', '2026-02-28', 'Office / Team', 'Team Catering (2 Months)', 45000, NULL, NULL, NULL, NULL, '2026-02-28T09:00:00.000000+00:00', '2026-02-28T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-02-28' AND description = 'Team Catering (2 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '9670272c-1bfc-4ce0-a90a-cf75406f4749', '2026-03-15', 'Hardware Maintenance', 'Miloud PC Repair / Upgrade (Part 2)', 25000, NULL, NULL, NULL, NULL, '2026-03-15T09:00:00.000000+00:00', '2026-03-15T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-03-15' AND description = 'Miloud PC Repair / Upgrade (Part 2)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '59769e3b-a8e3-4fef-8dc5-063e92e98601', '2026-04-10', 'Utilities', 'Office Phone (6 Months)', 4500, NULL, NULL, NULL, NULL, '2026-04-10T09:00:00.000000+00:00', '2026-04-10T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-04-10' AND description = 'Office Phone (6 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '69a10731-5d4e-435b-810b-7c18298177ce', '2026-05-10', 'Utilities', 'Electricity Bill (6 Months)', 42000, NULL, NULL, NULL, NULL, '2026-05-10T09:00:00.000000+00:00', '2026-05-10T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-10' AND description = 'Electricity Bill (6 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '10a41471-0f23-45bd-8459-3662546d94ac', '2026-05-25', 'Office Supplies', 'Kitchen & Cleaning Supplies (6 Months)', 15000, NULL, NULL, NULL, NULL, '2026-05-25T09:00:00.000000+00:00', '2026-05-25T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-05-25' AND description = 'Kitchen & Cleaning Supplies (6 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'c0b07c47-7dc0-4386-85a9-b92d84f8870a', '2026-06-01', 'Utilities', 'Internet Connection (6 Months)', 12000, NULL, NULL, NULL, NULL, '2026-06-01T09:00:00.000000+00:00', '2026-06-01T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-01' AND description = 'Internet Connection (6 Months)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'b023bb04-5b3c-4e84-a6fe-0ea2f050ac70', '2026-06-15', 'Miscellaneous', 'Miscellaneous Office Expenses', 10000, NULL, NULL, NULL, NULL, '2026-06-15T09:00:00.000000+00:00', '2026-06-15T09:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-15' AND description = 'Miscellaneous Office Expenses');
COMMIT;
