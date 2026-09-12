-- Sordi seed: clients (step 1)
-- Generated seed script; idempotent by client name (safe to re-run).
BEGIN TRANSACTION;
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '5b192527-1ba8-4041-b2c3-24090e6a5407', NULL, 'Mobino', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:18.496270+00:00', '2026-09-01T23:43:18.496270+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Mobino');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT 'e5fc24b6-a6d7-4099-abb6-390f9542a7c7', NULL, 'Archi Design', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:19.496404+00:00', '2026-09-01T23:43:19.496404+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Archi Design');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '8cffb354-02cc-4881-906e-76fe5b505258', NULL, 'ETB', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:20.496417+00:00', '2026-09-01T23:43:20.496417+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'ETB');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '5d55d53d-0972-45f3-bddc-6e7d7efaa7c6', NULL, 'Ammar Karitha', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:21.496426+00:00', '2026-09-01T23:43:21.496426+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Ammar Karitha');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '8fd8e12e-277a-484a-9b3e-ec853d36a268', NULL, 'Exosafe', NULL, NULL, NULL, NULL, 'Batna', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:22.496435+00:00', '2026-09-01T23:43:22.496435+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Exosafe');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '5f740672-9066-497e-8430-69169a1bf43e', NULL, 'EGAP DZ', NULL, NULL, NULL, NULL, 'Setif', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:23.496444+00:00', '2026-09-01T23:43:23.496444+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'EGAP DZ');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '3fee3fb7-13a5-4db6-ab49-822db8511f33', NULL, 'Smati Logistics', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:24.496451+00:00', '2026-09-01T23:43:24.496451+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Smati Logistics');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT 'f98658ec-f954-41a3-86e7-694153dcef8b', NULL, 'Elfarouk Voyage', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:25.496459+00:00', '2026-09-01T23:43:25.496459+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Elfarouk Voyage');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT 'dba2cc98-0d06-4a71-87c0-0a2780f77723', NULL, 'Hotel Garden', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:26.496467+00:00', '2026-09-01T23:43:26.496467+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'Hotel Garden');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT 'e08a46a5-daa5-44e2-9f76-eb1152287173', NULL, 'FC Ceram', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:27.496474+00:00', '2026-09-01T23:43:27.496474+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'FC Ceram');
INSERT INTO clients (id, code, name, contact_person, phone, email, address, city, wilaya, nif, nis, rc, secondary_rc, secondary_address, ai, activite, credit_limit, payment_terms_days, notes, is_active, created_at, updated_at, initial_balance, advance_payment, company_id)
SELECT '81da16c8-035f-404b-94ce-237db6b8e5b3', NULL, 'CFCE', NULL, NULL, NULL, NULL, 'Setif', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-09-01T23:43:28.496494+00:00', '2026-09-01T23:43:28.496494+00:00', 0, 0, 'a20c6ef4-0d61-4b1e-bf99-d2db39917096'
WHERE NOT EXISTS (SELECT 1 FROM clients WHERE name = 'CFCE');
COMMIT;
