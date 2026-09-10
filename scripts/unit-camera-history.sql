-- Additive, independently runnable migration. No existing tables or rows change.
CREATE TABLE IF NOT EXISTS "UnitCameraObservation" (
  "sourceKey" varchar(64) NOT NULL,
  "vehicleKey" text NOT NULL,
  "cameraKey" varchar(32) NOT NULL,
  "label" text DEFAULT '' NOT NULL,
  "firstSeen" timestamp with time zone NOT NULL,
  "lastSeen" timestamp with time zone NOT NULL,
  PRIMARY KEY ("sourceKey", "vehicleKey", "cameraKey")
);
