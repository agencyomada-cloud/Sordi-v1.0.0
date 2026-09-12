-- Sordi seed: employees + historical payroll closing (step 6)
-- is_active maps the requested active/inactive status (schema has no
-- separate `status` enum column, just this boolean).
-- Payroll: one closing settlement row per employee, month = 2026-06,
-- paid = 1. Ilhem Achouri has no row (0 DZD paid so far, per spec).
--
-- NOTE: employees.hire_date is derived directly from each person's
-- stated tenure ("worked X months Y days") counted back from the
-- 2026-06-30 period close — there's no free-text notes column on
-- employees or payroll_runs to store that phrase verbatim, so it's
-- encoded as a real date field instead of being dropped.
--
-- NOTE: payroll_runs already has pre-existing rows for Houssem Serai
-- (2026-01, 2026-02 unpaid; 2026-08 paid 40833.33) and Zakaria Reguig
-- (2026-08 paid 20416.67) from earlier real app usage/testing — left
-- untouched. The 402,000 total below covers only the 6 new/updated
-- rows this script adds, not those pre-existing ones.
BEGIN TRANSACTION;
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'b51f4eb7-7c5c-4150-a54e-6e98bd6076e0', 'Boustila Meroua', NULL, NULL, NULL, NULL, 0, '2026-02-04T09:00:00.000000+00:00', '2026-02-04T09:00:00.000000+00:00', NULL, '2026-02-04', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Boustila Meroua');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '8448d22f-e967-4e7e-b223-4ecbf66c9966', (SELECT id FROM employees WHERE name = 'Boustila Meroua'), '2026-06', 141000, 26, 0, 5423.08, 0, 0, 0, 141000, 1, '2026-06-30', '2026-06-30T10:00:00.000000+00:00', '2026-06-30T10:00:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Boustila Meroua') AND month = '2026-06');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT '626224ab-b731-4a0f-a8ba-75dd07076f58', 'Rouaa Khababa', NULL, NULL, NULL, NULL, 0, '2026-03-13T09:01:00.000000+00:00', '2026-03-13T09:01:00.000000+00:00', NULL, '2026-03-13', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Rouaa Khababa');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '2e8fa55a-1be6-473e-9a6f-7ca8e68cd57e', (SELECT id FROM employees WHERE name = 'Rouaa Khababa'), '2026-06', 58000, 26, 0, 2230.77, 0, 0, 0, 58000, 1, '2026-06-30', '2026-06-30T10:01:00.000000+00:00', '2026-06-30T10:01:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Rouaa Khababa') AND month = '2026-06');
UPDATE employees SET is_active = 1, hire_date = COALESCE(NULLIF(hire_date, ''), '2025-12-08'), updated_at = '2026-06-30T09:02:00.000000+00:00' WHERE id = '1a1f053e-3096-40d0-860c-cf099393d1bc';
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '49a7d470-28a6-4c97-a825-5f8de2bb615e', (SELECT id FROM employees WHERE name = 'Houssem Serai'), '2026-06', 120000, 26, 0, 4615.38, 0, 0, 0, 120000, 1, '2026-06-30', '2026-06-30T10:02:00.000000+00:00', '2026-06-30T10:02:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Houssem Serai') AND month = '2026-06');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'bca3187b-d06a-4082-8628-fec80b1c1365', 'Aissa Belhaddad', NULL, NULL, NULL, NULL, 0, '2026-05-13T09:03:00.000000+00:00', '2026-05-13T09:03:00.000000+00:00', NULL, '2026-05-13', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Aissa Belhaddad');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '089f2f4d-610d-406e-90f4-2f1066b3e220', (SELECT id FROM employees WHERE name = 'Aissa Belhaddad'), '2026-06', 48000, 26, 0, 1846.15, 0, 0, 0, 48000, 1, '2026-06-30', '2026-06-30T10:03:00.000000+00:00', '2026-06-30T10:03:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Aissa Belhaddad') AND month = '2026-06');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT '482a2faf-102a-45e7-92ef-2b62ff7c31e6', 'Almass Jabar', NULL, NULL, NULL, NULL, 1, '2026-04-17T09:04:00.000000+00:00', '2026-04-17T09:04:00.000000+00:00', NULL, '2026-04-17', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Almass Jabar');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT 'ea474a01-0ef6-4279-8484-882ae8b85c31', (SELECT id FROM employees WHERE name = 'Almass Jabar'), '2026-06', 20000, 26, 0, 769.23, 0, 0, 0, 20000, 1, '2026-06-30', '2026-06-30T10:04:00.000000+00:00', '2026-06-30T10:04:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Almass Jabar') AND month = '2026-06');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT '54440378-21ff-4c08-af86-04e2705adf8e', 'Ilhem Achouri', NULL, NULL, NULL, NULL, 1, '2026-05-24T09:05:00.000000+00:00', '2026-05-24T09:05:00.000000+00:00', NULL, '2026-05-24', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Ilhem Achouri');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT '2e98c425-9c6f-4e51-bacd-4d25a3d21265', 'Ikram Guelati', NULL, NULL, NULL, NULL, 1, '2026-02-21T09:06:00.000000+00:00', '2026-02-21T09:06:00.000000+00:00', NULL, '2026-02-21', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Ikram Guelati');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT 'c7f1fe68-69f7-4cac-9a0e-d05eaa0b0a3a', (SELECT id FROM employees WHERE name = 'Ikram Guelati'), '2026-06', 15000, 26, 0, 576.92, 0, 0, 0, 15000, 1, '2026-06-30', '2026-06-30T10:06:00.000000+00:00', '2026-06-30T10:06:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Ikram Guelati') AND month = '2026-06');
COMMIT;
