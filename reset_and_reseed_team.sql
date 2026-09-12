-- Sordi: full employees/payroll reset + re-seed (clean slate)
--
-- Step 1: wipe payroll_runs and employees completely, per explicit
-- instruction (including the CEO record, Islem Soualhia, confirmed).
-- foreign_keys=ON so the schema's own ON DELETE rules do the right
-- thing: employee_advances/employee_documents CASCADE away (Zakaria's
-- 2 advances + 1 document), punch_records.employee_id SETs NULL for
-- the 234 rows that referenced a real employee (the attendance scans
-- themselves are kept — only the reset target, employees/payroll, is
-- being wiped; punch history isn't part of this reset's scope and
-- SET NULL is the schema's own non-orphaning answer for it).
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;
DELETE FROM payroll_runs;
DELETE FROM employees;

-- Step 2: the 4 current active team members.
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id) VALUES ('4d0cb026-557a-4658-9469-7721160ee2e8', 'Houssem Serai', NULL, NULL, NULL, NULL, 1, '2025-12-08T09:00:00.000000+00:00', '2025-12-08T09:00:00.000000+00:00', NULL, '2025-12-08', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at) VALUES ('89ee88d6-00ac-4074-bb9f-5a2a43ecf27e', '4d0cb026-557a-4658-9469-7721160ee2e8', '2026-06', 120000, 26, 0, 4615.38, 0, 0, 0, 120000, 1, '2026-06-30', '2026-06-30T10:00:00.000000+00:00', '2026-06-30T10:00:00.000000+00:00');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id) VALUES ('b99b5da6-0715-401c-95b9-d0a778716397', 'Almass Jabar', NULL, NULL, NULL, NULL, 1, '2026-04-17T09:01:00.000000+00:00', '2026-04-17T09:01:00.000000+00:00', NULL, '2026-04-17', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at) VALUES ('0611dcac-bf83-4152-9463-f4f0bae409f4', 'b99b5da6-0715-401c-95b9-d0a778716397', '2026-06', 20000, 26, 0, 769.23, 0, 0, 0, 20000, 1, '2026-06-30', '2026-06-30T10:01:00.000000+00:00', '2026-06-30T10:01:00.000000+00:00');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id) VALUES ('8b45c897-bdb6-4a1a-a274-51de17ebe630', 'Ikram Guelati', NULL, NULL, NULL, NULL, 1, '2026-02-21T09:02:00.000000+00:00', '2026-02-21T09:02:00.000000+00:00', NULL, '2026-02-21', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at) VALUES ('5fcc919d-b198-4409-b990-107f2ce9b0a4', '8b45c897-bdb6-4a1a-a274-51de17ebe630', '2026-06', 15000, 26, 0, 576.92, 0, 0, 0, 15000, 1, '2026-06-30', '2026-06-30T10:02:00.000000+00:00', '2026-06-30T10:02:00.000000+00:00');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id) VALUES ('2a6ceb13-e6e7-47cc-a7cf-b1f0bde67758', 'Ilhem Achouri', NULL, NULL, NULL, NULL, 1, '2026-05-24T09:03:00.000000+00:00', '2026-05-24T09:03:00.000000+00:00', NULL, '2026-05-24', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096');

-- Step 3: former staff, NOT re-added to employees — recorded as subcontractor settlement expenses instead (Subcontracting / Outsourcing).
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '8fb058b9-546b-4b12-9f5f-48d6dbf3c369', '2026-06-30', 'Subcontracting / Outsourcing', 'Boustila Meroua - Freelance Settlement (Jan-Jun 2026)', 141000, NULL, NULL, NULL, NULL, '2026-06-30T11:00:00.000000+00:00', '2026-06-30T11:00:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-30' AND description = 'Boustila Meroua - Freelance Settlement (Jan-Jun 2026)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT 'ba91c167-de48-4773-8842-ebc1f62868ae', '2026-06-30', 'Subcontracting / Outsourcing', 'Rouaa Khababa - Freelance Settlement (Jan-Jun 2026)', 58000, NULL, NULL, NULL, NULL, '2026-06-30T11:01:00.000000+00:00', '2026-06-30T11:01:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-30' AND description = 'Rouaa Khababa - Freelance Settlement (Jan-Jun 2026)');
INSERT INTO expenses (id, expense_date, category, description, amount, payment_method, reference, notes, month_period, created_at, updated_at, project_id, is_recurring, recurrence_interval, supplier_id, company_id)
SELECT '7cd78d63-8f09-4384-9b9a-86700c3bf7e0', '2026-06-30', 'Subcontracting / Outsourcing', 'Aissa Belhaddad - Freelance Settlement (Jan-Jun 2026)', 48000, NULL, NULL, NULL, NULL, '2026-06-30T11:02:00.000000+00:00', '2026-06-30T11:02:00.000000+00:00', NULL, 0, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE expense_date = '2026-06-30' AND description = 'Aissa Belhaddad - Freelance Settlement (Jan-Jun 2026)');
COMMIT;
