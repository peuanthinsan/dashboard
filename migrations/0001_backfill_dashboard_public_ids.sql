WITH generated AS (
  SELECT
    id,
    md5(random()::text || clock_timestamp()::text || id::text) AS hex
  FROM "Dashboard"
  WHERE "publicId" IS NULL
)
UPDATE "Dashboard" AS d
SET "publicId" = substr(g.hex, 1, 8)
  || '-' || substr(g.hex, 9, 4)
  || '-' || substr(g.hex, 13, 4)
  || '-' || substr(g.hex, 17, 4)
  || '-' || substr(g.hex, 21, 12)
FROM generated AS g
WHERE d.id = g.id;

ALTER TABLE "Dashboard" ALTER COLUMN "publicId" SET NOT NULL;
