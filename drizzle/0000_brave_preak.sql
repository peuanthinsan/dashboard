-- pgcrypto for LINE token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

-- LineChannel: many per Organization (fleet); each is one LINE Messaging channel + target group
CREATE TABLE "LineChannel" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
	"name" varchar(64) NOT NULL,
	"accessToken" text NOT NULL,
	"groupId" varchar(64) NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "LineChannel_organizationId_idx" ON "LineChannel" USING btree ("organizationId");
--> statement-breakpoint

-- Dashboard: default LINE channel (drizzle schema does not encode the FK; spec requires it)
ALTER TABLE "Dashboard"
	ADD COLUMN "lineChannelId" integer NULL
		REFERENCES "LineChannel"(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "Dashboard_lineChannelId_idx" ON "Dashboard" USING btree ("lineChannelId");
--> statement-breakpoint

-- DrivingWarning: per-violation-row warning state, idempotent by violationKey
CREATE TABLE "DrivingWarning" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboardId" integer NOT NULL REFERENCES "Dashboard"(id) ON DELETE CASCADE,
	"violationKey" varchar(64) NOT NULL,
	"driverName" varchar(128) NOT NULL,
	"vehicleNo" varchar(64) NOT NULL,
	"eventAt" timestamp with time zone NOT NULL,
	"metric" varchar(16) NOT NULL CHECK ("metric" IN ('drive_hrs','rest_hrs')),
	"threshold" numeric NOT NULL,
	"valueHours" numeric NOT NULL,
	"distanceKm" numeric,
	"loginAt" timestamp with time zone,
	"logoutAt" timestamp with time zone,
	"loginLocation" varchar(256),
	"logoutLocation" varchar(256),
	"lineChannelId" integer REFERENCES "LineChannel"(id) ON DELETE SET NULL,
	"sentByUserId" integer NOT NULL REFERENCES "User"(id),
	"sentAt" timestamp with time zone,
	"lineMessageId" varchar(64),
	"lineStatus" varchar(16) NOT NULL CHECK ("lineStatus" IN ('pending','sent','failed')),
	"errorMessage" text,
	"operatorNote" varchar(500),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "DrivingWarning_dashboard_key_unique" ON "DrivingWarning" USING btree ("dashboardId","violationKey");
--> statement-breakpoint
CREATE INDEX "DrivingWarning_dashboard_sentAt_idx" ON "DrivingWarning" USING btree ("dashboardId","sentAt");
