-- Targeted, reviewable configuration. Run only with approval for production changes.
-- Does not change Google Sheets, historical alerts, users, permissions or other dashboards.
BEGIN;
DO $$
BEGIN
  IF (SELECT count(*) FROM "Dashboard" WHERE "publicId" = 'fe35d065-aa5a-47d1-9aa8-1ef05f395bf0' AND "template" = 'Summary') <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Airliquide Summary dashboard';
  END IF;
END $$;
UPDATE "Dashboard"
SET "driverRosterSettings" = '{"sheetId":"1lpV3WHzQxWDi9CiF5v38rKULc6THdImKsxgjOSTKQHw","sheetGid":"1146184501","defaultFleet":"SERVICE","namePolicy":"vehicle"}'::jsonb
WHERE "publicId" = 'fe35d065-aa5a-47d1-9aa8-1ef05f395bf0' AND "template" = 'Summary';
COMMIT;
