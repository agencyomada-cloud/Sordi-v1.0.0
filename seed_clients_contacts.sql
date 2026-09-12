-- Sordi seed: client contact details (step 2)
-- Updates existing client rows in place (matched by current name), or
-- inserts them fresh if a row isn't found (e.g. if it was deleted since).
BEGIN TRANSACTION;
UPDATE clients SET name = 'Mobino', phone = '0770311560', city = 'Ain Roua', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:36.439608+00:00' WHERE id = '5b192527-1ba8-4041-b2c3-24090e6a5407';
UPDATE clients SET name = 'Archi Design', phone = '0664484440', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:37.439847+00:00' WHERE id = 'e5fc24b6-a6d7-4099-abb6-390f9542a7c7';
UPDATE clients SET name = 'ETB', phone = '0550088695', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:38.439887+00:00' WHERE id = '8cffb354-02cc-4881-906e-76fe5b505258';
UPDATE clients SET name = 'Ammar Karitha', phone = '0555068605', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:39.439911+00:00' WHERE id = '5d55d53d-0972-45f3-bddc-6e7d7efaa7c6';
UPDATE clients SET name = 'Exosafe', phone = '0550869925', city = 'N''Gaous', wilaya = 'Batna', updated_at = '2026-09-01T23:56:40.439926+00:00' WHERE id = '8fd8e12e-277a-484a-9b3e-ec853d36a268';
UPDATE clients SET name = 'EGAP DZ', phone = '0550017113', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:41.439941+00:00' WHERE id = '5f740672-9066-497e-8430-69169a1bf43e';
UPDATE clients SET name = 'Smati Logistics', phone = '0550849858', city = 'Alger', wilaya = 'Alger', updated_at = '2026-09-01T23:56:42.439957+00:00' WHERE id = '3fee3fb7-13a5-4db6-ab49-822db8511f33';
UPDATE clients SET name = 'Elfarouk Voyages', phone = '0770168660', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:43.439968+00:00' WHERE id = 'f98658ec-f954-41a3-86e7-694153dcef8b';
UPDATE clients SET name = 'Hotel Garden', phone = NULL, city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:44.439979+00:00' WHERE id = 'dba2cc98-0d06-4a71-87c0-0a2780f77723';
UPDATE clients SET name = 'FC Ceram', phone = '0540547477', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:45.439991+00:00' WHERE id = 'e08a46a5-daa5-44e2-9f76-eb1152287173';
UPDATE clients SET name = 'CFCE', phone = '0661121210', city = 'Sétif', wilaya = 'Sétif', updated_at = '2026-09-01T23:56:46.440001+00:00' WHERE id = '81da16c8-035f-404b-94ce-237db6b8e5b3';
COMMIT;
