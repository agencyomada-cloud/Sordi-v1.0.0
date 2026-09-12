-- Sordi migration: former staff archived into employees/payroll_runs
-- (is_active=0) instead of standalone Subcontracting/Outsourcing
-- expenses. Removes the 6 expense rows this replaces (318,000 DZD)
-- and inserts 6 matching paid payroll_runs rows (same total).
PRAGMA foreign_keys = ON;
BEGIN TRANSACTION;

-- 1. Remove the expense rows being replaced (exact description match).
DELETE FROM expenses WHERE description = 'Boustila Meroua - Freelance Settlement (Jan-Jun 2026)' AND category = 'Subcontracting / Outsourcing';
DELETE FROM expenses WHERE description = 'Rouaa Khababa - Freelance Settlement (Jan-Jun 2026)' AND category = 'Subcontracting / Outsourcing';
DELETE FROM expenses WHERE description = 'Aissa Belhaddad - Freelance Settlement (Jan-Jun 2026)' AND category = 'Subcontracting / Outsourcing';
DELETE FROM expenses WHERE description = 'Almass Jabar - Freelance / Subcontracting Settlement' AND category = 'Subcontracting / Outsourcing';
DELETE FROM expenses WHERE description = 'Ikram Guelati - Freelance / Subcontracting Settlement' AND category = 'Subcontracting / Outsourcing';
DELETE FROM expenses WHERE description = 'Ikram Guelati - Freelance / Subcontracting Settlement (July)' AND category = 'Subcontracting / Outsourcing';

-- 2. Re-insert former staff as inactive employees (idempotent by name).
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'b2762803-a343-48b5-ad5b-4babc1ad7a0f', 'Boustila Meroua', NULL, NULL, NULL, NULL, 0, '2026-02-04T09:00:00.000000+00:00', '2026-02-04T09:00:00.000000+00:00', NULL, '2026-02-04', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Boustila Meroua');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'd83f8010-78fb-41c0-a844-269803d19420', 'Rouaa Khababa', NULL, NULL, NULL, NULL, 0, '2026-03-13T09:01:00.000000+00:00', '2026-03-13T09:01:00.000000+00:00', NULL, '2026-03-13', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Rouaa Khababa');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'f8598f5f-f92e-4ff1-b4e7-cdb76c5b7399', 'Aissa Belhaddad', NULL, NULL, NULL, NULL, 0, '2026-05-13T09:02:00.000000+00:00', '2026-05-13T09:02:00.000000+00:00', NULL, '2026-05-13', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Aissa Belhaddad');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'a63daf00-7e53-47d8-ae50-f65246d2d3dd', 'Almass Jabar', NULL, NULL, NULL, NULL, 0, '2026-04-17T09:03:00.000000+00:00', '2026-04-17T09:03:00.000000+00:00', NULL, '2026-04-17', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Almass Jabar');
INSERT INTO employees (id, name, role, email, phone, address, is_active, created_at, updated_at, base_salary, hire_date, contract_type, rib, external_code, photo_path, company_id)
SELECT 'dcb39801-4423-4785-b6d7-0f4d831ea1d5', 'Ikram Guelati', NULL, NULL, NULL, NULL, 0, '2026-02-21T09:04:00.000000+00:00', '2026-02-21T09:04:00.000000+00:00', NULL, '2026-02-21', NULL, NULL, NULL, NULL, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM employees WHERE name = 'Ikram Guelati');

-- 3. Settled payroll_runs for each, paid=1 (idempotent by employee+month).
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT 'eda78eb3-5a2e-4718-aefc-5f52e521e806', (SELECT id FROM employees WHERE name = 'Boustila Meroua'), '2026-06', 141000, 26, 0, 5423.08, 0, 0, 0, 141000, 1, '2026-06-30', '2026-06-30T10:05:00.000000+00:00', '2026-06-30T10:05:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Boustila Meroua') AND month = '2026-06');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '63b7f2d2-1119-41a1-8b2b-418a21a9c3b2', (SELECT id FROM employees WHERE name = 'Rouaa Khababa'), '2026-06', 58000, 26, 0, 2230.77, 0, 0, 0, 58000, 1, '2026-06-30', '2026-06-30T10:06:00.000000+00:00', '2026-06-30T10:06:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Rouaa Khababa') AND month = '2026-06');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '387ed75f-96b2-47c6-81c9-256383762844', (SELECT id FROM employees WHERE name = 'Aissa Belhaddad'), '2026-06', 48000, 26, 0, 1846.15, 0, 0, 0, 48000, 1, '2026-06-30', '2026-06-30T10:07:00.000000+00:00', '2026-06-30T10:07:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Aissa Belhaddad') AND month = '2026-06');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '8bde3775-bf47-4365-8765-3ca0ff09d51b', (SELECT id FROM employees WHERE name = 'Almass Jabar'), '2026-06', 20000, 26, 0, 769.23, 0, 0, 0, 20000, 1, '2026-06-30', '2026-06-30T10:08:00.000000+00:00', '2026-06-30T10:08:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Almass Jabar') AND month = '2026-06');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '98735ca6-79b6-4c1d-9b4a-c85d7c9205c5', (SELECT id FROM employees WHERE name = 'Ikram Guelati'), '2026-06', 15000, 26, 0, 576.92, 0, 0, 0, 15000, 1, '2026-06-30', '2026-06-30T10:09:00.000000+00:00', '2026-06-30T10:09:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Ikram Guelati') AND month = '2026-06');
INSERT INTO payroll_runs (id, employee_id, month, base_salary, working_days_in_month, absence_days, daily_rate, absence_deduction, primes, avance_deduction, net_a_payer, paid, paid_date, created_at, updated_at)
SELECT '7565471d-31c3-4860-90c6-aa3a9025d8a3', (SELECT id FROM employees WHERE name = 'Ikram Guelati'), '2026-07', 36000, 26, 0, 1384.62, 0, 0, 0, 36000, 1, '2026-07-02', '2026-07-02T10:10:00.000000+00:00', '2026-07-02T10:10:00.000000+00:00'
WHERE NOT EXISTS (SELECT 1 FROM payroll_runs WHERE employee_id = (SELECT id FROM employees WHERE name = 'Ikram Guelati') AND month = '2026-07');
COMMIT;
