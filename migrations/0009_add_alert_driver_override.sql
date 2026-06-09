-- Manual driver-name overrides for Detail dashboard alert rows (sheet data is read-only).
CREATE TABLE IF NOT EXISTS "AlertDriverOverride" (
  "id" serial PRIMARY KEY NOT NULL,
  "dashboardId" integer NOT NULL REFERENCES "Dashboard"(id) ON DELETE CASCADE,
  "alertKey" varchar(64) NOT NULL,
  "driverName" varchar(128) NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertDriverOverride_dashboard_key_unique"
  ON "AlertDriverOverride" ("dashboardId", "alertKey");
